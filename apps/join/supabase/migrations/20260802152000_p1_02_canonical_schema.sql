-- P1-02 canonical schema. This migration intentionally creates no RLS policy
-- and grants no application-role access; P1-04 owns that authorization work.

create type public.organizer_role as enum ('owner', 'admin', 'staff');
create type public.event_status as enum (
  'draft',
  'published',
  'cancellation_pending',
  'cancelled',
  'cancellation_exception'
);
create type public.event_visibility as enum ('public', 'unlisted', 'private');
create type public.event_confirmation_mode as enum ('instant', 'organizer_confirmed');
create type public.roster_visibility as enum (
  'organizer_only',
  'registrants_only',
  'event_viewers'
);
create type public.registration_status as enum (
  'offered',
  'pending_organizer_confirmation',
  'confirmed',
  'waitlisted',
  'offer_expired',
  'expired',
  'declined',
  'cancelled',
  'removed_by_organizer'
);
create type public.seat_pool as enum ('invite', 'public');
create type public.event_field_type as enum (
  'short_text',
  'long_text',
  'single_choice',
  'multiple_choice',
  'boolean'
);
create type public.invitee_type as enum ('verified_email', 'one_time_token');
create type public.notification_channel as enum ('email', 'in_app');
create type public.delivery_status as enum (
  'pending',
  'processing',
  'delivered',
  'failed',
  'dead_letter'
);

create table public.users (
  id uuid primary key references auth.users (id) on delete restrict,
  line_user_id text unique,
  legal_name text,
  birth_date date,
  email text,
  email_normalized text generated always as (lower(btrim(email))) stored,
  email_verified_at timestamptz,
  phone text,
  display_name text,
  public_bio text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint verified_email_requires_value check (
    email_verified_at is null or email is not null
  ),
  constraint nonblank_line_user_id check (
    line_user_id is null or btrim(line_user_id) <> ''
  )
);

create unique index one_verified_account_per_email
  on public.users (email_normalized)
  where email_verified_at is not null;

create table public.organizers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  created_by_user_id uuid not null references public.users (id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint organizer_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  constraint organizer_display_name_nonblank check (btrim(display_name) <> '')
);

create index organizers_created_by_user_id_idx
  on public.organizers (created_by_user_id);

create table public.organizer_members (
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete restrict,
  role public.organizer_role not null,
  accepted_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (organizer_id, user_id),
  constraint member_revocation_order check (
    revoked_at is null or revoked_at >= accepted_at
  )
);

create unique index one_active_owner_per_organizer
  on public.organizer_members (organizer_id)
  where role = 'owner' and revoked_at is null;

create index organizer_members_user_id_idx
  on public.organizer_members (user_id)
  where revoked_at is null;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id) on delete restrict,
  created_by_user_id uuid not null references public.users (id) on delete restrict,
  slug text not null unique,
  title text not null,
  summary text,
  description text,
  status public.event_status not null default 'draft',
  visibility public.event_visibility not null default 'public',
  confirmation_mode public.event_confirmation_mode not null default 'instant',
  timezone text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  location_name text,
  location_address text,
  capacity integer,
  fee_amount numeric(12, 2) not null default 0,
  fee_currency text not null default 'TWD',
  payment_instructions text,
  roster_visibility public.roster_visibility not null default 'organizer_only',
  roster_show_capacity boolean not null default false,
  password_hash text,
  invite_only boolean not null default false,
  min_age smallint,
  invite_reserved_seats integer,
  invite_pool_deadline timestamptz,
  invite_pool_released_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint event_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{2,95}$'),
  constraint event_title_nonblank check (btrim(title) <> ''),
  constraint event_time_order check (starts_at < ends_at),
  constraint event_registration_window check (
    (registration_opens_at is null
      or registration_opens_at < coalesce(registration_closes_at, starts_at))
    and (registration_closes_at is null or registration_closes_at <= starts_at)
  ),
  constraint event_capacity_positive check (capacity is null or capacity > 0),
  constraint event_fee_nonnegative check (fee_amount >= 0),
  constraint event_fee_currency_format check (fee_currency ~ '^[A-Z]{3}$'),
  constraint event_min_age_range check (min_age is null or min_age between 0 and 120),
  constraint event_invite_pool_configuration check (
    (
      capacity is null
      and invite_reserved_seats is null
      and invite_pool_deadline is null
      and invite_pool_released_at is null
    )
    or (
      capacity is not null
      and (
        (
          invite_reserved_seats is null
          and invite_pool_deadline is null
          and invite_pool_released_at is null
        )
        or (
          invite_reserved_seats between 1 and capacity
          and invite_pool_deadline is not null
          and invite_pool_deadline < starts_at
          and (
            invite_pool_released_at is null
            or invite_pool_released_at >= invite_pool_deadline
          )
        )
      )
    )
  )
);

