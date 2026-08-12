import postgres from "postgres";

const databaseUrl = process.env.GATHER_JOIN_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("GATHER_JOIN_TEST_DATABASE_URL is required");

const sql = postgres(databaseUrl, { max: 1 });
const actorId = "11111111-1111-1111-1111-111111111111";
const organizerId = "22222222-2222-2222-2222-222222222222";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectSqlState(transaction, expectedState, operation) {
  await transaction`savepoint expected_failure`;
  let observedState;
  try {
    await operation();
  } catch (error) {
    observedState = error.code;
  }
  await transaction`rollback to savepoint expected_failure`;
  await transaction`release savepoint expected_failure`;
  assert(observedState === expectedState, `expected SQLSTATE ${expectedState}, observed ${observedState ?? "success"}`);
}

async function setActor(transaction) {
  await transaction`select set_config('request.jwt.claim.sub', ${actorId}, true)`;
}

try {
  await sql.begin(async (transaction) => {
    await transaction`insert into auth.users (id, email, aud, role, email_confirmed_at)
      values (${actorId}, 'lifecycle-test@example.test', 'authenticated', 'authenticated', statement_timestamp())`;
    await transaction`insert into public.users (id, email, display_name)
      values (${actorId}, 'lifecycle-test@example.test', 'Lifecycle Test')`;
    await transaction`insert into public.organizers (id, slug, display_name, created_by_user_id)
      values (${organizerId}, 'lifecycle-test', 'Lifecycle Test Organizer', ${actorId})`;
    await transaction`insert into public.organizer_members (organizer_id, user_id, role)
      values (${organizerId}, ${actorId}, 'owner')`;
    await setActor(transaction);

    await expectSqlState(transaction, "22023", async () => {
      await transaction`insert into public.events (
        organizer_id, created_by_user_id, slug, title, timezone, starts_at, ends_at
      ) values (
        ${organizerId}, ${actorId}, 'past-event-test', 'Past Event', 'Asia/Taipei',
        statement_timestamp() - interval '1 minute', statement_timestamp() + interval '1 hour'
      )`;
    });

    const [source] = await transaction`insert into public.events (
      organizer_id, created_by_user_id, slug, title, summary, description, status,
      visibility, confirmation_mode, timezone, starts_at, ends_at, location_name,
      location_address, capacity, fee_amount, payment_instructions, invite_only,
      gathering_type
    ) values (
      ${organizerId}, ${actorId}, 'repeat-source-test', 'Repeat Source', 'A summary',
      'A description', 'published', 'private', 'organizer_confirmed', 'Asia/Taipei',
      statement_timestamp() + interval '2 days', statement_timestamp() + interval '2 days 2 hours',
      'Test Venue', 'Test Address', 8, 1000, '現場均攤', true, 'friends_dinner'
    ) returning id`;
    const [field] = await transaction`insert into public.event_fields (
      event_id, field_key, label, field_type, is_required, position
    ) values (${source.id}, 'dietary_note', '飲食備註', 'short_text', false, 1) returning id`;
    await transaction`insert into public.event_invitees (
      event_id, invitee_type, invitee_key_hash, created_by_user_id
    ) values (${source.id}, 'verified_email', 'verified-source-hash', ${actorId})`;
    await transaction`insert into public.event_invitees (
      event_id, invitee_type, invitee_key_hash, token_hash, created_by_user_id
    ) values (${source.id}, 'one_time_token', 'token-source-key', 'token-source-hash', ${actorId})`;
    await transaction`insert into public.registrations (
      event_id, user_id, status, seats, seat_pool, manual_display_name,
      manual_contact, added_by_user_id, display_name_snapshot
    ) values (
      ${source.id}, null, 'pending_organizer_confirmation', 1, 'public', '手動邀請朋友', '0912', ${actorId}, '手動邀請朋友'
    )`;
    await transaction`update public.events
      set starts_at = statement_timestamp() - interval '2 days',
          ends_at = statement_timestamp() - interval '1 day'
      where id = ${source.id}`;

    const [duplicated] = await transaction`select public.duplicate_event(
      ${source.id}, statement_timestamp() + interval '10 days', statement_timestamp() + interval '10 days 2 hours'
    ) as result`;
    const newEventId = duplicated.result.id;
    const [newEvent] = await transaction`select title, location_name, status, starts_at from public.events where id = ${newEventId}`;
    const [newField] = await transaction`select id from public.event_fields where event_id = ${newEventId} and field_key = 'dietary_note'`;
    const [newVerifiedInvite] = await transaction`select id from public.event_invitees where event_id = ${newEventId} and invitee_type = 'verified_email'`;
    const [newTokenInvite] = await transaction`select id from public.event_invitees where event_id = ${newEventId} and invitee_type = 'one_time_token'`;
    const [newManualRegistration] = await transaction`select status, manual_display_name from public.registrations where event_id = ${newEventId}`;
    assert(newEvent.title === "Repeat Source" && newEvent.location_name === "Test Venue", "repeat did not copy event details");
    assert(newEvent.status === "published" && new Date(newEvent.starts_at).getTime() > Date.now(), "repeat is not published in the future");
    assert(newField && newVerifiedInvite && !newTokenInvite, "repeat copied unsafe or incomplete invite data");
    assert(newManualRegistration?.status === "pending_organizer_confirmation", "manual roster did not reset to pending");
    assert(field.id && newEventId, "fixture IDs were not created");

    const [deleteTarget] = await transaction`insert into public.events (
      organizer_id, created_by_user_id, slug, title, status, timezone, starts_at, ends_at
    ) values (
      ${organizerId}, ${actorId}, 'delete-target-test', 'Delete Target', 'published', 'Asia/Taipei',
      statement_timestamp() + interval '5 days', statement_timestamp() + interval '5 days 2 hours'
    ) returning id`;
    await transaction`insert into public.event_fields (event_id, field_key, label, field_type)
      values (${deleteTarget.id}, 'note', '備註', 'long_text')`;
    await transaction`insert into public.event_invitees (event_id, invitee_type, invitee_key_hash, created_by_user_id)
      values (${deleteTarget.id}, 'verified_email', 'delete-target-hash', ${actorId})`;
    await transaction`insert into public.registrations (
      event_id, user_id, status, manual_display_name, added_by_user_id, display_name_snapshot
    ) values (${deleteTarget.id}, null, 'confirmed', 'Delete Me', ${actorId}, 'Delete Me')`;
    await transaction`select public.delete_event_permanently(${deleteTarget.id})`;
    const [remainingEvent] = await transaction`select id from public.events where id = ${deleteTarget.id}`;
    const [remainingField] = await transaction`select id from public.event_fields where event_id = ${deleteTarget.id}`;
    assert(!remainingEvent && !remainingField, "permanent deletion left operational rows behind");
    const [audit] = await transaction`select action, metadata->>'permanent' as permanent
      from public.audit_logs where action = 'event.deleted_permanently' order by created_at desc limit 1`;
    assert(audit?.action === "event.deleted_permanently" && audit.permanent === "true", "permanent deletion audit row missing");

    throw new Error("ROLLBACK_LIFECYCLE_FIXTURES");
  });
} catch (error) {
  if (error.message !== "ROLLBACK_LIFECYCLE_FIXTURES") throw error;
  console.log("event lifecycle local verification: PASS");
} finally {
  await sql.end({ timeout: 1 });
}
