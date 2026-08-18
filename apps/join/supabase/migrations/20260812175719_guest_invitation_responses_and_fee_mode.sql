-- Wave 01: a shared private-event invitation URL can collect anonymous
-- attendance responses. This is deliberately separate from registrations:
-- registrations remain account-based, while this small response layer is for
-- a host's real-world guest list and does not create member accounts.

alter table public.events
  add column fee_mode text not null default 'free';

alter table public.events
  add constraint event_fee_mode_valid
  check (fee_mode in ('free', 'fixed', 'on_site_split'));

grant select (fee_mode) on public.events to anon, authenticated;
grant insert (fee_mode) on public.events to authenticated;
grant update (fee_mode) on public.events to authenticated;

comment on column public.events.fee_mode is
  'Display/payment semantics: free, fixed, or on_site_split. The platform does not collect on-site split payments.';

create table public.event_invitation_targets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  display_name text not null,
  display_name_normalized text generated always as (lower(btrim(display_name))) stored,
  response text not null default 'pending',
  guest_key_hash text,
  responded_at timestamptz,
  created_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,
  constraint invitation_target_name_nonblank check (btrim(display_name) <> ''),
  constraint invitation_target_response_valid check (response in ('pending', 'attending', 'declined')),
  constraint invitation_target_response_time check (
    (response = 'pending' and responded_at is null)
    or (response <> 'pending' and responded_at is not null)
  )
);

create unique index event_invitation_targets_active_name_idx
  on public.event_invitation_targets (event_id, display_name_normalized)
  where revoked_at is null;

create unique index event_invitation_targets_guest_key_idx
  on public.event_invitation_targets (event_id, guest_key_hash)
  where revoked_at is null and guest_key_hash is not null;

create index event_invitation_targets_event_status_idx
  on public.event_invitation_targets (event_id, response, created_at)
  where revoked_at is null;

alter table public.event_invitation_targets enable row level security;

create policy event_invitation_targets_select_admin
  on public.event_invitation_targets
  for select to authenticated
  using (public.is_organizer_admin(public.event_organizer_id(event_id)));

grant select (
  id, event_id, display_name, response, responded_at,
  created_by_user_id, created_at, updated_at, revoked_at
) on public.event_invitation_targets to authenticated;

-- ---------------------------------------------------------------------------
-- Organizer-side target management
-- ---------------------------------------------------------------------------

create function public.organizer_add_event_invitation_target(
  p_event_id uuid,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_display_name, ''));
  v_existing_id uuid;
  v_target_id uuid;
begin
  if not public.is_organizer_admin(public.event_organizer_id(p_event_id), v_actor_user_id) then
    raise exception 'only an owner or admin may manage invitation targets' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'display name is required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.status = 'published'
      and e.visibility = 'private' and e.invite_only
  ) then
    raise exception 'shared guest invitations require a published private invite-only event'
      using errcode = '42501';
  end if;

  select id into v_existing_id
  from public.event_invitation_targets
  where event_id = p_event_id
    and display_name_normalized = lower(v_name)
    and revoked_at is null
  for update;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  insert into public.event_invitation_targets (
    event_id, display_name, response, created_by_user_id
  ) values (
    p_event_id, v_name, 'pending', v_actor_user_id
  ) returning id into v_target_id;

  insert into public.audit_logs (actor_user_id, event_id, action, after_state)
  values (
    v_actor_user_id, p_event_id, 'event_invitation.target_added',
    jsonb_build_object('target_id', v_target_id, 'display_name', v_name)
  );

  return v_target_id;
end;
$$;

