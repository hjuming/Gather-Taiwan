/**
 * Local-only Wave 2 verifier for organizer confirm/decline/remove.
 *
 * Contract: exactly 12 cases (anonymous/member/organizer/replay for each
 * action), existing local owner identity plus one temporary local Auth Admin
 * identity, and fixture-owned cleanup with a zero-residue read-back.
 *
 * This script deliberately does not apply migrations, reset the database, or
 * write public.auth.users/auth.users directly. The migration must already be
 * present on the explicitly supplied local diagnostic database.
 */

import postgres from "postgres";
import { randomUUID } from "node:crypto";

const databaseUrl = process.env.GATHER_JOIN_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("GATHER_JOIN_TEST_DATABASE_URL is required");

const parsedDatabaseUrl = new URL(databaseUrl);
if (parsedDatabaseUrl.hostname !== "127.0.0.1" || parsedDatabaseUrl.port !== "58332") {
  throw new Error("Refusing a non-local or non-diagnostic Wave 2 verifier database");
}

const localApiUrl = process.env.GATHER_JOIN_LOCAL_API_URL ?? "http://127.0.0.1:58331";
const parsedApiUrl = new URL(localApiUrl);
if (parsedApiUrl.hostname !== "127.0.0.1") {
  throw new Error("Refusing a non-local Auth Admin API");
}
const localServiceRoleKey = process.env.GATHER_JOIN_LOCAL_SERVICE_ROLE_KEY;
if (!localServiceRoleKey) throw new Error("GATHER_JOIN_LOCAL_SERVICE_ROLE_KEY is required");

const sql = postgres(databaseUrl, { max: 4 });
const suffix = randomUUID().slice(0, 12);
const fixturePrefix = `wave2-organizer-idem-${suffix}`;
const fixtureEmail = `${fixturePrefix}@local.test`;
const fixturePassword = `${randomUUID()}Aa1!`;
const organizerId = randomUUID();
const actionIds = {
  confirm: randomUUID(),
  decline: randomUUID(),
  remove: randomUUID(),
};
const registrationIds = {
  confirm: randomUUID(),
  decline: randomUUID(),
  remove: randomUUID(),
};
const waitlistedIds = {
  decline: randomUUID(),
  remove: randomUUID(),
};
const idempotencyKeys = {
  confirm: randomUUID(),
  decline: randomUUID(),
  remove: randomUUID(),
};

let ownerId;
let memberId;
let temporaryAuthUserId;
const report = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sqlState(error) {
  return typeof error?.code === "string" ? error.code : "UNKNOWN";
}

function asClaim(role, actorId) {
  return JSON.stringify({ role, ...(actorId ? { sub: actorId } : {}) });
}

async function withRole(tx, role, actorId, operation) {
  await tx.unsafe(`set local role ${role}`);
  await tx`select set_config('request.jwt.claims', ${asClaim(role, actorId)}, true)`;
  const [context] = await tx`
    select current_user as current_role,
           auth.uid() is not null as has_uid,
           has_function_privilege(current_user, 'public.organizer_confirm_registration(uuid,text)', 'execute') as can_execute
  `;
  assert(context.current_role === role && context.has_uid === Boolean(actorId) && context.can_execute, "unexpected authenticated RPC role context");
  try {
    return await operation();
  } finally {
    await tx`reset role`;
    await tx`reset request.jwt.claims`;
  }
}

async function expectFailure(role, actorId, operation) {
  const tx = await sql.reserve();
  let observed;
  try {
    await tx`begin`;
    await tx.unsafe(`set local role ${role}`);
    await tx`select set_config('request.jwt.claims', ${asClaim(role, actorId)}, true)`;
    try {
      await operation(tx);
    } catch (error) {
      observed = sqlState(error);
    }
    await tx`rollback`;
    return observed;
  } finally {
    await tx.release();
  }
}

async function localAuthAdmin(path, options = {}) {
  const response = await fetch(`${localApiUrl}${path}`, {
    ...options,
    headers: {
      apikey: localServiceRoleKey,
      Authorization: `Bearer ${localServiceRoleKey}`,
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`local Auth Admin API ${response.status}`);
  }
  return body;
}

async function createTemporaryIdentity() {
  const body = await localAuthAdmin("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: fixtureEmail,
      password: fixturePassword,
      email_confirm: true,
      user_metadata: { wave2_fixture: fixturePrefix },
    }),
  });
  assert(typeof body.id === "string", "local Auth Admin API did not return fixture user id");
  temporaryAuthUserId = body.id;
  memberId = body.id;
  await sql`
    insert into public.users (id, email, display_name)
    values (${memberId}, ${fixtureEmail}, 'Wave 2 temporary member')
  `;
}

