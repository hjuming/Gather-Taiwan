-- P1-02 corrective migration. The original transfer function assumed the
-- owner-count constraint remained deferred. Make that assumption explicit so
-- callers cannot break an otherwise atomic transfer by setting constraints
-- immediate earlier in the transaction.

create or replace function public.transfer_organizer_ownership(
  p_organizer_id uuid,
  p_new_owner_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  current_owner_user_id uuid;
begin
  if actor_user_id is null then
    raise exception 'authenticated owner required' using errcode = '42501';
  end if;

  perform 1
  from public.organizers
  where id = p_organizer_id
  for update;

  if not found then
    raise exception 'organizer not found' using errcode = 'P0002';
  end if;

  select user_id
  into current_owner_user_id
  from public.organizer_members
  where organizer_id = p_organizer_id
    and role = 'owner'
    and revoked_at is null
  for update;

  if current_owner_user_id is distinct from actor_user_id then
    raise exception 'only the current owner can transfer ownership'
      using errcode = '42501';
  end if;

  if p_new_owner_user_id = current_owner_user_id then
    return;
  end if;

  perform 1
  from public.organizer_members
  where organizer_id = p_organizer_id
    and user_id = p_new_owner_user_id
    and revoked_at is null
  for update;

  if not found then
    raise exception 'new owner must be an active organizer member'
      using errcode = '23514';
  end if;

  set constraints organizer_members_must_preserve_one_owner deferred;

  update public.organizer_members
  set role = 'admin', updated_at = statement_timestamp()
  where organizer_id = p_organizer_id
    and user_id = current_owner_user_id;

  update public.organizer_members
  set role = 'owner', updated_at = statement_timestamp()
  where organizer_id = p_organizer_id
    and user_id = p_new_owner_user_id;

  set constraints organizer_members_must_preserve_one_owner immediate;

  insert into public.audit_logs (
    actor_user_id,
    organizer_id,
    action,
    before_state,
    after_state
  ) values (
    actor_user_id,
    p_organizer_id,
    'organizer.owner_transferred',
    jsonb_build_object('owner_user_id', current_owner_user_id),
    jsonb_build_object('owner_user_id', p_new_owner_user_id)
  );
end;
$$;

revoke all on function public.transfer_organizer_ownership(uuid, uuid)
  from public, anon, authenticated;
