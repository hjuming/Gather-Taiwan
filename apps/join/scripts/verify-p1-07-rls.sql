-- P1-07 invite/password behavior verification. Runs entirely inside one
-- transaction and rolls back at the end; no synthetic data is left behind.
-- Requires the P1-07 migration already applied. Usage: pnpm verify:p1-07.
\set ON_ERROR_STOP on
\set QUIET on
begin;


insert into auth.users (id) values
  ('a0000000-0000-4000-8000-00000000000a'),
  ('c0000000-0000-4000-8000-00000000000c'),
  ('e0000000-0000-4000-8000-00000000000e'),
  ('f0000000-0000-4000-8000-00000000000f');

insert into public.users (id, email, display_name, email_verified_at) values
  ('a0000000-0000-4000-8000-00000000000a', 'owner-a@test.invalid', 'Owner A', now()),
  ('c0000000-0000-4000-8000-00000000000c', 'outsider@test.invalid', 'Outsider C', now()),
  ('e0000000-0000-4000-8000-00000000000e', 'invited-e@test.invalid', 'Invited E', now()),
  ('f0000000-0000-4000-8000-00000000000f', 'unverified-f@test.invalid', 'Unverified F', null);

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.create_organizer('org-alpha', 'Organizer Alpha') as org_alpha_id \gset
reset role;
reset request.jwt.claim.sub;

-- private, invite_only event
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
insert into public.events (
  organizer_id, created_by_user_id, slug, title, status, visibility,
  confirmation_mode, timezone, starts_at, ends_at, capacity, invite_only
) values (
  :'org_alpha_id', 'a0000000-0000-4000-8000-00000000000a', 'alpha-private-invite',
  'Alpha Private Invite', 'published', 'private', 'instant', 'Asia/Taipei',
  now() + interval '5 days', now() + interval '5 days 2 hours', 10, true
) returning id as event_id \gset
reset role;
reset request.jwt.claim.sub;

\set QUIET off
\set ON_ERROR_STOP off
\echo '=== fixtures ready: event=':event_id' ==='

-- 1. outsider (not invited) cannot view the private event at all
set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-00000000000c';
select (count(*) = 0) as ok from public.events where id = :'event_id' \gset check1_
reset role;
reset request.jwt.claim.sub;
\if :check1_ok
  \echo 'PASS 1: non-invited outsider cannot view private event'
\else
  \echo 'FAIL 1: outsider saw the private event'
\endif

-- 2. owner invites E by verified email
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.create_event_invite(:'event_id', 'verified_email', 'invited-e@test.invalid', null) as _void \gset
reset role;
reset request.jwt.claim.sub;

-- 3. E (verified email matches invite) can view the private event WITHOUT any explicit claim step
set local role authenticated;
set local request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
select (count(*) = 1) as ok from public.events where id = :'event_id' \gset check2_
reset role;
reset request.jwt.claim.sub;
\if :check2_ok
  \echo 'PASS 2: verified-email invitee can view private event (no claim step needed)'
\else
  \echo 'FAIL 2: verified-email invitee cannot view'
\endif

-- 4. E can register (invite_only gate passes via email match)
set local role authenticated;
set local request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
select public.register_for_event(:'event_id', 'idem-e', '{}'::jsonb) as e_reg_id \gset
reset role;
reset request.jwt.claim.sub;
select (status = 'confirmed') as ok from public.registrations where id = :'e_reg_id' \gset check3_
\if :check3_ok
  \echo 'PASS 3: verified-email invitee can register for invite_only event'
\else
  \echo 'FAIL 3: invitee could not register'
\endif

-- 5. unverified F (email NOT verified) is not eligible even with a matching invite
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.create_event_invite(:'event_id', 'verified_email', 'unverified-f@test.invalid', null) as _void \gset
reset role;
reset request.jwt.claim.sub;

savepoint before_unverified;
set local role authenticated;
set local request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000f';
\echo 'expecting error: unverified email cannot register despite matching invite'
select public.register_for_event(:'event_id', 'idem-f', '{}'::jsonb);
rollback to savepoint before_unverified;
reset role;
reset request.jwt.claim.sub;

