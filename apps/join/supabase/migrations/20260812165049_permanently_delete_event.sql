-- P2-05: owner/admin-only permanent event deletion.
--
-- This is intentionally separate from cancel_event. Cancellation keeps the
-- event and its registration history; permanent deletion removes the event's
-- operational data after preserving one audit record with the event identity
-- in metadata. The caller must remove the public cover through Storage first,
-- while the event still exists for the Storage delete policy to authorize it.

create function public.delete_event_permanently(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_event public.events%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'authenticated organizer required' using errcode = '42501';
  end if;

  select *
  into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if not public.is_organizer_admin(v_event.organizer_id, v_actor_user_id) then
    raise exception 'only an owner or admin may permanently delete the event'
      using errcode = '42501';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    organizer_id,
    event_id,
    action,
    before_state,
    metadata
  ) values (
    v_actor_user_id,
    v_event.organizer_id,
    v_event.id,
    'event.deleted_permanently',
    jsonb_build_object('status', v_event.status, 'visibility', v_event.visibility),
    jsonb_build_object(
      'slug', v_event.slug,
      'title', v_event.title,
      'cover_image_url', v_event.cover_image_url,
      'permanent', true
    )
  );

  -- These relations use RESTRICT FKs so deletion is explicit and fail-fast.
  -- Delete answers before fields, and notifications/outbox/idempotency before
  -- registrations because their composite FKs retain registration history.
  delete from public.notifications where event_id = p_event_id;
  delete from public.outbox_events where event_id = p_event_id;
  delete from public.idempotency_requests where event_id = p_event_id;
  delete from public.registration_answers where event_id = p_event_id;
  delete from public.registrations where event_id = p_event_id;
  delete from public.event_password_grants where event_id = p_event_id;
  delete from public.event_invitees where event_id = p_event_id;
  delete from public.event_blocklist where event_id = p_event_id;
  delete from public.event_fields where event_id = p_event_id;
  delete from public.events where id = p_event_id;
end;
$$;

revoke all on function public.delete_event_permanently(uuid) from public, anon, authenticated;
grant execute on function public.delete_event_permanently(uuid) to authenticated;
