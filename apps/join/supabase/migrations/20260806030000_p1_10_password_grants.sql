-- P1-10 support: turn a verified event password into actual RLS-visible
-- access for the (authenticated) caller. P1-07 deliberately deferred this —
-- true anonymous-visitor access needs a Worker minting a scoped session
-- token, which doesn't exist yet. This migration closes the loop for
-- *logged-in* users only: verify_event_password(), on success, records a
-- grant; can_view_event() and a new events policy honor it. An anonymous
-- (not logged in) visitor must sign in before a password unlocks anything —
-- a reasonable simplification for this internal-test build, and a strictly
-- smaller surface than a full anonymous-session mechanism would be.

create table public.event_password_grants (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  granted_at timestamptz not null default statement_timestamp(),
  primary key (event_id, user_id)
);

alter table public.event_password_grants enable row level security;
alter table public.event_password_grants force row level security;
revoke all on table public.event_password_grants from public, anon, authenticated;

create function public.has_verified_event_password(
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
    select 1 from public.event_password_grants g
    where g.event_id = p_event_id and g.user_id = p_user_id
  )
$$;

revoke all on function public.has_verified_event_password(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.has_verified_event_password(uuid, uuid) to authenticated;

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
    or public.has_verified_event_password(p_event_id, p_user_id)
$$;

create policy events_select_password_verified on public.events
  for select to authenticated
  using (public.has_verified_event_password(id));

create or replace function public.verify_event_password(p_event_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  stored_hash text;
  dummy_hash text := crypt('dummy-password-never-matches', gen_salt('bf'));
  v_actor_user_id uuid := auth.uid();
  matched boolean;
begin
  select password_hash into stored_hash from public.events where id = p_event_id;

  if stored_hash is null then
    perform crypt(coalesce(p_password, ''), dummy_hash);
    return false;
  end if;

  matched := crypt(coalesce(p_password, ''), stored_hash) = stored_hash;

  if matched and v_actor_user_id is not null then
    insert into public.event_password_grants (event_id, user_id)
    values (p_event_id, v_actor_user_id)
    on conflict (event_id, user_id) do nothing;
  end if;

  return matched;
end;
$$;
