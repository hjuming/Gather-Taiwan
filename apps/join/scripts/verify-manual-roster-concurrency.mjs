/**
 * Local-only concurrent verifier for manual roster add capacity.
 *
 * This uses committed throwaway fixtures so parallel connections can see the
 * same event. It refuses non-local database URLs and cleans up its own rows.
 */
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const CONCURRENCY_PHASES = new Set([
  "bootstrap",
  "preflight",
  "fixture_setup",
  "manual_race",
  "cross_source_race",
  "readback",
  "cleanup",
]);
const POOL_MAX = 10;
const INTERNAL_PHASE = Symbol("concurrency.phase");
const INTERNAL_TELEMETRY = Symbol("concurrency.telemetry");

function safeNonnegativeInteger(value) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

function readPostgresCode(reason) {
  const seen = new Set();
  let current = reason;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    if (seen.has(current)) break;
    seen.add(current);
    if (typeof current.code === "string" && /^[0-9A-Z]{5}$/i.test(current.code)) {
      return current.code.toUpperCase();
    }
    current = current.cause;
  }
  return null;
}

class ConcurrencyPhaseFailure extends Error {
  constructor(phase, cause) {
    super("CONCURRENCY_PHASE_FAILURE", { cause });
    this.code = readPostgresCode(cause);
    Object.defineProperty(this, INTERNAL_PHASE, {
      value: CONCURRENCY_PHASES.has(phase) ? phase : "bootstrap",
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }
}

export async function runConcurrencyPhase(phase, operation) {
  try {
    return await operation();
  } catch (cause) {
    if (cause instanceof ConcurrencyPhaseFailure) throw cause;
    throw new ConcurrencyPhaseFailure(phase, cause);
  }
}

function createSettledFailure(cause) {
  const failure = new Error("CONCURRENCY_SETTLED_REJECTION", { cause });
  failure.code = readPostgresCode(cause);
  return failure;
}

class ConcurrencyRuntimeFailure extends Error {
  constructor(cause, telemetry) {
    super("CONCURRENCY_RUNTIME_FAILURE", { cause });
    this.code = readPostgresCode(cause);
    Object.defineProperty(this, INTERNAL_TELEMETRY, {
      value: Object.freeze({
        pool: Object.freeze({ ...telemetry.pool }),
        settled: Object.freeze({ ...telemetry.settled }),
        server: Object.freeze({ ...telemetry.server }),
      }),
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }
}

export function buildSafeConcurrencyDiagnostic({ phase, reason, pool, settled, server }) {
  const pgCode = readPostgresCode(reason);
  return {
    phase: CONCURRENCY_PHASES.has(phase) ? phase : "bootstrap",
    pg_code: pgCode,
    pg_class: pgCode?.slice(0, 2) ?? null,
    pool: {
      configured: safeNonnegativeInteger(pool?.configured),
      observed: pool?.observed === null ? null : safeNonnegativeInteger(pool?.observed),
      inflight: safeNonnegativeInteger(pool?.inflight),
    },
    settled: {
      manual_f: safeNonnegativeInteger(settled?.manual_f),
      manual_r: safeNonnegativeInteger(settled?.manual_r),
      cross_f: safeNonnegativeInteger(settled?.cross_f),
      cross_r: safeNonnegativeInteger(settled?.cross_r),
    },
    server: {
      max: safeNonnegativeInteger(server?.max),
      active: safeNonnegativeInteger(server?.active),
    },
  };
}

function readInternalToken(reason, token) {
  const seen = new Set();
  let current = reason;
  for (let depth = 0; depth < 6 && current && typeof current === "object"; depth += 1) {
    if (seen.has(current)) break;
    seen.add(current);
    if (current[token] !== undefined) return current[token];
    current = current.cause;
  }
  return undefined;
}

export function buildSafeTopLevelDiagnostic(reason) {
  const telemetry = readInternalToken(reason, INTERNAL_TELEMETRY);
  return buildSafeConcurrencyDiagnostic({
    phase: readInternalToken(reason, INTERNAL_PHASE) ?? "bootstrap",
    reason,
    pool: telemetry?.pool ?? { configured: null, observed: null, inflight: null },
    settled: telemetry?.settled
      ?? { manual_f: null, manual_r: null, cross_f: null, cross_r: null },
    server: telemetry?.server ?? { max: null, active: null },
  });
}

async function runVerifier() {

const databaseUrl = process.env.GATHER_JOIN_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("GATHER_JOIN_TEST_DATABASE_URL is required");

const parsedUrl = new URL(databaseUrl);
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
if (!localHosts.has(parsedUrl.hostname)) {
  throw new Error("Refusing a non-local manual roster concurrency verifier database");
}

const ownerId = process.env.GATHER_JOIN_TEST_OWNER_USER_ID;
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId ?? "")) {
  throw new Error(
    "GATHER_JOIN_TEST_OWNER_USER_ID must identify an existing local dedicated fixture identity",
  );
}

const MAX_CAPACITY = 50;
const MAX_RACERS = 100;

function parseStrictPositiveInteger(name, rawValue, fallback) {
  const value = rawValue ?? String(fallback);
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${name} must be a positive base-10 integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a safe integer`);
  }
  return parsed;
}

const N = parseStrictPositiveInteger("MANUAL_RACE_N", process.env.MANUAL_RACE_N, 6);
const CAPACITY = parseStrictPositiveInteger(
  "MANUAL_RACE_CAPACITY",
  process.env.MANUAL_RACE_CAPACITY,
  1,
);
if (CAPACITY > MAX_CAPACITY) {
  throw new Error(`MANUAL_RACE_CAPACITY must be at most ${MAX_CAPACITY}`);
}
if (N <= CAPACITY) {
  throw new Error("MANUAL_RACE_N must be greater than MANUAL_RACE_CAPACITY");
}
if (N > MAX_RACERS) {
  throw new Error(`MANUAL_RACE_N must be at most ${MAX_RACERS}`);
}

const sql = postgres(databaseUrl, { max: POOL_MAX });
const suffix = randomUUID().slice(0, 8);
const organizerId = randomUUID();
const eventId = randomUUID();
const crossSourceEventId = randomUUID();
const organizerSlug = `manual-race-org-${suffix}`;
const eventSlug = `manual-race-${suffix}`;
const crossSourceEventSlug = `manual-invite-race-${suffix}`;
let canCleanup = false;
const settledCounts = {
  manual_f: null,
  manual_r: null,
  cross_f: null,
  cross_r: null,
};
const poolState = {
  configured: POOL_MAX,
  observed: null,
  inflight: 0,
};

async function withInflight(operation) {
  poolState.inflight += 1;
  try {
    return await operation();
  } finally {
    poolState.inflight -= 1;
  }
}

function recordSettled(kind, results) {
  const fulfilled = results.filter((result) => result.status === "fulfilled").length;
  const rejected = results.length - fulfilled;
  if (kind === "manual") {
    settledCounts.manual_f = fulfilled;
    settledCounts.manual_r = rejected;
    return;
  }
  settledCounts.cross_f = fulfilled;
  settledCounts.cross_r = rejected;
}

async function readServerAggregate() {
  try {
    const [maxConnections] = await sql`show max_connections`;
    const [activity] = await sql`
      select count(*)::integer as active
      from pg_stat_activity
    `;
    return {
      max: maxConnections?.max_connections,
      active: activity?.active,
    };
  } catch {
    return { max: null, active: null };
  }
}

async function createRuntimeFailure(reason) {
  const telemetry = {
    pool: poolState,
    settled: settledCounts,
    server: await readServerAggregate(),
  };
  return new ConcurrencyRuntimeFailure(reason, telemetry);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function cleanup() {
  if (!canCleanup) return;
  await sql`delete from public.outbox_events where event_id = ${eventId} or event_id = ${crossSourceEventId}`;
  await sql`delete from public.audit_logs where event_id = ${eventId} or event_id = ${crossSourceEventId}`;
  await sql`delete from public.event_invitation_targets where event_id = ${crossSourceEventId}`;
  await sql`delete from public.registrations where event_id = ${eventId} or event_id = ${crossSourceEventId}`;
  await sql`delete from public.events where id = ${eventId} or id = ${crossSourceEventId}`;
  await sql`delete from public.organizers where id = ${organizerId}`;
  await sql`delete from public.organizer_members where organizer_id = ${organizerId}`;
  await sql`delete from public.audit_logs where organizer_id = ${organizerId}`;
}

async function assertZeroResidue() {
  const [residue] = await sql`
    select
      (select count(*)::integer from public.outbox_events
        where event_id = ${eventId} or event_id = ${crossSourceEventId}) as outbox_events,
      (select count(*)::integer from public.audit_logs
        where event_id = ${eventId} or event_id = ${crossSourceEventId}
          or organizer_id = ${organizerId}) as audit_logs,
      (select count(*)::integer from public.event_invitation_targets
        where event_id = ${crossSourceEventId}) as event_invitation_targets,
      (select count(*)::integer from public.registrations
        where event_id = ${eventId} or event_id = ${crossSourceEventId}) as registrations,
      (select count(*)::integer from public.events
        where id = ${eventId} or id = ${crossSourceEventId}) as events,
      (select count(*)::integer from public.organizer_members where organizer_id = ${organizerId}) as organizer_members,
      (select count(*)::integer from public.organizers where id = ${organizerId}) as organizers
  `;
  for (const [table, count] of Object.entries(residue)) {
    assert(count === 0, `cleanup left ${count} fixture row(s) in ${table}`);
  }
}

async function asOwner(operation) {
  return sql.begin(async (tx) => {
    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ role: "authenticated", sub: ownerId })}, true)`;
    return operation(tx);
  });
}

async function asAnonymous(operation) {
  return sql.begin(async (tx) => {
    await tx`set local role anon`;
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ role: "anon" })}, true)`;
    return operation(tx);
  });
}

async function addConcurrent(index, targetEventId = eventId) {
  return withInflight(() => asOwner(async (tx) => {
    const [row] = await tx`
      select public.organizer_add_manual_participant(
        ${targetEventId}, ${`Manual Racer ${index}`}, null, 'confirmed'::public.registration_status
      ) as id
    `;
    return row.id;
  }));
}

async function respondConcurrent(inviteeToken) {
  return withInflight(() => asAnonymous((tx) => tx`
    select public.respond_to_event_invitation(
      ${crossSourceEventSlug}, ${inviteeToken}, 'attending'
    )
  `));
}

let runtimeFailure = null;
try {
  let crossSourceTargetId;
  let crossSourceToken;
  let manualResult;
  let inviteResult;
  let confirmed = 0;
  let waitlisted = 0;

  await runConcurrencyPhase("preflight", async () => {
  const [baseSchema] = await sql`
    select
      to_regtype('public.seat_pool') is not null as has_seat_pool,
      to_regclass('public.outbox_events') is not null as has_outbox_table
  `;
  if (baseSchema?.has_seat_pool !== true || baseSchema?.has_outbox_table !== true) {
    throw new Error("Local Join schema is missing manual roster dependencies; run this verifier only after local migrations are applied");
  }
  const [fixtureOwner] = await sql`
    select exists (
      select 1
      from public.users app_user
      join auth.users auth_user on auth_user.id = app_user.id
      where app_user.id = ${ownerId}
    ) as exists
  `;
  if (fixtureOwner?.exists !== true) {
    throw new Error("GATHER_JOIN_TEST_OWNER_USER_ID is not an existing local dedicated fixture identity");
  }
  canCleanup = true;

  const [appliedDefinitions] = await sql`
    select
      pg_get_functiondef(to_regprocedure('public.event_capacity_usage(uuid)'))
        as capacity_definition,
      pg_get_functiondef(to_regprocedure(
        'public.promote_next_waitlisted_locked_core(uuid,public.seat_pool,uuid)'
      )) as promotion_definition,
      pg_get_functiondef(to_regprocedure(
        'public.respond_to_event_invitation(text,text,text)'
      )) as response_definition
  `;
  assert(
    appliedDefinitions?.capacity_definition?.includes("'within_limits'")
      && appliedDefinitions?.promotion_definition?.includes("p_actor_user_id")
      && appliedDefinitions?.response_definition?.includes("usage_after"),
    "manual roster capacity migration is not applied to this local database",
  );
  });

  await runConcurrencyPhase("fixture_setup", async () => {
  await cleanup();
  await sql.begin(async (tx) => {
    await tx`
      insert into public.organizers (id, slug, display_name, created_by_user_id)
      values (${organizerId}, ${organizerSlug}, 'Manual Race Org', ${ownerId})
    `;
    await tx`
      insert into public.organizer_members (organizer_id, user_id, role)
      values (${organizerId}, ${ownerId}, 'owner')
    `;
    await tx`
      insert into public.events (
        id, organizer_id, created_by_user_id, slug, title, status, visibility,
        confirmation_mode, timezone, starts_at, ends_at, capacity
      ) values (
        ${eventId}, ${organizerId}, ${ownerId}, ${eventSlug}, 'Manual Race Event',
        'published', 'public', 'instant', 'Asia/Taipei',
        statement_timestamp() + interval '5 days',
        statement_timestamp() + interval '5 days 2 hours',
        ${CAPACITY}
      )
    `;
    await tx`
      insert into public.events (
        id, organizer_id, created_by_user_id, slug, title, status, visibility,
        confirmation_mode, timezone, starts_at, ends_at, capacity, invite_only
      ) values (
        ${crossSourceEventId}, ${organizerId}, ${ownerId}, ${crossSourceEventSlug},
        'Same-seat manual/invite concurrency', 'published', 'private', 'instant',
        'Asia/Taipei', statement_timestamp() + interval '5 days',
        statement_timestamp() + interval '5 days 2 hours', 1, true
      )
    `;
    await tx.unsafe(`set local role authenticated`);
    await tx`
      select set_config('request.jwt.claims', ${JSON.stringify({ role: "authenticated", sub: ownerId })}, true)
    `;
    [{ target_id: crossSourceTargetId }] = await tx`
      select public.organizer_add_event_invitation_target(
        ${crossSourceEventId}, 'Cross-source Invitee'
      ) as target_id
    `;
    [{ token: crossSourceToken }] = await tx`
      select public.organizer_issue_event_invitation_token(${crossSourceTargetId}) as token
    `;
  });
  });

  await runConcurrencyPhase("manual_race", async () => {
  settledCounts.manual_f = 0;
  settledCounts.manual_r = 0;
  const results = await Promise.allSettled(Array.from({ length: N }, (_, index) => addConcurrent(index)));
  recordSettled("manual", results);
  const rejected = results.filter((result) => result.status === "rejected");
  if (rejected.length > 0) {
    throw createSettledFailure(rejected[0].reason);
  }

  const rows = await sql`
    select status, count(*)::integer as count
    from public.registrations
    where event_id = ${eventId}
    group by status
  `;
  confirmed = rows.find((row) => row.status === "confirmed")?.count ?? 0;
  waitlisted = rows.find((row) => row.status === "waitlisted")?.count ?? 0;
  assert(confirmed === CAPACITY, `expected ${CAPACITY} confirmed, got ${confirmed}`);
  assert(confirmed + waitlisted === N, `expected ${N} total active rows, got ${confirmed + waitlisted}`);
  });

  await runConcurrencyPhase("cross_source_race", async () => {
  settledCounts.cross_f = 0;
  settledCounts.cross_r = 0;
  [manualResult, inviteResult] = await Promise.allSettled([
    addConcurrent("Cross-source", crossSourceEventId),
    respondConcurrent(crossSourceToken),
  ]);
  recordSettled("cross", [manualResult, inviteResult]);
  if (manualResult.status === "rejected") {
    throw createSettledFailure(manualResult.reason);
  }
  if (inviteResult.status === "rejected" && inviteResult.reason?.code !== "53300") {
    throw createSettledFailure(inviteResult.reason);
  }
  });

  await runConcurrencyPhase("readback", async () => {
  const [crossSourceState] = await sql`
    select
      public.event_capacity_usage(${crossSourceEventId}) as usage,
      (select response from public.event_invitation_targets
        where id = ${crossSourceTargetId}) as target_response,
      (select count(*)::integer from public.registrations
        where event_id = ${crossSourceEventId} and status = 'confirmed') as confirmed_registrations,
      (select count(*)::integer from public.registrations
        where event_id = ${crossSourceEventId}) as registration_count
  `;
  assert(
    crossSourceState.usage.total_occupied_seats === 1
      && crossSourceState.usage.within_limits.total === true,
    "cross-source race must keep total occupancy at one and within limits",
  );
  assert(
    crossSourceState.registration_count === 1
      && crossSourceState.confirmed_registrations
        + (crossSourceState.target_response === "attending" ? 1 : 0) === 1,
    "cross-source race must admit exactly one source",
  );
  assert(
    (inviteResult.status === "fulfilled" && crossSourceState.target_response === "attending")
      || (inviteResult.status === "rejected" && crossSourceState.target_response === "pending"),
    "token result and persisted invitation response must agree",
  );
  });
  console.log(`manual roster concurrency verifier: PASS confirmed=${confirmed} waitlisted=${waitlisted}`);
} catch (cause) {
  runtimeFailure = await createRuntimeFailure(cause);
} finally {
  try {
    await runConcurrencyPhase("cleanup", async () => {
      await cleanup();
      if (canCleanup) await assertZeroResidue();
    });
  } catch (cause) {
    if (!runtimeFailure) runtimeFailure = await createRuntimeFailure(cause);
  } finally {
    await sql.end({ timeout: 1 });
  }
}
if (runtimeFailure) throw runtimeFailure;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runVerifier();
  } catch (error) {
    const diagnostic = buildSafeTopLevelDiagnostic(error);
    process.stderr.write(`${JSON.stringify(diagnostic)}\n`);
    process.exitCode = 1;
  }
}