async function deleteTemporaryIdentity() {
  if (!temporaryAuthUserId) return;
  await localAuthAdmin(`/auth/v1/admin/users/${temporaryAuthUserId}`, { method: "DELETE" });
  temporaryAuthUserId = undefined;
}

async function resolveExistingOwner() {
  const [row] = await sql`
    select u.id
    from public.users u
    join auth.users a on a.id = u.id
    order by u.created_at, u.id
    limit 1
  `;
  assert(row?.id, "local diagnostic database must contain one existing owner fixture identity");
  ownerId = row.id;
}

async function assertWave2Functions() {
  const rows = await sql`
    select p.proname, pg_get_function_identity_arguments(p.oid) as args,
           has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'organizer_confirm_registration',
        'organizer_decline_registration',
        'organizer_remove_registration'
      )
    order by p.proname, args
  `;
  const signature = rows.map((row) => `${row.proname}(${row.args})`).join("|");
  assert(
    signature ===
      "organizer_confirm_registration(p_registration_id uuid, p_idempotency_key text)|organizer_decline_registration(p_registration_id uuid, p_idempotency_key text)|organizer_remove_registration(p_registration_id uuid, p_idempotency_key text, p_reason_internal text)",
    `unexpected Wave 2 RPC signatures: ${signature}`,
  );
  assert(rows.every((row) => row.authenticated_execute), "authenticated execute grant is missing");
}

async function assertFreshPrefix() {
  const [row] = await sql`
    select
      (select count(*)::integer from public.organizers where slug like ${`${fixturePrefix}%`}) as organizers,
      (select count(*)::integer from public.events where slug like ${`${fixturePrefix}%`}) as events
  `;
  assert(row.organizers === 0 && row.events === 0, "Wave 2 fixture prefix already has residue; refusing cleanup of unknown rows");
}

async function createFixture() {
  await sql.begin(async (tx) => {
    await tx`
      insert into public.organizers (id, slug, display_name, created_by_user_id)
      values (${organizerId}, ${fixturePrefix}, 'Wave 2 local verifier', ${ownerId})
    `;
    await tx`
      insert into public.organizer_members (organizer_id, user_id, role)
      values (${organizerId}, ${ownerId}, 'owner')
    `;

    for (const [action, eventId] of Object.entries(actionIds)) {
      await tx`
        insert into public.events (
          id, organizer_id, created_by_user_id, slug, title, status, visibility,
          confirmation_mode, timezone, starts_at, ends_at, capacity,
          gathering_type, fee_mode
        ) values (
          ${eventId}, ${organizerId}, ${ownerId}, ${`${fixturePrefix}-${action}`},
          ${`Wave 2 ${action}`}, 'published', 'public',
          ${action === "remove" ? "instant" : "organizer_confirmed"},
          'Asia/Taipei', statement_timestamp() + interval '5 days',
          statement_timestamp() + interval '5 days 2 hours', 1, 'other', 'free'
        )
      `;

      const primaryStatus = action === "remove" ? "confirmed" : "pending_organizer_confirmation";
      await tx`
        insert into public.registrations (
          id, event_id, user_id, status, seats, seat_pool,
          roster_consent, display_name_snapshot
        ) values (
          ${registrationIds[action]}, ${eventId}, ${memberId},
          ${primaryStatus}::public.registration_status, 1, 'public', true, 'Wave 2 online'
        )
      `;

      if (action !== "confirm") {
        await tx`
          insert into public.registrations (
            id, event_id, user_id, status, seats, seat_pool,
            waitlisted_at, roster_consent, display_name_snapshot
          ) values (
            ${waitlistedIds[action]}, ${eventId}, ${ownerId}, 'waitlisted', 1,
            'public', statement_timestamp(), true, 'Wave 2 waitlisted'
          )
        `;
      }
    }
  });
}

async function actionCall(tx, action, registrationId, key) {
  if (action === "confirm") {
    return tx`select public.organizer_confirm_registration(${registrationId}, ${key})`;
  }
  if (action === "decline") {
    return tx`select public.organizer_decline_registration(${registrationId}, ${key})`;
  }
  return tx`select public.organizer_remove_registration(${registrationId}, ${key}, ${"wave2 verifier"})`;
}

