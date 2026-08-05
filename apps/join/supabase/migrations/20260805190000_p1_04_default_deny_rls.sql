-- P1-04: default-deny RLS policies, registration-scoped access, and column
-- allowlisting. Builds on the fail-closed baseline from P1-02 (zero policy,
-- zero grant). This migration does not implement P1-05 RBAC workflows
-- (invite/revoke/staff management RPCs), P1-06/P1-08 seat engine RPCs, or
-- P1-07 invite/password-gated viewing; those remain fail-closed by omission
-- and are picked up by their own Gates.

-- ---------------------------------------------------------------------------
-- Helper functions (security definer, stable, pinned search_path). Owned by
-- the migration-applying superuser, so they bypass RLS internally the same
-- way public.transfer_organizer_ownership already does in P1-02.
-- ---------------------------------------------------------------------------

create function public.is_organizer_member(
  p_organizer_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p_user_id is not null and exists (
    select 1
    from public.organizer_members om
    where om.organizer_id = p_organizer_id
      and om.user_id = p_user_id
      and om.revoked_at is null
  )
$$;

create function public.is_organizer_admin(
  p_organizer_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p_user_id is not null and exists (
    select 1
    from public.organizer_members om
    where om.organizer_id = p_organizer_id
      and om.user_id = p_user_id
      and om.role in ('owner', 'admin')
      and om.revoked_at is null
  )
$$;

create function public.event_organizer_id(p_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select organizer_id from public.events where id = p_event_id
$$;

create function public.event_is_public_readable(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.status = 'published'
      and e.visibility in ('public', 'unlisted')
  )
$$;

create function public.can_view_event(
  p_event_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select public.event_is_public_readable(p_event_id)
    or public.is_organizer_member(public.event_organizer_id(p_event_id), p_user_id)
$$;

revoke all on function public.is_organizer_member(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.is_organizer_admin(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.event_organizer_id(uuid)
  from public, anon, authenticated;
revoke all on function public.event_is_public_readable(uuid)
  from public, anon, authenticated;
revoke all on function public.can_view_event(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.is_organizer_member(uuid, uuid) to authenticated;
grant execute on function public.is_organizer_admin(uuid, uuid) to authenticated;
grant execute on function public.event_organizer_id(uuid) to anon, authenticated;
grant execute on function public.event_is_public_readable(uuid) to anon, authenticated;
grant execute on function public.can_view_event(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_organizer RPC: bootstraps organizer + sole owner membership in one
-- transaction. A bare INSERT into organizers alone would violate the
-- deferred one-owner constraint trigger (P1-02) the instant a PostgREST call
-- commits, since each REST call is its own transaction; only an atomic RPC
-- can satisfy it.
-- ---------------------------------------------------------------------------

create function public.create_organizer(p_slug text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_user_id uuid := auth.uid();
  new_organizer_id uuid;
begin
  if actor_user_id is null then
    raise exception 'authenticated user required' using errcode = '42501';
  end if;

  insert into public.organizers (slug, display_name, created_by_user_id)
  values (p_slug, p_display_name, actor_user_id)
  returning id into new_organizer_id;

  insert into public.organizer_members (organizer_id, user_id, role)
  values (new_organizer_id, actor_user_id, 'owner');

  insert into public.audit_logs (
    actor_user_id, organizer_id, action, after_state
  ) values (
    actor_user_id,
    new_organizer_id,
    'organizer.created',
    jsonb_build_object('slug', p_slug, 'display_name', p_display_name)
  );

  return new_organizer_id;
end;
$$;

revoke all on function public.create_organizer(text, text) from public, anon, authenticated;
grant execute on function public.create_organizer(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- users: self-only. Legal name / birth date / email verification / LINE
-- linkage stay out of the direct UPDATE grant; those are owned by later
-- gates (P1-13 age/legal, P1-14 email verification, LINE identity linkage).
-- ---------------------------------------------------------------------------

create policy users_select_own on public.users
  for select to authenticated
  using (id = auth.uid());

create policy users_insert_own on public.users
  for insert to authenticated
  with check (id = auth.uid());

create policy users_update_own on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

grant select (
  id, line_user_id, legal_name, birth_date, email, email_normalized,
  email_verified_at, phone, display_name, public_bio, created_at, updated_at
) on public.users to authenticated;
grant insert (
  id, legal_name, birth_date, email, phone, display_name, public_bio
) on public.users to authenticated;
grant update (display_name, public_bio, phone, updated_at) on public.users to authenticated;

-- ---------------------------------------------------------------------------
-- organizers: members can read; only create_organizer() may insert; owner
-- and admin may edit display_name. Slug reassignment is out of scope here.
-- ---------------------------------------------------------------------------

create policy organizers_select_members on public.organizers
  for select to authenticated
  using (public.is_organizer_member(id));

create policy organizers_update_admin on public.organizers
  for update to authenticated
  using (public.is_organizer_admin(id))
  with check (public.is_organizer_admin(id));

grant select (
  id, slug, display_name, created_by_user_id, created_at, updated_at
) on public.organizers to authenticated;
grant update (display_name, updated_at) on public.organizers to authenticated;

-- ---------------------------------------------------------------------------
-- organizer_members: members can see their organizer's roster. Invite,
-- revoke, and role changes stay RPC-only and are P1-05 scope.
-- ---------------------------------------------------------------------------

create policy organizer_members_select_members on public.organizer_members
  for select to authenticated
  using (public.is_organizer_member(organizer_id));

grant select (
  organizer_id, user_id, role, accepted_at, revoked_at, created_at, updated_at
) on public.organizer_members to authenticated;

-- ---------------------------------------------------------------------------
-- events: organizer members see every status/visibility of their own
-- events; everyone else sees only published public/unlisted rows.
-- password_hash is intentionally excluded from every column grant below —
-- no role ever reads it through PostgREST; it is set and verified through
-- dedicated RPCs added alongside P1-07's password-gated viewing.
-- ---------------------------------------------------------------------------

create policy events_select_organizer_members on public.events
  for select to authenticated
  using (public.is_organizer_member(organizer_id));

create policy events_select_public on public.events
  for select to anon, authenticated
  using (status = 'published' and visibility in ('public', 'unlisted'));

create policy events_insert_admin on public.events
  for insert to authenticated
  with check (
    created_by_user_id = auth.uid()
    and public.is_organizer_admin(organizer_id)
  );

create policy events_update_admin on public.events
  for update to authenticated
  using (public.is_organizer_admin(organizer_id))
  with check (public.is_organizer_admin(organizer_id));

grant select (
  id, organizer_id, created_by_user_id, slug, title, summary, description,
  status, visibility, confirmation_mode, timezone, starts_at, ends_at,
  registration_opens_at, registration_closes_at, location_name,
  location_address, capacity, fee_amount, fee_currency, payment_instructions,
  roster_visibility, roster_show_capacity, invite_only, min_age,
  invite_reserved_seats, invite_pool_deadline, invite_pool_released_at,
  created_at, updated_at
) on public.events to anon, authenticated;
grant insert (
  organizer_id, created_by_user_id, slug, title, summary, description,
  status, visibility, confirmation_mode, timezone, starts_at, ends_at,
  registration_opens_at, registration_closes_at, location_name,
  location_address, capacity, fee_amount, fee_currency, payment_instructions,
  roster_visibility, roster_show_capacity, invite_only, min_age,
  invite_reserved_seats, invite_pool_deadline
) on public.events to authenticated;
grant update (
  title, summary, description, status, visibility, confirmation_mode,
  timezone, starts_at, ends_at, registration_opens_at, registration_closes_at,
  location_name, location_address, capacity, fee_amount, fee_currency,
  payment_instructions, roster_visibility, roster_show_capacity, invite_only,
  min_age, invite_reserved_seats, invite_pool_deadline, invite_pool_released_at,
  updated_at
) on public.events to authenticated;

-- ---------------------------------------------------------------------------
-- event_fields: readable by anyone who can view the parent event (needed to
-- render a registration form); writable by that event's organizer admins.
-- ---------------------------------------------------------------------------

create policy event_fields_select_viewable on public.event_fields
  for select to anon, authenticated
  using (public.can_view_event(event_id));

create policy event_fields_write_admin on public.event_fields
  for all to authenticated
  using (public.is_organizer_admin(public.event_organizer_id(event_id)))
  with check (public.is_organizer_admin(public.event_organizer_id(event_id)));

grant select (
  id, event_id, field_key, label, field_type, is_required, options,
  position, created_at, updated_at
) on public.event_fields to anon, authenticated;
grant insert (
  event_id, field_key, label, field_type, is_required, options, position
) on public.event_fields to authenticated;
grant update (
  label, field_type, is_required, options, position, updated_at
) on public.event_fields to authenticated;
grant delete on public.event_fields to authenticated;

-- ---------------------------------------------------------------------------
-- registrations: participants see only their own row; organizer members see
-- every registration under their events. No INSERT/UPDATE/DELETE grant —
-- all transitions go through the single seat-engine RPC (P1-06/P1-08); this
-- table stays write-closed to every app role until that RPC exists.
-- ---------------------------------------------------------------------------

create policy registrations_select_owner_or_organizer on public.registrations
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_organizer_member(public.event_organizer_id(event_id))
  );

grant select (
  id, event_id, user_id, status, seats, seat_pool, waitlisted_at, offered_at,
  offer_expires_at, transition_version, roster_consent, payment_declared_at,
  confirm_deadline_at, display_name_snapshot, public_bio_snapshot,
  created_at, updated_at
) on public.registrations to authenticated;

-- ---------------------------------------------------------------------------
-- registration_answers: same visibility as the parent registration.
-- No direct write grant; answers are written by the P1-06 registration RPC.
-- ---------------------------------------------------------------------------

create policy registration_answers_select_owner_or_organizer
  on public.registration_answers
  for select to authenticated
  using (
    exists (
      select 1
      from public.registrations r
      where r.id = registration_answers.registration_id
        and (
          r.user_id = auth.uid()
          or public.is_organizer_member(public.event_organizer_id(r.event_id))
        )
    )
  );

grant select (
  id, registration_id, event_field_id, answer_value, created_at, updated_at
) on public.registration_answers to authenticated;

-- ---------------------------------------------------------------------------
-- event_invitees: invite-list management is organizer-admin only. Claiming
-- an invite (by an invitee, via token) is P1-07 RPC scope, not a raw grant.
-- ---------------------------------------------------------------------------

create policy event_invitees_admin_only on public.event_invitees
  for all to authenticated
  using (public.is_organizer_admin(public.event_organizer_id(event_id)))
  with check (public.is_organizer_admin(public.event_organizer_id(event_id)));

grant select (
  id, event_id, invitee_type, expires_at, revoked_at, claimed_at,
  claimed_by_user_id, created_by_user_id, created_at
) on public.event_invitees to authenticated;
grant insert (
  event_id, invitee_type, invitee_key_hash, token_hash, expires_at,
  created_by_user_id
) on public.event_invitees to authenticated;
grant update (revoked_at) on public.event_invitees to authenticated;

-- ---------------------------------------------------------------------------
-- event_blocklist: organizer-admin read only for P1-04. Insert (blocking a
-- participant) is P1-08 scope, tied to the seat-engine remove/block RPC.
-- ---------------------------------------------------------------------------

create policy event_blocklist_select_admin on public.event_blocklist
  for select to authenticated
  using (public.is_organizer_admin(public.event_organizer_id(event_id)));

grant select (
  event_id, user_id, created_by_user_id, reason_internal, created_at
) on public.event_blocklist to authenticated;

-- ---------------------------------------------------------------------------
-- notifications: recipients can read their own and mark them read. Delivery
-- writes stay worker/RPC-only.
-- ---------------------------------------------------------------------------

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (recipient_user_id = auth.uid());

create policy notifications_update_own_read_at on public.notifications
  for update to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

grant select (
  id, event_id, registration_id, recipient_user_id, channel,
  notification_kind, status, delivered_at, failed_at, read_at, created_at,
  updated_at
) on public.notifications to authenticated;
grant update (read_at, updated_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- audit_logs: organizer owner/admin can read their organizer's audit trail.
-- No app-role write grant; only security-definer RPCs insert audit rows.
-- ---------------------------------------------------------------------------

create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using (organizer_id is not null and public.is_organizer_admin(organizer_id));

grant select (
  id, actor_user_id, organizer_id, event_id, registration_id, action,
  before_state, after_state, metadata, created_at
) on public.audit_logs to authenticated;

-- idempotency_requests and outbox_events remain fully fail-closed: no
-- policy, no grant. Both are internal to the seat-engine and worker RPCs
-- that P1-06/P1-08/P1-14 will add as security-definer functions.
