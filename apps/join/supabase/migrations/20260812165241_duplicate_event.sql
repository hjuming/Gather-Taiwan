-- P2-06: owner/admin-only repeat of a completed or cancelled event.
--
-- The copy is a new published event with a new slug. Registration status,
-- answers, one-time invite tokens, payment declarations and delivery history
-- are deliberately not copied. Verified-email invite identities and manual
-- roster names are copied as fresh pending invitations for the new event.

create function public.duplicate_event(
  p_event_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_source public.events%rowtype;
  v_new_event_id uuid;
  v_new_slug text;
begin
  if v_actor_user_id is null then
    raise exception 'authenticated organizer required' using errcode = '42501';
  end if;

  if p_starts_at is null or p_ends_at is null or p_starts_at <= statement_timestamp()
     or p_starts_at >= p_ends_at then
    raise exception 'a new event must start in the future and end after it starts'
      using errcode = '22023';
  end if;

  select *
  into v_source
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if not public.is_organizer_admin(v_source.organizer_id, v_actor_user_id) then
    raise exception 'only an owner or admin may repeat the event'
      using errcode = '42501';
  end if;

  if v_source.status <> 'cancelled' and v_source.ends_at >= statement_timestamp() then
    raise exception 'event must be cancelled or completed' using errcode = '22023';
  end if;

  v_new_slug := left(v_source.slug, 86)
    || '-'
    || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.events (
    organizer_id,
    created_by_user_id,
    slug,
    title,
    summary,
    description,
    status,
    visibility,
    confirmation_mode,
    timezone,
    starts_at,
    ends_at,
    registration_opens_at,
    registration_closes_at,
    location_name,
    location_address,
    capacity,
    fee_amount,
    fee_currency,
    payment_instructions,
    roster_visibility,
    roster_show_capacity,
    password_hash,
    invite_only,
    min_age,
    invite_reserved_seats,
    invite_pool_deadline,
    invite_pool_released_at,
    gathering_type,
    cover_image_url
  ) values (
    v_source.organizer_id,
    v_actor_user_id,
    v_new_slug,
    v_source.title,
    v_source.summary,
    v_source.description,
    'published',
    v_source.visibility,
    v_source.confirmation_mode,
    v_source.timezone,
    p_starts_at,
    p_ends_at,
    null,
    null,
    v_source.location_name,
    v_source.location_address,
    v_source.capacity,
    v_source.fee_amount,
    v_source.fee_currency,
    v_source.payment_instructions,
    v_source.roster_visibility,
    v_source.roster_show_capacity,
    v_source.password_hash,
    v_source.invite_only,
    v_source.min_age,
    null,
    null,
    null,
    v_source.gathering_type,
    case
      when v_source.cover_image_url like '/uploads/%' then v_source.cover_image_url
      else null
    end
  )
  returning id into v_new_event_id;

  insert into public.event_fields (
    event_id,
    field_key,
    label,
    field_type,
    is_required,
    options,
    position
  )
  select
    v_new_event_id,
    field_key,
    label,
    field_type,
    is_required,
    options,
    position
  from public.event_fields
  where event_id = p_event_id
  order by position, id;

  -- A one-time token cannot be reconstructed from its hash. Only active
  -- verified-email identities are copied, with a fresh lifetime for the new
  -- event instead of an absolute expiry inherited from the old event.
  insert into public.event_invitees (
    event_id,
    invitee_type,
    invitee_key_hash,
    expires_at,
    created_by_user_id
  )
  select
    v_new_event_id,
    'verified_email',
    invitee_key_hash,
    null,
    v_actor_user_id
  from public.event_invitees
  where event_id = p_event_id
    and invitee_type = 'verified_email'
    and revoked_at is null;

  -- Manual roster entries represent organizer-entered invitees. Recreate them
  -- as pending rows; self-registered users and their old status are not copied.
  insert into public.registrations (
    event_id,
    user_id,
    status,
    seats,
    seat_pool,
    manual_display_name,
    manual_contact,
    added_by_user_id,
    display_name_snapshot
  )
  select
    v_new_event_id,
    null,
    case
      when v_source.confirmation_mode = 'organizer_confirmed'
        then 'pending_organizer_confirmation'::public.registration_status
      else 'confirmed'::public.registration_status
    end,
    greatest(seats, 1),
    'public',
    btrim(manual_display_name),
    nullif(btrim(coalesce(manual_contact, '')), ''),
    v_actor_user_id,
    btrim(manual_display_name)
  from public.registrations
  where event_id = p_event_id
    and user_id is null
    and btrim(coalesce(manual_display_name, '')) <> ''
    and status <> 'removed_by_organizer';

  insert into public.audit_logs (
    actor_user_id,
    organizer_id,
    event_id,
    action,
    metadata
  ) values (
    v_actor_user_id,
    v_source.organizer_id,
    p_event_id,
    'event.duplicated',
    jsonb_build_object(
      'source_event_id', p_event_id,
      'new_event_id', v_new_event_id,
      'new_slug', v_new_slug,
      'cover_copied_by_client', v_source.cover_image_url is not null
        and v_source.cover_image_url !~ '^/uploads/'
    )
  );

  return jsonb_build_object('id', v_new_event_id, 'slug', v_new_slug);
end;
$$;

revoke all on function public.duplicate_event(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.duplicate_event(uuid, timestamptz, timestamptz)
  to authenticated;