async function readState(tx, action) {
  const [registration] = await tx`
    select status::text as status, transition_version
    from public.registrations where id = ${registrationIds[action]}
  `;
  const [seat] = await tx`
    select coalesce(sum(seats) filter (where status in ('offered', 'pending_organizer_confirmation', 'confirmed')), 0)::integer as occupied,
           count(*) filter (where status = 'offered')::integer as offered
    from public.registrations where event_id = ${actionIds[action]}
  `;
  const [audit] = await tx`
    select count(*)::integer as count,
           count(*) filter (where actor_user_id = ${ownerId})::integer as owner_count
    from public.audit_logs
    where registration_id = ${registrationIds[action]}
  `;
  const [idem] = await tx`
    select count(*)::integer as count,
           count(*) filter (where completed_at is not null and response_status = 200)::integer as completed
    from public.idempotency_requests
    where event_id = ${actionIds[action]}
  `;
  return {
    status: registration?.status ?? "missing",
    occupied: seat?.occupied ?? -1,
    offered: seat?.offered ?? -1,
    auditCount: audit?.count ?? -1,
    auditOwnerCount: audit?.owner_count ?? -1,
    idempotencyCount: idem?.count ?? -1,
    idempotencyCompleted: idem?.completed ?? -1,
  };
}

async function runCase(action, actor, expected) {
  const registrationId = registrationIds[action];
  const key = idempotencyKeys[action];
  const initial = await sql.begin(async (tx) => readState(tx, action));
  const observed = await sql.begin(async (tx) => {
    let state;
    let replayObserved = false;
    let replayError = null;
    if (actor === "anonymous") {
      const observedState = await expectFailure("anon", undefined, (roleTx) => actionCall(roleTx, action, registrationId, key));
      state = { sqlState: observedState ?? "SUCCESS" };
    } else if (actor === "member") {
      const observedState = await expectFailure("authenticated", memberId, (roleTx) => actionCall(roleTx, action, registrationId, key));
      state = { sqlState: observedState ?? "SUCCESS" };
    } else if (actor === "organizer") {
      await withRole(tx, "authenticated", ownerId, () => actionCall(tx, action, registrationId, key));
      state = { sqlState: "SUCCESS" };
      try {
        await withRole(tx, "authenticated", ownerId, () => actionCall(tx, action, registrationId, key));
        replayObserved = true;
      } catch (error) {
        replayError = sqlState(error);
      }
    } else if (actor === "replay") {
      try {
        await withRole(tx, "authenticated", ownerId, () => actionCall(tx, action, registrationId, key));
        replayObserved = true;
        state = { sqlState: "SUCCESS" };
      } catch (error) {
        state = { sqlState: sqlState(error) };
      }
    }
    state.after = await readState(tx, action);
    state.replayObserved = replayObserved;
    state.replayError = replayError;
    return state;
  });

  const shouldSucceed = actor === "organizer" || actor === "replay";
  assert(
    shouldSucceed ? observed.sqlState === "SUCCESS" : observed.sqlState === expected.sqlState,
    `${action}/${actor}: unexpected SQLSTATE ${observed.sqlState}`,
  );
  assert(observed.after.status === expected.status, `${action}/${actor}: unexpected target status`);
  assert(observed.after.occupied === 1, `${action}/${actor}: unexpected occupied seat count`);
  assert(observed.after.auditCount === expected.auditCount, `${action}/${actor}: unexpected audit count`);
  assert(observed.after.idempotencyCount === expected.idempotencyCount, `${action}/${actor}: unexpected idempotency count`);
  if (shouldSucceed) {
    if (actor === "organizer") {
      assert(observed.replayObserved === true && observed.replayError === null, `${action}/${actor}: replay did not return success`);
    } else {
      assert(observed.replayObserved === true, `${action}/${actor}: replay did not return success`);
    }
    assert(observed.after.idempotencyCompleted === 1, `${action}/${actor}: completed idempotency row missing`);
    assert(observed.after.auditOwnerCount === 1, `${action}/${actor}: audit actor mismatch`);
  }

  report.push({
    case: `${action}/${actor}`,
    expected: shouldSucceed ? "success" : expected.sqlState,
    actual: observed.sqlState,
    targetStatus: observed.after.status,
    auditActor: observed.after.auditOwnerCount === 1 ? "owner" : "none",
    seat: `occupied=${observed.after.occupied};offered=${observed.after.offered}`,
    replay: actor === "replay" ? "same-key-success-no-extra-transition" : actor === "organizer" ? "same-key-success" : "not-applicable",
    fixtureCleanup: "pending; final residue read-back required",
    initialStatus: initial.status,
  });
}

