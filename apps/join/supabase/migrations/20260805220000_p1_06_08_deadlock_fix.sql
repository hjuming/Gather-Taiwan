-- Corrective migration for 20260805210000_p1_06_08_seat_engine.sql.
--
-- register_for_event and cancel_registration inserted into
-- idempotency_requests (which has a foreign key to events) BEFORE taking
-- the explicit `SELECT ... FOR UPDATE` lock on the event row. That FK
-- insert implicitly takes a FOR KEY SHARE lock on the referenced event row;
-- two concurrent callers each holding FOR KEY SHARE while both then try to
-- upgrade to FOR UPDATE is a genuine Postgres lock-upgrade deadlock — not a
-- rare timing fluke, but a structural one that reproduced on essentially
-- every concurrent burst during the P1-06/P1-08 concurrency test
-- (apps/join/scripts/verify-p1-06-08-concurrency.mjs). The fix: acquire the
-- FOR UPDATE lock on the event row first, then insert into
-- idempotency_requests — the later FK-driven FOR KEY SHARE is compatible
-- with a lock the same transaction already holds, so it never queues
-- behind another caller's KEY SHARE.
--
-- Per the already-applied 20260805210000, this migration never edits it in
-- place; it CREATE OR REPLACEs only the two affected function bodies.

create or replace function public.register_for_event(
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

  select * into event_row from public.events where id = p_event_id for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  insert into public.idempotency_requests (
    actor_user_id, operation, key_hash, event_id, request_fingerprint
  ) values (
    v_actor_user_id, 'register_for_event', v_key_hash, p_event_id, v_fingerprint
  );

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

create or replace function public.cancel_registration(
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

  select * into reg from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'registration not found' using errcode = 'P0002';
  end if;
  if reg.user_id <> v_actor_user_id then
    raise exception 'only the registrant may cancel this registration' using errcode = '42501';
  end if;

  select * into event_row from public.events where id = reg.event_id for update;

  insert into public.idempotency_requests (
    actor_user_id, operation, key_hash, event_id, request_fingerprint
  ) values (
    v_actor_user_id, 'cancel_registration', v_key_hash, reg.event_id, v_fingerprint
  );

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
