-- P1-06/P1-08 seat-engine sequential behavior verification (idempotency,
-- pool math, waitlist promotion, remove/block). Runs entirely inside one
-- transaction and rolls back at the end; no synthetic data is left behind.
-- Requires the P1-06/P1-08 migrations already applied. Usage:
-- pnpm verify:p1-06-08. For true concurrent-load / deadlock-freedom
-- verification, see verify-p1-06-08-concurrency.mjs instead.
\set ON_ERROR_STOP on
\set QUIET on
begin;


insert into auth.users (id) values
  ('a0000000-0000-4000-8000-00000000000a'),
  ('c0000000-0000-4000-8000-00000000000c'),
  ('e0000000-0000-4000-8000-00000000000e'),
  ('f0000000-0000-4000-8000-00000000000f'),
  ('11111111-1111-4111-8111-000000000001'),
  ('11111111-1111-4111-8111-000000000002'),
  ('11111111-1111-4111-8111-000000000003');

insert into public.users (id, email, display_name) values
  ('a0000000-0000-4000-8000-00000000000a', 'owner-a@test.invalid', 'Owner A'),
  ('c0000000-0000-4000-8000-00000000000c', 'outsider@test.invalid', 'Outsider C'),
  ('e0000000-0000-4000-8000-00000000000e', 'staff-e@test.invalid', 'Staff E'),
  ('f0000000-0000-4000-8000-00000000000f', 'registrant-f@test.invalid', 'Registrant F'),
  ('11111111-1111-4111-8111-000000000001', 'p1@test.invalid', 'P1'),
  ('11111111-1111-4111-8111-000000000002', 'p2@test.invalid', 'P2'),
  ('11111111-1111-4111-8111-000000000003', 'p3@test.invalid', 'P3');

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.create_organizer('org-alpha', 'Organizer Alpha') as org_alpha_id \gset
reset role;
reset request.jwt.claim.sub;

insert into public.organizer_members (organizer_id, user_id, role)
values (:'org_alpha_id', 'e0000000-0000-4000-8000-00000000000e', 'staff');

-- capacity=2 event, instant confirmation, no invite pool split
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
insert into public.events (
  organizer_id, created_by_user_id, slug, title, status, visibility,
  confirmation_mode, timezone, starts_at, ends_at, capacity
) values (
  :'org_alpha_id', 'a0000000-0000-4000-8000-00000000000a', 'alpha-seat-test',
  'Alpha Seat Test', 'published', 'public', 'instant', 'Asia/Taipei',
  now() + interval '5 days', now() + interval '5 days 2 hours', 2
) returning id as event_id \gset
reset role;
reset request.jwt.claim.sub;

\set QUIET off
\set ON_ERROR_STOP off
\echo '=== fixtures ready: event=':event_id' ==='

-- 1. P1 registers -> confirmed (1/2 held)
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-000000000001';
select public.register_for_event(:'event_id', 'idem-p1', '{}'::jsonb) as p1_reg_id \gset
reset role;
reset request.jwt.claim.sub;
select (status = 'confirmed') as ok from public.registrations where id = :'p1_reg_id' \gset check1_
\if :check1_ok
  \echo 'PASS 1: P1 registered as confirmed'
\else
  \echo 'FAIL 1: P1 not confirmed'
\endif

-- 2. P1 replays same idempotency key -> same registration id, no new row
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-000000000001';
select public.register_for_event(:'event_id', 'idem-p1', '{}'::jsonb) as p1_replay_id \gset
reset role;
reset request.jwt.claim.sub;
select (:'p1_replay_id' = :'p1_reg_id') as ok \gset check2_
select (count(*) = 1) as ok from public.registrations where event_id = :'event_id' and user_id = '11111111-1111-4111-8111-000000000001' \gset check3_
\if :check2_ok
  \echo 'PASS 2: idempotent replay returned same registration id'
\else
  \echo 'FAIL 2: replay returned a different id'
\endif
\if :check3_ok
  \echo 'PASS 3: no duplicate registration row from replay'
\else
  \echo 'FAIL 3: duplicate row created'
\endif

-- 3. P1 reuses same key with a different payload -> 23505
savepoint before_conflict;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-000000000001';
\echo 'expecting error: idempotency key reused with different payload'
select public.register_for_event(:'event_id', 'idem-p1', '{"note":"different"}'::jsonb);
rollback to savepoint before_conflict;
reset role;
reset request.jwt.claim.sub;

-- 4. P2 registers -> confirmed (2/2 held, capacity full)
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-000000000002';
select public.register_for_event(:'event_id', 'idem-p2', '{}'::jsonb) as p2_reg_id \gset
reset role;
reset request.jwt.claim.sub;
select (status = 'confirmed') as ok from public.registrations where id = :'p2_reg_id' \gset check4_
\if :check4_ok
  \echo 'PASS 4: P2 registered as confirmed (capacity now full)'
\else
  \echo 'FAIL 4: P2 not confirmed'