-- 6. owner creates a one-time token invite for outsider C
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.create_event_invite(:'event_id', 'one_time_token', 'outsider-friend', null) as invite_token \gset
reset role;
reset request.jwt.claim.sub;

-- 7. C cannot view the event before claiming the token
set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-00000000000c';
select (count(*) = 0) as ok from public.events where id = :'event_id' \gset check4_
reset role;
reset request.jwt.claim.sub;
\if :check4_ok
  \echo 'PASS 4: token holder cannot view before claiming'
\else
  \echo 'FAIL 4: token holder saw event before claiming'
\endif

-- 8. wrong token is rejected
savepoint before_wrong_token;
set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-00000000000c';
\echo 'expecting error: wrong token rejected'
select public.claim_event_invite_by_token(:'event_id', 'totally-wrong-token');
rollback to savepoint before_wrong_token;
reset role;
reset request.jwt.claim.sub;

-- 9. C claims with the correct token -> can now view
set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-00000000000c';
select public.claim_event_invite_by_token(:'event_id', :'invite_token') as _void \gset
select (count(*) = 1) as ok from public.events where id = :'event_id' \gset check5_
reset role;
reset request.jwt.claim.sub;
\if :check5_ok
  \echo 'PASS 5: token claim grants view access'
\else
  \echo 'FAIL 5: claimed token did not grant view'
\endif

-- 10. token is single-use: a second (different) user cannot claim the same token
savepoint before_reclaim;
set local role authenticated;
set local request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000f';
\echo 'expecting error: token already claimed by someone else'
select public.claim_event_invite_by_token(:'event_id', :'invite_token');
rollback to savepoint before_reclaim;
reset role;
reset request.jwt.claim.sub;

-- 11. staff cannot create invites (admin/owner only)
insert into public.organizer_members (organizer_id, user_id, role)
values (:'org_alpha_id', 'f0000000-0000-4000-8000-00000000000f', 'staff');

savepoint before_staff_invite;
set local role authenticated;
set local request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000f';
\echo 'expecting error: staff cannot create invites'
select public.create_event_invite(:'event_id', 'one_time_token', 'x', null);
rollback to savepoint before_staff_invite;
reset role;
reset request.jwt.claim.sub;

-- 12. owner sets a password; correct password verifies true, wrong verifies false
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.set_event_password(:'event_id', 'correct-horse-battery') as _void \gset
reset role;
reset request.jwt.claim.sub;

select public.verify_event_password(:'event_id', 'correct-horse-battery') as ok \gset check6_
select public.verify_event_password(:'event_id', 'wrong-password') as ok \gset check7_
select public.verify_event_password('00000000-0000-4000-8000-000000000000'::uuid, 'anything') as ok \gset check8_
\if :check6_ok
  \echo 'PASS 6: correct password verifies true'
\else
  \echo 'FAIL 6: correct password did not verify'
\endif
\if :check7_ok
  \echo 'FAIL 7: wrong password verified true'
\else
  \echo 'PASS 7: wrong password verifies false'
\endif
\if :check8_ok
  \echo 'FAIL 8: nonexistent event verified true'
\else
  \echo 'PASS 8: nonexistent event verifies false (no distinguishable behavior)'
\endif

-- 13. password_hash still never selectable directly, even after being set
savepoint before_pwhash2;
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
\echo 'expecting permission-denied on password_hash select'
select password_hash from public.events where id = :'event_id';
rollback to savepoint before_pwhash2;
reset role;
reset request.jwt.claim.sub;

-- 14. owner revokes C's token invite; C loses view access
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select id as invite_id from public.event_invitees where event_id = :'event_id' and invitee_type = 'one_time_token' \gset
select public.revoke_event_invite(:'invite_id') as _void \gset
reset role;
reset request.jwt.claim.sub;

set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-00000000000c';
select (count(*) = 0) as ok from public.events where id = :'event_id' \gset check9_
reset role;
reset request.jwt.claim.sub;
\if :check9_ok
  \echo 'PASS 9: revoked invite loses view access'
\else
  \echo 'FAIL 9: revoked invitee still sees event'
\endif

\echo '=== end of script ==='
rollback;