create index events_organizer_id_idx on public.events (organizer_id);
create index events_created_by_user_id_idx on public.events (created_by_user_id);
create index events_public_schedule_idx
  on public.events (starts_at, id)
  where status = 'published' and visibility = 'public';

create function public.is_prohibited_payment_proof_field_name(p_value text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(p_value, '') ~* (
    '(付款|匯款|轉帳|payment|transfer|transaction)'
    || '.{0,12}'
    || '(金額|帳號|末碼|編號|截圖|時間|amount|account|last[ _-]?digits|id|screenshot|time)'
    || '|(銀行帳號|交易編號|付款截圖|匯款截圖|轉帳截圖|匯款末碼|轉帳末碼)'
  )
$$;

create table public.event_fields (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  field_key text not null,
  label text not null,
  field_type public.event_field_type not null,
  is_required boolean not null default false,
  options jsonb,
  position integer not null default 0,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (event_id, field_key),
  constraint event_field_key_format check (field_key ~ '^[a-z][a-z0-9_]{1,62}$'),
  constraint event_field_label_nonblank check (btrim(label) <> ''),
  constraint event_field_position_nonnegative check (position >= 0),
  constraint event_field_payment_proof_name_block check (
    not public.is_prohibited_payment_proof_field_name(field_key)
    and not public.is_prohibited_payment_proof_field_name(label)
  )
);

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  user_id uuid not null references public.users (id) on delete restrict,
  status public.registration_status not null,
  seats integer not null default 1 check (seats > 0),
  seat_pool public.seat_pool not null default 'public',
  waitlisted_at timestamptz,
  offered_at timestamptz,
  offer_expires_at timestamptz,
  transition_version bigint not null default 1 check (transition_version > 0),
  roster_consent boolean not null default false,
  payment_declared_at timestamptz,
  confirm_deadline_at timestamptz,
  display_name_snapshot text,
  public_bio_snapshot text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint waitlist_timestamp_consistency check (
    status <> 'waitlisted' or waitlisted_at is not null
  ),
  constraint offer_timestamp_consistency check (
    status <> 'offered'
    or (
      offered_at is not null
      and offer_expires_at is not null
      and offered_at < offer_expires_at
    )
  )
);

create unique index one_active_registration_per_user_event
  on public.registrations (event_id, user_id)
  where status in (
    'offered',
    'pending_organizer_confirmation',
    'confirmed',
    'waitlisted'
  );

create index registrations_event_status_queue_idx
  on public.registrations (event_id, status, waitlisted_at, id);
create index registrations_user_id_idx on public.registrations (user_id);

create table public.registration_answers (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  event_field_id uuid not null references public.event_fields (id) on delete restrict,
  answer_value jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (registration_id, event_field_id)
);

create index registration_answers_event_field_id_idx
  on public.registration_answers (event_field_id);

create table public.event_invitees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  invitee_type public.invitee_type not null,
  invitee_key_hash text not null,
  token_hash text,
  expires_at timestamptz,
  revoked_at timestamptz,
  claimed_at timestamptz,
  claimed_by_user_id uuid references public.users (id) on delete restrict,
  created_by_user_id uuid not null references public.users (id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (event_id, invitee_type, invitee_key_hash),
  constraint one_time_token_requires_hash check (
    invitee_type <> 'one_time_token' or token_hash is not null
  ),
  constraint invitee_claim_consistency check (
    (claimed_at is null and claimed_by_user_id is null)
    or (claimed_at is not null and claimed_by_user_id is not null)
  ),
  constraint invitee_revocation_order check (
    revoked_at is null or revoked_at >= created_at
  )
);

create index event_invitees_claimed_by_user_id_idx
  on public.event_invitees (claimed_by_user_id)
  where claimed_by_user_id is not null;
create index event_invitees_created_by_user_id_idx
  on public.event_invitees (created_by_user_id);

create table public.event_blocklist (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete restrict,
  created_by_user_id uuid not null references public.users (id) on delete restrict,
  reason_internal text,
  created_at timestamptz not null default statement_timestamp(),
  primary key (event_id, user_id)
);

create index event_blocklist_user_id_idx on public.event_blocklist (user_id);
create index event_blocklist_created_by_user_id_idx
  on public.event_blocklist (created_by_user_id);

create table public.idempotency_requests (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users (id) on delete restrict,
  operation text not null,
  key_hash text not null,
  event_id uuid not null references public.events (id) on delete restrict,
  request_fingerprint text not null,
  result_registration_id uuid references public.registrations (id) on delete restrict,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  unique (actor_user_id, operation, key_hash),
  constraint idempotency_operation_nonblank check (btrim(operation) <> ''),
  constraint idempotency_response_status_range check (
    response_status is null or response_status between 100 and 599
  ),
  constraint idempotency_completion_consistency check (
    (completed_at is null and response_status is null and response_body is null)
    or (completed_at is not null and response_status is not null)
  )
);

