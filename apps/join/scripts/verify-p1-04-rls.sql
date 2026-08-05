-- P1-04 RLS behavior verification. Runs entirely inside one transaction and
-- rolls back at the end; no synthetic data is left behind. Requires the
-- P1-04 migration (20260805190000_p1_04_default_deny_rls.sql) already
-- applied to the target database.
--
-- Usage (against the Gather cloud project; never run against production
-- without confirming with the project owner first):
--   set -a; source .env.supabase.local; set +a
--   DB_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
--   PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$DB_URL" -f scripts/verify-p1-04-rls.sql
--
-- Expect nine "PASS N" lines and two "expecting permission-denied" blocks
-- that each surface exactly one ERROR (password_hash select, registrations
-- insert). Any "FAIL" line or a missing ERROR means the Gate has regressed.

\set ON_ERROR_STOP on
\set QUIET on
begin;

-- ---------------------------------------------------------------------------
-- Fixtures (created as the superuser migration role, bypasses RLS by design)
-- ---------------------------------------------------------------------------

insert into auth.users (id) values
  ('a0000000-0000-4000-8000-00000000000a'),
  ('b0000000-0000-4000-8000-00000000000b'),
  ('c0000000-0000-4000-8000-00000000000c'),
  ('d0000000-0000-4000-8000-00000000000d');

insert into public.users (id, email, display_name) values
  ('a0000000-0000-4000-8000-00000000000a', 'owner-a@test.invalid', 'Owner A'),
  ('b0000000-0000-4000-8000-00000000000b', 'owner-b@test.invalid', 'Owner B'),
  ('c0000000-0000-4000-8000-00000000000c', 'outsider@test.invalid', 'Outsider C'),
  ('d0000000-0000-4000-8000-00000000000d', 'staff-a@test.invalid', 'Staff D');

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.create_organizer('org-alpha', 'Organizer Alpha') as org_alpha_id \gset
reset role;
reset request.jwt.claim.sub;

set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-00000000000b';
select public.create_organizer('org-beta', 'Organizer Beta') as org_beta_id \gset
reset role;
reset request.jwt.claim.sub;

insert into public.organizer_members (organizer_id, user_id, role)
values (:'org_alpha_id', 'd0000000-0000-4000-8000-00000000000d', 'staff');

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
insert into public.events (
  organizer_id, created_by_user_id, slug, title, status, visibility,
  confirmation_mode, timezone, starts_at, ends_at
) values (
  :'org_alpha_id', 'a0000000-0000-4000-8000-00000000000a', 'alpha-private-draft',
  'Alpha Private Draft', 'draft', 'private', 'instant', 'Asia/Taipei',
  now() + interval '3 days', now() + interval '3 days 2 hours'
) returning id as alpha_private_event_id \gset

insert into public.events (
  organizer_id, created_by_user_id, slug, title, status, visibility,
  confirmation_mode, timezone, starts_at, ends_at
) values (
  :'org_alpha_id', 'a0000000-0000-4000-8000-00000000000a', 'alpha-public-live',
  'Alpha Public Live', 'published', 'public', 'instant', 'Asia/Taipei',
  now() + interval '5 days', now() + interval '5 days 2 hours'
) returning id as alpha_public_event_id \gset
reset role;
reset request.jwt.claim.sub;

insert into public.registrations (event_id, user_id, status)
values (:'alpha_public_event_id', 'c0000000-0000-4000-8000-00000000000c', 'confirmed')
returning id as outsider_registration_id \gset

\set QUIET off
\set ON_ERROR_STOP off
\echo '=== fixtures ready: org_alpha=':org_alpha_id' org_beta=':org_beta_id' ==='

-- ---------------------------------------------------------------------------
-- 1. Outsider cannot see Alpha's organizer row (cross-tenant)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-00000000000c';
select count(*) as n from public.organizers where id = :'org_alpha_id' \gset check1_
\if :check1_n
  \echo 'FAIL 1: outsider saw organizer row'
\else
  \echo 'PASS 1: outsider cannot see organizer row'
\endif
reset role;
reset request.jwt.claim.sub;