\endif

-- 5. P3 registers -> waitlisted (capacity exceeded, no oversell)
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-000000000003';
select public.register_for_event(:'event_id', 'idem-p3', '{}'::jsonb) as p3_reg_id \gset
reset role;
reset request.jwt.claim.sub;
select (status = 'waitlisted') as ok from public.registrations where id = :'p3_reg_id' \gset check5_
\if :check5_ok
  \echo 'PASS 5: P3 waitlisted (no oversell beyond capacity=2)'
\else
  \echo 'FAIL 5: P3 not waitlisted -- possible oversell'
\endif

-- 6. active-registration-unique: P1 tries to register again with a new key -> DB unique violation (23505 from index)
savepoint before_dup_active;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-000000000001';
\echo 'expecting error: active registration already exists'
select public.register_for_event(:'event_id', 'idem-p1-second', '{}'::jsonb);
rollback to savepoint before_dup_active;
reset role;
reset request.jwt.claim.sub;

-- 7. P1 cancels -> P3 auto-promoted to 'offered'
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-000000000001';
select public.cancel_registration(:'p1_reg_id', 'cancel-p1') as _void \gset
reset role;
reset request.jwt.claim.sub;
select (status = 'cancelled') as ok from public.registrations where id = :'p1_reg_id' \gset check6_
select (status = 'offered' and offer_expires_at is not null) as ok from public.registrations where id = :'p3_reg_id' \gset check7_
\if :check6_ok
  \echo 'PASS 6: P1 cancelled'
\else
  \echo 'FAIL 6: P1 not cancelled'
\endif
\if :check7_ok
  \echo 'PASS 7: P3 auto-promoted to offered after P1 cancelled'
\else
  \echo 'FAIL 7: P3 not promoted'
\endif

-- 8. P3 accepts offer -> confirmed
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-000000000003';
select public.accept_offer(:'p3_reg_id') as _void \gset
reset role;
reset request.jwt.claim.sub;
select (status = 'confirmed') as ok from public.registrations where id = :'p3_reg_id' \gset check8_
\if :check8_ok
  \echo 'PASS 8: P3 accepted offer, now confirmed'
\else
  \echo 'FAIL 8: P3 not confirmed after accept'
\endif

-- 9. staff cannot remove a registration (admin/owner only)
savepoint before_staff_remove;
set local role authenticated;
set local request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
\echo 'expecting error: staff cannot remove registrations'
select public.organizer_remove_registration(:'p2_reg_id', 'test removal');
rollback to savepoint before_staff_remove;
reset role;
reset request.jwt.claim.sub;

-- 10. owner removes P2 -> removed_by_organizer, capacity frees (no one waiting, no promotion needed)
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.organizer_remove_registration(:'p2_reg_id', 'test removal') as _void \gset
reset role;
reset request.jwt.claim.sub;
select (status = 'removed_by_organizer') as ok from public.registrations where id = :'p2_reg_id' \gset check9_
\if :check9_ok
  \echo 'PASS 9: owner removed P2'
\else
  \echo 'FAIL 9: P2 not removed'
\endif

-- 11. owner blocks outsider C; C cannot register afterward
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.organizer_block_participant(:'event_id', 'c0000000-0000-4000-8000-00000000000c', 'internal reason not for participant') as _void \gset
reset role;
reset request.jwt.claim.sub;

savepoint before_blocked_register;
set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-00000000000c';
\echo 'expecting error: blocked participant cannot register'
select public.register_for_event(:'event_id', 'idem-c-blocked', '{}'::jsonb);
rollback to savepoint before_blocked_register;
reset role;
reset request.jwt.claim.sub;

-- blocked user cannot read the internal reason (event_blocklist SELECT is admin-only per P1-04)
set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-00000000000c';
select (count(*) = 0) as ok from public.event_blocklist where event_id = :'event_id' and user_id = 'c0000000-0000-4000-8000-00000000000c' \gset check10_
reset role;
reset request.jwt.claim.sub;
\if :check10_ok
  \echo 'PASS 10: blocked participant cannot read block reason'
\else
  \echo 'FAIL 10: blocked participant could read own blocklist row'
\endif

-- 12. one outbox row per (registration, transition_version, notification_kind)
select (count(*) = count(distinct (registration_id, transition_version, notification_kind))) as ok
from public.outbox_events where event_id = :'event_id' \gset check11_
\if :check11_ok
  \echo 'PASS 11: outbox rows unique per registration+transition+kind'
\else
  \echo 'FAIL 11: duplicate outbox rows detected'
\endif

-- 13. capacity cannot drop below currently-held seats (P3 confirmed = 1 held)
savepoint before_capacity_drop;
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
\echo 'expecting error: capacity cannot drop below held seats'
update public.events set capacity = 0 where id = :'event_id';
rollback to savepoint before_capacity_drop;
reset role;
reset request.jwt.claim.sub;

\echo '=== end of script ==='
rollback;