create function public.organizer_remove_event_invitation_target(
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_target public.event_invitation_targets%rowtype;
begin
  select * into v_target
  from public.event_invitation_targets
  where id = p_target_id and revoked_at is null
  for update;
  if not found then
    raise exception 'invitation target not found' using errcode = 'P0002';
  end if;
  if not public.is_organizer_admin(public.event_organizer_id(v_target.event_id), v_actor_user_id) then
    raise exception 'only an owner or admin may manage invitation targets' using errcode = '42501';
  end if;

  update public.event_invitation_targets
  set revoked_at = statement_timestamp(), updated_at = statement_timestamp()
  where id = p_target_id;

  insert into public.audit_logs (actor_user_id, event_id, action, before_state)
  values (
    v_actor_user_id, v_target.event_id, 'event_invitation.target_removed',
    jsonb_build_object('target_id', p_target_id, 'display_name', v_target.display_name)
  );
end;
$$;

grant execute on function public.organizer_add_event_invitation_target(uuid, text) to authenticated;
grant execute on function public.organizer_remove_event_invitation_target(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Anonymous shared-link read / response
-- ---------------------------------------------------------------------------

create function public.get_event_invitation_by_slug(
  p_slug text,
  p_guest_key text default null
)
returns jsonb
language plpgsql
security definer
stable
set search_path = pg_catalog, public, extensions
as $$
declare
  v_event public.events%rowtype;
  v_organizer_name text;
  v_guest_key_hash text;
  v_current_target public.event_invitation_targets%rowtype;
  v_registration_count integer;
  v_guest_count integer;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{2,95}$' then
    return null;
  end if;

  select * into v_event
  from public.events
  where slug = p_slug
    and status = 'published'
    and visibility = 'private'
    and invite_only
  limit 1;
  if not found then
    return null;
  end if;

  select display_name into v_organizer_name
  from public.organizers
  where id = v_event.organizer_id;

  if nullif(btrim(coalesce(p_guest_key, '')), '') is not null then
    v_guest_key_hash := public.hash_invitee_key(p_guest_key);
    select * into v_current_target
    from public.event_invitation_targets
    where event_id = v_event.id
      and guest_key_hash = v_guest_key_hash
      and revoked_at is null;
  end if;

  select coalesce(sum(seats), 0)::integer into v_registration_count
  from public.registrations
  where event_id = v_event.id
    and status in ('offered', 'pending_organizer_confirmation', 'confirmed');

  select count(*)::integer into v_guest_count
  from public.event_invitation_targets
  where event_id = v_event.id
    and response = 'attending'
    and revoked_at is null;

  return jsonb_build_object(
    'id', v_event.id,
    'organizer_id', v_event.organizer_id,
    'created_by_user_id', v_event.created_by_user_id,
    'slug', v_event.slug,
    'title', v_event.title,
    'summary', v_event.summary,
    'description', v_event.description,
    'status', v_event.status,
    'visibility', v_event.visibility,
    'confirmation_mode', v_event.confirmation_mode,
    'timezone', v_event.timezone,
    'starts_at', v_event.starts_at,
    'ends_at', v_event.ends_at,
    'registration_opens_at', v_event.registration_opens_at,
    'registration_closes_at', v_event.registration_closes_at,
    'location_name', v_event.location_name,
    'location_address', v_event.location_address,
    'capacity', v_event.capacity,
    'fee_amount', v_event.fee_amount,
    'fee_mode', v_event.fee_mode,
    'fee_currency', v_event.fee_currency,
    'payment_instructions', v_event.payment_instructions,
    'roster_visibility', v_event.roster_visibility,
    'roster_show_capacity', v_event.roster_show_capacity,
    'invite_only', v_event.invite_only,
    'min_age', v_event.min_age,
    'invite_reserved_seats', v_event.invite_reserved_seats,
    'invite_pool_deadline', v_event.invite_pool_deadline,
    'invite_pool_released_at', v_event.invite_pool_released_at,
    'gathering_type', v_event.gathering_type,
    'cover_image_url', v_event.cover_image_url,
    'updated_at', v_event.updated_at,
    'organizer_display_name', v_organizer_name,
    'attending_count', v_registration_count + v_guest_count,
    'guest_response', case when v_current_target.id is null then null else v_current_target.response end,
    'guest_display_name', case when v_current_target.id is null then null else v_current_target.display_name end
  );
end;
$$;

create function public.respond_to_event_invitation(
  p_slug text,
  p_guest_key text,
  p_display_name text,
  p_response text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_event public.events%rowtype;
  v_guest_key_hash text;
  v_name text := btrim(coalesce(p_display_name, ''));
  v_response text := lower(btrim(coalesce(p_response, '')));
  v_target public.event_invitation_targets%rowtype;
  v_name_target public.event_invitation_targets%rowtype;
  v_registration_count integer;
  v_guest_count integer;
  v_attending_count integer;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{2,95}$' then
    raise exception 'invalid event link' using errcode = '22023';
  end if;
  if p_guest_key is null or length(btrim(p_guest_key)) < 16 then
    raise exception 'guest key is required' using errcode = '22023';
  end if;
  if length(v_name) < 1 or length(v_name) > 80 then
    raise exception 'display name must be 1 to 80 characters' using errcode = '22023';
  end if;
  if v_response not in ('attending', 'declined') then
    raise exception 'response must be attending or declined' using errcode = '22023';
  end if;

  select * into v_event
  from public.events
  where slug = p_slug
    and status = 'published'
    and visibility = 'private'
    and invite_only
  for update;
  if not found then
    raise exception 'invitation event not found' using errcode = 'P0002';
  end if;

  v_guest_key_hash := public.hash_invitee_key(p_guest_key);
  select * into v_target
  from public.event_invitation_targets
  where event_id = v_event.id
    and guest_key_hash = v_guest_key_hash
    and revoked_at is null
  for update;

  if not found then
    select * into v_name_target
    from public.event_invitation_targets
    where event_id = v_event.id
      and display_name_normalized = lower(v_name)
      and revoked_at is null
    for update;
    if found then
      v_target := v_name_target;
    end if;
  end if;

  if v_target.id is null then
    if v_response = 'attending' then
      select coalesce(sum(seats), 0)::integer into v_registration_count
      from public.registrations
      where event_id = v_event.id
        and status in ('offered', 'pending_organizer_confirmation', 'confirmed');
      select count(*)::integer into v_guest_count
      from public.event_invitation_targets
      where event_id = v_event.id
        and response = 'attending'
        and revoked_at is null;
      if v_event.capacity is not null and v_registration_count + v_guest_count >= v_event.capacity then
        raise exception '這場聚會已額滿' using errcode = '53300';
      end if;
    end if;
    insert into public.event_invitation_targets (
      event_id, display_name, response, guest_key_hash, responded_at
    ) values (
      v_event.id, v_name, v_response, v_guest_key_hash, statement_timestamp()
    ) returning * into v_target;
  else
    if v_target.display_name_normalized <> lower(v_name)
      and exists (
        select 1 from public.event_invitation_targets other
        where other.event_id = v_event.id
          and other.display_name_normalized = lower(v_name)
          and other.revoked_at is null
          and other.id <> v_target.id
      )
    then
      raise exception '這個姓名已經有另一筆回覆，請換一個顯示名稱' using errcode = '23505';
    end if;

    if v_response = 'attending' and v_target.response <> 'attending' then
      select coalesce(sum(seats), 0)::integer into v_registration_count
      from public.registrations
      where event_id = v_event.id
        and status in ('offered', 'pending_organizer_confirmation', 'confirmed');
      select count(*)::integer into v_guest_count
      from public.event_invitation_targets
      where event_id = v_event.id
        and response = 'attending'
        and revoked_at is null
        and id <> v_target.id;
      if v_event.capacity is not null and v_registration_count + v_guest_count >= v_event.capacity then
        raise exception '這場聚會已額滿' using errcode = '53300';
      end if;
    end if;

    update public.event_invitation_targets
    set display_name = v_name,
        response = v_response,
        guest_key_hash = v_guest_key_hash,
        responded_at = statement_timestamp(),
        updated_at = statement_timestamp()
    where id = v_target.id
    returning * into v_target;
  end if;

  if v_response = 'attending' and v_target.response = 'attending'
    and v_target.id is not null
  then
    select coalesce(sum(seats), 0)::integer into v_registration_count
    from public.registrations
    where event_id = v_event.id
      and status in ('offered', 'pending_organizer_confirmation', 'confirmed');
    select count(*)::integer into v_guest_count
    from public.event_invitation_targets
    where event_id = v_event.id
      and response = 'attending'
      and revoked_at is null;
    v_attending_count := v_registration_count + v_guest_count;
    if v_event.capacity is not null and v_attending_count > v_event.capacity then
      raise exception '這場聚會已額滿' using errcode = '53300';
    end if;
  else
    select coalesce(sum(seats), 0)::integer into v_registration_count
    from public.registrations
    where event_id = v_event.id
      and status in ('offered', 'pending_organizer_confirmation', 'confirmed');
    select count(*)::integer into v_guest_count
    from public.event_invitation_targets
    where event_id = v_event.id
      and response = 'attending'
      and revoked_at is null;
    v_attending_count := v_registration_count + v_guest_count;
  end if;

  insert into public.audit_logs (event_id, action, after_state)
  values (
    v_event.id, 'event_invitation.response_submitted',
    jsonb_build_object('target_id', v_target.id, 'display_name', v_target.display_name, 'response', v_target.response)
  );

  return jsonb_build_object(
    'id', v_target.id,
    'display_name', v_target.display_name,
    'response', v_target.response,
    'attending_count', v_attending_count,
    'capacity', v_event.capacity
  );
end;
$$;

grant execute on function public.get_event_invitation_by_slug(text, text) to anon, authenticated;
grant execute on function public.respond_to_event_invitation(text, text, text, text) to anon, authenticated;
