import postgres from "postgres";

const databaseUrl = process.env.GATHER_JOIN_TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("GATHER_JOIN_TEST_DATABASE_URL is required for domain-schema verification.");
}

const expectedTables = [
  "audit_logs",
  "event_blocklist",
  "event_fields",
  "event_invitees",
  "events",
  "idempotency_requests",
  "notifications",
  "organizer_members",
  "organizers",
  "outbox_events",
  "registration_answers",
  "registrations",
  "users",
];

const expectedEnums = new Map([
  [
    "event_status",
    ["draft", "published", "cancellation_pending", "cancelled", "cancellation_exception"],
  ],
  [
    "registration_status",
    [
      "offered",
      "pending_organizer_confirmation",
      "confirmed",
      "waitlisted",
      "offer_expired",
      "expired",
      "declined",
      "cancelled",
      "removed_by_organizer",
    ],
  ],
  ["seat_pool", ["invite", "public"]],
  ["organizer_role", ["owner", "admin", "staff"]],
]);

const sql = postgres(databaseUrl, { max: 1 });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectSqlState(transaction, savepoint, expectedState, operation) {
  await transaction.unsafe(`savepoint ${savepoint}`);
  let observedState;
  try {
    await operation();
  } catch (error) {
    observedState = error.code;
  }
  await transaction.unsafe(`rollback to savepoint ${savepoint}`);
  await transaction.unsafe(`release savepoint ${savepoint}`);
  assert(
    observedState === expectedState,
    `${savepoint} expected SQLSTATE ${expectedState}, observed ${observedState ?? "success"}.`,
  );
}

