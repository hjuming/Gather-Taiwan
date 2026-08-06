-- P1-10 support: cancel_event. Locks the whole event to `cancelled` (which
-- guard_event_safety_edits_after_start already treats as a normal status
-- update, not a safety-critical field, so no trigger change needed) and
-- transitions every active registration to `cancelled`, one outbox row per
-- recipient, matching "整場取消鎖新報名並逐筆 outbox" (P1-10 acceptance).
-- event_registration_is_open() already requires status='published', so
-- setting status='cancelled' alone locks out new registrations — no
-- separate flag needed.

create function public.cancel_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  reg record;
begin
  if not public.is_organizer_admin(public.event_organizer_id(p_event_id), v_actor_user_id) then
    raise exception 'only an owner or admin may cancel the event' using errcode = '42501';
  end if;

  perform 1 from public.events where id = p_event_id for update;
  perform public.sweep_event_locked(p_event_id);

  update public.events
  set status = 'cancelled', updated_at = statement_timestamp()
  where id = p_event_id and status <> 'cancelled';

  for reg in
    select id, user_id, transition_version, status as previous_status
    from public.registrations
    where event_id = p_event_id
      and status in ('offered', 'pending_organizer_confirmation', 'confirmed', 'waitlisted')
    for update
  loop
    update public.registrations
    set status = 'cancelled', transition_version = transition_version + 1,
        updated_at = statement_timestamp()
    where id = reg.id;

    perform public.emit_registration_event(
      reg.id, p_event_id, reg.user_id, reg.transition_version + 1,
      'registration.event_cancelled', v_actor_user_id, 'registration.event_cancelled',
      jsonb_build_object('status', reg.previous_status),
      jsonb_build_object('status', 'cancelled', 'reason', 'event_cancelled')
    );
  end loop;

  insert into public.audit_logs (
    actor_user_id, event_id, action, after_state
  ) values (
    v_actor_user_id, p_event_id, 'event.cancelled', '{}'::jsonb
  );
end;
$$;

revoke all on function public.cancel_event(uuid) from public, anon, authenticated;
grant execute on function public.cancel_event(uuid) to authenticated;
