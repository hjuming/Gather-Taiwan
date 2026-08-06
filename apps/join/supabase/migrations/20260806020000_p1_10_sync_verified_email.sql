-- P1-10 support: sync_verified_email. Bridges Supabase Auth's own email
-- confirmation (magic-link / OTP sign-in, auth.users.email_confirmed_at —
-- set by Supabase's own auth service, never client-controlled) into
-- public.users.email_verified_at. The client cannot set
-- email_verified_at directly (excluded from P1-04's INSERT/UPDATE grants
-- on purpose); this is the only path, and it only trusts Supabase's own
-- confirmation flag, never anything the client asserts about itself.
--
-- Scope note: this is what lets real internal testers sign in today
-- without Cloudflare Access (P1-03 dev-auth, staging-only) or LINE (P2-02,
-- not built yet). It doesn't replace either — D-7's "dev JWT only for
-- Phase 1" was about not building a throwaway custom auth UI; Supabase's
-- own hosted magic-link flow is exactly the identity foundation P1-14
-- already assumed, just wired in early because P1-10 needs *some* real
-- login path to be testable by anyone other than this session.

create function public.sync_verified_email()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, auth
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_email text;
  v_confirmed_at timestamptz;
begin
  if v_actor_user_id is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;

  select email, email_confirmed_at into v_email, v_confirmed_at
  from auth.users where id = v_actor_user_id;

  if v_confirmed_at is null then
    return;
  end if;

  update public.users
  set email = v_email, email_verified_at = v_confirmed_at, updated_at = statement_timestamp()
  where id = v_actor_user_id;
end;
$$;

revoke all on function public.sync_verified_email() from public, anon, authenticated;
grant execute on function public.sync_verified_email() to authenticated;
