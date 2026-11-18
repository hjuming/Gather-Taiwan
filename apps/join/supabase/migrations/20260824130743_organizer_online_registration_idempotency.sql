-- Wave 2: organizer actions are only valid for self-registered rows and use
-- the canonical idempotency_requests contract. The old overloads are removed
-- so an authenticated caller cannot bypass the online-only/idempotency gate.

drop function public.organizer_confirm_registration(uuid);
drop function public.organizer_decline_registration(uuid);
drop function public.organizer_remove_registration(uuid, text);

create function public.organizer_confirm_registration(
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
begin
  if v_actor_user_id is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  select * into reg from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'registration not found' using errcode = 'P0002';
  end if;
  if not public.is_organizer_admin(public.event_organizer_id(reg.event_id), v_actor_user_id) then
    raise exception 'only an owner or admin may confirm registrations' using errcode = '42501';
  end if;
  if reg.user_id is null then
    raise exception 'organizer actions only apply to online registrations' using errcode = '42501';
  end if;

  v_key_hash := encode(digest(p_idempotency_key, 'sha256'), 'hex');
  v_fingerprint := encode(digest(p_registration_id::text || '|organizer_confirm_registration', 'sha256'), 'hex');

  select * into existing
  from public.idempotency_requests
  where idempotency_requests.actor_user_id = v_actor_user_id
    and operation = 'organizer_confirm_registration'
    and key_hash = v_key_hash
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
  ) values (
    v_actor_user_id, 'organizer_confirm_registration', v_key_hash, reg.event_id, v_fingerprint
  );

  perform 1 from public.events where id = reg.event_id for update;
  perform public.sweep_event_locked(reg.event_id);
  select * into reg from public.registrations where id = p_registration_id;

  if reg.user_id is null then
    raise exception 'organizer actions only apply to online registrations' using errcode = '42501';
  end if;
  if reg.status <> 'pending_organizer_confirmation' then
    raise exception 'registration is not pending confirmation' using errcode = '55000';
  end if;

  update public.registrations
  set status = 'confirmed', transition_version = transition_version + 1,
      updated_at = statement_timestamp()
  where id = p_registration_id;

  perform public.emit_registration_event(
    p_registration_id, reg.event_id, reg.user_id, reg.transition_version + 1,
    'registration.confirmed', v_actor_user_id, 'registration.organizer_confirmed',
    jsonb_build_object('status', 'pending_organizer_confirmation'),
    jsonb_build_object('status', 'confirmed')
  );

  update public.idempotency_requests
  set result_registration_id = p_registration_id,
      response_status = 200,
      response_body = jsonb_build_object('registration_id', p_registration_id, 'status', 'confirmed'),
      completed_at = statement_timestamp()
  where idempotency_requests.actor_user_id = v_actor_user_id
    and operation = 'organizer_confirm_registration'
    and key_hash = v_key_hash;
end;
$$;

create function public.organizer_decline_registration(
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
begin
  if v_actor_user_id is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  select * into reg from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'registration not found' using errcode = 'P0002';
  end if;
  if not public.is_organizer_admin(public.event_organizer_id(reg.event_id), v_actor_user_id) then
    raise exception 'only an owner or admin may decline registrations' using errcode = '42501';
  end if;
  if reg.user_id is null then
    raise exception 'organizer actions only apply to online registrations' using errcode = '42501';
  end if;

  v_key_hash := encode(digest(p_idempotency_key, 'sha256'), 'hex');
  v_fingerprint := encode(digest(p_registration_id::text || '|organizer_decline_registration', 'sha256'), 'hex');

  select * into existing
  from public.idempotency_requests
  where idempotency_requests.actor_user_id = v_actor_user_id
    and operation = 'organizer_decline_registration'
    and key_hash = v_key_hash
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
  ) values (
    v_actor_user_id, 'organizer_decline_registration', v_key_hash, reg.event_id, v_fingerprint
  );

  perform 1 from public.events where id = reg.event_id for update;
  perform public.sweep_event_locked(reg.event_id);
  select * into reg from public.registrations where id = p_registration_id;

  if reg.user_id is null then
    raise exception 'organizer actions only apply to online registrations' using errcode = '42501';
  end if;
  if reg.status <> 'pending_organizer_confirmation' then
    raise exception 'registration is not pending confirmation' using errcode = '55000';
  end if;

  update public.registrations
  set status = 'declined', transition_version = transition_version + 1,
      updated_at = statement_timestamp()
  where id = p_registration_id;

  perform public.emit_registration_event(
    p_registration_id, reg.event_id, reg.user_id, reg.transition_version + 1,
    'registration.declined', v_actor_user_id, 'registration.organizer_declined',
    jsonb_build_object('status', 'pending_organizer_confirmation'),
    jsonb_build_object('status', 'declined')
  );

  perform public.promote_next_waitlisted_locked(reg.event_id, reg.seat_pool);

  update public.idempotency_requests
  set result_registration_id = p_registration_id,
      response_status = 200,
      response_body = jsonb_build_object('registration_id', p_registration_id, 'status', 'declined'),
      completed_at = statement_timestamp()
  where idempotency_requests.actor_user_id = v_actor_user_id
    and operation = 'organizer_decline_registration'
    and key_hash = v_key_hash;
