-- P1-10 support: verify_event_password_by_slug. A hidden (private,
-- not-yet-password-verified) event is invisible via normal SELECT — by
-- design, so a client can't distinguish "doesn't exist" from "exists but
-- you can't see it yet". That's exactly why the client has no event id to
-- pass into P1-07's verify_event_password(uuid, text): it never got to
-- read the row that would contain that id. This resolves slug -> id
-- server-side (security definer, bypasses RLS for that one lookup) using
-- the same dummy-hash discipline, then delegates to verify_event_password.
-- A slug that matches no row at all still runs a dummy comparison, so
-- "wrong password" and "no such slug" remain indistinguishable.

create function public.verify_event_password_by_slug(p_slug text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_event_id uuid;
  dummy_hash text := crypt('dummy-password-never-matches', gen_salt('bf'));
begin
  select id into v_event_id from public.events where slug = p_slug;

  if v_event_id is null then
    perform crypt(coalesce(p_password, ''), dummy_hash);
    return false;
  end if;

  return public.verify_event_password(v_event_id, p_password);
end;
$$;

revoke all on function public.verify_event_password_by_slug(text, text)
  from public, anon, authenticated;
grant execute on function public.verify_event_password_by_slug(text, text) to anon, authenticated;
