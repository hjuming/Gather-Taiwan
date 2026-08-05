-- P1-06 / P1-08: single seat-engine RPC family. All registration state
-- transitions (register, cancel, offer accept/decline, organizer
-- confirm/decline/remove, block) go through these security-definer
-- functions; App role has zero direct write grant on registrations
-- (unchanged from P1-04). Every function's first step locks the event row,
-- sweeps expired offers, and lazily releases the invite pool past its
-- deadline, per the Master Backlog's canonical architecture contract.
--
-- Scope decisions (documented in docs/evidence/p1-06-08-green.md):
-- - seats is hardcoded to 1 for every registration (Master Backlog "seats=1
--   MVP 合約"); multi-seat companions are P3-04, out of scope here.
-- - offer window is a fixed 24 hours; making it event-configurable is a
--   later enhancement, not required by the P1-06/P1-08 acceptance criteria.
-- - organizer-facing notifications (e.g. "you have a pending registration
--   to review") are out of scope; outbox rows are written for the
--   registrant only. Organizer notification fan-out is P1-15 territory.
-- - invite_only permanently gates who may call register_for_event,
--   independent of whether the invite/public pool has since merged; pool
--   release only changes seat *counting*, not registration *eligibility*.

-- ---------------------------------------------------------------------------
-- Guard: capacity / invite_reserved_seats may never drop below seats
-- currently held (offered + pending_organizer_confirmation + confirmed).
-- ---------------------------------------------------------------------------

create function public.guard_event_capacity_decrease()
returns trigger
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
declare
  held_total integer;
  held_invite integer;
begin
  if new.capacity is distinct from old.capacity
    or new.invite_reserved_seats is distinct from old.invite_reserved_seats
  then
    select count(*) into held_total
    from public.registrations
    where event_id = old.id
      and status in ('offered', 'pending_organizer_confirmation', 'confirmed');

    if new.capacity is not null and new.capacity < held_total then
      raise exception 'capacity cannot drop below % seats already held', held_total
        using errcode = '23514';
    end if;

    if new.invite_reserved_seats is distinct from old.invite_reserved_seats
      and new.invite_reserved_seats is not null
    then
      select count(*) into held_invite
      from public.registrations
      where event_id = old.id
        and seat_pool = 'invite'
        and status in ('offered', 'pending_organizer_confirmation', 'confirmed');

      if new.invite_reserved_seats < held_invite then
        raise exception 'invite_reserved_seats cannot drop below % seats already held', held_invite
          using errcode = '23514';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_event_capacity_decrease() from public, anon, authenticated;

create trigger guard_event_capacity_decrease_before_update
before update on public.events
for each row execute function public.guard_event_capacity_decrease();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.is_event_invitee(
  p_event_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select p_user_id is not null and exists (
    select 1
    from public.event_invitees ei
    where ei.event_id = p_event_id
      and ei.claimed_by_user_id = p_user_id
      and ei.revoked_at is null
  )
$$;

revoke all on function public.is_event_invitee(uuid, uuid) from public, anon, authenticated;
grant execute on function public.is_event_invitee(uuid, uuid) to authenticated;

create function public.emit_registration_event(
  p_registration_id uuid,
  p_event_id uuid,
  p_recipient_user_id uuid,
  p_transition_version bigint,
  p_notification_kind text,
  p_actor_user_id uuid,
  p_action text,
  p_before jsonb,
  p_after jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  insert into public.outbox_events (
    event_id, registration_id, recipient_user_id, transition_version,
    notification_kind
  ) values (
    p_event_id, p_registration_id, p_recipient_user_id, p_transition_version,
    p_notification_kind
  )
  on conflict (registration_id, transition_version, notification_kind) do nothing;

  insert into public.audit_logs (
    actor_user_id, event_id, registration_id, action, before_state, after_state
  ) values (
    p_actor_user_id, p_event_id, p_registration_id, p_action, p_before, p_after
  );
end;
$$;

revoke all on function public.emit_registration_event(
  uuid, uuid, uuid, bigint, text, uuid, text, jsonb, jsonb
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal: expire stale offers, release invite pool. Caller must already
-- hold the event row lock (select ... for update).
-- ---------------------------------------------------------------------------

create function public.sweep_event_locked(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  expired record;
begin
  for expired in
    select id, seat_pool, transition_version, user_id
    from public.registrations
    where event_id = p_event_id
      and status = 'offered'
      and offer_expires_at < statement_timestamp()
    for update
  loop
    update public.registrations
    set status = 'offer_expired', transition_version = transition_version + 1,
        updated_at = statement_timestamp()
    where id = expired.id;

    perform public.emit_registration_event(
      expired.id, p_event_id, expired.user_id, expired.transition_version + 1,
      'registration.offer_expired', null, 'registration.offer_expired',
      jsonb_build_object('status', 'offered'),
      jsonb_build_object('status', 'offer_expired')
    );

    perform public.promote_next_waitlisted_locked(p_event_id, expired.seat_pool);
  end loop;

  update public.events
  set invite_pool_released_at = statement_timestamp()
  where id = p_event_id
    and invite_pool_deadline is not null
    and invite_pool_deadline < statement_timestamp()
    and invite_pool_released_at is null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Internal: promote the next waitlisted registration in the freed pool (or,
-- once pools have merged, across both pools ordered by (waitlisted_at, id)).
-- ---------------------------------------------------------------------------

create function public.promote_next_waitlisted_locked(
  p_event_id uuid,
  p_freed_pool public.seat_pool
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  next_reg record;
  pool_merged boolean;
begin
  select invite_pool_released_at is not null into pool_merged
  from public.events where id = p_event_id;

  select id, user_id, transition_version into next_reg
  from public.registrations
  where event_id = p_event_id
    and status = 'waitlisted'
    and (pool_merged or seat_pool = p_freed_pool)
  order by waitlisted_at, id
  limit 1
  for update;

  if not found then
    return;
  end if;

  update public.registrations
  set status = 'offered', offered_at = statement_timestamp(),
      offer_expires_at = statement_timestamp() + interval '24 hours',
      transition_version = transition_version + 1, updated_at = statement_timestamp()
  where id = next_reg.id;

  perform public.emit_registration_event(
    next_reg.id, p_event_id, next_reg.user_id, next_reg.transition_version + 1,
    'registration.offered', null, 'registration.offered',
    jsonb_build_object('status', 'waitlisted'),
    jsonb_build_object('status', 'offered')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- register_for_event: the only way seats get taken.
-- ---------------------------------------------------------------------------

create function public.register_for_event(
  p_event_id uuid,
  p_idempotency_key text,
  p_answers jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_key_hash text;
  v_fingerprint text;
  existing record;
  event_row public.events%rowtype;
  target_pool public.seat_pool;
  held_count integer;
  effective_capacity integer;
  new_status public.registration_status;
  new_registration_id uuid;
  new_transition_version bigint := 1;
  field_key text;
begin
  if v_actor_user_id is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  v_key_hash := encode(digest(p_idempotency_key, 'sha256'), 'hex');
  v_fingerprint := encode(digest(p_event_id::text || '|' || coalesce(p_answers::text, ''), 'sha256'), 'hex');

  select * into existing
  from public.idempotency_requests
  where idempotency_requests.actor_user_id = v_actor_user_id
    and operation = 'register_for_event'
    and idempotency_requests.key_hash = v_key_hash
  for update;

  if found then
    if existing.request_fingerprint <> v_fingerprint then
      raise exception 'idempotency key reused with a different request' using errcode = '23505';
    end if;
    if existing.completed_at is not null then
      return existing.result_registration_id;
    end if;
    raise exception 'a request with this idempotency key is already in progress' using errcode = '55P03';
  end if;

  insert into public.idempotency_requests (
    actor_user_id, operation, key_hash, event_id, request_fingerprint
  ) values (
    v_actor_user_id, 'register_for_event', v_key_hash, p_event_id, v_fingerprint
  );

  select * into event_row from public.events where id = p_event_id for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  perform public.sweep_event_locked(p_event_id);
  select * into event_row from public.events where id = p_event_id;

  if not public.event_registration_is_open(p_event_id) then
    raise exception 'registration is not open for this event' using errcode = '55000';
  end if;

  if event_row.invite_only and not public.is_event_invitee(p_event_id, v_actor_user_id) then
    raise exception 'this event requires an invitation' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.event_blocklist
    where event_id = p_event_id and user_id = v_actor_user_id
  ) then
    raise exception 'registration is not available' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.registrations
    where event_id = p_event_id and user_id = v_actor_user_id
      and status in ('offered', 'pending_organizer_confirmation', 'confirmed', 'waitlisted')
  ) then
    raise exception 'an active registration already exists' using errcode = '23505';
  end if;

  if event_row.capacity is null then
    target_pool := 'public';
    effective_capacity := null;
  elsif event_row.invite_pool_released_at is null and event_row.invite_reserved_seats is not null then
    if public.is_event_invitee(p_event_id, v_actor_user_id) then
      target_pool := 'invite';
      effective_capacity := event_row.invite_reserved_seats;
    else
      target_pool := 'public';
      effective_capacity := event_row.capacity - event_row.invite_reserved_seats;
    end if;
  else
    target_pool := 'public';
    effective_capacity := event_row.capacity;
  end if;

  if effective_capacity is null then
    new_status := case event_row.confirmation_mode
      when 'instant' then 'confirmed'
      else 'pending_organizer_confirmation'
    end;
  else
    if event_row.capacity is not null
      and event_row.invite_pool_released_at is not null
      and event_row.invite_reserved_seats is not null
    then
      select count(*) into held_count
      from public.registrations
      where event_id = p_event_id
        and status in ('offered', 'pending_organizer_confirmation', 'confirmed');
    else
      select count(*) into held_count
      from public.registrations
      where event_id = p_event_id
        and seat_pool = target_pool
        and status in ('offered', 'pending_organizer_confirmation', 'confirmed');
    end if;

    if held_count < effective_capacity then
      new_status := case event_row.confirmation_mode
        when 'instant' then 'confirmed'
        else 'pending_organizer_confirmation'
      end;
    else
      new_status := 'waitlisted';
    end if;
  end if;

  insert into public.registrations (
    event_id, user_id, status, seats, seat_pool, waitlisted_at,
    display_name_snapshot, public_bio_snapshot
  )
  select
    p_event_id, v_actor_user_id, new_status, 1, target_pool,
    case when new_status = 'waitlisted' then statement_timestamp() else null end,
    u.display_name, u.public_bio
  from public.users u where u.id = v_actor_user_id
  returning id into new_registration_id;

  if p_answers is not null and p_answers <> '{}'::jsonb then
    for field_key in select jsonb_object_keys(p_answers)
    loop
      insert into public.registration_answers (registration_id, event_field_id, answer_value)
      select new_registration_id, ef.id, p_answers -> field_key
      from public.event_fields ef
      where ef.event_id = p_event_id and ef.field_key = field_key;
    end loop;

    if exists (
      select 1 from public.event_fields ef
      where ef.event_id = p_event_id and ef.is_required
        and not exists (
          select 1 from public.registration_answers ra
          where ra.registration_id = new_registration_id and ra.event_field_id = ef.id
        )
    ) then
      raise exception 'a required field is missing an answer' using errcode = '22023';
    end if;
  elsif exists (select 1 from public.event_fields where event_id = p_event_id and is_required) then
    raise exception 'a required field is missing an answer' using errcode = '22023';
  end if;

  perform public.emit_registration_event(
    new_registration_id, p_event_id, v_actor_user_id, new_transition_version,
    'registration.' || new_status::text, v_actor_user_id, 'registration.created',
    '{}'::jsonb, jsonb_build_object('status', new_status)
  );

  update public.idempotency_requests
  set result_registration_id = new_registration_id, response_status = 201,
      response_body = jsonb_build_object('registration_id', new_registration_id, 'status', new_status),
      completed_at = statement_timestamp()
  where idempotency_requests.actor_user_id = v_actor_user_id
    and operation = 'register_for_event'
    and idempotency_requests.key_hash = v_key_hash;

  return new_registration_id;
end;
$$;

revoke all on function public.register_for_event(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.register_for_event(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_registration: participant cancels their own active registration.
-- ---------------------------------------------------------------------------

create function public.cancel_registration(
  p_registration_id uuid,
  p_idempotency_key text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_key_hash text;
  v_fingerprint text;
  existing record;
  reg public.registrations%rowtype;
  event_row public.events%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  v_key_hash := encode(digest(p_idempotency_key, 'sha256'), 'hex');
  v_fingerprint := encode(digest(p_registration_id::text, 'sha256'), 'hex');

  select * into existing
  from public.idempotency_requests
  where idempotency_requests.actor_user_id = v_actor_user_id
    and operation = 'cancel_registration'
    and idempotency_requests.key_hash = v_key_hash
  for update;

  if found then
    if existing.request_fingerprint <> v_fingerprint then
      raise exception 'idempotency key reused with a different request' using errcode = '23505';
    end if;
    if existing.completed_at is not null then
      return;
    end if;
    raise exception 'a request with this idempotency key is already in progress' using errcode = '55P03';
  end if;

  insert into public.idempotency_requests (
    actor_user_id, operation, key_hash, event_id, request_fingerprint
  )
  select v_actor_user_id, 'cancel_registration', v_key_hash, event_id, v_fingerprint
  from public.registrations where id = p_registration_id;

  select * into reg from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'registration not found' using errcode = 'P0002';
  end if;
  if reg.user_id <> v_actor_user_id then
    raise exception 'only the registrant may cancel this registration' using errcode = '42501';
  end if;

  select * into event_row from public.events where id = reg.event_id for update;
  perform public.sweep_event_locked(reg.event_id);
  select * into reg from public.registrations where id = p_registration_id;

  if reg.status not in ('offered', 'pending_organizer_confirmation', 'confirmed', 'waitlisted') then
    update public.idempotency_requests
    set response_status = 200, completed_at = statement_timestamp()
    where idempotency_requests.actor_user_id = v_actor_user_id
      and operation = 'cancel_registration' and idempotency_requests.key_hash = v_key_hash;
    return;
  end if;

  update public.registrations
  set status = 'cancelled', transition_version = transition_version + 1,
      updated_at = statement_timestamp()
  where id = p_registration_id;

  perform public.emit_registration_event(
    p_registration_id, reg.event_id, v_actor_user_id, reg.transition_version + 1,
    'registration.cancelled', v_actor_user_id, 'registration.cancelled',
    jsonb_build_object('status', reg.status), jsonb_build_object('status', 'cancelled')
  );

  if reg.status in ('offered', 'pending_organizer_confirmation', 'confirmed') then
    perform public.promote_next_waitlisted_locked(reg.event_id, reg.seat_pool);
  end if;

  update public.idempotency_requests
  set response_status = 200, completed_at = statement_timestamp()
  where idempotency_requests.actor_user_id = v_actor_user_id
    and operation = 'cancel_registration' and idempotency_requests.key_hash = v_key_hash;
end;
$$;

revoke all on function public.cancel_registration(uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_registration(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- accept_offer / decline_offer: the waitlisted-and-promoted participant
-- responds to a held offer.
-- ---------------------------------------------------------------------------

create function public.accept_offer(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  actor_user_id uuid := auth.uid();
  reg public.registrations%rowtype;
begin
  if actor_user_id is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;

  select * into reg from public.registrations where id = p_registration_id;
  if not found or reg.user_id <> actor_user_id then
    raise exception 'registration not found' using errcode = 'P0002';
  end if;

  perform 1 from public.events where id = reg.event_id for update;
  perform public.sweep_event_locked(reg.event_id);
  select * into reg from public.registrations where id = p_registration_id;

  if reg.status <> 'offered' then
    raise exception 'no active offer to accept' using errcode = '55000';
  end if;

  update public.registrations
  set status = 'confirmed', transition_version = transition_version + 1,
      updated_at = statement_timestamp()
  where id = p_registration_id;

  perform public.emit_registration_event(
    p_registration_id, reg.event_id, actor_user_id, reg.transition_version + 1,
    'registration.confirmed', actor_user_id, 'registration.offer_accepted',
    jsonb_build_object('status', 'offered'), jsonb_build_object('status', 'confirmed')
  );
end;
$$;

create function public.decline_offer(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  actor_user_id uuid := auth.uid();
  reg public.registrations%rowtype;
begin
  if actor_user_id is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;

  select * into reg from public.registrations where id = p_registration_id;
  if not found or reg.user_id <> actor_user_id then
    raise exception 'registration not found' using errcode = 'P0002';
  end if;

  perform 1 from public.events where id = reg.event_id for update;
  perform public.sweep_event_locked(reg.event_id);
  select * into reg from public.registrations where id = p_registration_id;

  if reg.status <> 'offered' then
    raise exception 'no active offer to decline' using errcode = '55000';
  end if;

  update public.registrations
  set status = 'declined', transition_version = transition_version + 1,
      updated_at = statement_timestamp()
  where id = p_registration_id;

  perform public.emit_registration_event(
    p_registration_id, reg.event_id, actor_user_id, reg.transition_version + 1,
    'registration.declined', actor_user_id, 'registration.offer_declined',
    jsonb_build_object('status', 'offered'), jsonb_build_object('status', 'declined')
  );

  perform public.promote_next_waitlisted_locked(reg.event_id, reg.seat_pool);
end;
$$;

revoke all on function public.accept_offer(uuid) from public, anon, authenticated;
revoke all on function public.decline_offer(uuid) from public, anon, authenticated;
grant execute on function public.accept_offer(uuid) to authenticated;
grant execute on function public.decline_offer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- organizer_confirm_registration / organizer_decline_registration: resolve
-- a pending_organizer_confirmation registration. admin/owner only.
-- ---------------------------------------------------------------------------

create function public.organizer_confirm_registration(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  actor_user_id uuid := auth.uid();
  reg public.registrations%rowtype;
begin
  select * into reg from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'registration not found' using errcode = 'P0002';
  end if;

  if not public.is_organizer_admin(public.event_organizer_id(reg.event_id), actor_user_id) then
    raise exception 'only an owner or admin may confirm registrations' using errcode = '42501';
  end if;

  perform 1 from public.events where id = reg.event_id for update;
  perform public.sweep_event_locked(reg.event_id);
  select * into reg from public.registrations where id = p_registration_id;

  if reg.status <> 'pending_organizer_confirmation' then
    raise exception 'registration is not pending confirmation' using errcode = '55000';
  end if;

  update public.registrations
  set status = 'confirmed', transition_version = transition_version + 1,
      updated_at = statement_timestamp()
  where id = p_registration_id;

  perform public.emit_registration_event(
    p_registration_id, reg.event_id, reg.user_id, reg.transition_version + 1,
    'registration.confirmed', actor_user_id, 'registration.organizer_confirmed',
    jsonb_build_object('status', 'pending_organizer_confirmation'),
    jsonb_build_object('status', 'confirmed')
  );
end;
$$;

create function public.organizer_decline_registration(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  actor_user_id uuid := auth.uid();
  reg public.registrations%rowtype;
begin
  select * into reg from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'registration not found' using errcode = 'P0002';
  end if;

  if not public.is_organizer_admin(public.event_organizer_id(reg.event_id), actor_user_id) then
    raise exception 'only an owner or admin may decline registrations' using errcode = '42501';
  end if;

  perform 1 from public.events where id = reg.event_id for update;
  perform public.sweep_event_locked(reg.event_id);
  select * into reg from public.registrations where id = p_registration_id;

  if reg.status <> 'pending_organizer_confirmation' then
    raise exception 'registration is not pending confirmation' using errcode = '55000';
  end if;

  update public.registrations
  set status = 'declined', transition_version = transition_version + 1,
      updated_at = statement_timestamp()
  where id = p_registration_id;

  perform public.emit_registration_event(
    p_registration_id, reg.event_id, reg.user_id, reg.transition_version + 1,
    'registration.declined', actor_user_id, 'registration.organizer_declined',
    jsonb_build_object('status', 'pending_organizer_confirmation'),
    jsonb_build_object('status', 'declined')
  );

  perform public.promote_next_waitlisted_locked(reg.event_id, reg.seat_pool);
end;
$$;

revoke all on function public.organizer_confirm_registration(uuid) from public, anon, authenticated;
revoke all on function public.organizer_decline_registration(uuid) from public, anon, authenticated;
grant execute on function public.organizer_confirm_registration(uuid) to authenticated;
grant execute on function public.organizer_decline_registration(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- organizer_remove_registration / organizer_block_participant: admin/owner
-- only (staff excluded — matches P1-08 "staff remove/block 403"). Blocking
-- also removes any active registration; neither RPC returns the internal
-- reason to the affected participant (callers never select
-- event_blocklist.reason_internal for the blocked user themselves — P1-04's
-- event_blocklist_select_admin policy already restricts SELECT to
-- organizer admins).
-- ---------------------------------------------------------------------------

create function public.organizer_remove_registration(
  p_registration_id uuid,
  p_reason_internal text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  actor_user_id uuid := auth.uid();
  reg public.registrations%rowtype;
begin
  select * into reg from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'registration not found' using errcode = 'P0002';
  end if;

  if not public.is_organizer_admin(public.event_organizer_id(reg.event_id), actor_user_id) then
    raise exception 'only an owner or admin may remove registrations' using errcode = '42501';
  end if;

  perform 1 from public.events where id = reg.event_id for update;
  perform public.sweep_event_locked(reg.event_id);
  select * into reg from public.registrations where id = p_registration_id;

  if reg.status not in ('offered', 'pending_organizer_confirmation', 'confirmed', 'waitlisted') then
    return;
  end if;

  update public.registrations
  set status = 'removed_by_organizer', transition_version = transition_version + 1,
      updated_at = statement_timestamp()
  where id = p_registration_id;

  perform public.emit_registration_event(
    p_registration_id, reg.event_id, reg.user_id, reg.transition_version + 1,
    'registration.removed', actor_user_id, 'registration.removed_by_organizer',
    jsonb_build_object('status', reg.status),
    jsonb_build_object('status', 'removed_by_organizer', 'reason_internal', p_reason_internal)
  );

  if reg.status in ('offered', 'pending_organizer_confirmation', 'confirmed') then
    perform public.promote_next_waitlisted_locked(reg.event_id, reg.seat_pool);
  end if;
end;
$$;

create function public.organizer_block_participant(
  p_event_id uuid,
  p_user_id uuid,
  p_reason_internal text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  actor_user_id uuid := auth.uid();
  reg public.registrations%rowtype;
begin
  if not public.is_organizer_admin(public.event_organizer_id(p_event_id), actor_user_id) then
    raise exception 'only an owner or admin may block participants' using errcode = '42501';
  end if;

  perform 1 from public.events where id = p_event_id for update;
  perform public.sweep_event_locked(p_event_id);

  insert into public.event_blocklist (event_id, user_id, created_by_user_id, reason_internal)
  values (p_event_id, p_user_id, actor_user_id, p_reason_internal)
  on conflict (event_id, user_id) do update set reason_internal = excluded.reason_internal;

  select * into reg from public.registrations
  where event_id = p_event_id and user_id = p_user_id
    and status in ('offered', 'pending_organizer_confirmation', 'confirmed', 'waitlisted');

  if found then
    update public.registrations
    set status = 'removed_by_organizer', transition_version = transition_version + 1,
        updated_at = statement_timestamp()
    where id = reg.id;

    perform public.emit_registration_event(
      reg.id, p_event_id, reg.user_id, reg.transition_version + 1,
      'registration.removed', actor_user_id, 'registration.blocked',
      jsonb_build_object('status', reg.status),
      jsonb_build_object('status', 'removed_by_organizer', 'blocked', true)
    );

    if reg.status in ('offered', 'pending_organizer_confirmation', 'confirmed') then
      perform public.promote_next_waitlisted_locked(p_event_id, reg.seat_pool);
    end if;
  else
    insert into public.audit_logs (
      actor_user_id, event_id, action, after_state
    ) values (
      actor_user_id, p_event_id, 'event_blocklist.added',
      jsonb_build_object('user_id', p_user_id, 'reason_internal', p_reason_internal)
    );
  end if;
end;
$$;

revoke all on function public.organizer_remove_registration(uuid, text) from public, anon, authenticated;
revoke all on function public.organizer_block_participant(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.organizer_remove_registration(uuid, text) to authenticated;
grant execute on function public.organizer_block_participant(uuid, uuid, text) to authenticated;