async function cleanupFixture() {
  await sql.begin(async (tx) => {
    const eventIds = Object.values(actionIds);
    await tx`delete from public.outbox_events where event_id = any(${eventIds})`;
    await tx`delete from public.audit_logs where event_id = any(${eventIds}) or organizer_id = ${organizerId}`;
    await tx`delete from public.idempotency_requests where event_id = any(${eventIds})`;
    await tx`delete from public.registrations where event_id = any(${eventIds})`;
    await tx`delete from public.events where id = any(${eventIds})`;
    await tx`delete from public.organizer_members where organizer_id = ${organizerId}`;
    await tx`delete from public.organizers where id = ${organizerId}`;
    await tx`delete from public.users where id = ${memberId}`;
  });
}

async function residue() {
  const [row] = await sql`
    select
      (select count(*)::integer from public.organizers where id = ${organizerId}) as organizers,
      (select count(*)::integer from public.events where id = any(${Object.values(actionIds)})) as events,
      (select count(*)::integer from public.registrations where event_id = any(${Object.values(actionIds)})) as registrations,
      (select count(*)::integer from public.idempotency_requests where event_id = any(${Object.values(actionIds)})) as idempotency,
      (select count(*)::integer from public.audit_logs where organizer_id = ${organizerId} or event_id = any(${Object.values(actionIds)})) as audit,
      (select count(*)::integer from public.outbox_events where event_id = any(${Object.values(actionIds)})) as outbox,
      (select count(*)::integer from public.users where id = ${memberId}) as public_member,
      (select count(*)::integer from auth.users where id = ${memberId}) as auth_member
  `;
  return row;
}

async function main() {
  await assertFreshPrefix();
  await resolveExistingOwner();
  await createTemporaryIdentity();
  await assertWave2Functions();
  await createFixture();

  await runCase("confirm", "anonymous", { sqlState: "42501", status: "pending_organizer_confirmation", auditCount: 0, idempotencyCount: 0 });
  await runCase("confirm", "member", { sqlState: "42501", status: "pending_organizer_confirmation", auditCount: 0, idempotencyCount: 0 });
  await runCase("confirm", "organizer", { status: "confirmed", auditCount: 1, idempotencyCount: 1 });
  await runCase("confirm", "replay", { status: "confirmed", auditCount: 1, idempotencyCount: 1 });

  await runCase("decline", "anonymous", { sqlState: "42501", status: "pending_organizer_confirmation", auditCount: 0, idempotencyCount: 0 });
  await runCase("decline", "member", { sqlState: "42501", status: "pending_organizer_confirmation", auditCount: 0, idempotencyCount: 0 });
  await runCase("decline", "organizer", { status: "declined", auditCount: 1, idempotencyCount: 1 });
  await runCase("decline", "replay", { status: "declined", auditCount: 1, idempotencyCount: 1 });

  await runCase("remove", "anonymous", { sqlState: "42501", status: "confirmed", auditCount: 0, idempotencyCount: 0 });
  await runCase("remove", "member", { sqlState: "42501", status: "confirmed", auditCount: 0, idempotencyCount: 0 });
  await runCase("remove", "organizer", { status: "removed_by_organizer", auditCount: 1, idempotencyCount: 1 });
  await runCase("remove", "replay", { status: "removed_by_organizer", auditCount: 1, idempotencyCount: 1 });

  assert(report.length === 12, `expected 12 cases, observed ${report.length}`);
}

let failure;
try {
  await main();
} catch (error) {
  failure = error;
} finally {
  try {
    await cleanupFixture();
  } catch (error) {
    failure ??= error;
  }
  try {
    await deleteTemporaryIdentity();
  } catch (error) {
    failure ??= error;
  }
  let residueRow;
  try {
    residueRow = await residue();
  } catch (error) {
    failure ??= error;
  }
  for (const entry of report) entry.fixtureCleanup = residueRow && Object.values(residueRow).every((value) => value === 0) ? "residue=0" : "not-zero";
  console.log(JSON.stringify({
    verifier: "wave2-organizer-registration",
    target: "127.0.0.1:58332",
    cases: report,
    caseCount: report.length,
    residue: residueRow ?? null,
    result: failure ? "FAIL" : "PASS",
    error: failure ? (failure instanceof Error ? failure.message : "unknown") : null,
  }));
  await sql.end({ timeout: 5 });
}

if (failure) throw failure;
