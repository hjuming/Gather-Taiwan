/**
 * Runtime verifier for canonical seat-engine hardening A.
 *
 * Safety contract:
 * - Requires an explicit GATHER_JOIN_TEST_DATABASE_URL.
 * - Refuses non-local hosts unless ROLLBACK_FIXTURE_ALLOW_REMOTE=1 is set.
 * - All fixture rows are created in one transaction and rolled back by a
 *   sentinel error. This script never performs a committed cleanup/delete.
 *
 * This is intentionally separate from the production concurrency verifier:
 * it exercises multi-seat strict FIFO, deadline pool merge, capacity-setting
 * idempotency and negative ACLs without leaving an organizer or event behind.
 */
import postgres from "postgres";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.GATHER_JOIN_TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("GATHER_JOIN_TEST_DATABASE_URL is required");
}

const parsedUrl = new URL(databaseUrl);
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
if (!localHosts.has(parsedUrl.hostname) && process.env.ROLLBACK_FIXTURE_ALLOW_REMOTE !== "1") {
  throw new Error(
    "Refusing a non-local rollback fixture. Set ROLLBACK_FIXTURE_ALLOW_REMOTE=1 only after an explicit remote-fixture authorization.",
  );
}

const sql = postgres(databaseUrl, { max: 1 });
const fixtureRollback = new Error("CANONICAL_HARDENING_FIXTURE_ROLLBACK");
const suffix = randomUUID().slice(0, 8);
const ownerId = randomUUID();
const memberIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const organizerId = randomUUID();
const organizerSlug = `seat-hardening-${suffix}`;
const mergeEventId = randomUUID();
const mergeSlug = `seat-merge-${suffix}`;
const fifoEventId = randomUUID();
const fifoSlug = `seat-fifo-${suffix}`;
const settingsEventId = randomUUID();
const settingsSlug = `seat-settings-${suffix}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectSqlState(tx, expectedState, operation, label) {
  await tx`savepoint canonical_expected_failure`;
  let observedState;
  try {
    await operation();
  } catch (error) {
    observedState = error?.code;
  }
  await tx`rollback to savepoint canonical_expected_failure`;
  await tx`release savepoint canonical_expected_failure`;
  assert(
    observedState === expectedState,
    `${label}: expected SQLSTATE ${expectedState}, observed ${observedState ?? "success"}`,
  );
}

async function asRole(tx, role, actorId, operation) {
  if (!new Set(["anon", "authenticated", "postgres"]).has(role)) {
    throw new Error(`unexpected verification role: ${role}`);
  }
  await tx.unsafe(`set local role ${role}`);
  if (actorId) await tx`select set_config('request.jwt.claim.sub', ${actorId}, true)`;
  let succeeded = false;
  try {
    const result = await operation();
    succeeded = true;
    return result;
  } finally {
    // A failed SQL statement aborts the transaction until its savepoint is
    // rolled back. Do not issue RESET ROLE in that aborted window; the caller
    // owns the savepoint rollback for expected failures.
    if (succeeded) await tx`reset role`;
  }
}

async function insertAuthUser(tx, id, index) {
  const email = `seat-hardening-${suffix}-${index}@example.test`;
  await tx`
    insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
    values (${id}, gen_random_uuid(), 'authenticated', 'authenticated', ${email}, statement_timestamp(), statement_timestamp(), statement_timestamp())
  `;
  await tx`
    insert into public.users (id, email, email_verified_at, display_name)
    values (${id}, ${email}, statement_timestamp(), ${`測試使用者${index}`})
  `;
}

async function insertEvent(tx, id, slug, title, capacity, reservedSeats, deadline) {
  await tx`
    insert into public.events (
      id, organizer_id, created_by_user_id, slug, title, status, visibility,
      confirmation_mode, timezone, starts_at, ends_at, capacity,
      invite_reserved_seats, invite_pool_deadline, invite_only
    ) values (
      ${id}, ${organizerId}, ${ownerId}, ${slug}, ${title}, 'published', 'public',
      'instant', 'Asia/Taipei', statement_timestamp() + interval '2 days',
      statement_timestamp() + interval '2 days 3 hours', ${capacity},
      ${reservedSeats}, ${deadline}, false
    )
  `;
}

async function insertRegistration(tx, eventId, userId, status, seats, pool, waitlistedAt) {
  await tx`
    insert into public.registrations (
      event_id, user_id, status, seats, seat_pool, waitlisted_at,
      display_name_snapshot
    ) values (
      ${eventId}, ${userId}, ${status}, ${seats}, ${pool}, ${waitlistedAt},
      ${`測試使用者-${userId.slice(0, 8)}`}
    )
  `;
}

try {
  const [routineAcl] = await sql`
    select
      has_function_privilege('authenticated', 'public.update_event_capacity_settings(uuid, text, integer, integer, timestamptz)', 'execute') as organizer_rpc_auth,
      has_function_privilege('anon', 'public.update_event_capacity_settings(uuid, text, integer, integer, timestamptz)', 'execute') as organizer_rpc_anon,
      has_function_privilege('anon', 'public.event_capacity_usage(uuid)', 'execute') as capacity_helper_anon,
      has_function_privilege('anon', 'public.sweep_event_locked(uuid)', 'execute') as sweep_anon
  `;
  assert(routineAcl.organizer_rpc_auth === true, "authenticated must execute capacity settings RPC");
  assert(routineAcl.organizer_rpc_anon === false, "anon must not execute capacity settings RPC");
  assert(routineAcl.capacity_helper_anon === false, "anon must not execute capacity helper");
  assert(routineAcl.sweep_anon === false, "anon must not execute internal sweep");

  await sql.begin(async (tx) => {
    await insertAuthUser(tx, ownerId, 0);
    for (const [index, memberId] of memberIds.entries()) await insertAuthUser(tx, memberId, index + 1);

    await tx`
      insert into public.organizers (id, slug, display_name, created_by_user_id)
      values (${organizerId}, ${organizerSlug}, 'Seat hardening verifier', ${ownerId})
    `;
    await tx`
      insert into public.organizer_members (organizer_id, user_id, role)
      values (${organizerId}, ${ownerId}, 'owner')
    `;

    // Deadline merge: expired invite pool must release before a global FIFO
    // promotion. The older invite head fits the one remaining seat; the later
    // public row must remain waitlisted.
    const mergeDeadline = new Date(Date.now() - 5 * 60 * 1000);
    await insertEvent(tx, mergeEventId, mergeSlug, "Deadline merge", 3, 1, mergeDeadline);
    await insertRegistration(tx, mergeEventId, memberIds[0], "confirmed", 2, "public", null);
    await insertRegistration(tx, mergeEventId, memberIds[1], "waitlisted", 1, "invite", new Date(Date.now() - 4 * 60 * 1000));
    await insertRegistration(tx, mergeEventId, memberIds[2], "waitlisted", 1, "public", new Date(Date.now() - 3 * 60 * 1000));
    await tx`select public.sweep_event_locked(${mergeEventId})`;
    const [mergeEvent] = await tx`select invite_pool_released_at from public.events where id = ${mergeEventId}`;
    const mergeRows = await tx`
      select user_id, status, seat_pool from public.registrations
      where event_id = ${mergeEventId} order by created_at, id
    `;
    const mergeByUser = new Map(mergeRows.map((row) => [row.user_id, row]));
    assert(mergeEvent.invite_pool_released_at !== null, "expired invite pool was not released");
    assert(mergeByUser.get(memberIds[1])?.status === "offered" && mergeByUser.get(memberIds[1])?.seat_pool === "invite", "global FIFO did not promote the older invite head after merge");
    assert(mergeByUser.get(memberIds[2])?.status === "waitlisted", "later public waitlist bypassed strict FIFO");

    // Multi-seat strict FIFO: with one seat available, a two-seat head must
    // block a later one-seat row rather than being skipped.
    await insertEvent(tx, fifoEventId, fifoSlug, "Multi-seat FIFO", 3, 1, mergeDeadline);
    await insertRegistration(tx, fifoEventId, memberIds[3], "confirmed", 2, "public", null);
    await insertRegistration(tx, fifoEventId, memberIds[4], "waitlisted", 2, "public", new Date(Date.now() - 4 * 60 * 1000));
    await insertRegistration(tx, fifoEventId, memberIds[2], "waitlisted", 1, "invite", new Date(Date.now() - 3 * 60 * 1000));
    await tx`select public.sweep_event_locked(${fifoEventId})`;
    const fifoRows = await tx`
      select user_id, status, seats from public.registrations
      where event_id = ${fifoEventId} order by waitlisted_at nulls first, created_at, id
    `;
    const fifoByUser = new Map(fifoRows.map((row) => [row.user_id, row]));
    assert(fifoByUser.get(memberIds[4])?.seats === 2 && fifoByUser.get(memberIds[4])?.status === "waitlisted", "multi-seat FIFO head was unexpectedly promoted");
    assert(fifoByUser.get(memberIds[2])?.seats === 1 && fifoByUser.get(memberIds[2])?.status === "waitlisted", "later registration bypassed a non-fitting FIFO head");

    // Capacity settings RPC: organizer auth, exact idempotent replay, key
    // fingerprint conflict, and capacity floor enforcement.
    await insertEvent(tx, settingsEventId, settingsSlug, "Capacity settings", 6, null, null);
    const settingsKey = `capacity-${suffix}`;
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const [settingsResult] = await asRole(tx, "authenticated", ownerId, async () => tx`
      select public.update_event_capacity_settings(
        ${settingsEventId}, ${settingsKey}, 5, 2, ${deadline}::timestamptz
      ) as result
    `);
    const [replayedResult] = await asRole(tx, "authenticated", ownerId, async () => tx`
      select public.update_event_capacity_settings(
        ${settingsEventId}, ${settingsKey}, 5, 2, ${deadline}::timestamptz
      ) as result
    `);
    assert(settingsResult.result.event_id === settingsEventId, "capacity settings RPC returned the wrong event");
    assert(JSON.stringify(settingsResult.result) === JSON.stringify(replayedResult.result), "idempotent replay changed the capacity response");
    await expectSqlState(
      tx,
      "23505",
      () => asRole(tx, "authenticated", ownerId, () => tx`
        select public.update_event_capacity_settings(
          ${settingsEventId}, ${settingsKey}, 4, 2, ${deadline}::timestamptz
        )
      `),
      "capacity key fingerprint conflict",
    );
    await expectSqlState(
      tx,
      "42501",
      () => asRole(tx, "anon", null, () => tx`
        select public.update_event_capacity_settings(
          ${settingsEventId}, ${`anonymous-${suffix}`}, 4, null, null
        )
      `),
      "anonymous capacity settings call",
    );

    await insertRegistration(tx, settingsEventId, memberIds[0], "confirmed", 2, "public", null);
    await expectSqlState(
      tx,
      "23514",
      () => asRole(tx, "authenticated", ownerId, () => tx`
        select public.update_event_capacity_settings(
          ${settingsEventId}, ${`floor-${suffix}`}, 3, 2, ${deadline}::timestamptz
        )
      `),
      "public pool floor below summed seats",
    );

    throw fixtureRollback;
  });
} catch (error) {
  if (error !== fixtureRollback) throw error;
  console.log("canonical seat-engine rollback verifier: PASS");
} finally {
  await sql.end({ timeout: 1 });
}
