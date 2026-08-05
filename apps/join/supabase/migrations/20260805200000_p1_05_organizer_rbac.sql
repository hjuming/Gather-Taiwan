-- P1-05: owner/admin/staff RBAC — add and revoke co-organizer membership.
--
-- Scope decision: co-organizer invitation here is direct assignment by an
-- existing owner/admin naming an existing platform user (public.users row),
-- not an email/token claim subsystem like event_invitees (P1-07). A real
-- token-claim flow needs P1-14's email verification foundation to be
-- trustworthy (who is allowed to claim an invite depends on verified
-- email); building a half-verified version now would be worse than this
-- explicit, audited direct-assignment RPC. Owner transfer already exists
-- from P1-02 (public.transfer_organizer_ownership) and is untouched here.

create function public.add_organizer_member(
  p_organizer_id uuid,
  p_user_id uuid,
  p_role public.organizer_role
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  previous_role public.organizer_role;
begin
  if actor_user_id is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;

  if not public.is_organizer_admin(p_organizer_id, actor_user_id) then
    raise exception 'only an owner or admin may add organizer members'
      using errcode = '42501';
  end if;

  if p_role = 'owner' then
    raise exception 'use transfer_organizer_ownership to change the owner'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'target user does not exist' using errcode = 'P0002';
  end if;

  select role into previous_role
  from public.organizer_members
  where organizer_id = p_organizer_id and user_id = p_user_id;

  if previous_role is null then
    insert into public.organizer_members (organizer_id, user_id, role)
    values (p_organizer_id, p_user_id, p_role);
  elsif previous_role = 'owner' then
    raise exception 'use transfer_organizer_ownership to change the owner'
      using errcode = '42501';
  else
    update public.organizer_members
    set role = p_role, revoked_at = null, accepted_at = statement_timestamp(),
        updated_at = statement_timestamp()
    where organizer_id = p_organizer_id and user_id = p_user_id;
  end if;

  insert into public.audit_logs (
    actor_user_id, organizer_id, action, before_state, after_state
  ) values (
    actor_user_id,
    p_organizer_id,
    case when previous_role is null
      then 'organizer_member.added'
      else 'organizer_member.role_changed'
    end,
    jsonb_build_object('user_id', p_user_id, 'previous_role', previous_role),
    jsonb_build_object('user_id', p_user_id, 'role', p_role)
  );
end;
$$;

create function public.revoke_organizer_member(
  p_organizer_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  target_role public.organizer_role;
  target_revoked_at timestamptz;
begin
  if actor_user_id is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;

  if not public.is_organizer_admin(p_organizer_id, actor_user_id) then
    raise exception 'only an owner or admin may revoke organizer members'
      using errcode = '42501';
  end if;

  select role, revoked_at into target_role, target_revoked_at
  from public.organizer_members
  where organizer_id = p_organizer_id and user_id = p_user_id
  for update;

  if not found then
    raise exception 'membership not found' using errcode = 'P0002';
  end if;

  if target_role = 'owner' then
    raise exception 'transfer ownership before revoking the owner'
      using errcode = '42501';
  end if;

  if target_revoked_at is not null then
    return;
  end if;

  update public.organizer_members
  set revoked_at = statement_timestamp(), updated_at = statement_timestamp()
  where organizer_id = p_organizer_id and user_id = p_user_id;

  insert into public.audit_logs (
    actor_user_id, organizer_id, action, before_state, after_state
  ) values (
    actor_user_id,
    p_organizer_id,
    'organizer_member.revoked',
    jsonb_build_object('user_id', p_user_id, 'role', target_role),
    jsonb_build_object('user_id', p_user_id, 'revoked', true)
  );
end;
$$;

revoke all on function public.add_organizer_member(uuid, uuid, public.organizer_role)
  from public, anon, authenticated;
revoke all on function public.revoke_organizer_member(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.add_organizer_member(uuid, uuid, public.organizer_role)
  to authenticated;
grant execute on function public.revoke_organizer_member(uuid, uuid)
  to authenticated;
