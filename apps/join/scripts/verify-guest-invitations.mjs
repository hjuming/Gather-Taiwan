import postgres from "postgres";

const databaseUrl = process.env.GATHER_JOIN_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("GATHER_JOIN_TEST_DATABASE_URL is required.");

const parsedUrl = new URL(databaseUrl);
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
if (!localHosts.has(parsedUrl.hostname)) {
  throw new Error("Refusing a non-local guest invitation verifier database");
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ownerId = process.env.GATHER_JOIN_TEST_OWNER_USER_ID;
const memberId = process.env.GATHER_JOIN_TEST_MEMBER_USER_ID;
for (const [name, value] of [
  ["GATHER_JOIN_TEST_OWNER_USER_ID", ownerId],
  ["GATHER_JOIN_TEST_MEMBER_USER_ID", memberId],
]) {
  if (!uuidPattern.test(value ?? "")) {
    throw new Error(`${name} must identify an existing local dedicated fixture identity`);
  }
}
if (ownerId === memberId) {
  throw new Error("GATHER_JOIN_TEST_OWNER_USER_ID and GATHER_JOIN_TEST_MEMBER_USER_ID must be distinct");
}

const sql = postgres(databaseUrl, { max: 1 });
let activeSql = sql;
const fixtureRollback = new Error("GUEST_INVITATION_FIXTURE_ROLLBACK");
const organizerId = "00000000-0000-0000-0000-000000000402";
const eventId = "00000000-0000-0000-0000-000000000403";
const otherEventId = "00000000-0000-0000-0000-000000000404";
const slug = "guest-invite-contract-test";
const otherSlug = "guest-invite-other-contract";

async function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function withinActiveTransaction(action) {
  if (typeof activeSql.begin === "function") return activeSql.begin(action);
  return activeSql.savepoint(action);
}

async function asRole(role, action) {
  return withinActiveTransaction(async (tx) => {
    await tx.unsafe(`set local role ${role}`);
    try {
      return await action(tx);
    } finally {
      await tx`reset role`;
    }
  });
}

async function asOrganizer(action) {
  return withinActiveTransaction(async (tx) => {
    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claim.sub', ${ownerId}, true)`;
    try {
      return await action(tx);
    } finally {
      await tx`reset role`;
    }
  });
}

async function expectSqlState(action, expectedCode, message) {
  try {
    await action();
  } catch (error) {
    await assert(error?.code === expectedCode, `${message}: expected ${expectedCode}, received ${error?.code ?? "no SQLSTATE"}`);
    return;
  }
  throw new Error(message);
}

async function createPrivateInviteEvent(id, eventSlug, title) {
  await activeSql`
    insert into public.events (
      id, organizer_id, created_by_user_id, slug, title, summary, status,
      visibility, confirmation_mode, timezone, starts_at, ends_at, capacity,
      fee_amount, fee_mode, payment_instructions, roster_show_capacity, invite_only
    ) values (
      ${id}, ${organizerId}, ${ownerId}, ${eventSlug}, ${title}, '測試用', 'published',
      'private', 'instant', 'Asia/Taipei', now() + interval '1 day', now() + interval '1 day 3 hours', 8,
      0, 'on_site_split', '現場結算後分攤', true, true
    )
  `;
}

async function assertRollbackZeroResidue() {
  const [residue] = await sql`
    select
      (select count(*)::integer from public.organizers
        where id = ${organizerId}) as organizers,
      (select count(*)::integer from public.organizer_members
        where organizer_id = ${organizerId}) as organizer_members,
      (select count(*)::integer from public.events
        where id = ${eventId} or id = ${otherEventId}) as events,
      (select count(*)::integer from public.registrations
        where event_id = ${eventId} or event_id = ${otherEventId}) as registrations,
      (select count(*)::integer from public.event_invitation_targets
        where event_id = ${eventId} or event_id = ${otherEventId}) as event_invitation_targets,
      (select count(*)::integer from public.audit_logs
        where organizer_id = ${organizerId}
          or event_id = ${eventId} or event_id = ${otherEventId}) as audit_logs,
      (select count(*)::integer from public.outbox_events
        where event_id = ${eventId} or event_id = ${otherEventId}) as outbox_events
  `;
  for (const [table, count] of Object.entries(residue)) {
    await assert(count === 0, `rollback left ${count} fixture row(s) in ${table}`);
  }
}

try {
  const [fixtureIdentities] = await sql`
    select count(distinct auth_user.id)::integer as identity_count
    from auth.users auth_user
    join public.users app_user on app_user.id = auth_user.id
    where auth_user.id in (${ownerId}, ${memberId})
  `;
  if (fixtureIdentities?.identity_count !== 2) {
    throw new Error(
      "Both configured IDs must reference existing isolated local fixture identities in auth.users and public.users",
    );
  }

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
        'organizer_remove_event_invitation_target',
        'organizer_issue_event_invitation_token'
      )
  `;
  const responseSignatures = await sql`
    select pg_get_function_identity_arguments(proc.oid) as arguments
    from pg_proc proc
    join pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public' and proc.proname = 'respond_to_event_invitation'
  `;
  await assert(feeColumn?.column_name === "fee_mode", "fee_mode column is missing");
  await assert(targetTable?.rls_enabled === true, "invitation target RLS is not enabled");
  await assert(new Set(routines.map((row) => row.routine_name)).size === 5, "invitation RPCs are incomplete");
  await assert(responseSignatures.length === 1 && responseSignatures[0].arguments === "p_slug text, p_invitee_token text, p_response text", "only the token-only response RPC may remain");
  await assert(
    await sql`select has_function_privilege('anon', 'public.get_event_invitation_by_slug(text, text)', 'EXECUTE') as allowed`.then((rows) => rows[0].allowed),
    "anon cannot execute the invitation read RPC",
  );
  await assert(
    await sql`select has_function_privilege('anon', 'public.respond_to_event_invitation(text, text, text)', 'EXECUTE') as allowed`.then((rows) => rows[0].allowed),
    "anon cannot execute the token-only response RPC",
  );
  await assert(
    !(await sql`select has_function_privilege('anon', 'public.organizer_add_event_invitation_target(uuid, text)', 'EXECUTE') as allowed`.then((rows) => rows[0].allowed)),
    "anon can execute organizer add",
  );
  await assert(
    !(await sql`select has_function_privilege('anon', 'public.organizer_remove_event_invitation_target(uuid)', 'EXECUTE') as allowed`.then((rows) => rows[0].allowed)),
    "anon can execute organizer remove",
  );
  await assert(
    !(await sql`select has_table_privilege('anon', 'public.event_invitation_targets', 'SELECT') as allowed`.then((rows) => rows[0].allowed)),
    "anon has direct invitation-target table access",
  );

  await sql.begin(async (fixtureSql) => {
    activeSql = fixtureSql;
    try {
    await fixtureSql`
      insert into public.organizers (id, slug, display_name, created_by_user_id)
      values (${organizerId}, 'guest-invite-contract', '邀請測試主辦人', ${ownerId})
    `;
    await fixtureSql`
      insert into public.organizer_members (organizer_id, user_id, role)
      values (${organizerId}, ${ownerId}, 'owner')
    `;
  await createPrivateInviteEvent(eventId, slug, "邀請契約測試");
  await createPrivateInviteEvent(otherEventId, otherSlug, "另一場邀請契約測試");
  for (const displayName of ["學長", "大師兄", "陳大哥", "愛德華", "木木三", "日月MING"]) {
    await fixtureSql`
      insert into public.registrations (
        event_id, user_id, status, seats, seat_pool, manual_display_name, added_by_user_id,
        display_name_snapshot
      ) values (${eventId}, null, 'confirmed', 1, 'public', ${displayName}, ${ownerId}, ${displayName})
    `;
  }

  const tokens = await asOrganizer(async (tx) => {
    const [{ target_id: primaryTargetId }] = await tx`select public.organizer_add_event_invitation_target(${eventId}, '哈蜜瓜') as target_id`;
    const [{ token: oldPrimaryToken }] = await tx`select public.organizer_issue_event_invitation_token(${primaryTargetId}) as token`;
    const [{ token: primaryToken }] = await tx`select public.organizer_issue_event_invitation_token(${primaryTargetId}) as token`;
    const [{ target_id: duplicateManualTargetId }] = await tx`select public.organizer_add_event_invitation_target(${eventId}, '日月MING') as target_id`;
    const [{ token: duplicateManualToken }] = await tx`select public.organizer_issue_event_invitation_token(${duplicateManualTargetId}) as token`;
    const [{ target_id: secondTargetId }] = await tx`select public.organizer_add_event_invitation_target(${eventId}, '朋友A') as target_id`;
    const [{ token: secondToken }] = await tx`select public.organizer_issue_event_invitation_token(${secondTargetId}) as token`;
    const [{ target_id: thirdTargetId }] = await tx`select public.organizer_add_event_invitation_target(${eventId}, '朋友B') as target_id`;
    const [{ token: thirdToken }] = await tx`select public.organizer_issue_event_invitation_token(${thirdTargetId}) as token`;
    const [{ target_id: otherTargetId }] = await tx`select public.organizer_add_event_invitation_target(${otherEventId}, '另一位朋友') as target_id`;
    const [{ token: otherEventToken }] = await tx`select public.organizer_issue_event_invitation_token(${otherTargetId}) as token`;
    return { primaryTargetId, oldPrimaryToken, primaryToken, duplicateManualTargetId, duplicateManualToken, secondToken, thirdToken, otherEventToken };
  });

  await expectSqlState(
    () => asRole("anon", (tx) => tx`select public.organizer_add_event_invitation_target(${eventId}, '匿名新增')`),
    "42501",
    "anonymous organizer add must be rejected",
  );
  await expectSqlState(
    () => asRole("anon", (tx) => tx`select public.organizer_issue_event_invitation_token(${tokens.primaryTargetId})`),
    "42501",
    "anonymous organizer token issue must be rejected",
  );
  await expectSqlState(
    () => asRole("anon", (tx) => tx`select public.organizer_remove_event_invitation_target(${tokens.primaryTargetId})`),
    "42501",
    "anonymous organizer remove must be rejected",
  );

  const [before] = await asRole("anon", (tx) => tx`select public.get_event_invitation_by_slug(${slug}, ${null}) as payload`);
  await assert(
    before.payload.attending_count === 6,
    "a pending invitation target must not subtract a matching confirmed manual registration before the invitee attends",
  );
  await assert(before.payload.invitees?.filter((invitee) => invitee.display_name === "哈蜜瓜").length === 1, "bare roster must not duplicate an invitee");
  await assert(before.payload.invitees?.filter((invitee) => invitee.display_name === "日月MING").length === 1, "matching manual registration and invitation target must render once");

  await expectSqlState(
    () => asRole("anon", (tx) => tx`select public.respond_to_event_invitation(${slug}, ${tokens.oldPrimaryToken}, 'attending')`),
    "42501",
    "old token must be rejected after reissue",
  );
  await expectSqlState(
    () => asRole("anon", (tx) => tx`select public.respond_to_event_invitation(${slug}, ${tokens.otherEventToken}, 'attending')`),
    "42501",
    "another event token must be rejected",
  );
  await expectSqlState(
    () => asRole("anon", (tx) => tx`select public.respond_to_event_invitation(${slug}, 'unknown-token-contract-0001', 'attending')`),
    "42501",
    "unknown token must be rejected",
  );

  const [duplicateManualAttending] = await asRole("anon", (tx) => tx`select public.respond_to_event_invitation(${slug}, ${tokens.duplicateManualToken}, 'attending') as payload`);
  await assert(duplicateManualAttending.payload.attending_count === 7, "same-name invitation response must conservatively count its own attending seat");
  const [duplicateReload] = await asRole("anon", (tx) => tx`select public.get_event_invitation_by_slug(${slug}, ${tokens.duplicateManualToken}) as payload`);
  await assert(
    duplicateReload.payload.attending_count === duplicateManualAttending.payload.attending_count
      && duplicateReload.payload.attending_count === 7,
    "same-name RSVP response and reload reader must agree at canonical seven",
  );
  await asOrganizer((tx) => tx`select public.organizer_edit_event_invitation_target(${tokens.duplicateManualTargetId}, '日月MING（邀請）')`);
  const [renamedReload] = await asRole("anon", (tx) => tx`select public.get_event_invitation_by_slug(${slug}, ${tokens.duplicateManualToken}) as payload`);
  await assert(
    renamedReload.payload.attending_count === duplicateReload.payload.attending_count
      && renamedReload.payload.guest_display_name === "日月MING（邀請）",
    "invitation rename must not change canonical capacity",
  );
  const [attending] = await asRole("anon", (tx) => tx`select public.respond_to_event_invitation(${slug}, ${tokens.primaryToken}, 'attending') as payload`);
  await assert(attending.payload.attending_count === 8, "new token should update only its own invitee");
  const [remembered] = await asRole("anon", (tx) => tx`select public.get_event_invitation_by_slug(${slug}, ${tokens.primaryToken}) as payload`);
  await assert(remembered.payload.guest_response === "attending" && remembered.payload.guest_display_name === "哈蜜瓜", "token should read back its own response");
  await assert(remembered.payload.attending_count === attending.payload.attending_count, "RSVP response and reload reader must agree");
  await expectSqlState(
    () => asRole("anon", (tx) => tx`select public.respond_to_event_invitation(${slug}, ${tokens.secondToken}, 'attending')`),
    "53300",
    "capacity must reject the ninth attendee",
  );

  const [after] = await asRole("anon", (tx) => tx`select public.get_event_invitation_by_slug(${slug}, ${null}) as payload`);
  await assert(after.payload.attending_count === 8, "aggregate count must match canonical capacity at eight");
  await assert(
    after.payload.invitees?.filter((invitee) => invitee.display_name === "日月MING").length === 1
      && after.payload.invitees?.filter((invitee) => invitee.display_name === "日月MING（邀請）").length === 1,
    "roster projection must keep the renamed invitation and manual rows distinct",
  );

  const [target] = await fixtureSql`
    select response, display_name
    from public.event_invitation_targets
    where id = ${tokens.primaryTargetId} and revoked_at is null
  `;
  await assert(target?.response === "attending" && target?.display_name === "哈蜜瓜", "token response must update the matching invitation target without duplicates");
  process.stdout.write("Guest invitation token, RLS, aggregate count, duplicate roster, and capacity contract verified.\n");
    } finally {
      activeSql = sql;
    }
    throw fixtureRollback;
  });
} catch (error) {
  if (error !== fixtureRollback) throw error;
  await assertRollbackZeroResidue();
  process.stdout.write("Guest invitation rollback zero-residue verifier: PASS\n");
} finally {
  await sql.end({ timeout: 1 });
}
