-- P1-07: dual invite system (verified-email auto-eligibility + one-time
-- token claim), event password view verification with dummy-hash timing
-- safety, and private-event visibility for invited users.
--
-- Scope decisions (documented in docs/evidence/p1-07-green.md):
-- - "password view cookie" (issuing/reading an HTTP cookie, and turning a
--   verified password into RLS-visible context for an anonymous visitor)
--   requires a Worker/API layer minting a short-lived scoped token — the
--   same pattern P1-03's dev-auth worker already uses. That worker doesn't
--   exist for the public event-viewing flow yet; building it now would be
--   premature, out of order with P1-10 (which owns the actual event page).
--   This migration only ships the DB-level password primitive
--   (set/verify), usable once that worker exists.
-- - "URL token referrer/log leak prevention and immediate URL clearing" is
--   entirely client-side (P1-10); nothing for a DB migration to do here.
-- - co-organizer invites (P1-05's add_organizer_member) are unrelated to
--   event invites (event_invitees, this migration); not touched here.

create function public.hash_invitee_key(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog, extensions
as $$
  select encode(digest(lower(btrim(p_value)), 'sha256'), 'hex')
$$;

revoke all on function public.hash_invitee_key(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Extend invite eligibility: a verified-email invite grants eligibility
-- automatically (identity match, no claim step needed as a security gate);
-- a one-time-token invite requires an explicit claim (token possession,
-- not identity, is what it proves, and must be single-use).
-- ---------------------------------------------------------------------------

create or replace function public.is_event_invitee(
  p_event_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select p_user_id is not null and exists (
    select 1
    from public.event_invitees ei
    where ei.event_id = p_event_id
      and ei.revoked_at is null
      and (
        ei.claimed_by_user_id = p_user_id
        or (
          ei.invitee_type = 'verified_email'
          and exists (
            select 1 from public.users u
            where u.id = p_user_id
              and u.email_verified_at is not null
              and public.hash_invitee_key(u.email_normalized) = ei.invitee_key_hash
          )
        )
      )
  )
$$;

-- Private events are visible to their invitees too, not just organizer
-- members and public+published rows.
create or replace function public.can_view_event(
  p_event_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select public.event_is_public_readable(p_event_id)
    or public.is_organizer_member(public.event_organizer_id(p_event_id), p_user_id)
    or public.is_event_invitee(p_event_id, p_user_id)
$$;

-- P1-04's events table RLS only had two SELECT policies: organizer members,
-- and public+published rows. can_view_event() above already accounted for
-- invitees, but nothing wired that into the events table itself — an
-- invitee's registration eligibility worked (register_for_event checks
-- is_event_invitee directly) while viewing the event row did not, since RLS
-- policies are independent of any application-level helper unless a policy
-- actually calls it. Multiple permissive SELECT policies are OR'd together
-- in Postgres, so this purely adds a case, without touching the existing two.
create policy events_select_invitee on public.events
  for select to authenticated
  using (public.is_event_invitee(id));

-- ---------------------------------------------------------------------------
-- create_event_invite / claim_event_invite_by_token / revoke_event_invite
-- ---------------------------------------------------------------------------

create function public.create_event_invite(
  p_event_id uuid,
  p_invitee_type public.invitee_type,
  p_identifier text,
  p_expires_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_key_hash text;
  v_token text;
  v_token_hash text;
  v_invite_id uuid;
begin
  if not public.is_organizer_admin(public.event_organizer_id(p_event_id), v_actor_user_id) then
    raise exception 'only an owner or admin may create event invites' using errcode = '42501';
  end if;
  if p_identifier is null or btrim(p_identifier) = '' then
    raise exception 'identifier is required' using errcode = '22023';
  end if;

  if p_invitee_type = 'verified_email' then
    v_key_hash := public.hash_invitee_key(p_identifier);
    insert into public.event_invitees (
      event_id, invitee_type, invitee_key_hash, expires_at, created_by_user_id
    ) values (
      p_event_id, 'verified_email', v_key_hash, p_expires_at, v_actor_user_id
    )
    returning id into v_invite_id;
    v_token := null;
  else
    v_token := encode(gen_random_bytes(24), 'hex');
    v_token_hash := public.hash_invitee_key(v_token);
    v_key_hash := public.hash_invitee_key(p_identifier || ':' || v_token_hash);
    insert into public.event_invitees (
      event_id, invitee_type, invitee_key_hash, token_hash, expires_at, created_by_user_id
    ) values (
      p_event_id, 'one_time_token', v_key_hash, v_token_hash, p_expires_at, v_actor_user_id
    )
    returning id into v_invite_id;
  end if;

  insert into public.audit_logs (
    actor_user_id, event_id, action, after_state
  ) values (
    v_actor_user_id, p_event_id, 'event_invitee.created',
    jsonb_build_object('invitee_id', v_invite_id, 'invitee_type', p_invitee_type)
  );

  return v_token;
end;
$$;

create function public.claim_event_invite_by_token(
  p_event_id uuid,
  p_token text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_token_hash text;
  invite record;
begin
  if v_actor_user_id is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;
  if p_token is null or btrim(p_token) = '' then
    raise exception 'token is required' using errcode = '22023';
  end if;

  v_token_hash := public.hash_invitee_key(p_token);

  select * into invite
  from public.event_invitees
  where event_id = p_event_id
    and invitee_type = 'one_time_token'
    and token_hash = v_token_hash
  for update;

  if not found then
    raise exception 'invalid invite token' using errcode = '42501';
  end if;
  if invite.revoked_at is not null then
    raise exception 'this invite has been revoked' using errcode = '42501';
  end if;
  if invite.expires_at is not null and invite.expires_at < statement_timestamp() then
    raise exception 'this invite has expired' using errcode = '42501';
  end if;
  if invite.claimed_at is not null then
    if invite.claimed_by_user_id = v_actor_user_id then
      return;
    end if;
    raise exception 'this invite has already been claimed' using errcode = '42501';
  end if;

  update public.event_invitees
  set claimed_at = statement_timestamp(), claimed_by_user_id = v_actor_user_id
  where id = invite.id;

  insert into public.audit_logs (
    actor_user_id, event_id, action, before_state, after_state
  ) values (
    v_actor_user_id, p_event_id, 'event_invitee.claimed',
    jsonb_build_object('invitee_id', invite.id),
    jsonb_build_object('claimed_by_user_id', v_actor_user_id)
  );
end;
$$;

create function public.revoke_event_invite(p_invitee_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
  invite record;
begin
  select * into invite from public.event_invitees where id = p_invitee_id for update;
  if not found then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;

  if not public.is_organizer_admin(public.event_organizer_id(invite.event_id), v_actor_user_id) then
    raise exception 'only an owner or admin may revoke event invites' using errcode = '42501';
  end if;

  if invite.revoked_at is not null then
    return;
  end if;

  update public.event_invitees
  set revoked_at = statement_timestamp()
  where id = p_invitee_id;

  insert into public.audit_logs (
    actor_user_id, event_id, action, before_state, after_state
  ) values (
    v_actor_user_id, invite.event_id, 'event_invitee.revoked',
    jsonb_build_object('invitee_id', p_invitee_id),
    jsonb_build_object('revoked', true)
  );
end;
$$;

revoke all on function public.create_event_invite(uuid, public.invitee_type, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.claim_event_invite_by_token(uuid, text)
  from public, anon, authenticated;
revoke all on function public.revoke_event_invite(uuid) from public, anon, authenticated;
grant execute on function public.create_event_invite(uuid, public.invitee_type, text, timestamptz)
  to authenticated;
grant execute on function public.claim_event_invite_by_token(uuid, text) to authenticated;
grant execute on function public.revoke_event_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Event password: set (admin/owner) / verify (anyone, including anon —
-- entering a password to view a page does not require an account). The
-- dummy-hash comparison keeps timing and code path identical whether the
-- event exists, has no password, or the password is simply wrong, so none
-- of those cases are distinguishable from outside.
-- ---------------------------------------------------------------------------

create function public.set_event_password(p_event_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_actor_user_id uuid := auth.uid();
begin
  if not public.is_organizer_admin(public.event_organizer_id(p_event_id), v_actor_user_id) then
    raise exception 'only an owner or admin may set the event password' using errcode = '42501';
  end if;
  if p_password is null or length(p_password) < 4 then
    raise exception 'password must be at least 4 characters' using errcode = '22023';
  end if;

  update public.events
  set password_hash = crypt(p_password, gen_salt('bf')), updated_at = statement_timestamp()
  where id = p_event_id;

  insert into public.audit_logs (
    actor_user_id, event_id, action, after_state
  ) values (
    v_actor_user_id, p_event_id, 'event.password_set', '{}'::jsonb
  );
end;
$$;

create function public.verify_event_password(p_event_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  stored_hash text;
  dummy_hash text := crypt('dummy-password-never-matches', gen_salt('bf'));
begin
  select password_hash into stored_hash from public.events where id = p_event_id;

  if stored_hash is null then
    perform crypt(coalesce(p_password, ''), dummy_hash);
    return false;
  end if;

  return crypt(coalesce(p_password, ''), stored_hash) = stored_hash;
end;
$$;

revoke all on function public.set_event_password(uuid, text) from public, anon, authenticated;
revoke all on function public.verify_event_password(uuid, text) from public, anon, authenticated;
grant execute on function public.set_event_password(uuid, text) to authenticated;
grant execute on function public.verify_event_password(uuid, text) to anon, authenticated;
