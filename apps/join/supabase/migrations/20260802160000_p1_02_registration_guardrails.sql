-- P1-02 corrective migration. Close the canonical state-machine, start-time,
-- membership-identity, and cross-event relational integrity gaps found by
-- fresh review. This migration grants no application-role access.

create function public.is_registration_status_transition_allowed(
  p_from public.registration_status,
  p_to public.registration_status
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_from = p_to then true
    when p_from = 'waitlisted' then
      p_to in ('offered', 'cancelled', 'removed_by_organizer')
    when p_from = 'offered' then
      p_to in (
        'pending_organizer_confirmation',
        'confirmed',
        'offer_expired',
        'declined',
        'cancelled',
        'removed_by_organizer'
      )
    when p_from = 'pending_organizer_confirmation' then
      p_to in ('confirmed', 'expired', 'declined', 'cancelled', 'removed_by_organizer')
    when p_from = 'confirmed' then
      p_to in ('cancelled', 'removed_by_organizer')
    else false
  end
$$;

create function public.guard_registration_state_machine()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  target_confirmation_mode public.event_confirmation_mode;
begin
  if tg_op = 'INSERT' then
    select event.confirmation_mode
    into target_confirmation_mode
    from public.events as event
    where event.id = new.event_id;

    if not found then
      raise exception 'registration event does not exist'
        using errcode = '23503';
    end if;

    if not public.event_registration_is_open(new.event_id, statement_timestamp()) then
      raise exception 'event registration window is closed'
        using errcode = '55000';
    end if;

    if target_confirmation_mode = 'instant'
      and new.status not in ('confirmed', 'waitlisted')
    then
      raise exception 'instant event initial registration status is invalid'
        using errcode = '23514';
    end if;

    if target_confirmation_mode = 'organizer_confirmed'
      and new.status not in ('pending_organizer_confirmation', 'waitlisted')
    then
      raise exception 'organizer-confirmed event initial registration status is invalid'
        using errcode = '23514';
    end if;

    return new;
  end if;

  if new.event_id is distinct from old.event_id
    or new.user_id is distinct from old.user_id
  then
    raise exception 'registration event and user identity are immutable'
      using errcode = '55000';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if old.status in (
    'offer_expired',
    'expired',
    'declined',
    'cancelled',
    'removed_by_organizer'
  ) then
    raise exception 'terminal registration status cannot transition'
      using errcode = '23514';
  end if;

  if not public.is_registration_status_transition_allowed(old.status, new.status) then
    raise exception 'registration status transition % -> % is not allowed', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger guard_registration_state_machine_before_write
before insert or update of event_id, user_id, status on public.registrations
for each row execute function public.guard_registration_state_machine();

create function public.guard_organizer_membership_identity()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.organizer_id is distinct from old.organizer_id
    or new.user_id is distinct from old.user_id
  then
    raise exception 'organizer membership identity is immutable'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger guard_organizer_membership_identity_before_update
before update of organizer_id, user_id on public.organizer_members
for each row execute function public.guard_organizer_membership_identity();

alter table public.registrations
  add constraint registrations_id_event_id_key unique (id, event_id);

alter table public.event_fields
  add constraint event_fields_id_event_id_key unique (id, event_id);

alter table public.registration_answers
  add column event_id uuid;

update public.registration_answers as answer
set event_id = registration.event_id
from public.registrations as registration
where registration.id = answer.registration_id;

alter table public.registration_answers
  alter column event_id set not null,
  add constraint registration_answers_registration_event_fkey
    foreign key (registration_id, event_id)
    references public.registrations (id, event_id)
    on delete cascade,
  add constraint registration_answers_field_event_fkey
    foreign key (event_field_id, event_id)
    references public.event_fields (id, event_id)
    on delete restrict;

alter table public.idempotency_requests
  drop constraint idempotency_requests_result_registration_id_fkey,
  add constraint idempotency_requests_result_registration_event_fkey
    foreign key (result_registration_id, event_id)
    references public.registrations (id, event_id)
    on delete restrict;

alter table public.notifications
  drop constraint notifications_registration_id_fkey,
  add constraint notification_registration_requires_event check (
    registration_id is null or event_id is not null
  ),
  add constraint notifications_registration_event_fkey
    foreign key (registration_id, event_id)
    references public.registrations (id, event_id)
    on delete restrict;

alter table public.outbox_events
  drop constraint outbox_events_registration_id_fkey,
  add constraint outbox_events_registration_event_fkey
    foreign key (registration_id, event_id)
    references public.registrations (id, event_id)
    on delete restrict;

alter table public.audit_logs
  drop constraint audit_logs_registration_id_fkey,
  add constraint audit_registration_requires_event check (
    registration_id is null or event_id is not null
  ),
  add constraint audit_logs_registration_event_fkey
    foreign key (registration_id, event_id)
    references public.registrations (id, event_id)
    on delete set null (registration_id);

revoke all on function public.is_registration_status_transition_allowed(
  public.registration_status,
  public.registration_status
) from public, anon, authenticated;
revoke all on function public.guard_registration_state_machine()
  from public, anon, authenticated;
revoke all on function public.guard_organizer_membership_identity()
  from public, anon, authenticated;
