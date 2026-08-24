-- Guest invitation pages need a compact, private-link-only roster summary.
-- The base table remains protected by RLS; this function exposes only the
-- display name and response state for an invite-only published event.

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
  from public.registrations
  where event_id = v_event.id
    and status in ('offered', 'pending_organizer_confirmation', 'confirmed');

  select count(*)::integer into v_guest_count
  from public.event_invitation_targets
  where event_id = v_event.id
    and response = 'attending'
    and revoked_at is null;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', target.id,
        'display_name', target.display_name,
        'response', target.response
      ) order by target.created_at
    ),
    '[]'::jsonb
  ) into v_invitees
  from public.event_invitation_targets target
  where target.event_id = v_event.id
    and target.revoked_at is null;

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

grant execute on function public.get_event_invitation_by_slug(text, text) to anon, authenticated;