create index idempotency_requests_event_id_idx
  on public.idempotency_requests (event_id, created_at);
create index idempotency_requests_result_registration_id_idx
  on public.idempotency_requests (result_registration_id)
  where result_registration_id is not null;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events (id) on delete restrict,
  registration_id uuid references public.registrations (id) on delete restrict,
  recipient_user_id uuid not null references public.users (id) on delete restrict,
  channel public.notification_channel not null,
  notification_kind text not null,
  status public.delivery_status not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  lease_expires_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  read_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint notification_kind_nonblank check (btrim(notification_kind) <> ''),
  constraint notification_delivery_consistency check (
    status <> 'delivered' or delivered_at is not null
  )
);

create index notifications_recipient_status_idx
  on public.notifications (recipient_user_id, status, created_at);
create index notifications_event_id_idx on public.notifications (event_id);
create index notifications_registration_id_idx
  on public.notifications (registration_id);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  registration_id uuid not null references public.registrations (id) on delete restrict,
  recipient_user_id uuid not null references public.users (id) on delete restrict,
  transition_version bigint not null check (transition_version > 0),
  notification_kind text not null,
  payload jsonb not null default '{}'::jsonb,
  available_at timestamptz not null default statement_timestamp(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  lease_expires_at timestamptz,
  processed_at timestamptz,
  dead_lettered_at timestamptz,
  last_failure_reason text,
  created_at timestamptz not null default statement_timestamp(),
  unique (registration_id, transition_version, notification_kind),
  constraint outbox_notification_kind_nonblank check (btrim(notification_kind) <> '')
);

create index outbox_events_delivery_queue_idx
  on public.outbox_events (available_at, id)
  where processed_at is null and dead_lettered_at is null;
create index outbox_events_event_id_idx on public.outbox_events (event_id);
create index outbox_events_recipient_user_id_idx
  on public.outbox_events (recipient_user_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users (id) on delete set null,
  organizer_id uuid references public.organizers (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  registration_id uuid references public.registrations (id) on delete set null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  constraint audit_action_nonblank check (btrim(action) <> '')
);

create index audit_logs_actor_user_id_idx on public.audit_logs (actor_user_id);
create index audit_logs_organizer_id_idx
  on public.audit_logs (organizer_id, created_at);
create index audit_logs_event_id_idx on public.audit_logs (event_id, created_at);
create index audit_logs_registration_id_idx
  on public.audit_logs (registration_id, created_at);

create function public.validate_event_timezone()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if not exists (
    select 1
    from pg_timezone_names
    where name = new.timezone
  ) then
    raise exception 'unknown IANA timezone: %', new.timezone
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger validate_event_timezone_before_write
before insert or update of timezone on public.events
for each row execute function public.validate_event_timezone();

create function public.guard_event_safety_edits_after_start()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if statement_timestamp() >= old.starts_at and (
    new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.timezone is distinct from old.timezone
    or new.registration_opens_at is distinct from old.registration_opens_at
    or new.registration_closes_at is distinct from old.registration_closes_at
    or new.capacity is distinct from old.capacity
    or new.confirmation_mode is distinct from old.confirmation_mode
    or new.invite_only is distinct from old.invite_only
    or new.min_age is distinct from old.min_age
    or new.invite_reserved_seats is distinct from old.invite_reserved_seats
    or new.invite_pool_deadline is distinct from old.invite_pool_deadline
  ) then
    raise exception 'safety-critical event settings are immutable after start'
      using errcode = '55000';
  end if;

  if old.invite_pool_released_at is not null
    and new.invite_pool_released_at is distinct from old.invite_pool_released_at
  then
    raise exception 'invite pool release is irreversible'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger guard_event_safety_edits_before_update
before update on public.events
for each row execute function public.guard_event_safety_edits_after_start();

create function public.event_registration_is_open(
  p_event_id uuid,
  p_at timestamptz default statement_timestamp()
)
returns boolean
language sql
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.events as event
    where event.id = p_event_id
      and event.status = 'published'
      and p_at >= coalesce(event.registration_opens_at, '-infinity'::timestamptz)
      and p_at < coalesce(event.registration_closes_at, event.starts_at)
      and p_at < event.starts_at
  )
$$;

create function public.enforce_organizer_owner_count()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_organizer_id uuid;
  owner_count integer;
