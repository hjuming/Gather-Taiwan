-- Wave 04: synthetic LINE identities are placeholders, never verified emails.
--
-- This is a forward-only correction. It deliberately leaves auth.users and all
-- identity/linkage fields untouched. A real email can become verified only after
-- Supabase Auth confirms a non-synthetic address and this RPC copies that state.

create or replace function public.sync_verified_email()
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
  from auth.users
  where id = v_actor_user_id;

  if v_confirmed_at is null then
    return;
  end if;

  -- LINE fallback addresses are synthetic Auth identities. Even if an old
  -- account was accidentally confirmed, fail closed: do not copy confirmation
  -- into the public verified-email identity used by invite/capacity flows.
  if lower(btrim(coalesce(v_email, ''))) ~* '^line\+[^@]+@users\.noreply\.gather\.wedopr\.com$' then
    return;
  end if;

  update public.users
  set email = v_email,
      email_verified_at = v_confirmed_at,
      updated_at = statement_timestamp()
  where id = v_actor_user_id;
end;
$$;

-- Repair only the derived public verification timestamp. Preserve email,
-- line_user_id, display_name, and every relationship; do not touch auth.users.
update public.users
set email_verified_at = null,
    updated_at = statement_timestamp()
where email_verified_at is not null
  and email_normalized ~* '^line\+[^@]+@users\.noreply\.gather\.wedopr\.com$';

revoke all on function public.sync_verified_email() from public, anon, authenticated;
grant execute on function public.sync_verified_email() to authenticated;
