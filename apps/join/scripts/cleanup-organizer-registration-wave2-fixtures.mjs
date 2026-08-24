/** Local-only, exact-prefix cleanup for the Wave 2 verifier's own fixtures. */
import postgres from "postgres";

const databaseUrl = process.env.GATHER_JOIN_TEST_DATABASE_URL;
const apiUrl = process.env.GATHER_JOIN_LOCAL_API_URL ?? "http://127.0.0.1:58331";
const serviceRoleKey = process.env.GATHER_JOIN_LOCAL_SERVICE_ROLE_KEY;
if (!databaseUrl || !serviceRoleKey) throw new Error("local database and Auth Admin credentials are required");
const database = new URL(databaseUrl);
const api = new URL(apiUrl);
if (!["127.0.0.1", "localhost", "::1"].includes(database.hostname) || database.port !== "58332") {
  throw new Error("refusing non-diagnostic database");
}
if (!["127.0.0.1", "localhost", "::1"].includes(api.hostname)) throw new Error("refusing non-local Auth Admin API");

const sql = postgres(databaseUrl, { max: 1 });
const prefix = "wave2-organizer-idem-";

async function adminDelete(id) {
  const response = await fetch(`${apiUrl}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  if (!response.ok) throw new Error(`local Auth Admin delete failed: ${response.status}`);
}

let authIds = [];
try {
  const organizers = await sql`select id from public.organizers where slug like ${`${prefix}%`}`;
  const organizerIds = organizers.map((row) => row.id);
  const events = await sql`
    select id, organizer_id from public.events where slug like ${`${prefix}%`}
  `;
  if (events.some((row) => !organizerIds.includes(row.organizer_id))) {
    throw new Error("event prefix does not belong exclusively to Wave 2 fixture organizers");
  }
  const eventIds = events.map((row) => row.id);
  const fixtureUsers = await sql`
    select u.id
    from public.users u
    join auth.users a on a.id = u.id
    where u.email like ${`${prefix}%`}
  `;
  authIds = fixtureUsers.map((row) => row.id);

  await sql.begin(async (tx) => {
    if (eventIds.length > 0) {
      await tx`delete from public.outbox_events where event_id = any(${eventIds})`;
      await tx`delete from public.audit_logs where event_id = any(${eventIds})`;
      await tx`delete from public.idempotency_requests where event_id = any(${eventIds})`;
      await tx`delete from public.registrations where event_id = any(${eventIds})`;
      await tx`delete from public.events where id = any(${eventIds})`;
    }
    if (organizerIds.length > 0) {
      await tx`delete from public.audit_logs where organizer_id = any(${organizerIds})`;
      await tx`delete from public.organizer_members where organizer_id = any(${organizerIds})`;
      await tx`delete from public.organizers where id = any(${organizerIds})`;
    }
    if (authIds.length > 0) {
      await tx`delete from public.users where id = any(${authIds})`;
    }
  });

  for (const id of authIds) await adminDelete(id);

  const [residue] = await sql`
    select
      (select count(*)::integer from public.organizers where slug like ${`${prefix}%`}) as organizers,
      (select count(*)::integer from public.events where slug like ${`${prefix}%`}) as events,
      (select count(*)::integer from public.users where email like ${`${prefix}%`}) as public_users,
      (select count(*)::integer from auth.users where email like ${`${prefix}%`}) as auth_users
  `;
  if (Object.values(residue).some((value) => value !== 0)) throw new Error(`cleanup residue is not zero: ${JSON.stringify(residue)}`);
  console.log(JSON.stringify({ target: "127.0.0.1:58332", prefix, deletedAuthFixtureCount: authIds.length, residue, result: "PASS" }));
} finally {
  await sql.end({ timeout: 5 });
}
