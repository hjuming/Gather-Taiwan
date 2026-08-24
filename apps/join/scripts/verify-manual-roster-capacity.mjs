/**
 * Local-only rollback verifier for manual roster capacity/FIFO behavior.
 *
 * The corrective migration is applied inside the fixture transaction, then
 * rolled back with the fixture data. This script never connects to production.
 * Wave 3 identity linkage is deferred; Wave 0 never infers identity from display names.
 */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.GATHER_JOIN_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("GATHER_JOIN_TEST_DATABASE_URL is required");

const parsedUrl = new URL(databaseUrl);
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
if (!localHosts.has(parsedUrl.hostname)) {
  throw new Error("Refusing a non-local manual roster capacity verifier database");
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ownerId = process.env.GATHER_JOIN_TEST_OWNER_USER_ID;
const nonOrganizerId = process.env.GATHER_JOIN_TEST_MEMBER_USER_ID;
for (const [name, value] of [
  ["GATHER_JOIN_TEST_OWNER_USER_ID", ownerId],
  ["GATHER_JOIN_TEST_MEMBER_USER_ID", nonOrganizerId],
]) {
  if (!uuidPattern.test(value ?? "")) {
    throw new Error(`${name} must identify an existing local dedicated fixture identity`);
  }
}
if (ownerId === nonOrganizerId) {
  throw new Error("GATHER_JOIN_TEST_OWNER_USER_ID and GATHER_JOIN_TEST_MEMBER_USER_ID must be distinct");
}

const sql = postgres(databaseUrl, { max: 1 });
const migrationSql = readFileSync(
  "supabase/migrations/20260815060000_manual_roster_capacity_seat_engine_fix.sql",
  "utf8",
);
const fixtureRollback = new Error("MANUAL_ROSTER_CAPACITY_FIXTURE_ROLLBACK");
const suffix = randomUUID().slice(0, 8);
const organizerId = randomUUID();
const capacityEventId = randomUUID();
const editEventId = randomUUID();
const inviteEventId = randomUUID();
const reverseInviteEventId = randomUUID();
const poolCapacityEventId = randomUUID();
const mergedInviteEventId = randomUUID();
const conservativeIdentityEventId = randomUUID();
const identityRenameEventId = randomUUID();
const identityDeclineEventId = randomUUID();
const fifoSeatsEventId = randomUUID();
const systemPromotionEventId = randomUUID();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function asRole(tx, role, actorId, operation) {
  if (!new Set(["anon", "authenticated"]).has(role)) throw new Error(`unexpected role: ${role}`);
  await tx.unsafe(`set local role ${role}`);
  await tx`select set_config('request.jwt.claims', ${JSON.stringify({ role, ...(actorId ? { sub: actorId } : {}) })}, true)`;
  const result = await operation();
  await tx`reset role`;
  await tx`reset request.jwt.claims`;
  return result;
}

async function expectRoleSqlState(tx, role, actorId, expectedState, operation, label) {
  if (!new Set(["anon", "authenticated"]).has(role)) throw new Error(`unexpected role: ${role}`);
  await tx`savepoint manual_roster_expected_failure`;
  await tx.unsafe(`set local role ${role}`);
  await tx`select set_config('request.jwt.claims', ${JSON.stringify({ role, ...(actorId ? { sub: actorId } : {}) })}, true)`;
  let observedState;
  try {
    await operation();
  } catch (error) {
    observedState = error?.code;
  }
  await tx`rollback to savepoint manual_roster_expected_failure`;
  await tx`reset role`;
  await tx`reset request.jwt.claims`;
  await tx`release savepoint manual_roster_expected_failure`;
  assert(
    observedState === expectedState,
    `${label}: expected SQLSTATE ${expectedState}, observed ${observedState ?? "success"}`,
  );
}

async function insertEvent(
  tx,
  id,
  slug,
  title,
  capacity,
  visibility = "public",
  inviteOnly = false,
  inviteReservedSeats = null,
) {
  await tx`
    insert into public.events (
      id, organizer_id, created_by_user_id, slug, title, status, visibility,
      confirmation_mode, timezone, starts_at, ends_at, capacity, invite_only,
      invite_reserved_seats, invite_pool_deadline
    ) values (
      ${id}, ${organizerId}, ${ownerId}, ${slug}, ${title}, 'published', ${visibility},
      'instant', 'Asia/Taipei', statement_timestamp() + interval '5 days',
      statement_timestamp() + interval '5 days 2 hours', ${capacity}, ${inviteOnly},
      ${inviteReservedSeats},
      case when ${inviteReservedSeats}::integer is null then null else statement_timestamp() + interval '4 days' end
    )
  `;
}

async function addManual(tx, eventId, name, status = "confirmed") {
  const [row] = await asRole(tx, "authenticated", ownerId, () => tx`
    select public.organizer_add_manual_participant(${eventId}, ${name}, null, ${status}::public.registration_status) as id
  `);
  return row.id;
}

async function statusById(tx, id) {
  const [row] = await tx`select status from public.registrations where id = ${id}`;
  return row?.status;
}

async function assertRollbackZeroResidue() {
  const [residue] = await sql`
    select
      (select count(*)::integer from public.outbox_events
        where event_id = ${capacityEventId} or event_id = ${editEventId} or event_id = ${inviteEventId}
          or event_id = ${reverseInviteEventId} or event_id = ${poolCapacityEventId}
          or event_id = ${mergedInviteEventId} or event_id = ${conservativeIdentityEventId}
          or event_id = ${identityRenameEventId} or event_id = ${identityDeclineEventId}
          or event_id = ${fifoSeatsEventId} or event_id = ${systemPromotionEventId}) as outbox_events,
      (select count(*)::integer from public.audit_logs
        where event_id = ${capacityEventId} or event_id = ${editEventId} or event_id = ${inviteEventId}
          or event_id = ${reverseInviteEventId} or event_id = ${poolCapacityEventId}
          or event_id = ${mergedInviteEventId} or event_id = ${conservativeIdentityEventId}
          or event_id = ${identityRenameEventId} or event_id = ${identityDeclineEventId}
          or event_id = ${fifoSeatsEventId} or event_id = ${systemPromotionEventId}
          or organizer_id = ${organizerId}) as audit_logs,
      (select count(*)::integer from public.event_invitation_targets
        where event_id = ${inviteEventId} or event_id = ${reverseInviteEventId}
          or event_id = ${poolCapacityEventId} or event_id = ${mergedInviteEventId}
          or event_id = ${conservativeIdentityEventId} or event_id = ${identityRenameEventId}
          or event_id = ${identityDeclineEventId}
          or event_id = ${fifoSeatsEventId}
          or event_id = ${systemPromotionEventId}) as event_invitation_targets,
      (select count(*)::integer from public.registrations
        where event_id = ${capacityEventId} or event_id = ${editEventId} or event_id = ${inviteEventId}
          or event_id = ${reverseInviteEventId} or event_id = ${poolCapacityEventId}
          or event_id = ${mergedInviteEventId} or event_id = ${conservativeIdentityEventId}
          or event_id = ${identityRenameEventId} or event_id = ${identityDeclineEventId}
          or event_id = ${fifoSeatsEventId} or event_id = ${systemPromotionEventId}) as registrations,
      (select count(*)::integer from public.events
        where id = ${capacityEventId} or id = ${editEventId} or id = ${inviteEventId}
          or id = ${reverseInviteEventId} or id = ${poolCapacityEventId}
          or id = ${mergedInviteEventId} or id = ${conservativeIdentityEventId}
          or id = ${identityRenameEventId} or id = ${identityDeclineEventId}
          or id = ${fifoSeatsEventId} or id = ${systemPromotionEventId}) as events,
      (select count(*)::integer from public.organizer_members where organizer_id = ${organizerId}) as organizer_members,
      (select count(*)::integer from public.organizers where id = ${organizerId}) as organizers
  `;
  for (const [table, count] of Object.entries(residue)) {
    assert(count === 0, `rollback left ${count} fixture row(s) in ${table}`);
  }
}

// Run this aggregate-only query against the target database before a remote apply.
// A nonzero count is a hard stop; investigate privately without listing event or person data.
async function readConservativeCapacityPreflight() {
  const [row] = await sql`
    with registration_usage as (
      select
        registration.event_id,
        coalesce(sum(registration.seats), 0)::integer as registration_seats,
        coalesce(sum(registration.seats) filter (
          where registration.seat_pool = 'invite'
        ), 0)::integer as invite_registration_seats
      from public.registrations registration
      where registration.status in ('offered', 'pending_organizer_confirmation', 'confirmed')
      group by registration.event_id
    ), invitee_usage as (
      select target.event_id, count(*)::integer as attending_invitee_count
      from public.event_invitation_targets target
      where target.response = 'attending' and target.revoked_at is null
      group by target.event_id
    )
    select count(*)::integer as over_limit_event_count
    from public.events event
    left join registration_usage registration on registration.event_id = event.id
    left join invitee_usage invitee on invitee.event_id = event.id
    where event.capacity is not null
      and (
        coalesce(registration.registration_seats, 0)
          + coalesce(invitee.attending_invitee_count, 0) > event.capacity
        or (
          event.invite_reserved_seats is not null
          and event.invite_pool_released_at is null
          and (
            coalesce(registration.invite_registration_seats, 0)
              + coalesce(invitee.attending_invitee_count, 0) > event.invite_reserved_seats
            or coalesce(registration.registration_seats, 0)
              - coalesce(registration.invite_registration_seats, 0)
                > event.capacity - event.invite_reserved_seats
          )
        )
      )
  `;
  return row?.over_limit_event_count ?? 0;
}

try {
  const [baseSchema] = await sql`select to_regtype('public.seat_pool')::text as seat_pool_type`;
  if (baseSchema?.seat_pool_type !== "seat_pool") {
    throw new Error("Local Join schema is missing public.seat_pool; run this verifier only after local migrations are applied");
  }
  const overLimitEventCount = await readConservativeCapacityPreflight();
  if (overLimitEventCount > 0) {
    throw new Error(
      `Conservative capacity preflight hard stop: ${overLimitEventCount} event(s) exceed the Wave 0 envelope`,
    );
  }
  const [fixtureIdentities] = await sql`
    select count(distinct auth_user.id)::integer as identity_count
    from public.users app_user
    join auth.users auth_user on auth_user.id = app_user.id
    where auth_user.id in (${ownerId}, ${nonOrganizerId})
  `;
  if (fixtureIdentities?.identity_count !== 2) {
    throw new Error(
      "Both configured IDs must reference existing isolated local fixture identities in auth.users and public.users",
    );
  }

  await sql.begin(async (tx) => {
    await tx.unsafe(migrationSql);
    await tx`
      insert into public.organizers (id, slug, display_name, created_by_user_id)
      values (${organizerId}, ${`manual-capacity-${suffix}`}, 'Manual capacity verifier', ${ownerId})
    `;
    await tx`
      insert into public.organizer_members (organizer_id, user_id, role)
      values (${organizerId}, ${ownerId}, 'owner')
    `;

    await insertEvent(tx, capacityEventId, `manual-capacity-${suffix}`, "Manual Capacity", 1);
    const firstId = await addManual(tx, capacityEventId, "  Manual A  ");
    const [firstRegistration] = await tx`
      select manual_display_name
      from public.registrations
      where id = ${firstId}
    `;
    const [manualAddAudit] = await tx`
      select
        actor_user_id::text as actor_user_id,
        before_state -> 'capacity_usage' ->> 'total_occupied_seats' as before_total,
        after_state ->> 'display_name' as display_name,
        after_state -> 'capacity_usage' ->> 'total_occupied_seats' as after_total
      from public.audit_logs
      where registration_id = ${firstId} and action = 'registration.manual_added'
    `;
    assert(firstRegistration.manual_display_name === "Manual A", "manual add row should store normalized Manual A");
    assert(manualAddAudit.display_name === "Manual A", "manual add audit should store normalized Manual A");
    assert(manualAddAudit.actor_user_id === ownerId, "manual add audit actor should be the fixture owner");
    assert(manualAddAudit.before_total === "0", "manual add audit before total should be zero");
    assert(manualAddAudit.after_total === "1", "manual add audit after total should be one");
    const secondId = await addManual(tx, capacityEventId, "Manual B");
    assert((await statusById(tx, firstId)) === "confirmed", "first manual participant should hold the only seat");
    assert((await statusById(tx, secondId)) === "waitlisted", "second manual participant should waitlist instead of overselling");

    await asRole(tx, "authenticated", ownerId, () => tx`
      select public.organizer_remove_manual_participant(${firstId})
    `);
    assert((await statusById(tx, firstId)) === "removed_by_organizer", "removed manual participant should become terminal");
    assert((await statusById(tx, secondId)) === "confirmed", "manual waitlist head should promote directly to confirmed");
    const [manualOutbox] = await tx`
      select count(*)::integer as count from public.outbox_events where registration_id = ${secondId}
    `;
    assert(manualOutbox.count === 0, "manual/null recipient promotion must not create an outbox row");
    const [manualAudit] = await tx`
      select
        actor_user_id::text as actor_user_id,
        before_state ->> 'status' as before_status,
        before_state ->> 'seats' as before_seats,
        before_state ->> 'seat_pool' as before_pool,
        before_state -> 'capacity_usage' ->> 'total_occupied_seats' as before_total,
        after_state ->> 'status' as after_status,
        after_state ->> 'seats' as after_seats,
        after_state ->> 'seat_pool' as after_pool,
        after_state -> 'capacity_usage' ->> 'total_occupied_seats' as after_total
      from public.audit_logs
      where registration_id = ${secondId} and action = 'registration.manual_promoted'
    `;
    assert(manualAudit.actor_user_id === ownerId, "manual promotion audit actor should be the fixture owner");
    assert(manualAudit.before_total === "0", "manual promotion audit before total should be zero");
    assert(manualAudit.after_total === "1", "manual promotion audit after total should be one");
    assert(
      manualAudit.before_status === "waitlisted"
        && manualAudit.after_status === "confirmed"
        && manualAudit.before_seats === "1"
        && manualAudit.after_seats === "1"
        && manualAudit.before_pool === "public"
        && manualAudit.after_pool === "public",
      "manual promotion audit must contain the real status, seats, and pool transition",
    );

    await insertEvent(tx, editEventId, `manual-edit-${suffix}`, "Manual Edit FIFO", 2);
    const editHeldId = await addManual(tx, editEventId, "Edit Held");
    const editHeadId = await addManual(tx, editEventId, "Edit Head", "waitlisted");
    const editTailId = await addManual(tx, editEventId, "Edit Tail", "waitlisted");
    await expectRoleSqlState(
      tx,
      "authenticated",
      ownerId,
      "55000",
      () => tx`
        select public.organizer_edit_manual_participant(${editTailId}, null, null, 'confirmed'::public.registration_status)
      `,
      "manual waitlisted tail confirmation",
    );
    await asRole(tx, "authenticated", ownerId, () => tx`
      select public.organizer_edit_manual_participant(${editHeadId}, ${"  Edited Head  "}, null, 'confirmed'::public.registration_status)
    `);
    const [manualEditAudit] = await tx`
      select
        audit.actor_user_id::text as actor_user_id,
        registration.manual_display_name as row_display_name,
        audit.before_state -> 'capacity_usage' ->> 'total_occupied_seats' as before_total,
        audit.after_state ->> 'display_name' as display_name,
        audit.after_state -> 'capacity_usage' ->> 'total_occupied_seats' as after_total
      from public.audit_logs audit
      join public.registrations registration on registration.id = audit.registration_id
      where audit.registration_id = ${editHeadId} and audit.action = 'registration.manual_edited'
    `;
    assert(manualEditAudit.row_display_name === "Edited Head", "manual edit row should store normalized Edited Head");
    assert(manualEditAudit.display_name === "Edited Head", "manual edit audit should store normalized Edited Head");
    assert(manualEditAudit.actor_user_id === ownerId, "manual edit audit actor should be the fixture owner");
    assert(manualEditAudit.before_total === "1", "manual edit audit before total should be one");
    assert(manualEditAudit.after_total === "2", "manual edit audit after total should be two");
    assert((await statusById(tx, editHeldId)) === "confirmed", "existing held row should remain confirmed");
    assert((await statusById(tx, editHeadId)) === "confirmed", "manual waitlist head should confirm when a seat fits");
    assert((await statusById(tx, editTailId)) === "waitlisted", "later manual row must remain waitlisted");

    await insertEvent(
      tx,
      fifoSeatsEventId,
      `manual-fifo-seats-${suffix}`,
      "Two-seat FIFO head blocks one-seat tail",
      3,
    );
    await addManual(tx, fifoSeatsEventId, "FIFO Held A");
    await addManual(tx, fifoSeatsEventId, "FIFO Held B");
    const [{ id: fifoHeadId }] = await tx`
      insert into public.registrations (
        event_id, user_id, status, seats, seat_pool, manual_display_name,
        added_by_user_id, display_name_snapshot, waitlisted_at
      ) values (
        ${fifoSeatsEventId}, null, 'waitlisted', 2, 'public', 'FIFO Head Two Seats',
        ${ownerId}, 'FIFO Head Two Seats', statement_timestamp() - interval '2 minutes'
      )
      returning id
    `;
    const [{ id: fifoTailId }] = await tx`
      insert into public.registrations (
        event_id, user_id, status, seats, seat_pool, manual_display_name,
        added_by_user_id, display_name_snapshot, waitlisted_at
      ) values (
        ${fifoSeatsEventId}, null, 'waitlisted', 1, 'public', 'FIFO Tail One Seat',
        ${ownerId}, 'FIFO Tail One Seat', statement_timestamp() - interval '1 minute'
      )
      returning id
    `;
    await tx`select public.promote_next_waitlisted_locked(${fifoSeatsEventId}, 'public')`;
    assert(
      (await statusById(tx, fifoHeadId)) === "waitlisted"
        && (await statusById(tx, fifoTailId)) === "waitlisted",
      "a fitting FIFO tail must not bypass a non-fitting head",
    );

    await insertEvent(
      tx,
      systemPromotionEventId,
      `manual-system-promotion-${suffix}`,
      "System promotion actor is null",
      1,
    );
    const [{ id: systemPromotionId }] = await tx`
      insert into public.registrations (
        event_id, user_id, status, seats, seat_pool, manual_display_name,
        added_by_user_id, display_name_snapshot, waitlisted_at
      ) values (
        ${systemPromotionEventId}, null, 'waitlisted', 1, 'public', 'System Promoted',
        ${ownerId}, 'System Promoted', statement_timestamp() - interval '1 minute'
      )
      returning id
    `;
    await tx`select public.promote_next_waitlisted_locked(${systemPromotionEventId}, 'public')`;
    const [systemPromotionAudit] = await tx`
      select
        actor_user_id,
        before_state -> 'capacity_usage' ->> 'total_occupied_seats' as before_total,
        after_state -> 'capacity_usage' ->> 'total_occupied_seats' as after_total
      from public.audit_logs
      where registration_id = ${systemPromotionId} and action = 'registration.manual_promoted'
    `;
    assert(systemPromotionAudit.actor_user_id === null, "system promotion audit actor must be null");
    assert(
      systemPromotionAudit.before_total === "0" && systemPromotionAudit.after_total === "1",
      "system promotion audit must capture zero-to-one usage",
    );
    const [systemPromotionOutbox] = await tx`
      select count(*)::integer as count
      from public.outbox_events
      where registration_id = ${systemPromotionId}
    `;
    assert(
      systemPromotionOutbox.count === 0,
      "system manual promotion must not create an outbox row",
    );

    await insertEvent(tx, inviteEventId, `manual-invite-${suffix}`, "Manual Invite Capacity", 1, "private", true);
    const [{ target_id: targetId }] = await asRole(tx, "authenticated", ownerId, () => tx`
      select public.organizer_add_event_invitation_target(${inviteEventId}, 'Invited Guest') as target_id
    `);
    const [{ token }] = await asRole(tx, "authenticated", ownerId, () => tx`
      select public.organizer_issue_event_invitation_token(${targetId}) as token
    `);
    await asRole(tx, "anon", null, () => tx`
      select public.respond_to_event_invitation(${`manual-invite-${suffix}`}, ${token}, 'attending')
    `);
    const inviteManualId = await addManual(tx, inviteEventId, "Different Manual");
    assert((await statusById(tx, inviteManualId)) === "waitlisted", "attending invitee should consume capacity before manual add");

    await insertEvent(
      tx,
      reverseInviteEventId,
      `manual-reverse-invite-${suffix}`,
      "Reverse-order Invitation Capacity",
      1,
      "private",
      true,
    );
    const reverseManualId = await addManual(tx, reverseInviteEventId, "Manual First");
    const [{ target_id: reverseTargetId }] = await asRole(tx, "authenticated", ownerId, () => tx`
      select public.organizer_add_event_invitation_target(${reverseInviteEventId}, 'Invite Second') as target_id
    `);
    const [{ token: reverseToken }] = await asRole(tx, "authenticated", ownerId, () => tx`
      select public.organizer_issue_event_invitation_token(${reverseTargetId}) as token
    `);
    await expectRoleSqlState(
      tx,
      "anon",
      null,
      "53300",
      () => tx`
        select public.respond_to_event_invitation(${`manual-reverse-invite-${suffix}`}, ${reverseToken}, 'attending')
      `,
      "manual first blocks reverse-order invitation capacity",
    );
    assert((await statusById(tx, reverseManualId)) === "confirmed", "manual-first held seat should remain confirmed");

    await insertEvent(
      tx,
      poolCapacityEventId,
      `manual-total-pool-${suffix}`,
      "Split Invite-pool Envelope",
      3,
      "private",
      true,
      1,
    );
    const [{ target_id: poolFirstTargetId }] = await asRole(tx, "authenticated", ownerId, () => tx`
      select public.organizer_add_event_invitation_target(${poolCapacityEventId}, 'Pool Invite A') as target_id
    `);
    const [{ target_id: poolSecondTargetId }] = await asRole(tx, "authenticated", ownerId, () => tx`
      select public.organizer_add_event_invitation_target(${poolCapacityEventId}, 'Pool Invite B') as target_id
    `);
    const [{ token: poolFirstToken }] = await asRole(tx, "authenticated", ownerId, () => tx`
      select public.organizer_issue_event_invitation_token(${poolFirstTargetId}) as token
    `);
    const [{ token: poolSecondToken }] = await asRole(tx, "authenticated", ownerId, () => tx`
      select public.organizer_issue_event_invitation_token(${poolSecondTargetId}) as token
    `);
    await asRole(tx, "anon", null, () => tx`
      select public.respond_to_event_invitation(${`manual-total-pool-${suffix}`}, ${poolFirstToken}, 'attending')
    `);
    const [splitBefore] = await tx`
      select public.event_capacity_usage(${poolCapacityEventId}) as usage
    `;
    await expectRoleSqlState(
      tx,
      "anon",
      null,
      "53300",
      () => tx`
        select public.respond_to_event_invitation(${`manual-total-pool-${suffix}`}, ${poolSecondToken}, 'attending')
      `,
      "pre-release second invite",
    );
    const [splitAfter] = await tx`
      select
        public.event_capacity_usage(${poolCapacityEventId}) as usage,
        (select response from public.event_invitation_targets where id = ${poolSecondTargetId}) as response
    `;
    assert(
      splitAfter.response === "pending"
        && splitAfter.usage.total_occupied_seats === splitBefore.usage.total_occupied_seats
        && splitAfter.usage.invite_occupied_seats === splitBefore.usage.invite_occupied_seats,
      "rejected invite response must leave usage and target unchanged",
    );
    const poolFirstManualId = await addManual(tx, poolCapacityEventId, "Pool Manual A");
    const poolSecondManualId = await addManual(tx, poolCapacityEventId, "Pool Manual B");
    const poolThirdManualId = await addManual(tx, poolCapacityEventId, "Pool Manual C");
    assert((await statusById(tx, poolFirstManualId)) === "confirmed", "first public pool seat should be admitted");
    assert((await statusById(tx, poolSecondManualId)) === "confirmed", "second public pool seat should be admitted");
    assert((await statusById(tx, poolThirdManualId)) === "waitlisted", "public pool must stop at its split limit");

    await insertEvent(
      tx,
      mergedInviteEventId,
      `manual-merged-invite-${suffix}`,
      "Deadline Merge Invite Envelope",
      3,
      "private",
      true,
      1,
    );
    await tx`
      update public.events
      set invite_pool_deadline = statement_timestamp() - interval '1 second'
      where id = ${mergedInviteEventId}
    `;
    for (const inviteeName of ["Merged Invite A", "Merged Invite B"]) {
      const [{ target_id: mergedTargetId }] = await asRole(tx, "authenticated", ownerId, () => tx`
        select public.organizer_add_event_invitation_target(${mergedInviteEventId}, ${inviteeName}) as target_id
      `);
      const [{ token: mergedToken }] = await asRole(tx, "authenticated", ownerId, () => tx`
        select public.organizer_issue_event_invitation_token(${mergedTargetId}) as token
      `);
      await asRole(tx, "anon", null, () => tx`
        select public.respond_to_event_invitation(${`manual-merged-invite-${suffix}`}, ${mergedToken}, 'attending')
      `);
    }
    const [mergedUsage] = await tx`
      select public.event_capacity_usage(${mergedInviteEventId}) as usage
    `;
    assert(
      mergedUsage.usage.merged === true && mergedUsage.usage.total_occupied_seats === 2,
      "deadline merge should admit the second invite while total has room",
    );

    await insertEvent(
      tx,
      conservativeIdentityEventId,
      `manual-independent-identity-${suffix}`,
      "Same-name identities stay independent",
      1,
      "private",
      true,
    );
    await addManual(tx, conservativeIdentityEventId, "Same Person");
    const [{ target_id: conservativeTargetId }] = await asRole(tx, "authenticated", ownerId, () => tx`
      select public.organizer_add_event_invitation_target(${conservativeIdentityEventId}, 'Same Person') as target_id
    `);
    const [{ token: conservativeToken }] = await asRole(tx, "authenticated", ownerId, () => tx`
      select public.organizer_issue_event_invitation_token(${conservativeTargetId}) as token
    `);
    const [sameNameBefore] = await tx`
      select public.event_capacity_usage(${conservativeIdentityEventId}) as usage
    `;
    await expectRoleSqlState(
      tx,
      "anon",
      null,
      "53300",
      () => tx`
        select public.respond_to_event_invitation(
          ${`manual-independent-identity-${suffix}`}, ${conservativeToken}, 'attending'
        )
      `,
      "same-name invitation must not reuse manual capacity",
    );
    const [sameNameAfter] = await tx`
      select
        public.event_capacity_usage(${conservativeIdentityEventId}) as usage,
        (select response from public.event_invitation_targets
          where id = ${conservativeTargetId}) as response
    `;
    assert(
      sameNameAfter.response === "pending"
        && sameNameAfter.usage.total_occupied_seats === sameNameBefore.usage.total_occupied_seats
        && sameNameAfter.usage.attending_invitee_count === 0,
      "same-name rejection must leave target pending and usage unchanged",
    );

    await insertEvent(
      tx,
      identityRenameEventId,
      `manual-identity-rename-${suffix}`,
      "Conservative rename-invariant capacity",
      5,
      "private",
      true,
    );
    const renameFirstManualId = await addManual(tx, identityRenameEventId, "Duplicate Held");
    await addManual(tx, identityRenameEventId, "Duplicate Held");
    const [{ target_id: renameTargetId }] = await asRole(tx, "authenticated", ownerId, () => tx`
      select public.organizer_add_event_invitation_target(${identityRenameEventId}, 'Duplicate Held') as target_id
    `);
    const [{ token: renameToken }] = await asRole(tx, "authenticated", ownerId, () => tx`
      select public.organizer_issue_event_invitation_token(${renameTargetId}) as token
    `);
    await asRole(tx, "anon", null, () => tx`
      select public.respond_to_event_invitation(
        ${`manual-identity-rename-${suffix}`}, ${renameToken}, 'attending'
      )
    `);
    const [renameUsageBefore] = await tx`
      select public.event_capacity_usage(${identityRenameEventId}) as usage
    `;
    assert(
      renameUsageBefore.usage.registration_seats === 2
        && renameUsageBefore.usage.attending_invitee_count === 1
        && renameUsageBefore.usage.total_occupied_seats === 3,
      "same-name held registrations must each consume one seat",
    );
    await asRole(tx, "authenticated", ownerId, () => tx`
      select public.organizer_edit_manual_participant(${renameFirstManualId}, 'Renamed Manual', null, null)
    `);
    await asRole(tx, "authenticated", ownerId, () => tx`
      select public.organizer_edit_event_invitation_target(${renameTargetId}, 'Renamed Invite')
    `);
    const [renameUsageAfter] = await tx`
      select public.event_capacity_usage(${identityRenameEventId}) as usage
    `;
    assert(
      renameUsageAfter.usage.registration_seats === renameUsageBefore.usage.registration_seats
        && renameUsageAfter.usage.attending_invitee_count
          === renameUsageBefore.usage.attending_invitee_count
        && renameUsageAfter.usage.total_occupied_seats
          === renameUsageBefore.usage.total_occupied_seats,
      "manual and invitation renames must not change capacity usage",
    );

    await insertEvent(
      tx,
      identityDeclineEventId,
      `manual-identity-decline-${suffix}`,
      "Conservative decline keeps registrations visible",
      5,
      "private",
      true,
    );
    await addManual(tx, identityDeclineEventId, "Shared Label");
    await addManual(tx, identityDeclineEventId, "Shared Label");
    const [{ target_id: declineTargetId }] = await asRole(tx, "authenticated", ownerId, () => tx`
      select public.organizer_add_event_invitation_target(${identityDeclineEventId}, 'Shared Label') as target_id
    `);
    const [{ token: declineToken }] = await asRole(tx, "authenticated", ownerId, () => tx`
      select public.organizer_issue_event_invitation_token(${declineTargetId}) as token
    `);
    await asRole(tx, "anon", null, () => tx`
      select public.respond_to_event_invitation(
        ${`manual-identity-decline-${suffix}`}, ${declineToken}, 'attending'
      )
    `);
    const [declineAttendingUsage] = await tx`
      select public.event_capacity_usage(${identityDeclineEventId}) as usage
    `;
    assert(
      declineAttendingUsage.usage.registration_seats === 2
        && declineAttendingUsage.usage.attending_invitee_count === 1
        && declineAttendingUsage.usage.total_occupied_seats === 3,
      "same-name attending must count both registrations plus the invitation",
    );
    await asRole(tx, "anon", null, () => tx`
      select public.respond_to_event_invitation(
        ${`manual-identity-decline-${suffix}`}, ${declineToken}, 'declined'
      )
    `);
    const [declinedUsage] = await tx`
      select public.event_capacity_usage(${identityDeclineEventId}) as usage
    `;
    assert(
      declinedUsage.usage.registration_seats === 2
        && declinedUsage.usage.attending_invitee_count === 0
        && declinedUsage.usage.total_occupied_seats === 2,
      "decline must subtract only the invitation without restoring hidden registrations",
    );

    await expectRoleSqlState(
      tx,
      "authenticated",
      nonOrganizerId,
      "42501",
      () => tx`
        select public.organizer_add_manual_participant(${capacityEventId}, 'Non-organizer Add', null, 'confirmed'::public.registration_status)
      `,
      "authenticated non-organizer manual add",
    );
    await expectRoleSqlState(
      tx,
      "anon",
      null,
      "42501",
      () => tx`
        select public.organizer_add_manual_participant(${capacityEventId}, 'Anon Add', null, 'confirmed'::public.registration_status)
      `,
      "anonymous manual add",
    );

    throw fixtureRollback;
  });
} catch (error) {
  if (error !== fixtureRollback) throw error;
  await assertRollbackZeroResidue();
  console.log("manual roster capacity rollback verifier: PASS");
} finally {
  await sql.end({ timeout: 1 });
}
