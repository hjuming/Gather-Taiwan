-- P1-11 manual roster behavior verification. Runs entirely inside one
-- transaction and rolls back at the end; no synthetic data is left behind.
-- Requires the P1-11 migration already applied.
\set ON_ERROR_STOP on
\set QUIET on
begin;


insert into auth.users (id) values
  ('a0000000-0000-4000-8000-00000000000a'),
  ('e0000000-0000-4000-8000-00000000000e');
insert into public.users (id, email, display_name) values
  ('a0000000-0000-4000-8000-00000000000a', 'owner-a@test.invalid', 'Owner A'),
  ('e0000000-0000-4000-8000-00000000000e', 'staff-e@test.invalid', 'Staff E');

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.create_organizer('org-alpha', 'Organizer Alpha') as org_id \gset
insert into public.events (
  organizer_id, created_by_user_id, slug, title, status, visibility,
  confirmation_mode, timezone, starts_at, ends_at, capacity
) values (
  :'org_id', 'a0000000-0000-4000-8000-00000000000a', 'alpha-manual-test',
  'Alpha Manual Test', 'published', 'public', 'instant', 'Asia/Taipei',
  now() + interval '5 days', now() + interval '5 days 2 hours', 5
) returning id as event_id \gset
reset role;
reset request.jwt.claim.sub;

insert into public.organizer_members (organizer_id, user_id, role)
values (:'org_id', 'e0000000-0000-4000-8000-00000000000e', 'staff');

\set QUIET off
\set ON_ERROR_STOP off
\echo '=== fixtures ready: event=':event_id' ==='

-- 1. owner adds a manual participant
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.organizer_add_manual_participant(:'event_id', '陳大文', '0912-345-678', 'confirmed') as manual_reg_id \gset
reset role;
reset request.jwt.claim.sub;
select (status = 'confirmed' and manual_display_name = '陳大文' and user_id is null) as ok
  from public.registrations where id = :'manual_reg_id' \gset check1_
\if :check1_ok
  \echo 'PASS 1: manual participant added with null user_id'
\else
  \echo 'FAIL 1: manual participant not recorded correctly'
\endif

-- 2. staff (non-admin) cannot add manual participants
savepoint before_staff_add;
set local role authenticated;
set local request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
\echo 'expecting error: staff cannot manage manual roster'
select public.organizer_add_manual_participant(:'event_id', 'staff added this', null, 'confirmed');
rollback to savepoint before_staff_add;
reset role;
reset request.jwt.claim.sub;

-- 3a. P1-02's state machine protects manual entries too: confirmed -> waitlisted
--     is not a legal transition for anyone, self-registered or manual.
savepoint before_illegal_transition;
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
\echo 'expecting error: confirmed -> waitlisted is not a legal transition'
select public.organizer_edit_manual_participant(:'manual_reg_id', null, null, 'waitlisted');
rollback to savepoint before_illegal_transition;
reset role;
reset request.jwt.claim.sub;

-- 3b. a legal transition (confirmed -> cancelled) works and updates the name too
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.organizer_edit_manual_participant(:'manual_reg_id', '陳大文（改名）', null, 'cancelled') as _void \gset
reset role;
reset request.jwt.claim.sub;
select (status = 'cancelled' and manual_display_name = '陳大文（改名）') as ok
  from public.registrations where id = :'manual_reg_id' \gset check2_
\if :check2_ok
  \echo 'PASS 2: legal status transition + name edit both applied'
\else
  \echo 'FAIL 2: edit did not apply correctly'
\endif

-- 4. multiple manual participants can coexist (no unique-index collision on null user_id)
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.organizer_add_manual_participant(:'event_id', '林小美', null, 'confirmed') as manual_reg_id_2 \gset
select public.organizer_add_manual_participant(:'event_id', '王小明', null, 'confirmed') as manual_reg_id_3 \gset
reset role;
reset request.jwt.claim.sub;
select (count(*) = 3) as ok from public.registrations where event_id = :'event_id' \gset check3_
\if :check3_ok
  \echo 'PASS 3: multiple manual participants coexist without unique-index collision'
\else
  \echo 'FAIL 3: manual participants collided or were not all recorded'
\endif

-- 5. removing a manual participant
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.organizer_remove_manual_participant(:'manual_reg_id_3') as _void \gset
reset role;
reset request.jwt.claim.sub;
select (status = 'removed_by_organizer') as ok from public.registrations where id = :'manual_reg_id_3' \gset check4_
\if :check4_ok
  \echo 'PASS 4: manual participant removed'
\else
  \echo 'FAIL 4: removal did not work'
\endif

-- 6. cannot edit/remove a self-registered registration via the manual RPCs
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.register_for_event(:'event_id', 'idem-owner-self', '{}'::jsonb) as self_reg_id \gset
reset role;
reset request.jwt.claim.sub;

savepoint before_wrong_rpc;
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
\echo 'expecting error: cannot use manual RPC on a self-registered row'
select public.organizer_edit_manual_participant(:'self_reg_id', 'hijacked name', null, 'cancelled');
rollback to savepoint before_wrong_rpc;
reset role;
reset request.jwt.claim.sub;

-- 7. identity-shape CHECK constraint rejects a mixed row (defense in depth,
--    bypassing the RPCs to attempt a direct superuser insert)
savepoint before_bad_shape;
\echo 'expecting error: CHECK constraint rejects mixed self+manual shape'
insert into public.registrations (event_id, user_id, status, manual_display_name, added_by_user_id)
values (:'event_id', 'a0000000-0000-4000-8000-00000000000a', 'confirmed', 'should not be allowed', 'a0000000-0000-4000-8000-00000000000a');
rollback to savepoint before_bad_shape;

\echo '=== end of script ==='
rollback;
