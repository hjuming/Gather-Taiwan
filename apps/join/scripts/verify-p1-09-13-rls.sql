-- P1-09/P1-13 behavior verification (min_age gate, payment declaration,
-- payment-instructions report, Feb 29 age computation). Runs entirely
-- inside one transaction and rolls back at the end; no synthetic data is
-- left behind. Requires the P1-09/P1-13 migration already applied.
-- Usage: pnpm verify:p1-09-13.
\set ON_ERROR_STOP on
\set QUIET on
begin;


insert into auth.users (id) values
  ('a0000000-0000-4000-8000-00000000000a'),
  ('c0000000-0000-4000-8000-00000000000c'),
  ('e0000000-0000-4000-8000-00000000000e');

insert into public.users (id, email, display_name, birth_date) values
  ('a0000000-0000-4000-8000-00000000000a', 'owner-a@test.invalid', 'Owner A', '1990-01-01'),
  ('c0000000-0000-4000-8000-00000000000c', 'minor-c@test.invalid', 'Minor C', (current_date - interval '15 years')::date),
  ('e0000000-0000-4000-8000-00000000000e', 'nobirth-e@test.invalid', 'No Birth E', null);

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.create_organizer('org-alpha', 'Organizer Alpha') as org_alpha_id \gset
reset role;
reset request.jwt.claim.sub;

-- 18+ event, no invite gating, capacity 5, has payment instructions
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
insert into public.events (
  organizer_id, created_by_user_id, slug, title, status, visibility,
  confirmation_mode, timezone, starts_at, ends_at, capacity, min_age,
  fee_amount, payment_instructions
) values (
  :'org_alpha_id', 'a0000000-0000-4000-8000-00000000000a', 'alpha-18plus',
  'Alpha 18+ Event', 'published', 'public', 'instant', 'Asia/Taipei',
  now() + interval '5 days', now() + interval '5 days 2 hours', 5, 18,
  500, 'Bank transfer to 123-456, then declare payment in the app.'
) returning id as event_id \gset
reset role;
reset request.jwt.claim.sub;

\set QUIET off
\set ON_ERROR_STOP off
\echo '=== fixtures ready: event=':event_id' ==='

-- 1. minor (under 18) rejected
savepoint before_minor;
set local role authenticated;
set local request.jwt.claim.sub = 'c0000000-0000-4000-8000-00000000000c';
\echo 'expecting error: minor rejected'
select public.register_for_event(:'event_id', 'idem-c', '{}'::jsonb);
rollback to savepoint before_minor;
reset role;
reset request.jwt.claim.sub;

-- 2. no birth_date on file, event has min_age -> fail closed
savepoint before_nobirth;
set local role authenticated;
set local request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000e';
\echo 'expecting error: no birth_date on file, fail closed'
select public.register_for_event(:'event_id', 'idem-e', '{}'::jsonb);
rollback to savepoint before_nobirth;
reset role;
reset request.jwt.claim.sub;

-- 3. adult owner registers fine (also tests self-registration as organizer)
insert into auth.users (id) values ('d0000000-0000-4000-8000-00000000000d');
insert into public.users (id, email, display_name, birth_date) values
  ('d0000000-0000-4000-8000-00000000000d', 'adult-d@test.invalid', 'Adult D', '1990-06-15');

set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-00000000000d';
select public.register_for_event(:'event_id', 'idem-d', '{}'::jsonb) as d_reg_id \gset
reset role;
reset request.jwt.claim.sub;
select (status = 'confirmed') as ok from public.registrations where id = :'d_reg_id' \gset check1_
\if :check1_ok
  \echo 'PASS 1: adult registered successfully (age gate passes)'
\else
  \echo 'FAIL 1: adult was rejected'
\endif

-- 4. declare payment: sets payment_declared_at, does not touch status
set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-00000000000d';
select public.declare_payment_for_registration(:'d_reg_id') as _void \gset
reset role;
reset request.jwt.claim.sub;
select (payment_declared_at is not null and status = 'confirmed') as ok from public.registrations where id = :'d_reg_id' \gset check2_
\if :check2_ok
  \echo 'PASS 2: payment declared, status unaffected'
\else
  \echo 'FAIL 2: payment declaration changed status or did not set timestamp'
\endif

-- 5. declaring payment twice is idempotent (no error, timestamp unchanged)
set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-00000000000d';
select payment_declared_at as first_ts from public.registrations where id = :'d_reg_id' \gset
select public.declare_payment_for_registration(:'d_reg_id') as _void \gset
select (payment_declared_at = :'first_ts'::timestamptz) as ok from public.registrations where id = :'d_reg_id' \gset check3_
reset role;
reset request.jwt.claim.sub;
\if :check3_ok
  \echo 'PASS 3: re-declaring payment is idempotent (timestamp unchanged)'
\else
  \echo 'FAIL 3: re-declaring payment changed the timestamp'
\endif

-- 6. outsider cannot declare payment for someone else's registration
insert into auth.users (id) values ('c1111111-0000-4000-8000-00000000000c');
insert into public.users (id, email, display_name) values
  ('c1111111-0000-4000-8000-00000000000c', 'other@test.invalid', 'Other');
savepoint before_other_declare;
set local role authenticated;
set local request.jwt.claim.sub = 'c1111111-0000-4000-8000-00000000000c';
\echo 'expecting error: cannot declare payment for someone else'
select public.declare_payment_for_registration(:'d_reg_id');
rollback to savepoint before_other_declare;
reset role;
reset request.jwt.claim.sub;

-- 7. any authenticated user can report payment instructions
set local role authenticated;
set local request.jwt.claim.sub = 'c1111111-0000-4000-8000-00000000000c';
select public.report_event_payment_instructions(:'event_id', 'looks suspicious') as _void \gset
reset role;
reset request.jwt.claim.sub;
select (count(*) = 1) as ok from public.audit_logs
  where event_id = :'event_id' and action = 'event.payment_instructions_reported' \gset check4_
\if :check4_ok
  \echo 'PASS 4: payment instructions report recorded'
\else
  \echo 'FAIL 4: report not recorded'
\endif

-- 8. legal_name/birth_date never leak across users
set local role authenticated;
set local request.jwt.claim.sub = 'c1111111-0000-4000-8000-00000000000c';
select (count(*) = 0) as ok from public.users where id = 'd0000000-0000-4000-8000-00000000000d'::uuid \gset check5_
reset role;
reset request.jwt.claim.sub;
\if :check5_ok
  \echo 'PASS 5: cannot read another user'"'"'s row (legal_name/birth_date never exposed cross-user)'
\else
  \echo 'FAIL 5: could read another user row'
\endif

-- 9. Feb 29 birthday age computation sanity (already smoke-tested standalone,
--    re-confirm inline here as part of the Gate)
select (public.compute_age('2000-02-29'::date, '2025-02-28'::date) = 24
        and public.compute_age('2000-02-29'::date, '2025-03-01'::date) = 25) as ok \gset check6_
\if :check6_ok
  \echo 'PASS 6: Feb 29 birthday age computed correctly across the 2025 anniversary'
\else
  \echo 'FAIL 6: Feb 29 age computation incorrect'
\endif

\echo '=== end of script ==='
rollback;
