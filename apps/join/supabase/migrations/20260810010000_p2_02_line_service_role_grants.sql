-- P2-02 LINE callback backend access.
--
-- P1-02/P1-04 intentionally revoke table privileges from PUBLIC, anon, and
-- authenticated. The LINE callback is a server-side Worker and therefore
-- needs an explicit, narrow service_role grant to look up and provision the
-- matching public.users row. This migration does not grant anything to an
-- app role and does not alter RLS policies.

grant select (id, line_user_id, email, email_normalized, display_name, email_verified_at)
  on public.users to service_role;
grant insert (id, line_user_id, email, display_name, email_verified_at)
  on public.users to service_role;
grant update (id, line_user_id, email, display_name, email_verified_at)
  on public.users to service_role;