begin
  if tg_table_name = 'organizers' then
    target_organizer_id := coalesce(new.id, old.id);
  else
    target_organizer_id := coalesce(new.organizer_id, old.organizer_id);
  end if;

  if not exists (
    select 1 from public.organizers where id = target_organizer_id
  ) then
    return null;
  end if;

  select count(*)
  into owner_count
  from public.organizer_members
  where organizer_id = target_organizer_id
    and role = 'owner'
    and revoked_at is null;

  if owner_count <> 1 then
    raise exception 'organizer % must have exactly one active owner', target_organizer_id
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create constraint trigger organizer_must_have_one_owner
after insert or update on public.organizers
deferrable initially deferred
for each row execute function public.enforce_organizer_owner_count();

create constraint trigger organizer_members_must_preserve_one_owner
after insert or update or delete on public.organizer_members
deferrable initially deferred
for each row execute function public.enforce_organizer_owner_count();

create function public.transfer_organizer_ownership(
  p_organizer_id uuid,
  p_new_owner_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  current_owner_user_id uuid;
begin
  if actor_user_id is null then
    raise exception 'authenticated owner required' using errcode = '42501';
  end if;

  perform 1
  from public.organizers
  where id = p_organizer_id
  for update;

  if not found then
    raise exception 'organizer not found' using errcode = 'P0002';
  end if;

  select user_id
  into current_owner_user_id
  from public.organizer_members
  where organizer_id = p_organizer_id
    and role = 'owner'
    and revoked_at is null
  for update;

  if current_owner_user_id is distinct from actor_user_id then
    raise exception 'only the current owner can transfer ownership'
      using errcode = '42501';
  end if;

  if p_new_owner_user_id = current_owner_user_id then
    return;
  end if;

  perform 1
  from public.organizer_members
  where organizer_id = p_organizer_id
    and user_id = p_new_owner_user_id
    and revoked_at is null
  for update;

  if not found then
    raise exception 'new owner must be an active organizer member'
      using errcode = '23514';
  end if;

  update public.organizer_members
  set role = 'admin', updated_at = statement_timestamp()
  where organizer_id = p_organizer_id
    and user_id = current_owner_user_id;

  update public.organizer_members
  set role = 'owner', updated_at = statement_timestamp()
  where organizer_id = p_organizer_id
    and user_id = p_new_owner_user_id;

  insert into public.audit_logs (
    actor_user_id,
    organizer_id,
    action,
    before_state,
    after_state
  ) values (
    actor_user_id,
    p_organizer_id,
    'organizer.owner_transferred',
    jsonb_build_object('owner_user_id', current_owner_user_id),
    jsonb_build_object('owner_user_id', p_new_owner_user_id)
  );
end;
$$;

alter table public.users enable row level security;
alter table public.users force row level security;
revoke all on table public.users from public, anon, authenticated;

alter table public.organizers enable row level security;
alter table public.organizers force row level security;
revoke all on table public.organizers from public, anon, authenticated;

alter table public.organizer_members enable row level security;
alter table public.organizer_members force row level security;
revoke all on table public.organizer_members from public, anon, authenticated;

alter table public.events enable row level security;
alter table public.events force row level security;
revoke all on table public.events from public, anon, authenticated;

alter table public.event_fields enable row level security;
alter table public.event_fields force row level security;
revoke all on table public.event_fields from public, anon, authenticated;

alter table public.registrations enable row level security;
alter table public.registrations force row level security;
revoke all on table public.registrations from public, anon, authenticated;

alter table public.registration_answers enable row level security;
alter table public.registration_answers force row level security;
revoke all on table public.registration_answers from public, anon, authenticated;

alter table public.event_invitees enable row level security;
alter table public.event_invitees force row level security;
revoke all on table public.event_invitees from public, anon, authenticated;

alter table public.event_blocklist enable row level security;
alter table public.event_blocklist force row level security;
revoke all on table public.event_blocklist from public, anon, authenticated;

alter table public.idempotency_requests enable row level security;
alter table public.idempotency_requests force row level security;
revoke all on table public.idempotency_requests from public, anon, authenticated;

alter table public.notifications enable row level security;
alter table public.notifications force row level security;
revoke all on table public.notifications from public, anon, authenticated;

alter table public.outbox_events enable row level security;
alter table public.outbox_events force row level security;
revoke all on table public.outbox_events from public, anon, authenticated;

alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;
revoke all on table public.audit_logs from public, anon, authenticated;

revoke all on function public.is_prohibited_payment_proof_field_name(text)
  from public, anon, authenticated;
revoke all on function public.validate_event_timezone()
  from public, anon, authenticated;
revoke all on function public.guard_event_safety_edits_after_start()
  from public, anon, authenticated;
revoke all on function public.event_registration_is_open(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.enforce_organizer_owner_count()
  from public, anon, authenticated;
revoke all on function public.transfer_organizer_ownership(uuid, uuid)
  from public, anon, authenticated;

alter default privileges in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public
  revoke all on functions from public, anon, authenticated;
