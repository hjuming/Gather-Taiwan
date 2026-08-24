// P1-06/P1-08 seat-engine concurrency verification: fires RACE_N (default 8)
// truly parallel connections at register_for_event for an event with
// RACE_CAPACITY (default 3) seats, and asserts no oversell. Retries on
// Postgres deadlock/serialization-failure (40P01/40001), matching the
// documented "call-site retries" contract. Creates and deletes its own
// throwaway organizer/event/users; usage: pnpm verify:p1-06-08:concurrency
// (or RACE_N=41 RACE_CAPACITY=40 node scripts/verify-p1-06-08-concurrency.mjs
// for the literal Master Backlog "41 搶 40" scenario).
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const envText = readFileSync(".env.supabase.local", "utf8");
const env = Object.fromEntries(
  envText.split("\n").filter(Boolean).map((line) => {
    const idx = line.indexOf("=");
    return [line.slice(0, idx), line.slice(idx + 1)];
  })
);

const dbUrl = `postgresql://postgres.${env.SUPABASE_PROJECT_REF}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require`;
const admin = postgres(dbUrl, { max: 10 });

const runSuffix = randomUUID().slice(0, 8);
const organizerSlug = `concurrency-race-org-${runSuffix}`;
const eventSlug = `concurrency-race-${runSuffix}`;
const ownerId = randomUUID();
const N = Number(process.env.RACE_N ?? 8);
const CAPACITY = Number(process.env.RACE_CAPACITY ?? 3);
const raceUserIds = Array.from({ length: N }, () => randomUUID());

async function cleanup() {
  const eventIds = await admin`select id from public.events where slug = ${eventSlug}`;
  const ids = eventIds.map((r) => r.id);
  if (ids.length > 0) {
    await admin`delete from public.outbox_events where event_id = any(${ids}::uuid[])`;
    await admin`delete from public.idempotency_requests where event_id = any(${ids}::uuid[])`;
    await admin`delete from public.notifications where event_id = any(${ids}::uuid[])`;
    await admin`delete from public.registration_answers where registration_id in (select id from public.registrations where event_id = any(${ids}::uuid[]))`;
    await admin`delete from public.registrations where event_id = any(${ids}::uuid[])`;
    await admin`delete from public.audit_logs where event_id = any(${ids}::uuid[])`;
    await admin`delete from public.events where id = any(${ids}::uuid[])`;
  }
  await admin`delete from public.audit_logs where organizer_id in (select id from public.organizers where slug = ${organizerSlug})`;
  await admin`delete from public.organizers where slug = ${organizerSlug}`;
  await admin`delete from public.users where id = ${ownerId}::uuid or id = any(${raceUserIds}::uuid[])`;
  await admin`delete from auth.users where id = ${ownerId}::uuid or id = any(${raceUserIds}::uuid[])`;
}

try {
  await cleanup();

  await admin`insert into auth.users (id) values (${ownerId}::uuid)`;
  await admin`insert into auth.users ${admin(raceUserIds.map((id) => ({ id })), "id")}`;
  await admin`insert into public.users (id, email, display_name) values (${ownerId}::uuid, 'owner@concurrency-test.invalid', 'Owner')`;
  await admin`insert into public.users ${admin(
    raceUserIds.map((id, i) => ({ id, email: `racer${i}@concurrency-test.invalid`, display_name: `Racer ${i}` })),
    "id", "email", "display_name"
  )}`;

  const [{ create_organizer: orgId }] = await admin.begin(async (tx) => {
    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claim.sub', ${ownerId}, true)`;
    return tx`select public.create_organizer(${organizerSlug}, 'Concurrency Race Org')`;
  });

  const [{ id: eventId }] = await admin.begin(async (tx) => {
    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claim.sub', ${ownerId}, true)`;
    return tx`
      insert into public.events (
        organizer_id, created_by_user_id, slug, title, status, visibility,
        confirmation_mode, timezone, starts_at, ends_at, capacity
      ) values (
        ${orgId}, ${ownerId}::uuid, ${eventSlug}, 'Concurrency Race Test',
        'published', 'public', 'instant', 'Asia/Taipei',
        now() + interval '5 days', now() + interval '5 days 2 hours', ${CAPACITY}
      ) returning id
    `;
  });

console.log(`event=${eventId} racing ${N} users for ${CAPACITY} seats...`);

  // P1-06 acceptance requires deadlock/serialization-failure retry at the
  // call site (Postgres SQLSTATE 40P01 / 40001 under FOR UPDATE contention
  // is expected, not a bug); each racer retries its own attempt with the
  // same idempotency key until it gets a definitive outcome.
  async function registerWithRetry(userId, key, attemptsLeft = 5) {
    try {
      return await admin.begin(async (tx) => {
        await tx`set local role authenticated`;
        await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
        const [row] = await tx`select public.register_for_event(${eventId}::uuid, ${key}, '{}'::jsonb) as registration_id`;
        return row.registration_id;
      });
    } catch (err) {
      if ((err.code === "40P01" || err.code === "40001") && attemptsLeft > 1) {
        return registerWithRetry(userId, key, attemptsLeft - 1);
      }
      throw err;
    }
  }

  const results = await Promise.allSettled(
    raceUserIds.map((userId, i) => registerWithRetry(userId, "race-key-" + i))
  );

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");
  console.log(`fulfilled=${fulfilled.length} rejected=${rejected.length}`);
  rejected.forEach((r) => console.log("  rejected:", r.reason.message ?? r.reason));

  const rows = await admin`
    select status, count(*) as n from public.registrations
    where event_id = ${eventId}::uuid group by status order by status
  `;
  console.log("status breakdown:", rows.map((r) => `${r.status}=${r.n}`).join(", "));

  const confirmedCount = rows.find((r) => r.status === "confirmed")?.n ?? 0;
  const waitlistedCount = rows.find((r) => r.status === "waitlisted")?.n ?? 0;

  if (Number(confirmedCount) !== CAPACITY) {
    throw new Error(`FAIL: expected exactly ${CAPACITY} confirmed, got ${confirmedCount}`);
  }
  if (Number(confirmedCount) + Number(waitlistedCount) !== N) {
    throw new Error(`FAIL: confirmed+waitlisted (${confirmedCount}+${waitlistedCount}) != ${N}`);
  }
  console.log(`PASS: no oversell -- exactly ${CAPACITY} confirmed, ${waitlistedCount} waitlisted, out of ${N} concurrent racers`);
} finally {
  await cleanup();
  await admin.end();
}
