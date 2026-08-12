import postgres from "postgres";

const databaseUrl = process.env.GATHER_JOIN_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("GATHER_JOIN_TEST_DATABASE_URL is required.");

const sql = postgres(databaseUrl, { max: 1 });
const ownerId = "00000000-0000-0000-0000-000000000401";
const organizerId = "00000000-0000-0000-0000-000000000402";
const eventId = "00000000-0000-0000-0000-000000000403";
const slug = "guest-invite-contract-test";

async function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const [feeColumn] = await sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'fee_mode'
  `;
  const [targetTable] = await sql`
    select relrowsecurity as rls_enabled
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public' and pg_class.relname = 'event_invitation_targets'
  `;
  const routines = await sql`
    select routine_name
    from information_schema.routines
    where routine_schema = 'public'
      and routine_name in (
        'get_event_invitation_by_slug',
        'respond_to_event_invitation',
        'organizer_add_event_invitation_target',
        'organizer_remove_event_invitation_target'
      )
  `;
  assert(feeColumn?.column_name === "fee_mode", "fee_mode column is missing");
  assert(targetTable?.rls_enabled === true, "invitation target RLS is not enabled");
  assert(new Set(routines.map((row) => row.routine_name)).size === 4, "invitation RPCs are incomplete");
  assert(
    await sql`select has_function_privilege('anon', 'public.get_event_invitation_by_slug(text, text)', 'EXECUTE') as allowed`.then((rows) => rows[0].allowed),
    "anon cannot execute the invitation read RPC",
  );
  assert(
    !(await sql`select has_table_privilege('anon', 'public.event_invitation_targets', 'SELECT') as allowed`.then((rows) => rows[0].allowed)),
    "anon has direct invitation-target table access",
  );

  await sql`
    insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
    values (${ownerId}, gen_random_uuid(), 'authenticated', 'authenticated', 'guest-invite-contract@example.test', now(), now(), now())
  `;
  await sql`
    insert into public.users (id, email, email_verified_at, display_name)
    values (${ownerId}, 'guest-invite-contract@example.test', now(), '邀請測試主辦人')
  `;
  await sql.begin(async (tx) => {
    await tx`
      insert into public.organizers (id, slug, display_name, created_by_user_id)
      values (${organizerId}, 'guest-invite-contract', '邀請測試主辦人', ${ownerId})
    `;
    await tx`
      insert into public.organizer_members (organizer_id, user_id, role)
      values (${organizerId}, ${ownerId}, 'owner')
    `;
  });
  await sql`
    insert into public.events (
      id, organizer_id, created_by_user_id, slug, title, summary, status,
      visibility, confirmation_mode, timezone, starts_at, ends_at, capacity,
      fee_amount, fee_mode, payment_instructions, roster_show_capacity, invite_only
    ) values (
      ${eventId}, ${organizerId}, ${ownerId}, ${slug}, '邀請契約測試', '測試用', 'published',
      'private', 'instant', 'Asia/Taipei', now() + interval '1 day', now() + interval '1 day 3 hours', 8,
      0, 'on_site_split', '現場結算後分攤', true, true
    )
  `;
  for (const displayName of ["學長", "大師兄", "陳大哥", "愛德華", "木木三", "日月MING"]) {
    await sql`
      insert into public.registrations (
        event_id, user_id, status, seats, seat_pool, manual_display_name, added_by_user_id,
        display_name_snapshot
      ) values (${eventId}, null, 'confirmed', 1, 'public', ${displayName}, ${ownerId}, ${displayName})
    `;
  }

  await sql.begin(async (tx) => {
    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claim.sub', ${ownerId}, true)`;
    await tx`select public.organizer_add_event_invitation_target(${eventId}, '哈蜜瓜')`;
  });

  const guestKey = "guest-key-contract-0001";
  const before = await sql`select public.get_event_invitation_by_slug(${slug}, ${guestKey}) as payload`;
  assert(before[0].payload.attending_count === 6, "initial aggregate count should include six manual seats");
  assert(before[0].payload.guest_response === null, "new guest should not have a response");
  assert(before[0].payload.invitees?.length === 7, "guest roster should combine manual participants and invitees");
  assert(before[0].payload.invitees?.some((invitee) => invitee.display_name === "日月MING" && invitee.response === "attending"), "guest roster should return confirmed participant names");
  assert(before[0].payload.invitees?.some((invitee) => invitee.display_name === "哈蜜瓜" && invitee.response === "pending"), "guest roster should return pending invitee name and status");

  const attending = await sql`select public.respond_to_event_invitation(${slug}, ${guestKey}, '哈蜜瓜', 'attending') as payload`;
  assert(attending[0].payload.attending_count === 7, "attending response should increase aggregate count to seven");

  const remembered = await sql`select public.get_event_invitation_by_slug(${slug}, ${guestKey}) as payload`;
  assert(remembered[0].payload.guest_response === "attending", "same guest key should remember attendance");
  assert(remembered[0].payload.guest_display_name === "哈蜜瓜", "guest display name should be returned");
  assert(remembered[0].payload.invitees?.some((invitee) => invitee.display_name === "哈蜜瓜" && invitee.response === "attending"), "guest roster should update response status");

  const declined = await sql`select public.respond_to_event_invitation(${slug}, ${guestKey}, '哈蜜瓜', 'declined') as payload`;
  assert(declined[0].payload.attending_count === 6, "declining should release the guest seat");

  const pending = await sql`select public.respond_to_event_invitation(${slug}, ${guestKey}, '哈蜜瓜', 'pending') as payload`;
  assert(pending[0].payload.attending_count === 6, "pending response should release the guest seat");

  const manualDeclined = await sql`select public.respond_to_event_invitation(${slug}, 'guest-key-contract-0005', '日月MING', 'declined') as payload`;
  assert(manualDeclined[0].payload.attending_count === 5, "an invitation target should replace a duplicate manual registration in the aggregate count");
  const manualRoster = await sql`select public.get_event_invitation_by_slug(${slug}, 'guest-key-contract-0005') as payload`;
  assert(manualRoster[0].payload.invitees?.filter((invitee) => invitee.display_name === "日月MING").length === 1, "duplicate manual registration should collapse into one roster entry");
  assert(manualRoster[0].payload.invitees?.some((invitee) => invitee.display_name === "日月MING" && invitee.response === "declined"), "manual registration status should be overridden by the invitation target");
  const manualAttending = await sql`select public.respond_to_event_invitation(${slug}, 'guest-key-contract-0005', '日月MING', 'attending') as payload`;
  assert(manualAttending[0].payload.attending_count === 6, "switching the manual participant back to attending should restore one seat");

  await sql`select public.respond_to_event_invitation(${slug}, 'guest-key-contract-0002', '朋友A', 'attending')`;
  await sql`select public.respond_to_event_invitation(${slug}, 'guest-key-contract-0003', '朋友B', 'attending')`;
  let fullRejected = false;
  try {
    await sql`select public.respond_to_event_invitation(${slug}, 'guest-key-contract-0004', '朋友C', 'attending')`;
  } catch (error) {
    fullRejected = error.code === "53300";
  }
  assert(fullRejected, "capacity must reject the ninth attendee");

  const [target] = await sql`
    select response, display_name
    from public.event_invitation_targets
    where event_id = ${eventId} and display_name = '哈蜜瓜' and revoked_at is null
  `;
  assert(target?.response === "declined", "target status should be editable");

  process.stdout.write("Guest invitation migration, RLS, aggregate counts, editable response, and capacity guard verified.\n");
} finally {
  await sql`delete from public.audit_logs where event_id = ${eventId}`;
  await sql`delete from public.registrations where event_id = ${eventId}`;
  await sql`delete from public.event_invitation_targets where event_id = ${eventId}`;
  await sql`delete from public.events where id = ${eventId}`;
  await sql.begin(async (tx) => {
    await tx`delete from public.organizer_members where organizer_id = ${organizerId}`;
    await tx`delete from public.organizers where id = ${organizerId}`;
  });
  await sql`delete from public.users where id = ${ownerId}`;
  await sql`delete from auth.users where id = ${ownerId}`;
  await sql.end({ timeout: 1 });
}