try {
  const migrationRows = await sql`
    select version
    from supabase_migrations.schema_migrations
    where version = any(${["20260802152000", "20260802154000", "20260802160000"]})
    order by version
  `;
  assert(
    migrationRows.map(({ version }) => version).join(",")
      === "20260802152000,20260802154000,20260802160000",
    "A P1-02 migration is absent from the remote ledger.",
  );

  const tableRows = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name = any(${expectedTables})
    order by table_name
  `;
  assert(
    tableRows.map(({ table_name: tableName }) => tableName).join(",") === expectedTables.join(","),
    "Canonical public tables do not match the expected set.",
  );

  const enumRows = await sql`
    select type.typname as enum_name, enum.enumlabel as enum_label
    from pg_type as type
    join pg_namespace as namespace on namespace.oid = type.typnamespace
    join pg_enum as enum on enum.enumtypid = type.oid
    where namespace.nspname = 'public'
      and type.typname = any(${[...expectedEnums.keys()]})
    order by type.typname, enum.enumsortorder
  `;
  for (const [enumName, labels] of expectedEnums) {
    const actual = enumRows
      .filter(({ enum_name: actualName }) => actualName === enumName)
      .map(({ enum_label: label }) => label);
    assert(actual.join(",") === labels.join(","), `${enumName} labels do not match SSOT.`);
  }

  const securityRows = await sql`
    select relation.relname as table_name,
           relation.relrowsecurity as rls_enabled,
           relation.relforcerowsecurity as rls_forced
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = any(${expectedTables})
      and relation.relkind = 'r'
    order by relation.relname
  `;
  assert(securityRows.length === expectedTables.length, "RLS metadata is incomplete.");
  assert(
    securityRows.every(({ rls_enabled: enabled, rls_forced: forced }) => enabled && forced),
    "Every canonical table must have ENABLE and FORCE RLS.",
  );

  const privilegeRows = await sql`
    with role_names(role_name) as (
      values ('anon'::text), ('authenticated'::text)
    ), privilege_names(privilege_name) as (
      values
        ('SELECT'::text), ('INSERT'::text), ('UPDATE'::text), ('DELETE'::text),
        ('TRUNCATE'::text), ('REFERENCES'::text), ('TRIGGER'::text)
    )
    select relation.relname as table_name,
           role_name,
           privilege_name,
           has_table_privilege(
             role_name,
             format('%I.%I', namespace.nspname, relation.relname),
             privilege_name
           ) as allowed
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    cross join role_names
    cross join privilege_names
    where namespace.nspname = 'public'
      and relation.relname = any(${expectedTables})
    order by relation.relname, role_name, privilege_name
  `;
  assert(
    privilegeRows.length === expectedTables.length * 2 * 7
      && privilegeRows.every(({ allowed }) => allowed === false),
    "anon/authenticated unexpectedly hold a canonical-table privilege.",
  );

  const publicAclRows = await sql`
    select relation.relname, expanded_acl.privilege_type
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    cross join lateral aclexplode(
      coalesce(relation.relacl, acldefault('r', relation.relowner))
    ) as expanded_acl
    where namespace.nspname = 'public'
      and relation.relname = any(${expectedTables})
      and expanded_acl.grantee = 0
  `;
  assert(publicAclRows.length === 0, "PUBLIC unexpectedly holds canonical-table privileges.");

  const policyRows = await sql`
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(${expectedTables})
  `;
  assert(policyRows.length === 0, "P1-02 must not introduce P1-04 RLS policies.");

  const protectedFunctionRows = await sql`
    with role_names(role_name) as (
      values ('anon'::text), ('authenticated'::text)
    )
    select procedure.proname as function_name,
           role_name,
           has_function_privilege(role_name, procedure.oid, 'EXECUTE') as allowed
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    cross join role_names
    where namespace.nspname = 'public'
      and procedure.proname = any(${[
        "is_prohibited_payment_proof_field_name",
        "validate_event_timezone",
        "guard_event_safety_edits_after_start",
        "event_registration_is_open",
        "enforce_organizer_owner_count",
        "transfer_organizer_ownership",
        "is_registration_status_transition_allowed",
        "guard_registration_state_machine",
        "guard_organizer_membership_identity",
      ]})
  `;
  assert(
    protectedFunctionRows.length === 18
      && protectedFunctionRows.every(({ allowed }) => allowed === false),
    "anon/authenticated unexpectedly hold EXECUTE on a P1-02 helper/RPC.",
  );

  const registrationPaymentColumns = await sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registrations'
      and column_name like '%payment%'
    order by column_name
  `;
  assert(
    registrationPaymentColumns.length === 1
      && registrationPaymentColumns[0].column_name === "payment_declared_at",
    "registrations contains a participant payment column outside the sole declaration timestamp.",
  );

  const prohibitedTables = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name = any(${["orders", "payments", "refunds", "merchant_connections"]})
  `;
  assert(prohibitedTables.length === 0, "A prohibited payment-processing table exists.");

  const indexRows = await sql`
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and indexname = any(${[
        "one_active_owner_per_organizer",
        "one_active_registration_per_user_event",
      ]})
  `;
  assert(indexRows.length === 2, "A required ownership/registration index is absent.");

  const replayConstraintRows = await sql`
    select relation.relname as table_name,
           pg_get_constraintdef(constraint_row.oid) as definition
    from pg_constraint as constraint_row
    join pg_class as relation on relation.oid = constraint_row.conrelid
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = any(${["idempotency_requests", "outbox_events"]})
      and constraint_row.contype = 'u'
  `;
  assert(
    replayConstraintRows.some(
      ({ table_name: tableName, definition }) =>
        tableName === "idempotency_requests"
        && definition === "UNIQUE (actor_user_id, operation, key_hash)",
    )
      && replayConstraintRows.some(
        ({ table_name: tableName, definition }) =>
          tableName === "outbox_events"
          && definition === "UNIQUE (registration_id, transition_version, notification_kind)",
      ),
    "A required idempotency/outbox unique constraint is absent.",
  );

  const crossEventConstraintRows = await sql`
    select constraint_row.conname
    from pg_constraint as constraint_row
    join pg_class as relation on relation.oid = constraint_row.conrelid
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and constraint_row.conname = any(${[
        "registration_answers_registration_event_fkey",
        "registration_answers_field_event_fkey",
        "idempotency_requests_result_registration_event_fkey",
        "notifications_registration_event_fkey",
        "outbox_events_registration_event_fkey",
        "audit_logs_registration_event_fkey",
      ]})
  `;
  assert(crossEventConstraintRows.length === 6, "A cross-event composite FK is absent.");

  await sql.unsafe("begin");
  try {
    const [fixture] = await sql`
      select
        gen_random_uuid() as owner_user_id,
        gen_random_uuid() as next_owner_user_id,
        gen_random_uuid() as participant_user_id,
        gen_random_uuid() as organizer_id,
        gen_random_uuid() as second_organizer_id,
        gen_random_uuid() as leap_event_id,
        gen_random_uuid() as dst_event_id,
        gen_random_uuid() as started_event_id
    `;

    for (const userId of [fixture.owner_user_id, fixture.next_owner_user_id, fixture.participant_user_id]) {
      await sql`
        insert into auth.users (id, aud, role, created_at, updated_at)
        values (${userId}, 'authenticated', 'authenticated', statement_timestamp(), statement_timestamp())
      `;
      await sql`insert into public.users (id) values (${userId})`;
    }

    await sql`
      insert into public.organizers (id, slug, display_name, created_by_user_id)
      values (${fixture.organizer_id}, 'gate2a-fixture', 'Gate 2A Fixture', ${fixture.owner_user_id})
    `;
    await sql`
      insert into public.organizer_members (organizer_id, user_id, role)
      values
        (${fixture.organizer_id}, ${fixture.owner_user_id}, 'owner'),
        (${fixture.organizer_id}, ${fixture.next_owner_user_id}, 'admin')
    `;
    await sql.unsafe("set constraints all immediate");

    await expectSqlState(sql, "duplicate_owner", "23505", async () => {
      await sql`
        insert into public.organizer_members (organizer_id, user_id, role)
        values (${fixture.organizer_id}, ${fixture.participant_user_id}, 'owner')
      `;
    });

    await sql`select set_config('request.jwt.claim.sub', ${fixture.owner_user_id}::text, true)`;
    await sql`select public.transfer_organizer_ownership(${fixture.organizer_id}, ${fixture.next_owner_user_id})`;
    const ownershipRows = await sql`
      select user_id, role
      from public.organizer_members
      where organizer_id = ${fixture.organizer_id}
        and revoked_at is null
      order by role, user_id
    `;
    assert(
      ownershipRows.filter(({ role }) => role === "owner").length === 1
        && ownershipRows.find(({ role }) => role === "owner").user_id === fixture.next_owner_user_id,
      "Owner transfer did not atomically leave exactly one expected owner.",
    );
    const ownerAuditRows = await sql`
      select id
      from public.audit_logs
      where organizer_id = ${fixture.organizer_id}
        and action = 'organizer.owner_transferred'
    `;
    assert(ownerAuditRows.length === 1, "Owner transfer audit is absent or duplicated.");

    await sql.unsafe("set constraints all deferred");
    await sql`
      insert into public.organizers (id, slug, display_name, created_by_user_id)
      values (
        ${fixture.second_organizer_id},
        'gate2a-second-fixture',
        'Gate 2A Second Fixture',
        ${fixture.participant_user_id}
      )
    `;
    await sql`
      insert into public.organizer_members (organizer_id, user_id, role)
      values (${fixture.second_organizer_id}, ${fixture.participant_user_id}, 'owner')
    `;
    await sql.unsafe("set constraints all immediate");
    await expectSqlState(sql, "membership_identity", "55000", async () => {
      await sql`
        update public.organizer_members
        set organizer_id = ${fixture.second_organizer_id}
        where organizer_id = ${fixture.organizer_id}
          and user_id = ${fixture.next_owner_user_id}
      `;
    });

    await sql`
      insert into public.events (
        id, organizer_id, created_by_user_id, slug, title, status, visibility,
        timezone, starts_at, ends_at, registration_opens_at, registration_closes_at,
        capacity
      ) values (
        ${fixture.leap_event_id}, ${fixture.organizer_id}, ${fixture.owner_user_id},
        'leap-day-fixture', 'Leap Day', 'published', 'public', 'Asia/Taipei',
        '2028-02-29T10:00:00+08:00', '2028-02-29T12:00:00+08:00',
        null, '2028-02-29T10:00:00+08:00', null
      ), (
        ${fixture.dst_event_id}, ${fixture.organizer_id}, ${fixture.owner_user_id},
        'dst-fixture', 'DST Boundary', 'published', 'public', 'America/New_York',
        '2028-03-12T03:30:00-04:00', '2028-03-12T05:30:00-04:00',
        '2028-03-01T00:00:00-05:00', '2028-03-12T03:30:00-04:00', 40
      ), (
        ${fixture.started_event_id}, ${fixture.organizer_id}, ${fixture.owner_user_id},
        'started-fixture', 'Started Event', 'published', 'private', 'Asia/Taipei',
        '2020-01-01T10:00:00+08:00', '2020-01-01T12:00:00+08:00',
        null, null, null
      )
    `;

    const calendarRows = await sql`
      select
        (
          select to_char(starts_at at time zone timezone, 'YYYY-MM-DD HH24:MI:SS')
          from public.events
          where id = ${fixture.leap_event_id}
        ) as leap_local,
        (
          select to_char(starts_at at time zone timezone, 'YYYY-MM-DD HH24:MI:SS')
          from public.events
          where id = ${fixture.dst_event_id}
        ) as dst_local
    `;
    assert(
      calendarRows[0].leap_local === "2028-02-29 10:00:00"
        && calendarRows[0].dst_local === "2028-03-12 03:30:00",
      "Leap-day or DST local rendering changed the stored intended wall time.",
    );

    const registrationWindowRows = await sql`
      select
        public.event_registration_is_open(${fixture.leap_event_id}, '2028-02-15T12:00:00+08:00') as before_start,
        public.event_registration_is_open(${fixture.leap_event_id}, '2028-02-29T10:00:00+08:00') as at_start
    `;
    assert(
      registrationWindowRows[0].before_start === true
        && registrationWindowRows[0].at_start === false,
      "Registration window must close no later than the event start instant.",
    );

    await sql`
      update public.events
      set starts_at = '2028-03-01T10:00:00+08:00',
          ends_at = '2028-03-01T12:00:00+08:00',
          registration_closes_at = '2028-03-01T10:00:00+08:00'
      where id = ${fixture.leap_event_id}
    `;
    await sql`
      update public.events
      set title = 'Started Event — content correction'
      where id = ${fixture.started_event_id}
    `;
    await expectSqlState(sql, "started_event_capacity", "55000", async () => {
      await sql`update public.events set capacity = 10 where id = ${fixture.started_event_id}`;
    });

    await expectSqlState(sql, "invalid_timezone", "22023", async () => {
      await sql`
        insert into public.events (
          organizer_id, created_by_user_id, slug, title, timezone, starts_at, ends_at
        ) values (
          ${fixture.organizer_id}, ${fixture.owner_user_id}, 'bad-timezone-fixture',
          'Bad timezone', 'Mars/Olympus', '2028-06-01T00:00:00Z', '2028-06-01T01:00:00Z'
        )
      `;
    });

    await expectSqlState(sql, "invalid_payment_field", "23514", async () => {
      await sql`
        insert into public.event_fields (event_id, field_key, label, field_type)
        values (${fixture.leap_event_id}, 'transfer_digits', '轉帳末碼', 'short_text')
      `;
    });

    await expectSqlState(sql, "registration_after_start", "55000", async () => {
      await sql`
        insert into public.registrations (event_id, user_id, status)
        values (${fixture.started_event_id}, ${fixture.participant_user_id}, 'confirmed')
      `;
    });

    await expectSqlState(sql, "invalid_initial_status", "23514", async () => {
      await sql`
        insert into public.registrations (event_id, user_id, status)
        values (
          ${fixture.leap_event_id},
          ${fixture.participant_user_id},
          'pending_organizer_confirmation'
        )
      `;
    });

    await sql`
      insert into public.registrations (
        event_id, user_id, status, seat_pool, waitlisted_at
      ) values (
        ${fixture.leap_event_id}, ${fixture.participant_user_id}, 'waitlisted', 'public', statement_timestamp()
      )
    `;
    await expectSqlState(sql, "duplicate_active_registration", "23505", async () => {
      await sql`
        insert into public.registrations (event_id, user_id, status)
        values (${fixture.leap_event_id}, ${fixture.participant_user_id}, 'confirmed')
      `;
    });

    const [crossEventField] = await sql`
      insert into public.event_fields (event_id, field_key, label, field_type)
      values (${fixture.dst_event_id}, 'dietary_note', '飲食備註', 'short_text')
      returning id
    `;
    const [registration] = await sql`
      select id, transition_version
      from public.registrations
      where event_id = ${fixture.leap_event_id}
        and user_id = ${fixture.participant_user_id}
    `;

    await expectSqlState(sql, "cross_event_answer", "23503", async () => {
      await sql`
        insert into public.registration_answers (
          registration_id, event_field_id, event_id, answer_value
        ) values (
          ${registration.id}, ${crossEventField.id}, ${fixture.leap_event_id}, '"none"'::jsonb
        )
      `;
    });
    await expectSqlState(sql, "cross_event_idempotency", "23503", async () => {
      await sql`
        insert into public.idempotency_requests (
          actor_user_id, operation, key_hash, event_id, request_fingerprint,
          result_registration_id
        ) values (
          ${fixture.participant_user_id}, 'register', 'fixture-key', ${fixture.dst_event_id},
          'fixture-fingerprint', ${registration.id}
        )
      `;
    });
    await expectSqlState(sql, "cross_event_notification", "23503", async () => {
      await sql`
        insert into public.notifications (
          event_id, registration_id, recipient_user_id, channel, notification_kind
        ) values (
          ${fixture.dst_event_id}, ${registration.id}, ${fixture.participant_user_id},
          'in_app', 'fixture.cross-event'
        )
      `;
    });
    await expectSqlState(sql, "cross_event_outbox", "23503", async () => {
      await sql`
        insert into public.outbox_events (
          event_id, registration_id, recipient_user_id, transition_version, notification_kind
        ) values (
          ${fixture.dst_event_id}, ${registration.id}, ${fixture.participant_user_id},
          ${registration.transition_version}, 'fixture.cross-event'
        )
      `;
    });
    await expectSqlState(sql, "cross_event_audit", "23503", async () => {
      await sql`
        insert into public.audit_logs (event_id, registration_id, action)
        values (${fixture.dst_event_id}, ${registration.id}, 'fixture.cross-event')
      `;
    });

    await sql`
      update public.registrations
      set status = 'offered',
          offered_at = statement_timestamp(),
          offer_expires_at = statement_timestamp() + interval '1 hour'
      where id = ${registration.id}
    `;
    await sql`update public.registrations set status = 'confirmed' where id = ${registration.id}`;
    await sql`update public.registrations set status = 'cancelled' where id = ${registration.id}`;
    await expectSqlState(sql, "terminal_registration_revival", "23514", async () => {
      await sql`update public.registrations set status = 'confirmed' where id = ${registration.id}`;
    });
  } finally {
    await sql.unsafe("rollback");
  }

  process.stdout.write(
    "P1-02 ledger, fail-closed ACL/RLS, calendar, owner, state-machine, and cross-event constraints verified.\n",
  );
} finally {
  await sql.end({ timeout: 1 });
}