end;
$$;

create function public.organizer_remove_registration(
  p_registration_id uuid,
  p_idempotency_key text,
  p_reason_internal text default null
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
begin
  if v_actor_user_id is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency key required' using errcode = '22023';
  end if;

  select * into reg from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'registration not found' using errcode = 'P0002';
  end if;
  if not public.is_organizer_admin(public.event_organizer_id(reg.event_id), v_actor_user_id) then
    raise exception 'only an owner or admin may remove registrations' using errcode = '42501';
  end if;
  if reg.user_id is null then
    raise exception 'organizer actions only apply to online registrations' using errcode = '42501';
  end if;

  v_key_hash := encode(digest(p_idempotency_key, 'sha256'), 'hex');
  v_fingerprint := encode(digest(
    p_registration_id::text || '|organizer_remove_registration|' || coalesce(p_reason_internal, ''),
    'sha256'
  ), 'hex');

  select * into existing
  from public.idempotency_requests
  where idempotency_requests.actor_user_id = v_actor_user_id
    and operation = 'organizer_remove_registration'
    and key_hash = v_key_hash
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
  ) values (
    v_actor_user_id, 'organizer_remove_registration', v_key_hash, reg.event_id, v_fingerprint
  );

  perform 1 from public.events where id = reg.event_id for update;
  perform public.sweep_event_locked(reg.event_id);
  select * into reg from public.registrations where id = p_registration_id;

  if reg.user_id is null then
    raise exception 'organizer actions only apply to online registrations' using errcode = '42501';
  end if;
  if reg.status not in ('offered', 'pending_organizer_confirmation', 'confirmed', 'waitlisted') then
    update public.idempotency_requests
    set result_registration_id = p_registration_id,
        response_status = 200,
        response_body = jsonb_build_object('registration_id', p_registration_id, 'status', reg.status),
        completed_at = statement_timestamp()
    where idempotency_requests.actor_user_id = v_actor_user_id
      and operation = 'organizer_remove_registration'
      and key_hash = v_key_hash;
    return;
  end if;

  update public.registrations
  set status = 'removed_by_organizer', transition_version = transition_version + 1,
      updated_at = statement_timestamp()
  where id = p_registration_id;

  perform public.emit_registration_event(
    p_registration_id, reg.event_id, reg.user_id, reg.transition_version + 1,
    'registration.removed', v_actor_user_id, 'registration.removed_by_organizer',
    jsonb_build_object('status', reg.status),
    jsonb_build_object('status', 'removed_by_organizer', 'reason_internal', p_reason_internal)
  );

  if reg.status in ('offered', 'pending_organizer_confirmation', 'confirmed') then
    perform public.promote_next_waitlisted_locked(reg.event_id, reg.seat_pool);
  end if;

  update public.idempotency_requests
  set result_registration_id = p_registration_id,
      response_status = 200,
      response_body = jsonb_build_object('registration_id', p_registration_id, 'status', 'removed_by_organizer'),
      completed_at = statement_timestamp()
  where idempotency_requests.actor_user_id = v_actor_user_id
    and operation = 'organizer_remove_registration'
    and key_hash = v_key_hash;
end;
$$;

revoke all on function public.organizer_confirm_registration(uuid, text) from public, anon, authenticated;
revoke all on function public.organizer_decline_registration(uuid, text) from public, anon, authenticated;
revoke all on function public.organizer_remove_registration(uuid, text, text) from public, anon, authenticated;
grant execute on function public.organizer_confirm_registration(uuid, text) to authenticated;
grant execute on function public.organizer_decline_registration(uuid, text) to authenticated;
grant execute on function public.organizer_remove_registration(uuid, text, text) to authenticated;
