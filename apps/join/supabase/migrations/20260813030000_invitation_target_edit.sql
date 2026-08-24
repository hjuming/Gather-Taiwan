-- Wave 02: let the organizer correct an invitation name without changing
-- the guest's response or the shared invitation URL.

create function public.organizer_edit_event_invitation_target(
  p_target_id uuid,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_target public.event_invitation_targets%rowtype;
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if length(v_name) < 1 or length(v_name) > 80 then
    raise exception 'display name must be between 1 and 80 characters'
      using errcode = '22023';
  end if;

  select * into v_target
  from public.event_invitation_targets
  where id = p_target_id and revoked_at is null
  for update;
  if not found then
    raise exception 'invitation target not found' using errcode = 'P0002';
  end if;

  if not public.is_organizer_admin(public.event_organizer_id(v_target.event_id), v_actor_user_id) then
    raise exception 'only an owner or admin may manage invitation targets' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.events e
    where e.id = v_target.event_id and e.status = 'published'
      and e.visibility = 'private' and e.invite_only
  ) then
    raise exception 'shared guest invitations require a published private invite-only event'
      using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.event_invitation_targets other
    where other.event_id = v_target.event_id
      and other.id <> v_target.id
      and other.revoked_at is null
      and other.display_name_normalized = lower(v_name)
  ) then
    raise exception 'an invitation with this display name already exists'
      using errcode = '23505';
  end if;

  update public.event_invitation_targets
  set display_name = v_name, updated_at = statement_timestamp()
  where id = v_target.id;

  insert into public.audit_logs (actor_user_id, event_id, action, before_state, after_state)
  values (
    v_actor_user_id,
    v_target.event_id,
    'event_invitation.target_renamed',
    jsonb_build_object('target_id', v_target.id, 'display_name', v_target.display_name),
    jsonb_build_object('target_id', v_target.id, 'display_name', v_name)
  );
end;
$$;

revoke all on function public.organizer_edit_event_invitation_target(uuid, text) from public, anon;
grant execute on function public.organizer_edit_event_invitation_target(uuid, text) to authenticated;
