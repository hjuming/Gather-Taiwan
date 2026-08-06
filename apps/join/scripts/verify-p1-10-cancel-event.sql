\set ON_ERROR_STOP on
\set QUIET on
begin;


insert into auth.users (id) values
  ('a0000000-0000-4000-8000-00000000000a'),
  ('b0000000-0000-4000-8000-00000000000b');
insert into public.users (id, email, display_name) values
  ('a0000000-0000-4000-8000-00000000000a', 'owner-a@test.invalid', 'Owner A'),
  ('b0000000-0000-4000-8000-00000000000b', 'participant-b@test.invalid', 'Participant B');

set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.create_organizer('org-alpha', 'Organizer Alpha') as org_id \gset
insert into public.events (
  organizer_id, created_by_user_id, slug, title, status, visibility,
  confirmation_mode, timezone, starts_at, ends_at, capacity
) values (
  :'org_id', 'a0000000-0000-4000-8000-00000000000a', 'alpha-cancel-test',
  'Alpha Cancel Test', 'published', 'public', 'instant', 'Asia/Taipei',
  now() + interval '5 days', now() + interval '5 days 2 hours', 5
) returning id as event_id \gset
reset role;
reset request.jwt.claim.sub;

set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-00000000000b';
select public.register_for_event(:'event_id', 'idem-b', '{}'::jsonb) as reg_id \gset
reset role;
reset request.jwt.claim.sub;

\set QUIET off
\set ON_ERROR_STOP off

-- 1. owner cancels the whole event
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
select public.cancel_event(:'event_id') as _void \gset
reset role;
reset request.jwt.claim.sub;

select (status = 'cancelled') as ok from public.events where id = :'event_id' \gset check1_
select (status = 'cancelled') as ok from public.registrations where id = :'reg_id' \gset check2_
select (count(*) = 1) as ok from public.outbox_events
  where registration_id = :'reg_id' and notification_kind = 'registration.event_cancelled' \gset check3_
\if :check1_ok
  \echo 'PASS 1: event status is cancelled'
\else
  \echo 'FAIL 1: event not cancelled'
\endif
\if :check2_ok
  \echo 'PASS 2: registration cancelled along with the event'
\else
  \echo 'FAIL 2: registration not cancelled'
\endif
\if :check3_ok
  \echo 'PASS 3: outbox notified the affected registrant'
\else
  \echo 'FAIL 3: no outbox row for the cancelled registrant'
\endif

-- 2. new registration attempts are now rejected
savepoint before_new_reg;
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
\echo 'expecting error: cannot register for a cancelled event'
select public.register_for_event(:'event_id', 'idem-new', '{}'::jsonb);
rollback to savepoint before_new_reg;
reset role;
reset request.jwt.claim.sub;

\echo '=== end of script ==='
rollback;
