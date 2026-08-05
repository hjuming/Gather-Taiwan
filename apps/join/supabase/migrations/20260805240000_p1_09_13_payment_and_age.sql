-- P1-09 / P1-13: payment declaration (participant-side, no amount/proof
-- fields), a payment-instructions report entry point, and event min_age
-- enforcement at registration time (register_for_event did not check
-- min_age at all until now — a real gap, not a refactor).
--
-- Scope decisions (documented in docs/evidence/p1-09-13-green.md):
-- - "活動日期變更重算與主辦裁量" (recalculate registrant age-eligibility
--   when an event's start date changes, leaving the final call to the
--   organizer) is deferred. It's a rare edge case (date changes are
--   uncommon, and the existing guard_event_safety_edits_after_start trigger
--   already blocks starts_at changes once the event has started); building
--   full recalculate-and-flag machinery now would be premature relative to
--   what's needed to get a basic internal test build working. The
--   at-registration-time min_age check (this migration) is the core
--   protection and always runs against the event's *current* starts_at.
-- - "申訴稽核" (formal appeal workflow for rejected registrations) is
--   P1-17 territory (客服 audit trail); age rejections already surface as
--   a distinct, identifiable error from register_for_event, which is what
--   a future appeal flow would need to key off of.
-- - "文案 allowlist" for payment_instructions free text is not a new DB
--   constraint: event_fields already blocks payment-proof-shaped field
--   names/labels (P1-02's is_prohibited_payment_proof_field_name);
--   payment_instructions itself is the organizer's own description of how
--   to pay, which is expected to contain amounts/account info — that's a
--   different thing from participant-supplied proof, and isn't blocked.

create function public.compute_age(p_birth_date date, p_at date default current_date)
returns integer
language sql
immutable
set search_path = pg_catalog
as $$
  select extract(year from age(p_at, p_birth_date))::integer
$$;

comment on function public.compute_age(date, date) is
  'Uses Postgres age(): correctly handles Feb 29 birthdays by comparing '
  'calendar month/day, not day-of-year arithmetic.';

create function public.zodiac_sign(p_birth_date date)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when (extract(month from p_birth_date), extract(day from p_birth_date)) >= (3, 21)
      and (extract(month from p_birth_date), extract(day from p_birth_date)) <= (4, 19) then 'aries'
    when (extract(month from p_birth_date), extract(day from p_birth_date)) >= (4, 20)
      and (extract(month from p_birth_date), extract(day from p_birth_date)) <= (5, 20) then 'taurus'
    when (extract(month from p_birth_date), extract(day from p_birth_date)) >= (5, 21)
      and (extract(month from p_birth_date), extract(day from p_birth_date)) <= (6, 20) then 'gemini'
    when (extract(month from p_birth_date), extract(day from p_birth_date)) >= (6, 21)
      and (extract(month from p_birth_date), extract(day from p_birth_date)) <= (7, 22) then 'cancer'
    when (extract(month from p_birth_date), extract(day from p_birth_date)) >= (7, 23)
      and (extract(month from p_birth_date), extract(day from p_birth_date)) <= (8, 22) then 'leo'
    when (extract(month from p_birth_date), extract(day from p_birth_date)) >= (8, 23)
      and (extract(month from p_birth_date), extract(day from p_birth_date)) <= (9, 22) then 'virgo'
    when (extract(month from p_birth_date), extract(day from p_birth_date)) >= (9, 23)
      and (extract(month from p_birth_date), extract(day from p_birth_date)) <= (10, 22) then 'libra'
    when (extract(month from p_birth_date), extract(day from p_birth_date)) >= (10, 23)
      and (extract(month from p_birth_date), extract(day from p_birth_date)) <= (11, 21) then 'scorpio'
    when (extract(month from p_birth_date), extract(day from p_birth_date)) >= (11, 22)
      and (extract(month from p_birth_date), extract(day from p_birth_date)) <= (12, 21) then 'sagittarius'
    when (extract(month from p_birth_date), extract(day from p_birth_date)) >= (12, 22)
      or (extract(month from p_birth_date), extract(day from p_birth_date)) <= (1, 19) then 'capricorn'
    when (extract(month from p_birth_date), extract(day from p_birth_date)) >= (1, 20)
      and (extract(month from p_birth_date), extract(day from p_birth_date)) <= (2, 18) then 'aquarius'
    else 'pisces'
  end
$$;

revoke all on function public.compute_age(date, date) from public, anon, authenticated;
revoke all on function public.zodiac_sign(date) from public, anon, authenticated;
grant execute on function public.compute_age(date, date) to authenticated;
grant execute on function public.zodiac_sign(date) to authenticated;

-- ---------------------------------------------------------------------------
-- register_for_event: add min_age enforcement. Fail-closed when min_age is
-- set but the registrant has no birth_date on file (cannot verify age).
-- Otherwise identical to the deadlock-fixed body from 20260805220000.
-- ---------------------------------------------------------------------------

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
  registrant_birth_date date;
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

  if event_row.min_age is not null then
    select birth_date into registrant_birth_date from public.users where id = v_actor_user_id;
    if registrant_birth_date is null then
      raise exception 'a birth date is required to register for this event' using errcode = '22023';
    end if;
    if public.compute_age(registrant_birth_date, event_row.starts_at::date) < event_row.min_age then
      raise exception 'registrant does not meet this event''s minimum age' using errcode = '42501';
    end if;
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

-- ---------------------------------------------------------------------------
-- declare_payment_for_registration: the registrant marks that they've paid
-- per the organizer's payment_instructions. No amount, account, or proof
-- field exists to accept — payment_declared_at is the sole SSOT, and this
-- RPC never touches status/expiry/seat fields.
-- ---------------------------------------------------------------------------

create function public.declare_payment_for_registration(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  reg public.registrations%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;

  select * into reg from public.registrations where id = p_registration_id;
  if not found or reg.user_id <> v_actor_user_id then
    raise exception 'registration not found' using errcode = 'P0002';
  end if;

  if reg.payment_declared_at is not null then
    return;
  end if;

  update public.registrations
  set payment_declared_at = statement_timestamp()
  where id = p_registration_id;

  insert into public.audit_logs (
    actor_user_id, event_id, registration_id, action, after_state
  ) values (
    v_actor_user_id, reg.event_id, p_registration_id, 'registration.payment_declared', '{}'::jsonb
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- report_event_payment_instructions: a lightweight report entry point.
-- Anyone authenticated can flag an event's payment_instructions text as
-- suspicious; this only records an audit entry for organizer/platform
-- follow-up, no automated action.
-- ---------------------------------------------------------------------------

create function public.report_event_payment_instructions(
  p_event_id uuid,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
begin
  if v_actor_user_id is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (
    actor_user_id, event_id, action, after_state
  ) values (
    v_actor_user_id, p_event_id, 'event.payment_instructions_reported',
    jsonb_build_object('note', left(coalesce(p_note, ''), 500))
  );
end;
$$;

revoke all on function public.declare_payment_for_registration(uuid) from public, anon, authenticated;
revoke all on function public.report_event_payment_instructions(uuid, text) from public, anon, authenticated;
grant execute on function public.declare_payment_for_registration(uuid) to authenticated;
grant execute on function public.report_event_payment_instructions(uuid, text) to authenticated;
