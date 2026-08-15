-- Forward-only correction for P1-11 manual roster entries after canonical
-- seat-engine hardening. Manual rows now share the same event lock, capacity
-- usage, and FIFO promotion path as self-registered rows. Rows without a user
-- still cannot receive notification outbox items, so their transition emits
-- audit only.

create or replace function public.event_capacity_usage(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  with event_config as (
    select
      capacity,
      invite_reserved_seats,
      capacity is null
        or invite_reserved_seats is null
        or invite_pool_released_at is not null as merged
    from public.events
    where id = p_event_id
  ), registration_usage as (
    select
      coalesce(sum(registration.seats), 0)::integer as registration_seats,
      coalesce(sum(registration.seats) filter (where registration.seat_pool = 'invite'), 0)::integer
        as invite_registration_seats
    from public.registrations registration
    where registration.event_id = p_event_id
      and registration.status in ('offered', 'pending_organizer_confirmation', 'confirmed')
  ), invitee_usage as (
    select count(*)::integer as attending_invitee_count
    from public.event_invitation_targets
    where event_id = p_event_id
      and response = 'attending'
      and revoked_at is null
  ), occupied as (
    select
      registration_usage.registration_seats,
      invitee_usage.attending_invitee_count,
      registration_usage.invite_registration_seats + invitee_usage.attending_invitee_count
        as invite_occupied_seats,
      registration_usage.registration_seats - registration_usage.invite_registration_seats
        as public_occupied_seats,
      registration_usage.registration_seats + invitee_usage.attending_invitee_count
        as total_occupied_seats
    from registration_usage cross join invitee_usage
  )
  select jsonb_build_object(
    'registration_seats', occupied.registration_seats,
    'attending_invitee_count', occupied.attending_invitee_count,
    'invite_occupied_seats', occupied.invite_occupied_seats,
    'public_occupied_seats', occupied.public_occupied_seats,
    'total_occupied_seats', occupied.total_occupied_seats,
    'merged', event_config.merged,
    'limits', jsonb_build_object(
      'total', event_config.capacity,
      'invite', case
        when event_config.capacity is null or event_config.merged then null
        else event_config.invite_reserved_seats
      end,
      'public', case
        when event_config.capacity is null or event_config.merged then null
        else event_config.capacity - event_config.invite_reserved_seats
      end
    ),
    'available', jsonb_build_object(
      'total', case
        when event_config.capacity is null then null
        else event_config.capacity - occupied.total_occupied_seats
      end,
      'invite', case
        when event_config.capacity is null or event_config.merged then null
        else least(
          event_config.capacity - occupied.total_occupied_seats,
          event_config.invite_reserved_seats - occupied.invite_occupied_seats
        )
      end,
      'public', case
        when event_config.capacity is null or event_config.merged then null
        else least(
          event_config.capacity - occupied.total_occupied_seats,
          event_config.capacity - event_config.invite_reserved_seats
            - occupied.public_occupied_seats
        )
      end
    ),
    'within_limits', jsonb_build_object(
      'total', event_config.capacity is null
        or occupied.total_occupied_seats <= event_config.capacity,
      'invite', event_config.merged
        or occupied.invite_occupied_seats <= event_config.invite_reserved_seats,
      'public', event_config.merged
        or occupied.public_occupied_seats <= event_config.capacity - event_config.invite_reserved_seats
    )
  )
  from event_config cross join occupied
$$;

revoke all on function public.event_capacity_usage(uuid) from public, anon, authenticated;

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
  v_previous_response text;
  v_target public.event_invitation_targets%rowtype;
  usage_before jsonb;
  usage_after jsonb;
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

  perform public.sweep_event_locked(v_event.id);
  select * into v_event from public.events where id = v_event.id;

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

  v_previous_response := v_target.response;
  usage_before := public.event_capacity_usage(v_event.id);

  update public.event_invitation_targets
  set response = v_response,
      responded_at = case when v_response = 'pending' then null else statement_timestamp() end,
      updated_at = statement_timestamp()
  where id = v_target.id
  returning * into v_target;

  usage_after := public.event_capacity_usage(v_event.id);
  if v_response = 'attending'
    and v_previous_response <> 'attending'
    and (
      (usage_after -> 'within_limits' ->> 'total')::boolean is not true
      or (
        (usage_after ->> 'merged')::boolean is not true
        and (usage_after -> 'within_limits' ->> 'invite')::boolean is not true
      )
    )
  then
    raise exception '這場聚會已額滿' using errcode = '53300';
  end if;

  insert into public.audit_logs (event_id, action, before_state, after_state)
  values (
    v_event.id,
    'event_invitation.response_submitted',
    jsonb_build_object(
      'target_id', v_target.id,
      'response', v_previous_response,
      'capacity_usage', usage_before
    ),
    jsonb_build_object(
      'target_id', v_target.id,
      'response', v_target.response,
      'capacity_usage', usage_after
    )
  );

  return jsonb_build_object(
    'id', v_target.id,
    'display_name', v_target.display_name,
    'response', v_target.response,
    'attending_count', (usage_after ->> 'total_occupied_seats')::integer,
    'capacity', v_event.capacity
  );
end;
$$;

revoke all on function public.respond_to_event_invitation(text, text, text) from public, anon, authenticated;
grant execute on function public.respond_to_event_invitation(text, text, text) to anon, authenticated;

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
  v_capacity_usage jsonb;
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

  v_capacity_usage := public.event_capacity_usage(v_event.id);

  -- Roster projection remains name-deduplicated against every active target.
  -- This display-only rule must not influence the capacity envelope above.
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
      coalesce(
        nullif(btrim(registration.manual_display_name), ''),
        nullif(btrim(registration.display_name_snapshot), ''),
        '未命名參加者'
      ) as display_name,
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
          and lower(btrim(target.display_name)) = lower(btrim(coalesce(
            registration.manual_display_name,
            registration.display_name_snapshot,
            '未命名參加者'
          )))
      )
  ) roster;

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
    'attending_count', (v_capacity_usage ->> 'total_occupied_seats')::integer,
    'invitees', v_invitees,
    'guest_invitee_id', case when v_current_target.id is null then null else v_current_target.id end,
    'guest_response', case when v_current_target.id is null then null else v_current_target.response end,
    'guest_display_name', case when v_current_target.id is null then null else v_current_target.display_name end
  );