-- ---------------------------------------------------------------------------
-- 2. Beta owner cannot see Alpha's private draft event (cross-tenant), but
--    CAN see Alpha's public published event
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-00000000000b';
select count(*) as n from public.events where id = :'alpha_private_event_id' \gset check2_
select count(*) as n from public.events where id = :'alpha_public_event_id' \gset check3_
\if :check2_n
  \echo 'FAIL 2: cross-tenant saw private draft event'
\else
  \echo 'PASS 2: cross-tenant cannot see private draft event'
\endif
\if :check3_n
  \echo 'PASS 3: cross-tenant CAN see published public event'
\else
  \echo 'FAIL 3: cross-tenant could not see published public event'
\endif
reset role;
reset request.jwt.claim.sub;

-- ---------------------------------------------------------------------------
-- 3. Anon cannot see Alpha's private draft event, but sees the public one
-- ---------------------------------------------------------------------------
set local role anon;
select count(*) as n from public.events where id = :'alpha_private_event_id' \gset check4_
select count(*) as n from public.events where id = :'alpha_public_event_id' \gset check5_
\if :check4_n
  \echo 'FAIL 4: anon saw private draft event'
\else
  \echo 'PASS 4: anon cannot see private draft event'
\endif
\if :check5_n
  \echo 'PASS 5: anon CAN see published public event'
\else
  \echo 'FAIL 5: anon could not see published public event'
\endif
reset role;

-- ---------------------------------------------------------------------------
-- 4. Alpha owner CAN see both Alpha events (own tenant, any status)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select (count(*) = 2) as ok from public.events where organizer_id = :'org_alpha_id' \gset check6_
\if :check6_ok
  \echo 'PASS 6: Alpha owner sees both own events'
\else
  \echo 'FAIL 6: Alpha owner did not see exactly 2 own events'
\endif
reset role;
reset request.jwt.claim.sub;

-- ---------------------------------------------------------------------------
-- 5. password_hash is never selectable, even by the organizer owner
-- ---------------------------------------------------------------------------
savepoint before_pwhash;
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
\echo 'expecting permission-denied on password_hash select:'
select password_hash from public.events where id = :'alpha_private_event_id';
rollback to savepoint before_pwhash;
reset role;
reset request.jwt.claim.sub;

-- ---------------------------------------------------------------------------
-- 6. Staff (non-admin) cannot UPDATE an event (row-filtered to zero, no error)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-00000000000d';
update public.events set title = 'hijacked' where id = :'alpha_private_event_id';
\echo 'rows updated by staff (expect 0):'
\echo :ROW_COUNT
reset role;
reset request.jwt.claim.sub;

-- ---------------------------------------------------------------------------
-- 7. authenticated role cannot INSERT into registrations at all (write-closed
--    until the seat-engine RPC exists)
-- ---------------------------------------------------------------------------
savepoint before_reg_insert;
set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-00000000000c';
\echo 'expecting permission-denied on registrations insert:'
insert into public.registrations (event_id, user_id, status)
values (:'alpha_public_event_id', 'c0000000-0000-4000-8000-00000000000c', 'confirmed');
rollback to savepoint before_reg_insert;
reset role;
reset request.jwt.claim.sub;

-- ---------------------------------------------------------------------------
-- 8. registration visibility: owner-of-registration and event's organizer
--    can see it; unrelated organizer (Beta) cannot
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-00000000000c';
select (count(*) = 1) as ok from public.registrations where id = :'outsider_registration_id' \gset check7_
reset role;
reset request.jwt.claim.sub;

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select (count(*) = 1) as ok from public.registrations where id = :'outsider_registration_id' \gset check8_
reset role;
reset request.jwt.claim.sub;

set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-00000000000b';
select (count(*) = 0) as ok from public.registrations where id = :'outsider_registration_id' \gset check9_
reset role;
reset request.jwt.claim.sub;

\if :check7_ok
  \echo 'PASS 7: registrant sees own registration'
\else
  \echo 'FAIL 7: registrant cannot see own registration'
\endif
\if :check8_ok
  \echo 'PASS 8: event organizer sees the registration'
\else
  \echo 'FAIL 8: event organizer cannot see the registration'
\endif
\if :check9_ok
  \echo 'PASS 9: unrelated organizer cannot see the registration'
\else
  \echo 'FAIL 9: unrelated organizer saw the registration (cross-tenant leak)'
\endif

\echo '=== end of script ==='

rollback;
