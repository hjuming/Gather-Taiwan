-- Private invite links can cycle one invitee between pending, attending, and
-- declined. Active invitation targets remain the primary status source when
-- a name also exists as a manual registration, so counts do not double count.

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

  select coalesce(sum(seats), 0)::integer into v_registration_count
  from public.registrations registration
  where registration.event_id = v_event.id
    and registration.status in ('offered', 'pending_organizer_confirmation', 'confirmed')
    and not exists (
      select 1
      from public.event_invitation_targets target
      where target.event_id = v_event.id
        and target.revoked_at is null
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
    select
      target.id as roster_id,
      target.display_name,
      target.response,
      target.created_at,
      0 as source_order
    from public.event_invitation_targets target
    where target.event_id = v_event.id
      and target.revoked_at is null

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
        select 1
        from public.event_invitation_targets target
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
    'attending_count', v_registration_count + v_guest_count,
    'invitees', v_invitees,
    'guest_response', case when v_current_target.id is null then null else v_current_target.response end,
    'guest_display_name', case when v_current_target.id is null then null else v_current_target.display_name end
  );
end;
$$;

create or replace function public.respond_to_event_invitation(
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
      from public.registrations registration
      where registration.event_id = v_event.id
        and registration.status in ('offered', 'pending_organizer_confirmation', 'confirmed')
        and not exists (
          select 1 from public.event_invitation_targets target
          where target.event_id = v_event.id
            and target.revoked_at is null
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
      if v_event.capacity is not null and v_registration_count + v_guest_count >= v_event.capacity then
        raise exception '這場聚會已額滿' using errcode = '53300';
      end if;
    end if;
    insert into public.event_invitation_targets (
      event_id, display_name, response, guest_key_hash, responded_at
    ) values (
      v_event.id, v_name, v_response, v_guest_key_hash,
      case when v_response = 'pending' then null else statement_timestamp() end
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
      from public.registrations registration
      where registration.event_id = v_event.id
        and registration.status in ('offered', 'pending_organizer_confirmation', 'confirmed')
        and not exists (
          select 1 from public.event_invitation_targets target
          where target.event_id = v_event.id
            and target.revoked_at is null
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
    set display_name = v_name,
        response = v_response,
        guest_key_hash = v_guest_key_hash,
        responded_at = case when v_response = 'pending' then null else statement_timestamp() end,
        updated_at = statement_timestamp()
    where id = v_target.id
    returning * into v_target;
  end if;

  select coalesce(sum(seats), 0)::integer into v_registration_count
  from public.registrations registration
  where registration.event_id = v_event.id
    and registration.status in ('offered', 'pending_organizer_confirmation', 'confirmed')
    and not exists (
      select 1 from public.event_invitation_targets target
      where target.event_id = v_event.id
        and target.revoked_at is null
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

  if v_event.capacity is not null and v_attending_count > v_event.capacity then
    raise exception '這場聚會已額滿' using errcode = '53300';
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
