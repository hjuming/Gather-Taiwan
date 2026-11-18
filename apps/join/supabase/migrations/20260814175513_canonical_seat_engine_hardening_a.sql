-- Canonical seat-engine hardening A. This migration preserves the MVP's
-- one-seat registrations, strict FIFO waitlist rule, and the Wave 03 rule
-- that attending private invitees consume the same event capacity.
--
-- A-stage compatibility: direct authenticated UPDATE grants remain until the
-- application has switched and B-stage can revoke only the sensitive columns.
-- The guard below nevertheless gives direct writes the same SUM(seats) floor.

-- One private helper centralizes the exact capacity view used by invitation
-- responses: an active invitation target is the source of truth for the same
-- normalized display name, so it is never counted twice with a registration.
create or replace function public.event_capacity_usage(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  with registration_usage as (
    select
      coalesce(sum(registration.seats), 0)::integer as registration_seats,
      coalesce(sum(registration.seats) filter (where registration.seat_pool = 'invite'), 0)::integer
        as invite_registration_seats
    from public.registrations registration
    where registration.event_id = p_event_id
      and registration.status in ('offered', 'pending_organizer_confirmation', 'confirmed')
      and not exists (
        select 1
        from public.event_invitation_targets target
        where target.event_id = p_event_id
          and target.revoked_at is null
          and target.response = 'attending'
          and lower(btrim(target.display_name)) = lower(btrim(coalesce(
            registration.manual_display_name,
            registration.display_name_snapshot,
            '未命名參加者'
          )))
      )
  ), invitee_usage as (
    select count(*)::integer as attending_invitee_count
    from public.event_invitation_targets
    where event_id = p_event_id
      and response = 'attending'
      and revoked_at is null
  )
  select jsonb_build_object(
    'registration_seats', registration_usage.registration_seats,
    'attending_invitee_count', invitee_usage.attending_invitee_count,
    'invite_occupied_seats',
      registration_usage.invite_registration_seats + invitee_usage.attending_invitee_count,
    'public_occupied_seats',
      registration_usage.registration_seats - registration_usage.invite_registration_seats,
    'total_occupied_seats',
      registration_usage.registration_seats + invitee_usage.attending_invitee_count
  )
  from registration_usage cross join invitee_usage
$$;

revoke all on function public.event_capacity_usage(uuid) from public, anon, authenticated;

-- Direct UPDATE remains temporarily available in A-stage, so its trigger must
-- use the same summed usage as the new RPC. It intentionally does not change
-- the event-pool schema constraint; that constraint remains the fail-closed
-- definition of valid pool configuration.
create or replace function public.guard_event_capacity_decrease()
returns trigger
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
declare
  usage jsonb;
  held_total integer;
  held_invite integer;
  held_public integer;
begin
  if new.capacity is distinct from old.capacity
    or new.invite_reserved_seats is distinct from old.invite_reserved_seats
    or new.invite_pool_deadline is distinct from old.invite_pool_deadline
  then
    usage := public.event_capacity_usage(old.id);
    held_total := (usage ->> 'total_occupied_seats')::integer;
    held_invite := (usage ->> 'invite_occupied_seats')::integer;
    held_public := (usage ->> 'public_occupied_seats')::integer;

    if (
      new.invite_reserved_seats is distinct from old.invite_reserved_seats
      or new.invite_pool_deadline is distinct from old.invite_pool_deadline
    ) and (
      exists (
        select 1 from public.registrations
        where event_id = old.id
          and status in ('offered', 'pending_organizer_confirmation', 'confirmed', 'waitlisted')
      ) or (usage ->> 'attending_invitee_count')::integer > 0
    ) then
      raise exception 'invite pool configuration cannot change after participant activity'
        using errcode = '55000';
    end if;

    if new.capacity is not null and new.capacity < held_total then
      raise exception 'capacity cannot drop below % seats already held', held_total
        using errcode = '23514';
    end if;

    if new.invite_reserved_seats is not null then
      if new.invite_reserved_seats < held_invite then
        raise exception 'invite_reserved_seats cannot drop below % seats already held', held_invite
          using errcode = '23514';
      end if;
      if new.capacity - new.invite_reserved_seats < held_public then
        raise exception 'public capacity cannot drop below % seats already held', held_public
          using errcode = '23514';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- A deadline merge must happen before the first expired offer tries to fill a
-- seat. Once merged, every promotion orders over both pools by (waitlisted_at,
-- id): strict FIFO waitlist cannot be bypassed.
create or replace function public.sweep_event_locked(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  expired record;
  event_row public.events%rowtype;
  usage jsonb;
  waitlist_head uuid;
  waitlist_head_still_waiting boolean;
begin
  update public.events
  set invite_pool_released_at = statement_timestamp()
  where id = p_event_id
    and invite_pool_deadline is not null
    and invite_pool_deadline < statement_timestamp()
    and invite_pool_released_at is null;

  for expired in
    select id, seat_pool, transition_version, user_id
    from public.registrations
    where event_id = p_event_id
      and status = 'offered'
      and offer_expires_at < statement_timestamp()
    order by offer_expires_at, id
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

  select * into event_row from public.events where id = p_event_id;
  if event_row.capacity is null or event_row.invite_pool_released_at is null then
    return;
  end if;

  -- A pool release itself can create multiple globally free seats. Fill each
  -- one in global FIFO order, including the case where no offer just expired.
  loop
    usage := public.event_capacity_usage(p_event_id);
    exit when (usage ->> 'total_occupied_seats')::integer >= event_row.capacity;

    select id into waitlist_head
    from public.registrations
    where event_id = p_event_id and status = 'waitlisted'
    order by waitlisted_at, id
    limit 1;
    exit when waitlist_head is null;

    perform public.promote_next_waitlisted_locked(p_event_id, 'public');
    select exists (
      select 1 from public.registrations
      where id = waitlist_head and status = 'waitlisted'
    ) into waitlist_head_still_waiting;
    exit when waitlist_head_still_waiting;
  end loop;
end;
$$;

create or replace function public.promote_next_waitlisted_locked(
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
  event_row public.events%rowtype;
  usage jsonb;
  v_available_seats integer;
begin
  select * into event_row from public.events where id = p_event_id;
  pool_merged := event_row.invite_pool_released_at is not null;

  select id, user_id, transition_version, seats into next_reg
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

  if event_row.capacity is not null then
    usage := public.event_capacity_usage(p_event_id);
    v_available_seats := case
      when pool_merged then event_row.capacity - (usage ->> 'total_occupied_seats')::integer
      when event_row.invite_reserved_seats is null then
        event_row.capacity - (usage ->> 'total_occupied_seats')::integer
      when p_freed_pool = 'invite' then
        event_row.invite_reserved_seats - (usage ->> 'invite_occupied_seats')::integer
      else
        event_row.capacity - event_row.invite_reserved_seats
          - (usage ->> 'public_occupied_seats')::integer
    end;
    if next_reg.seats > v_available_seats then
      -- strict FIFO head does not fit available seats: do not skip it.
      return;
    end if;
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

revoke all on function public.sweep_event_locked(uuid) from public, anon, authenticated;
revoke all on function public.promote_next_waitlisted_locked(uuid, public.seat_pool)
  from public, anon, authenticated;

-- Keep the token-only Wave 03 capability signature and ACL. A pending or
-- declined target no longer suppresses a same-name registration in either
-- capacity check; only an actually attending target is the source of truth.
create or replace function public.respond_to_event_invitation(
  p_slug text,
  p_invitee_token text,
  p_response text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_event public.events%rowtype;
  v_token_hash text;
  v_response text := lower(btrim(coalesce(p_response, '')));
  v_target public.event_invitation_targets%rowtype;
  v_registration_count integer;
  v_guest_count integer;
  v_attending_count integer;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{2,95}$' then
    raise exception 'invalid event link' using errcode = '22023';
  end if;
  if p_invitee_token is null or length(btrim(p_invitee_token)) < 16 then
    raise exception 'invalid or revoked invitation token' using errcode = '42501';
  end if;
  if v_response not in ('pending', 'attending', 'declined') then
    raise exception 'response must be pending, attending, or declined' using errcode = '22023';
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

  v_token_hash := public.hash_invitee_key(p_invitee_token);
  select * into v_target
  from public.event_invitation_targets
  where event_id = v_event.id
    and guest_key_hash = v_token_hash
    and revoked_at is null
  for update;
  if not found then
    raise exception 'invalid or revoked invitation token' using errcode = '42501';
  end if;

  if v_response = 'attending' and v_target.response <> 'attending' then
    select coalesce(sum(registration.seats), 0)::integer into v_registration_count
    from public.registrations registration
    where registration.event_id = v_event.id
      and registration.status in ('offered', 'pending_organizer_confirmation', 'confirmed')
      and not exists (
        select 1 from public.event_invitation_targets target
        where target.event_id = v_event.id
          and target.revoked_at is null
          and target.response = 'attending'
          and lower(btrim(target.display_name)) = lower(btrim(coalesce(
            registration.manual_display_name,
            registration.display_name_snapshot,
            '未命名參加者'
          )))
      );
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
  set response = v_response,
      responded_at = case when v_response = 'pending' then null else statement_timestamp() end,
      updated_at = statement_timestamp()
  where id = v_target.id
  returning * into v_target;

  select coalesce(sum(registration.seats), 0)::integer into v_registration_count
  from public.registrations registration
  where registration.event_id = v_event.id
    and registration.status in ('offered', 'pending_organizer_confirmation', 'confirmed')
    and not exists (
      select 1 from public.event_invitation_targets target
      where target.event_id = v_event.id
        and target.revoked_at is null
        and target.response = 'attending'
        and lower(btrim(target.display_name)) = lower(btrim(coalesce(
          registration.manual_display_name,
          registration.display_name_snapshot,
          '未命名參加者'
        )))
    );
  select count(*)::integer into v_guest_count
  from public.event_invitation_targets
  where event_id = v_event.id
    and response = 'attending'
    and revoked_at is null;
  v_attending_count := v_registration_count + v_guest_count;

  insert into public.audit_logs (event_id, action, after_state)
  values (
    v_event.id, 'event_invitation.response_submitted',
    jsonb_build_object('target_id', v_target.id, 'response', v_target.response)
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

revoke all on function public.respond_to_event_invitation(text, text, text)
  from public, anon, authenticated;
grant execute on function public.respond_to_event_invitation(text, text, text)
  to anon, authenticated;

create or replace function public.get_event_invitation_by_slug(
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
  v_invitees jsonb;
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

  select coalesce(sum(registration.seats), 0)::integer into v_registration_count
  from public.registrations registration
  where registration.event_id = v_event.id
    and registration.status in ('offered', 'pending_organizer_confirmation', 'confirmed')
    and not exists (
      select 1 from public.event_invitation_targets target
      where target.event_id = v_event.id
        and target.revoked_at is null
        and target.response = 'attending'
        and lower(btrim(target.display_name)) = lower(btrim(coalesce(
          registration.manual_display_name,
          registration.display_name_snapshot,
          '未命名參加者'
        )))
    );

  select count(*)::integer into v_guest_count
  from public.event_invitation_targets
  where event_id = v_event.id
    and response = 'attending'
    and revoked_at is null;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', roster.roster_id,
        'display_name', roster.display_name,
        'response', roster.response
      ) order by roster.created_at, roster.source_order, roster.display_name
    ),
    '[]'::jsonb
  ) into v_invitees
  from (
    select target.id as roster_id, target.display_name, target.response, target.created_at, 0 as source_order
    from public.event_invitation_targets target
    where target.event_id = v_event.id and target.revoked_at is null
    union all
    select
      registration.id as roster_id,
      coalesce(nullif(btrim(registration.manual_display_name), ''), nullif(btrim(registration.display_name_snapshot), ''), '未命名參加者') as display_name,
      case when registration.status = 'confirmed' then 'attending' else 'pending' end as response,
      registration.created_at,
      1 as source_order
    from public.registrations registration
    where registration.event_id = v_event.id
      and registration.status in ('offered', 'pending_organizer_confirmation', 'confirmed', 'waitlisted')
      and not exists (
        select 1 from public.event_invitation_targets target
        where target.event_id = v_event.id
          and target.revoked_at is null
          and target.response = 'attending'
          and lower(btrim(target.display_name)) = lower(btrim(coalesce(
            registration.manual_display_name, registration.display_name_snapshot, '未命名參加者'
          )))
      )
  ) roster;

  return jsonb_build_object(
    'id', v_event.id, 'organizer_id', v_event.organizer_id, 'created_by_user_id', v_event.created_by_user_id,
    'slug', v_event.slug, 'title', v_event.title, 'summary', v_event.summary, 'description', v_event.description,
    'status', v_event.status, 'visibility', v_event.visibility, 'confirmation_mode', v_event.confirmation_mode,
    'timezone', v_event.timezone, 'starts_at', v_event.starts_at, 'ends_at', v_event.ends_at,
    'registration_opens_at', v_event.registration_opens_at, 'registration_closes_at', v_event.registration_closes_at,
    'location_name', v_event.location_name, 'location_address', v_event.location_address, 'capacity', v_event.capacity,
    'fee_amount', v_event.fee_amount, 'fee_mode', v_event.fee_mode, 'fee_currency', v_event.fee_currency,
    'payment_instructions', v_event.payment_instructions, 'roster_visibility', v_event.roster_visibility,
    'roster_show_capacity', v_event.roster_show_capacity, 'invite_only', v_event.invite_only, 'min_age', v_event.min_age,
    'invite_reserved_seats', v_event.invite_reserved_seats, 'invite_pool_deadline', v_event.invite_pool_deadline,
    'invite_pool_released_at', v_event.invite_pool_released_at, 'gathering_type', v_event.gathering_type,
    'cover_image_url', v_event.cover_image_url, 'updated_at', v_event.updated_at,
    'organizer_display_name', v_organizer_name, 'attending_count', v_registration_count + v_guest_count,
    'invitees', v_invitees,
    'guest_invitee_id', case when v_current_target.id is null then null else v_current_target.id end,
    'guest_response', case when v_current_target.id is null then null else v_current_target.response end,
    'guest_display_name', case when v_current_target.id is null then null else v_current_target.display_name end
  );
end;
$$;

revoke all on function public.get_event_invitation_by_slug(text, text)
  from public, anon, authenticated;
grant execute on function public.get_event_invitation_by_slug(text, text)
  to anon, authenticated;

-- The final register_for_event body currently comes from P1-09/P1-13. Keep
-- its age and answer validation unchanged, but source pool occupancy from the
-- canonical usage helper rather than COUNT(*).
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
  usage jsonb;
  held_seats integer;
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
    usage := public.event_capacity_usage(p_event_id);
    held_seats := case
      when event_row.invite_pool_released_at is not null then (usage ->> 'total_occupied_seats')::integer
      when target_pool = 'invite' then (usage ->> 'invite_occupied_seats')::integer
      else (usage ->> 'public_occupied_seats')::integer
    end;
    if held_seats < effective_capacity then
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

create function public.update_event_capacity_settings(
  p_event_id uuid,
  p_idempotency_key text,
  p_capacity integer,
  p_invite_reserved_seats integer,
  p_invite_pool_deadline timestamptz
)
returns jsonb
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
  usage jsonb;
  v_pool_config_changed boolean;
  v_before jsonb;
  v_result jsonb;
begin
  if v_actor_user_id is null then
    raise exception 'authenticated organizer required' using errcode = '42501';
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  select * into event_row from public.events where id = p_event_id for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  if not public.is_organizer_admin(event_row.organizer_id, v_actor_user_id) then
    raise exception 'only an owner or admin may update capacity settings' using errcode = '42501';
  end if;

  v_key_hash := encode(digest(p_idempotency_key, 'sha256'), 'hex');
  v_fingerprint := encode(digest(
    p_event_id::text || '|' || coalesce(p_capacity::text, 'null') || '|'
      || coalesce(p_invite_reserved_seats::text, 'null') || '|'
      || coalesce(p_invite_pool_deadline::text, 'null'),
    'sha256'
  ), 'hex');
  select * into existing
  from public.idempotency_requests
  where actor_user_id = v_actor_user_id
    and operation = 'update_event_capacity_settings'
    and key_hash = v_key_hash
  for update;
  if found then
    if existing.request_fingerprint <> v_fingerprint then
      raise exception 'idempotency key reused with a different request' using errcode = '23505';
    end if;
    if existing.completed_at is not null then
      return existing.response_body;
    end if;
    raise exception 'a request with this idempotency key is already in progress' using errcode = '55P03';
  end if;

  if p_capacity is not null and p_capacity < 1 then
    raise exception 'capacity must be positive' using errcode = '22023';
  end if;
  if p_capacity is null and (p_invite_reserved_seats is not null or p_invite_pool_deadline is not null) then
    raise exception 'unlimited capacity cannot have an invite pool' using errcode = '22023';
  end if;
  if (p_invite_reserved_seats is null) <> (p_invite_pool_deadline is null) then
    raise exception 'invite reserved seats and deadline must be set together' using errcode = '22023';
  end if;
  if p_invite_reserved_seats is not null and (
    p_invite_reserved_seats < 1
    or p_invite_reserved_seats > p_capacity
    or p_invite_pool_deadline >= event_row.starts_at
  ) then
    raise exception 'invalid invite pool configuration' using errcode = '22023';
  end if;

  insert into public.idempotency_requests (
    actor_user_id, operation, key_hash, event_id, request_fingerprint
  ) values (
    v_actor_user_id, 'update_event_capacity_settings', v_key_hash, p_event_id, v_fingerprint
  );

  perform public.sweep_event_locked(p_event_id);
  select * into event_row from public.events where id = p_event_id;
  usage := public.event_capacity_usage(p_event_id);
  v_pool_config_changed := p_invite_reserved_seats is distinct from event_row.invite_reserved_seats
    or p_invite_pool_deadline is distinct from event_row.invite_pool_deadline;

  if v_pool_config_changed and (
    exists (
      select 1 from public.registrations
      where event_id = p_event_id
        and status in ('offered', 'pending_organizer_confirmation', 'confirmed', 'waitlisted')
    ) or (usage ->> 'attending_invitee_count')::integer > 0
  ) then
    raise exception 'invite pool configuration cannot change after participant activity' using errcode = '55000';
  end if;

  if p_capacity is not null and p_capacity < (usage ->> 'total_occupied_seats')::integer then
    raise exception 'capacity cannot drop below % seats already held', (usage ->> 'total_occupied_seats')::integer
      using errcode = '23514';
  end if;
  if p_invite_reserved_seats is not null then
    if p_invite_reserved_seats < (usage ->> 'invite_occupied_seats')::integer then
      raise exception 'invite_reserved_seats cannot drop below % seats already held', (usage ->> 'invite_occupied_seats')::integer
        using errcode = '23514';
    end if;
    if p_capacity - p_invite_reserved_seats < (usage ->> 'public_occupied_seats')::integer then
      raise exception 'public capacity cannot drop below % seats already held', (usage ->> 'public_occupied_seats')::integer
        using errcode = '23514';
    end if;
  end if;

  v_before := jsonb_build_object(
    'capacity', event_row.capacity,
    'invite_reserved_seats', event_row.invite_reserved_seats,
    'invite_pool_deadline', event_row.invite_pool_deadline,
    'invite_pool_released_at', event_row.invite_pool_released_at
  );

  update public.events
  set capacity = p_capacity,
      invite_reserved_seats = p_invite_reserved_seats,
      invite_pool_deadline = p_invite_pool_deadline,
      invite_pool_released_at = case
        when p_invite_reserved_seats is null then null
        when v_pool_config_changed then null
        else event_row.invite_pool_released_at
      end,
      updated_at = statement_timestamp()
  where id = p_event_id;

  select * into event_row from public.events where id = p_event_id;
  usage := public.event_capacity_usage(p_event_id);
  v_result := jsonb_build_object(
    'event_id', event_row.id,
    'capacity', event_row.capacity,
    'invite_reserved_seats', event_row.invite_reserved_seats,
    'invite_pool_deadline', event_row.invite_pool_deadline,
    'invite_pool_released_at', event_row.invite_pool_released_at,
    'registration_seats', (usage ->> 'registration_seats')::integer,
    'attending_invitee_count', (usage ->> 'attending_invitee_count')::integer,
    'total_occupied_seats', (usage ->> 'total_occupied_seats')::integer
  );
  insert into public.audit_logs (
    actor_user_id, organizer_id, event_id, action, before_state, after_state
  ) values (
    v_actor_user_id, event_row.organizer_id, p_event_id, 'event.capacity_settings_updated',
    v_before,
    v_result
  );
  -- outbox_events requires a registration_id and recipient_user_id. A setting
  -- change has neither, so audit is the durable contract and no invalid
  -- synthetic notification row is inserted.
  update public.idempotency_requests
  set response_status = 200, response_body = v_result, completed_at = statement_timestamp()
  where actor_user_id = v_actor_user_id
    and operation = 'update_event_capacity_settings'
    and key_hash = v_key_hash;
  return v_result;
end;
$$;

revoke all on function public.update_event_capacity_settings(uuid, text, integer, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.update_event_capacity_settings(uuid, text, integer, integer, timestamptz)
  to authenticated;