end;
$$;

revoke all on function public.get_event_invitation_by_slug(text, text) from public, anon, authenticated;
grant execute on function public.get_event_invitation_by_slug(text, text) to anon, authenticated;

create or replace function public.emit_registration_event(
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
  if p_recipient_user_id is not null then
    insert into public.outbox_events (
      event_id, registration_id, recipient_user_id, transition_version,
      notification_kind
    ) values (
      p_event_id, p_registration_id, p_recipient_user_id, p_transition_version,
      p_notification_kind
    )
    on conflict (registration_id, transition_version, notification_kind) do nothing;
  end if;

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

create or replace function public.promote_next_waitlisted_locked_core(
  p_event_id uuid,
  p_freed_pool public.seat_pool,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  next_reg record;
  pool_merged boolean;
  usage_before jsonb;
  usage_after jsonb;
  v_available_seats integer;
begin
  perform 1 from public.events where id = p_event_id for update;

  usage_before := public.event_capacity_usage(p_event_id);
  pool_merged := (usage_before ->> 'merged')::boolean;
  v_available_seats := case
    when pool_merged then (usage_before -> 'available' ->> 'total')::integer
    else (usage_before -> 'available' ->> p_freed_pool::text)::integer
  end;

  select id, user_id, transition_version, seats, seat_pool into next_reg
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

  if v_available_seats is not null and next_reg.seats > v_available_seats then
    return;
  end if;

  update public.registrations
  set status = 'offered',
      offered_at = statement_timestamp(),
      offer_expires_at = statement_timestamp() + interval '24 hours',
      transition_version = transition_version + 1,
      updated_at = statement_timestamp()
  where id = next_reg.id;

  if next_reg.user_id is null then
    update public.registrations
    set status = 'confirmed',
        transition_version = transition_version + 1,
        updated_at = statement_timestamp()
    where id = next_reg.id;

    usage_after := public.event_capacity_usage(p_event_id);
    perform public.emit_registration_event(
      next_reg.id, p_event_id, null, next_reg.transition_version + 2,
      'registration.confirmed', p_actor_user_id, 'registration.manual_promoted',
      jsonb_build_object(
        'status', 'waitlisted', 'seats', next_reg.seats,
        'seat_pool', next_reg.seat_pool, 'capacity_usage', usage_before
      ),
      jsonb_build_object(
        'status', 'confirmed', 'seats', next_reg.seats,
        'seat_pool', next_reg.seat_pool, 'capacity_usage', usage_after
      )
    );
  else
    usage_after := public.event_capacity_usage(p_event_id);
    perform public.emit_registration_event(
      next_reg.id, p_event_id, next_reg.user_id, next_reg.transition_version + 1,
      'registration.offered', p_actor_user_id, 'registration.offered',
      jsonb_build_object(
        'status', 'waitlisted', 'seats', next_reg.seats,
        'seat_pool', next_reg.seat_pool, 'capacity_usage', usage_before
      ),
      jsonb_build_object(
        'status', 'offered', 'seats', next_reg.seats,
        'seat_pool', next_reg.seat_pool, 'capacity_usage', usage_after
      )
    );
  end if;
end;
$$;

revoke all on function public.promote_next_waitlisted_locked_core(uuid, public.seat_pool, uuid)
  from public, anon, authenticated;

create or replace function public.promote_next_waitlisted_locked(
  p_event_id uuid,
  p_freed_pool public.seat_pool
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  perform public.promote_next_waitlisted_locked_core(p_event_id, p_freed_pool, null);
end;
$$;

revoke all on function public.promote_next_waitlisted_locked(uuid, public.seat_pool)
  from public, anon, authenticated;

create or replace function public.organizer_add_manual_participant(
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
  event_row public.events%rowtype;
  usage_before jsonb;
  usage_after jsonb;
  pool_merged boolean;
  v_available_seats integer;
  new_status public.registration_status;
  new_registration_id uuid;
  new_reg public.registrations%rowtype;
  waitlist_head_id uuid;
  normalized_display_name text := btrim(coalesce(p_display_name, ''));
  normalized_contact text := nullif(btrim(coalesce(p_contact, '')), '');
begin
  select * into event_row from public.events where id = p_event_id for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if not public.is_organizer_admin(event_row.organizer_id, v_actor_user_id) then
    raise exception 'only an owner or admin may manage the participant roster' using errcode = '42501';
  end if;
  if normalized_display_name = '' then
    raise exception 'display name is required' using errcode = '22023';
  end if;
  if p_status not in ('confirmed', 'waitlisted', 'pending_organizer_confirmation') then
    raise exception 'invalid initial status for a manual participant' using errcode = '22023';
  end if;

  perform public.sweep_event_locked(p_event_id);
  select * into event_row from public.events where id = p_event_id;
  usage_before := public.event_capacity_usage(p_event_id);
  new_status := p_status;

  if p_status in ('confirmed', 'pending_organizer_confirmation') then
    pool_merged := (usage_before ->> 'merged')::boolean;
    v_available_seats := case
      when pool_merged then (usage_before -> 'available' ->> 'total')::integer
      else (usage_before -> 'available' ->> 'public')::integer
    end;
    if v_available_seats is not null and v_available_seats < 1 then
      new_status := 'waitlisted';
    end if;
  end if;

  insert into public.registrations (
    event_id, user_id, status, seats, seat_pool,
    manual_display_name, manual_contact, added_by_user_id,
    display_name_snapshot, waitlisted_at
  ) values (
    p_event_id, null, 'waitlisted', 1, 'public',
    normalized_display_name, normalized_contact, v_actor_user_id,
    normalized_display_name, statement_timestamp()
  )
  returning * into new_reg;
  new_registration_id := new_reg.id;

  if p_status = 'confirmed' then
    perform public.promote_next_waitlisted_locked_core(p_event_id, 'public', v_actor_user_id);
  elsif p_status = 'pending_organizer_confirmation' and new_status <> 'waitlisted' then
    select id into waitlist_head_id
    from public.registrations
    where event_id = p_event_id and status = 'waitlisted'
    order by waitlisted_at, id
    limit 1
    for update;

    if waitlist_head_id = new_registration_id then
      update public.registrations
      set status = 'offered',
          offered_at = statement_timestamp(),
          offer_expires_at = statement_timestamp() + interval '24 hours',
          transition_version = transition_version + 1,
          updated_at = statement_timestamp()
      where id = new_registration_id;

      update public.registrations
      set status = new_status,
          transition_version = transition_version + 1,
          updated_at = statement_timestamp()
      where id = new_registration_id;
    end if;
  end if;

  select * into new_reg
  from public.registrations
  where id = new_registration_id;
  new_status := new_reg.status;
  usage_after := public.event_capacity_usage(p_event_id);

  insert into public.audit_logs (
    actor_user_id, organizer_id, event_id, registration_id, action, before_state, after_state
  ) values (
    v_actor_user_id, event_row.organizer_id, p_event_id, new_registration_id,
    'registration.manual_added',
    jsonb_build_object('capacity_usage', usage_before),
    jsonb_build_object(
      'display_name', new_reg.manual_display_name,
      'requested_status', p_status,
      'status', new_status,
      'capacity_usage', usage_after
    )
  );

  return new_registration_id;
end;
$$;

create or replace function public.organizer_edit_manual_participant(
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
  before_reg public.registrations%rowtype;
  after_reg public.registrations%rowtype;
  event_row public.events%rowtype;
  usage_before jsonb;
  usage_after jsonb;
  target_event_id uuid;
  normalized_display_name text := nullif(btrim(coalesce(p_display_name, '')), '');
  normalized_contact text := nullif(btrim(coalesce(p_contact, '')), '');
begin
  select event_id into target_event_id from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'registration not found' using errcode = 'P0002';
  end if;

  select * into event_row from public.events where id = target_event_id for update;
  select * into reg from public.registrations where id = p_registration_id for update;
  if not found then
    raise exception 'registration not found' using errcode = 'P0002';
  end if;
  if reg.user_id is not null then
    raise exception 'this registration is self-managed, not a manual entry' using errcode = '42501';
  end if;
  if not public.is_organizer_admin(event_row.organizer_id, v_actor_user_id) then
    raise exception 'only an owner or admin may manage the participant roster' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in
    ('confirmed', 'waitlisted', 'pending_organizer_confirmation', 'cancelled', 'removed_by_organizer')
  then
    raise exception 'invalid status for a manual participant' using errcode = '22023';
  end if;

  perform public.sweep_event_locked(reg.event_id);
  select * into reg from public.registrations where id = p_registration_id for update;
  before_reg := reg;
  usage_before := public.event_capacity_usage(reg.event_id);

  if p_status = 'confirmed' and reg.status = 'waitlisted' then
    perform public.promote_next_waitlisted_locked_core(reg.event_id, reg.seat_pool, v_actor_user_id);
    select * into reg from public.registrations where id = p_registration_id for update;
    if reg.status <> 'confirmed' then
      raise exception 'manual waitlisted participant is not eligible for confirmation'
        using errcode = '55000';
    end if;
  elsif p_status is not null then
    update public.registrations
    set status = p_status,
        waitlisted_at = case
          when p_status = 'waitlisted' and status <> 'waitlisted' then statement_timestamp()
          when p_status <> 'waitlisted' then null
          else waitlisted_at
        end,
        transition_version = transition_version + 1,
        updated_at = statement_timestamp()
    where id = p_registration_id;

    if reg.status in ('offered', 'pending_organizer_confirmation', 'confirmed')
      and p_status in ('cancelled', 'removed_by_organizer')
    then
      perform public.promote_next_waitlisted_locked_core(reg.event_id, reg.seat_pool, v_actor_user_id);
    end if;
  end if;

  update public.registrations
  set manual_display_name = coalesce(normalized_display_name, manual_display_name),
      display_name_snapshot = coalesce(normalized_display_name, display_name_snapshot),
      manual_contact = case
        when p_contact is null then manual_contact
        else normalized_contact
      end,
      updated_at = statement_timestamp()
  where id = p_registration_id
  returning * into after_reg;
  usage_after := public.event_capacity_usage(reg.event_id);

  insert into public.audit_logs (
    actor_user_id, organizer_id, event_id, registration_id, action, before_state, after_state
  ) values (
    v_actor_user_id, event_row.organizer_id, reg.event_id, p_registration_id,
    'registration.manual_edited',
    jsonb_build_object(
      'display_name', before_reg.manual_display_name,
      'status', before_reg.status,
      'capacity_usage', usage_before
    ),
    jsonb_build_object(
      'display_name', after_reg.manual_display_name,
      'status', after_reg.status,
      'capacity_usage', usage_after
    )
  );
end;
$$;

create or replace function public.organizer_remove_manual_participant(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  reg public.registrations%rowtype;
  event_row public.events%rowtype;
  usage_before jsonb;
  usage_after jsonb;
  target_event_id uuid;
begin
  select event_id into target_event_id from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'registration not found' using errcode = 'P0002';
  end if;

  select * into event_row from public.events where id = target_event_id for update;
  select * into reg from public.registrations where id = p_registration_id for update;
  if not found then
    raise exception 'registration not found' using errcode = 'P0002';
  end if;
  if reg.user_id is not null then
    raise exception 'this registration is self-managed, not a manual entry' using errcode = '42501';
  end if;
  if not public.is_organizer_admin(event_row.organizer_id, v_actor_user_id) then
    raise exception 'only an owner or admin may manage the participant roster' using errcode = '42501';
  end if;

  perform public.sweep_event_locked(reg.event_id);
  select * into reg from public.registrations where id = p_registration_id for update;
  usage_before := public.event_capacity_usage(reg.event_id);

  if reg.status not in ('offered', 'pending_organizer_confirmation', 'confirmed', 'waitlisted') then
    return;
  end if;

  update public.registrations
  set status = 'removed_by_organizer',
      transition_version = transition_version + 1,
      updated_at = statement_timestamp()
  where id = p_registration_id;

  if reg.status in ('offered', 'pending_organizer_confirmation', 'confirmed') then
    perform public.promote_next_waitlisted_locked_core(reg.event_id, reg.seat_pool, v_actor_user_id);
  end if;

  usage_after := public.event_capacity_usage(reg.event_id);
  insert into public.audit_logs (
    actor_user_id, organizer_id, event_id, registration_id, action, before_state, after_state
  ) values (
    v_actor_user_id, event_row.organizer_id, reg.event_id, p_registration_id,
    'registration.manual_removed',
    jsonb_build_object('status', reg.status, 'capacity_usage', usage_before),
    jsonb_build_object('status', 'removed_by_organizer', 'capacity_usage', usage_after)
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
