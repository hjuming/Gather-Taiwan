-- P1-05 organizer RBAC behavior verification. Runs entirely inside one
-- transaction and rolls back at the end; no synthetic data is left behind.
-- Requires the P1-05 migration (20260805200000_p1_05_organizer_rbac.sql)
-- already applied. Usage: pnpm verify:p1-05.
\set ON_ERROR_STOP on
\set QUIET on
begin;


insert into auth.users (id) values
  ('a0000000-0000-4000-8000-00000000000a'),
  ('b0000000-0000-4000-8000-00000000000b'),
  ('c0000000-0000-4000-8000-00000000000c'),
  ('d0000000-0000-4000-8000-00000000000d');

insert into public.users (id, email, display_name) values
  ('a0000000-0000-4000-8000-00000000000a', 'owner-a@test.invalid', 'Owner A'),
  ('b0000000-0000-4000-8000-00000000000b', 'staff-b@test.invalid', 'Staff B'),
  ('c0000000-0000-4000-8000-00000000000c', 'outsider@test.invalid', 'Outsider C'),
  ('d0000000-0000-4000-8000-00000000000d', 'newadmin-d@test.invalid', 'New Admin D');

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.create_organizer('org-alpha', 'Organizer Alpha') as org_alpha_id \gset
reset role;
reset request.jwt.claim.sub;

\set QUIET off
\set ON_ERROR_STOP off

-- 1. owner adds B as staff -> should succeed
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.add_organizer_member(:'org_alpha_id', 'b0000000-0000-4000-8000-00000000000b', 'staff');
reset role;
reset request.jwt.claim.sub;
select (role='staff' and revoked_at is null) as ok from public.organizer_members where organizer_id=:'org_alpha_id' and user_id='b0000000-0000-4000-8000-00000000000b' \gset check1_
\if :check1_ok
  \echo 'PASS 1: owner added B as staff'
\else
  \echo 'FAIL 1: B not recorded as active staff'
\endif

-- 2. staff B (non-admin) cannot add outsider C -> expect error
savepoint before_staff_add;
set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-00000000000b';
\echo 'expecting error: staff cannot add members'
select public.add_organizer_member(:'org_alpha_id', 'c0000000-0000-4000-8000-00000000000c', 'staff');
rollback to savepoint before_staff_add;
reset role;
reset request.jwt.claim.sub;

-- 3. outsider C cannot add anyone -> expect error
savepoint before_outsider_add;
set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-00000000000c';
\echo 'expecting error: outsider cannot add members'
select public.add_organizer_member(:'org_alpha_id', 'd0000000-0000-4000-8000-00000000000d', 'staff');
rollback to savepoint before_outsider_add;
reset role;
reset request.jwt.claim.sub;

-- 4. cannot grant role=owner via add_organizer_member -> expect error
savepoint before_owner_grant;
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
\echo 'expecting error: cannot grant owner via add_organizer_member'
select public.add_organizer_member(:'org_alpha_id', 'd0000000-0000-4000-8000-00000000000d', 'owner');
rollback to savepoint before_owner_grant;
reset role;
reset request.jwt.claim.sub;

-- 5. owner adds D as admin, then revokes staff B; B loses member visibility
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.add_organizer_member(:'org_alpha_id', 'd0000000-0000-4000-8000-00000000000d', 'admin');
select public.revoke_organizer_member(:'org_alpha_id', 'b0000000-0000-4000-8000-00000000000b');
reset role;
reset request.jwt.claim.sub;

select revoked_at is not null as ok from public.organizer_members where organizer_id=:'org_alpha_id' and user_id='b0000000-0000-4000-8000-00000000000b' \gset check2_
\if :check2_ok
  \echo 'PASS 2: staff B revoked'
\else
  \echo 'FAIL 2: staff B still active'
\endif

-- revoked B can no longer see the organizer (RLS immediately reflects revocation)
set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-00000000000b';
select (count(*) = 0) as ok from public.organizers where id = :'org_alpha_id' \gset check3_
reset role;
reset request.jwt.claim.sub;
\if :check3_ok
  \echo 'PASS 3: revoked staff B loses organizer visibility (403-equivalent)'
\else
  \echo 'FAIL 3: revoked staff B still sees organizer'
\endif

-- 6. cannot revoke the owner directly
savepoint before_owner_revoke;
set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-00000000000d';
\echo 'expecting error: cannot revoke the owner'
select public.revoke_organizer_member(:'org_alpha_id', 'a0000000-0000-4000-8000-00000000000a');
rollback to savepoint before_owner_revoke;
reset role;
reset request.jwt.claim.sub;

-- 7. re-inviting revoked B as admin reactivates with new role
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.add_organizer_member(:'org_alpha_id', 'b0000000-0000-4000-8000-00000000000b', 'admin');
reset role;
reset request.jwt.claim.sub;
select (role='admin' and revoked_at is null) as ok from public.organizer_members where organizer_id=:'org_alpha_id' and user_id='b0000000-0000-4000-8000-00000000000b' \gset check4_
\if :check4_ok
  \echo 'PASS 4: revoked B reactivated as admin'
\else
  \echo 'FAIL 4: B not correctly reactivated'
\endif

-- 8. audit trail recorded expected actions
select (count(*) >= 4) as ok from public.audit_logs
  where organizer_id = :'org_alpha_id'
    and action in ('organizer_member.added','organizer_member.revoked','organizer_member.role_changed') \gset check5_
\if :check5_ok
  \echo 'PASS 5: audit log recorded add/revoke/role_change actions'
\else
  \echo 'FAIL 5: audit log missing expected entries'
\endif

\echo '=== end of script ==='
rollback;
