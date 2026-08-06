-- Post-P1-10 scope addition: organizer-managed manual roster. The user
-- explicitly asked for this after reviewing the self-service-only build —
-- some participants won't register themselves, so the organizer needs to
-- be able to add/edit/remove entries directly.
--
-- Design: registrations.user_id becomes nullable. A row is either
-- "self-registered" (user_id set, manual_* columns null) or "manually
-- added" (user_id null, manual_display_name + added_by_user_id set) —
-- never a mix, enforced by a CHECK constraint. This is intentionally a
-- separate RPC family from register_for_event/cancel_registration rather
-- than retrofitting nullable-user_id handling into the already-shipped,
-- concurrency-tested seat-engine RPCs — safer than risking a regression in
-- code that already passed real deadlock/oversell testing (P1-06/P1-08).
--
-- Manual entries bypass capacity/pool accounting entirely (organizer
-- discretion over their own roster, matching how this backlog already
-- treats other organizer-judgment-call cases) and never enter the
-- outbox/notification pipeline (no account to notify).

alter table public.registrations alter column user_id drop not null;
alter table public.registrations add column manual_display_name text;
alter table public.registrations add column manual_contact text;
alter table public.registrations add column added_by_user_id uuid references public.users (id) on delete set null;

alter table public.registrations add constraint registration_identity_shape check (
  (
    user_id is not null
    and manual_display_name is null
    and manual_contact is null
    and added_by_user_id is null
  )
  or (
    user_id is null
    and btrim(coalesce(manual_display_name, '')) <> ''
    and added_by_user_id is not null
  )
);

-- ---------------------------------------------------------------------------
-- organizer_add_manual_participant
-- ---------------------------------------------------------------------------

create function public.organizer_add_manual_participant(
  p_event_id uuid,
  p_display_name text,
  p_contact text default null,
  p_status public.registration_status default 'confirmed'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  new_registration_id uuid;
  new_transition_version bigint := 1;
begin
  if not public.is_organizer_admin(public.event_organizer_id(p_event_id), v_actor_user_id) then
    raise exception 'only an owner or admin may manage the participant roster' using errcode = '42501';
  end if;
  if btrim(coalesce(p_display_name, '')) = '' then
    raise exception 'display name is required' using errcode = '22023';
  end if;
  if p_status not in ('confirmed', 'waitlisted', 'pending_organizer_confirmation') then
    raise exception 'invalid initial status for a manual participant' using errcode = '22023';
  end if;

  insert into public.registrations (
    event_id, user_id, status, seats, seat_pool,
    manual_display_name, manual_contact, added_by_user_id,
    display_name_snapshot, waitlisted_at
  ) values (
    p_event_id, null, p_status, 1, 'public',
    btrim(p_display_name), nullif(btrim(coalesce(p_contact, '')), ''), v_actor_user_id,
    btrim(p_display_name),
    case when p_status = 'waitlisted' then statement_timestamp() else null end
  )
  returning id into new_registration_id;

  insert into public.audit_logs (
    actor_user_id, event_id, registration_id, action, after_state
  ) values (
    v_actor_user_id, p_event_id, new_registration_id, 'registration.manual_added',
    jsonb_build_object('display_name', p_display_name, 'status', p_status)
  );

  return new_registration_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- organizer_edit_manual_participant
-- ---------------------------------------------------------------------------

create function public.organizer_edit_manual_participant(
  p_registration_id uuid,
  p_display_name text default null,
  p_contact text default null,
  p_status public.registration_status default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  reg public.registrations%rowtype;
begin
  select * into reg from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'registration not found' using errcode = 'P0002';
  end if;
  if reg.user_id is not null then
    raise exception 'this registration is self-managed, not a manual entry' using errcode = '42501';
  end if;
  if not public.is_organizer_admin(public.event_organizer_id(reg.event_id), v_actor_user_id) then
    raise exception 'only an owner or admin may manage the participant roster' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in
    ('confirmed', 'waitlisted', 'pending_organizer_confirmation', 'cancelled', 'removed_by_organizer')
  then
    raise exception 'invalid status for a manual participant' using errcode = '22023';
  end if;

  update public.registrations
  set manual_display_name = coalesce(nullif(btrim(p_display_name), ''), manual_display_name),
      display_name_snapshot = coalesce(nullif(btrim(p_display_name), ''), display_name_snapshot),
      manual_contact = case
        when p_contact is null then manual_contact
        else nullif(btrim(p_contact), '')
      end,
      status = coalesce(p_status, status),
      waitlisted_at = case
        when p_status = 'waitlisted' and status <> 'waitlisted' then statement_timestamp()
        when p_status is not null and p_status <> 'waitlisted' then null
        else waitlisted_at
      end,
      transition_version = transition_version + 1,
      updated_at = statement_timestamp()
  where id = p_registration_id;

  insert into public.audit_logs (
    actor_user_id, event_id, registration_id, action, before_state, after_state
  ) values (
    v_actor_user_id, reg.event_id, p_registration_id, 'registration.manual_edited',
    jsonb_build_object('display_name', reg.manual_display_name, 'status', reg.status),
    jsonb_build_object('display_name', coalesce(p_display_name, reg.manual_display_name), 'status', coalesce(p_status, reg.status))
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- organizer_remove_manual_participant
-- ---------------------------------------------------------------------------

create function public.organizer_remove_manual_participant(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  reg public.registrations%rowtype;
begin
  select * into reg from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'registration not found' using errcode = 'P0002';
  end if;
  if reg.user_id is not null then
    raise exception 'this registration is self-managed, not a manual entry' using errcode = '42501';
  end if;
  if not public.is_organizer_admin(public.event_organizer_id(reg.event_id), v_actor_user_id) then
    raise exception 'only an owner or admin may manage the participant roster' using errcode = '42501';
  end if;

  update public.registrations
  set status = 'removed_by_organizer', transition_version = transition_version + 1,
      updated_at = statement_timestamp()
  where id = p_registration_id;

  insert into public.audit_logs (
    actor_user_id, event_id, registration_id, action, before_state, after_state
  ) values (
    v_actor_user_id, reg.event_id, p_registration_id, 'registration.manual_removed',
    jsonb_build_object('status', reg.status), jsonb_build_object('status', 'removed_by_organizer')
  );
end;
$$;

revoke all on function public.organizer_add_manual_participant(uuid, text, text, public.registration_status)
  from public, anon, authenticated;
revoke all on function public.organizer_edit_manual_participant(uuid, text, text, public.registration_status)
  from public, anon, authenticated;
revoke all on function public.organizer_remove_manual_participant(uuid) from public, anon, authenticated;
grant execute on function public.organizer_add_manual_participant(uuid, text, text, public.registration_status)
  to authenticated;
grant execute on function public.organizer_edit_manual_participant(uuid, text, text, public.registration_status)
  to authenticated;
grant execute on function public.organizer_remove_manual_participant(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Column grants: registrations.manual_display_name / manual_contact /
-- added_by_user_id need to be selectable (organizer roster view). No new
-- INSERT/UPDATE grant on the table itself — only the RPCs above write it.
-- ---------------------------------------------------------------------------

grant select (manual_display_name, manual_contact, added_by_user_id) on public.registrations to authenticated;
