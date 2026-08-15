import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260802010000_p1_framework_probe.sql",
);
const invitationEditMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260813030000_invitation_target_edit.sql",
);
const privateInviteeTokenMigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260813110623_private_invitee_tokens.sql",
);
const canonicalSeatEngineHardeningPath = resolve(
  process.cwd(),
  "supabase/migrations/20260814175513_canonical_seat_engine_hardening_a.sql",
);
const canonicalRosterDedupeFixPath = resolve(
  process.cwd(),
  "supabase/migrations/20260815030000_canonical_seat_engine_roster_dedupe_fix.sql",
);
const canonicalSeatEngineDirectUpdateRevokePath = resolve(
  process.cwd(),
  "supabase/migrations/20260815040000_canonical_seat_engine_direct_update_revoke_b.sql",
);
const syntheticLineVerifiedGuardPath = resolve(
  process.cwd(),
  "supabase/migrations/20260815050000_synthetic_line_verified_guard.sql",
);
const manualRosterCapacityFixPath = resolve(
  process.cwd(),
  "supabase/migrations/20260815060000_manual_roster_capacity_seat_engine_fix.sql",
);
const guestInvitationVerifierPath = resolve(process.cwd(), "scripts/verify-guest-invitations.mjs");
const manualRosterCapacityVerifierPath = resolve(
  process.cwd(),
  "scripts/verify-manual-roster-capacity.mjs",
);
const manualRosterConcurrencyVerifierPath = resolve(
  process.cwd(),
  "scripts/verify-manual-roster-concurrency.mjs",
);

// Applied-state gate: `supabase migration list --local` lists filesystem migrations in its
// Local column. Before editing an existing timestamp, query the target database's
// supabase_migrations.schema_migrations row and read back the pg_proc definition.
function extractSqlFunction(sql: string, exactHeader: string): string {
  const start = sql.indexOf(exactHeader);
  if (start < 0) throw new Error(`missing SQL function header: ${exactHeader}`);
  const duplicate = sql.indexOf(exactHeader, start + exactHeader.length);
  if (duplicate >= 0) throw new Error(`duplicate SQL function header: ${exactHeader}`);
  const end = sql.indexOf("\n$$;", start);
  if (end < 0) throw new Error(`unterminated SQL function: ${exactHeader}`);
  return sql.slice(start, end + 4);
}

describe("P1-01 framework migration contract", () => {
  it("keeps the public probe default-deny without introducing domain schema", async () => {
    const migration = (await readFile(migrationPath, "utf8")).toLowerCase();
    const executableSql = migration.replace(/^--.*$/gm, "");

    expect(executableSql).toContain("enable row level security");
    expect(executableSql).toMatch(
      /revoke\s+all[\s\S]+from\s+public\s*,\s*anon\s*,\s*authenticated/,
    );
    expect(executableSql).toContain("create table public.p1_framework_probe");
    expect(executableSql).not.toContain("create table if not exists");
    expect(executableSql).not.toMatch(/\b(events|registrations|idempotency_requests)\b/);
    expect(executableSql).not.toMatch(/create\s+(policy|function|trigger|type)\b/);
  });
});

describe("invitation target edit migration contract", () => {
  it("keeps organizer authorization and duplicate-name protection in the database", async () => {
    const migration = (await readFile(invitationEditMigrationPath, "utf8")).toLowerCase();
    expect(migration).toContain("create function public.organizer_edit_event_invitation_target");
    expect(migration).toContain("is_organizer_admin");
    expect(migration).toContain("display_name_normalized = lower(v_name)");
    expect(migration).toContain("revoke all on function");
    expect(migration).toContain("grant execute on function public.organizer_edit_event_invitation_target");
  });
});

describe("private invitee token migration contract", () => {
  it("uses per-invitee tokens without widening the schema or anonymous organizer RPC access", async () => {
    const migration = (await readFile(privateInviteeTokenMigrationPath, "utf8")).toLowerCase();
    const executableSql = migration.replace(/^--.*$/gm, "");

    expect(executableSql).not.toMatch(/\b(create|alter)\s+table\b/);
    expect(migration).toContain("create or replace function public.organizer_issue_event_invitation_token");
    expect(migration).toContain("drop function public.respond_to_event_invitation(text, text, text, text)");
    expect(migration).toContain("set guest_key_hash = null");
    expect(migration).toContain("and target.guest_key_hash is not null");
    expect(migration).toContain("and event.status = 'published'");
    expect(migration).toContain("and event.visibility = 'private'");
    expect(migration).toContain("and event.invite_only");
    expect(migration).toContain("and target.revoked_at is null");
    expect(migration).toContain("'event_invitation.legacy_token_invalidated'");
    expect(migration).toContain("jsonb_build_object('target_id', id)");
    expect(migration.indexOf("event_invitation.legacy_token_invalidated")).toBeLessThan(
      migration.indexOf("create or replace function public.organizer_issue_event_invitation_token"),
    );
    expect(migration).toContain("create function public.respond_to_event_invitation(");
    expect(migration).toContain("p_invitee_token text");
    expect(migration).toContain("and guest_key_hash = v_token_hash");
    expect(migration).toContain("raise exception 'invalid or revoked invitation token'");
    expect(migration).toContain("revoke all on function public.organizer_add_event_invitation_target(uuid, text) from public, anon");
    expect(migration).toContain("revoke all on function public.organizer_remove_event_invitation_target(uuid) from public, anon");
    expect(migration).toContain("grant execute on function public.organizer_issue_event_invitation_token(uuid) to authenticated");

    const responseFunction = migration.slice(
      migration.indexOf("create function public.respond_to_event_invitation("),
      migration.indexOf("create or replace function public.get_event_invitation_by_slug("),
    );
    expect(responseFunction).not.toContain("p_display_name");
    expect(responseFunction).not.toContain("insert into public.event_invitation_targets");
    expect(responseFunction).not.toMatch(/set\s+guest_key_hash\s*=/);

    const rosterReader = migration.slice(
      migration.indexOf("create or replace function public.get_event_invitation_by_slug("),
      migration.indexOf("revoke all on function public.organizer_add_event_invitation_target"),
    );
    expect(rosterReader).toMatch(/from public\.registrations registration[\s\S]*?and not exists \([\s\S]*?target\.display_name/);
  });

  it("keeps the live guest-invitation verifier on the token-only RPC contract", async () => {
    const verifier = await readFile(guestInvitationVerifierPath, "utf8");
    expect(verifier).not.toContain("p_display_name");
    expect(verifier).toContain("public.respond_to_event_invitation(${slug}, ${tokens.primaryToken}, 'attending')");
    expect(verifier).toContain("organizer_issue_event_invitation_token");
    expect(verifier).toContain("old token must be rejected after reissue");
    expect(verifier).toContain("anonymous organizer add must be rejected");
    expect(verifier).toContain("anonymous organizer token issue must be rejected");
    expect(verifier).toContain("GUEST_INVITATION_FIXTURE_ROLLBACK");
    expect(verifier).toContain("activeSql.savepoint");
    expect(verifier).toContain("reset role");
  });
});

describe("canonical seat-engine hardening A migration contract", () => {
  it("uses the locked, idempotent organizer RPC rather than widening direct table access", async () => {
    const migration = (await readFile(canonicalSeatEngineHardeningPath, "utf8")).toLowerCase();

    expect(migration).toContain("create function public.update_event_capacity_settings(");
    expect(migration).toContain("p_event_id uuid");
    expect(migration).toContain("p_idempotency_key text");
    expect(migration).toContain("p_capacity integer");
    expect(migration).toContain("p_invite_reserved_seats integer");
    expect(migration).toContain("p_invite_pool_deadline timestamptz");
    expect(migration).toContain("returns jsonb");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = pg_catalog, public, extensions");
    expect(migration).toContain("for update");
    expect(migration).toContain("is_organizer_admin");
    expect(migration).toContain("operation = 'update_event_capacity_settings'");
    expect(migration).toContain("idempotency key reused with a different request");
    expect(migration).toContain("using errcode = '23505'");
    expect(migration).toContain("revoke all on function public.update_event_capacity_settings");
    expect(migration).toContain("grant execute on function public.update_event_capacity_settings");
  });

  it("keeps capacity accounting canonical across registrations and attending invitees", async () => {
    const migration = (await readFile(canonicalSeatEngineHardeningPath, "utf8")).toLowerCase();

    expect(migration).toContain("coalesce(sum(registration.seats), 0)::integer");
    expect(migration).toContain("response = 'attending'");
    expect(migration).toContain("total_occupied_seats");
    expect(migration).toContain("capacity cannot drop below");
    expect(migration).toContain("invite_reserved_seats cannot drop below");
    expect(migration).toContain("create or replace function public.guard_event_capacity_decrease()");

    const guard = migration.slice(
      migration.indexOf("create or replace function public.guard_event_capacity_decrease()"),
      migration.indexOf("create or replace function public.sweep_event_locked"),
    );
    expect(guard).toContain("invite pool configuration cannot change after participant activity");
  });

  it("supersedes the historical name rule with conservative Wave 0 capacity", async () => {
    const historical = (await readFile(canonicalSeatEngineHardeningPath, "utf8")).toLowerCase();
    const current = (await readFile(manualRosterCapacityFixPath, "utf8")).toLowerCase();
    const responseStart = historical.indexOf("create or replace function public.respond_to_event_invitation(");
    const responseEnd = historical.indexOf("create function public.update_event_capacity_settings(");
    const response = historical.slice(responseStart, responseEnd);
    const usage = extractSqlFunction(
      current,
      "create or replace function public.event_capacity_usage(p_event_id uuid)",
    );

    expect(responseStart).toBeGreaterThanOrEqual(0);
    expect(response).toContain("p_invitee_token text");
    expect(response).toContain("p_response text");
    expect(response).not.toContain("p_display_name");
    expect(usage).not.toContain("display_name");
    expect(usage).not.toContain("not exists");
  });

  it("keeps the private invitation reader on the same attending-only count rule", async () => {
    const migration = (await readFile(canonicalSeatEngineHardeningPath, "utf8")).toLowerCase();
    const readerStart = migration.indexOf("create or replace function public.get_event_invitation_by_slug(");
    const readerEnd = migration.indexOf("create or replace function public.register_for_event(");
    const reader = migration.slice(readerStart, readerEnd);

    expect(readerStart).toBeGreaterThanOrEqual(0);
    expect(reader).toContain("p_guest_key text default null");
    expect(reader).toContain("and target.response = 'attending'");
    expect(reader).toContain("'attending_count', v_registration_count + v_guest_count");
  });

  it("releases the invite pool before any expiry promotion and preserves strict FIFO", async () => {
    const migration = (await readFile(canonicalSeatEngineHardeningPath, "utf8")).toLowerCase();
    const sweepStart = migration.indexOf("create or replace function public.sweep_event_locked");
    const promoteStart = migration.indexOf("create or replace function public.promote_next_waitlisted_locked");
    const sweep = migration.slice(sweepStart, promoteStart);

    expect(sweepStart).toBeGreaterThanOrEqual(0);
    expect(promoteStart).toBeGreaterThan(sweepStart);
    expect(sweep.indexOf("set invite_pool_released_at = statement_timestamp()")).toBeLessThan(
      sweep.indexOf("perform public.promote_next_waitlisted_locked"),
    );
    expect(migration).toContain("order by waitlisted_at, id");
    expect(migration).toContain("strict fifo waitlist cannot be bypassed");
    expect(migration).toContain("next_reg.seats > v_available_seats");
    expect(migration).toContain("strict fifo head does not fit available seats");
    expect(sweep).toContain("exit when waitlist_head_still_waiting");
  });

  it("records the capacity-settings change in the audit trail without inventing an invalid registration outbox row", async () => {
    const migration = (await readFile(canonicalSeatEngineHardeningPath, "utf8")).toLowerCase();
    const rpcStart = migration.indexOf("create function public.update_event_capacity_settings(");
    const rpc = migration.slice(rpcStart);

    expect(rpc).toContain("insert into public.audit_logs");
    expect(rpc).toContain("event.capacity_settings_updated");
    expect(rpc).not.toContain("insert into public.outbox_events");
  });
});

describe("canonical roster de-duplication corrective migration contract", () => {
  it("keeps attending-only capacity accounting while de-duplicating every active invite target in the roster", async () => {
    const migration = (await readFile(canonicalRosterDedupeFixPath, "utf8")).toLowerCase();
    const capacitySection = migration.slice(0, migration.indexOf("-- roster projection remains"));
    const rosterSection = migration.slice(migration.indexOf("-- roster projection remains"));

    expect(migration).toContain("create or replace function public.get_event_invitation_by_slug");
    expect(capacitySection).toContain("target.response = 'attending'");
    expect(rosterSection).not.toContain("target.response = 'attending'");
    expect(rosterSection).toContain("revoke all on function public.get_event_invitation_by_slug(text, text)");
    expect(rosterSection).toContain("grant execute on function public.get_event_invitation_by_slug(text, text)");
  });
});

describe("canonical seat-engine hardening B migration contract", () => {
  it("revokes direct capacity and invite-pool UPDATE without widening the RPC", async () => {
    const migration = (await readFile(canonicalSeatEngineDirectUpdateRevokePath, "utf8")).toLowerCase();
    const executableSql = migration.replace(/^--.*$/gm, "");

    expect(executableSql).toContain(
      "revoke update (\n  capacity,\n  invite_reserved_seats,\n  invite_pool_deadline,\n  invite_pool_released_at\n) on public.events from public, anon, authenticated",
    );
    expect(executableSql).toContain(
      "revoke all on function public.update_event_capacity_settings(\n  uuid,\n  text,\n  integer,\n  integer,\n  timestamptz\n) from public, anon, authenticated",
    );
    expect(executableSql).toContain(
      "grant execute on function public.update_event_capacity_settings(\n  uuid,\n  text,\n  integer,\n  integer,\n  timestamptz\n) to authenticated",
    );
    expect(executableSql).not.toContain("grant update");
    expect(executableSql).not.toMatch(/alter\s+table\s+public\.events\s+disable\s+row\s+level\s+security/);
  });
});

describe("synthetic LINE verified guard migration contract", () => {
  it("is a unique, forward-only migration addressable by the Supabase ledger", async () => {
    const migration = (await readFile(syntheticLineVerifiedGuardPath, "utf8")).toLowerCase();

    expect(syntheticLineVerifiedGuardPath).toMatch(
      /supabase\/migrations\/20260815050000_synthetic_line_verified_guard\.sql$/,
    );
    expect(migration).toContain("forward-only correction");
    expect(migration).not.toContain("insert into supabase_migrations.schema_migrations");
    expect(migration).not.toMatch(/\b(drop|truncate|delete)\s+/);
  });

  it("fails closed for synthetic LINE email identities while preserving real-email sync", async () => {
    const migration = (await readFile(syntheticLineVerifiedGuardPath, "utf8")).toLowerCase();

    expect(migration).toContain("create or replace function public.sync_verified_email()");
    expect(migration).toContain("security definer");
    expect(migration).toContain(
      "set search_path = pg_catalog, public, extensions, auth",
    );
    expect(migration).toMatch(
      /if\s+lower\(btrim\(coalesce\(v_email,\s*''\)\)\)\s+~\*\s+'\^line\\\+\[\^@\]\+@users\\\.noreply\\\.gather\\\.wedopr\\\.com\$'/,
    );

    const syntheticGuardStart = migration.indexOf("if lower(btrim(coalesce(v_email");
    const syncUpdateStart = migration.indexOf("update public.users", syntheticGuardStart);
    expect(syntheticGuardStart).toBeGreaterThanOrEqual(0);
    expect(syncUpdateStart).toBeGreaterThan(syntheticGuardStart);
    expect(migration.slice(syntheticGuardStart, syncUpdateStart)).toContain("return");
    expect(migration.slice(syncUpdateStart)).toContain("set email = v_email");
  });

  it("repairs only the derived public verification timestamp and keeps auth/linkage untouched", async () => {
    const migration = (await readFile(syntheticLineVerifiedGuardPath, "utf8")).toLowerCase();
    const repairStart = migration.indexOf("update public.users\nset email_verified_at = null");
    const aclStart = migration.indexOf("revoke all on function public.sync_verified_email()");
    const repair = migration.slice(repairStart, aclStart);

    expect(repairStart).toBeGreaterThanOrEqual(0);
    expect(aclStart).toBeGreaterThan(repairStart);
    expect(repair).toContain("set email_verified_at = null");
    expect(repair).toContain("where email_verified_at is not null");
    expect(repair).toContain("email_normalized ~*");
    expect(repair).not.toContain("update auth.users");
    expect(repair).not.toContain("set email =");
    expect(repair).not.toContain("set line_user_id =");
    expect(repair).not.toContain("set display_name =");
    expect(repair).not.toMatch(/\b(delete|truncate)\b/);
  });

  it("keeps sync RPC ACL explicit and fail-closed for anonymous callers", async () => {
    const migration = (await readFile(syntheticLineVerifiedGuardPath, "utf8")).toLowerCase();

    expect(migration).toContain(
      "revoke all on function public.sync_verified_email() from public, anon, authenticated;",
    );
    expect(migration).toContain(
      "grant execute on function public.sync_verified_email() to authenticated;",
    );
    expect(migration).not.toMatch(/grant\s+execute[\s\S]+to\s+(public|anon)\s*;/);
  });
});

describe("manual roster canonical capacity corrective migration contract", () => {
  it("exposes a backward-compatible capacity envelope before and after pool merge", async () => {
    const migration = (await readFile(manualRosterCapacityFixPath, "utf8")).toLowerCase();
    const usage = extractSqlFunction(
      migration,
      "create or replace function public.event_capacity_usage(p_event_id uuid)",
    );

    for (const legacyKey of [
      "registration_seats",
      "attending_invitee_count",
      "invite_occupied_seats",
      "public_occupied_seats",
      "total_occupied_seats",
    ]) {
      expect(usage).toContain(`'${legacyKey}'`);
    }
    expect(usage).toContain("'merged'");
    expect(usage).toContain("'limits', jsonb_build_object");
    expect(usage).toContain("'available', jsonb_build_object");
    expect(usage).toContain("'within_limits', jsonb_build_object");
    expect(usage).toMatch(/invite_pool_released_at\s+is\s+not\s+null/);
    expect(usage).toMatch(/invite_reserved_seats\s+is\s+null/);
    expect(usage).toMatch(/capacity\s+is\s+null/);
    expect(migration).toContain(
      "revoke all on function public.event_capacity_usage(uuid) from public, anon, authenticated",
    );
  });

  it("keeps Wave 0 capacity conservative and defers explicit identity linkage to Wave 3", async () => {
    const migration = (await readFile(manualRosterCapacityFixPath, "utf8")).toLowerCase();
    const usage = extractSqlFunction(
      migration,
      "create or replace function public.event_capacity_usage(p_event_id uuid)",
    );
    const verifier = (await readFile(manualRosterCapacityVerifierPath, "utf8")).toLowerCase();

    expect(usage).toContain("coalesce(sum(registration.seats), 0)::integer");
    expect(usage).toContain("select count(*)::integer as attending_invitee_count");
    expect(usage).not.toContain("display_name");
    expect(usage).not.toContain("lower(");
    expect(usage).not.toContain("btrim(");
    expect(usage).not.toContain("not exists");
    expect(verifier).toContain(
      "wave 3 identity linkage is deferred; wave 0 never infers identity from display names",
    );
  });

  it("validates the token-only RSVP against the transactional after-state envelope", async () => {
    const migration = (await readFile(manualRosterCapacityFixPath, "utf8")).toLowerCase();
    const response = extractSqlFunction(
      migration,
      "create or replace function public.respond_to_event_invitation(\n" +
        "  p_slug text,\n" +
        "  p_invitee_token text,\n" +
        "  p_response text\n" +
        ")",
    );
    const eventLockAt = response.indexOf("from public.events");
    const sweepAt = response.indexOf("perform public.sweep_event_locked");
    const targetLockAt = response.indexOf("from public.event_invitation_targets");
    const updateAt = response.indexOf("update public.event_invitation_targets");
    const afterEnvelopeAt = response.indexOf(
      "usage_after := public.event_capacity_usage(v_event.id)",
      updateAt,
    );
    const rejectAt = response.indexOf("using errcode = '53300'", afterEnvelopeAt);

    expect(response).toContain("security definer");
    expect(response).toContain("set search_path = pg_catalog, public, extensions");
    expect(eventLockAt).toBeGreaterThanOrEqual(0);
    expect(sweepAt).toBeGreaterThan(eventLockAt);
    expect(targetLockAt).toBeGreaterThan(sweepAt);
    expect(updateAt).toBeGreaterThan(targetLockAt);
    expect(afterEnvelopeAt).toBeGreaterThan(updateAt);
    expect(rejectAt).toBeGreaterThan(afterEnvelopeAt);
    expect(response).toContain("usage_after -> 'within_limits' ->> 'total'");
    expect(response).toContain("usage_after ->> 'merged'");
    expect(response).toContain("usage_after -> 'within_limits' ->> 'invite'");
    expect(response).toContain("'capacity_usage', usage_before");
    expect(response).toContain("'capacity_usage', usage_after");
    expect(response).not.toContain("v_registration_count");
    expect(response).not.toContain("v_guest_count");
    expect(response).not.toMatch(/\bsum\s*\(/);
    expect(migration).toContain(
      "revoke all on function public.respond_to_event_invitation(text, text, text) from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.respond_to_event_invitation(text, text, text) to anon, authenticated",
    );
  });

  it("reloads private invitation capacity from the canonical envelope without changing roster projection", async () => {
    const migration = (await readFile(manualRosterCapacityFixPath, "utf8")).toLowerCase();
    const reader = extractSqlFunction(
      migration,
      "create or replace function public.get_event_invitation_by_slug(\n" +
        "  p_slug text,\n" +
        "  p_guest_key text default null\n" +
        ")",
    );
    const capacityAt = reader.indexOf(
      "v_capacity_usage := public.event_capacity_usage(v_event.id)",
    );
    const rosterAt = reader.indexOf("select coalesce(\n    jsonb_agg", capacityAt);
    const capacityBlock = reader.slice(capacityAt, rosterAt);
    const rosterBlock = reader.slice(rosterAt);

    expect(reader).toContain("security definer");
    expect(reader).toContain("stable");
    expect(reader).toContain("set search_path = pg_catalog, public, extensions");
    expect(reader).toContain("guest_key_hash = v_guest_key_hash");
    expect(capacityAt).toBeGreaterThanOrEqual(0);
    expect(rosterAt).toBeGreaterThan(capacityAt);
    expect(capacityBlock).not.toContain("display_name");
    expect(capacityBlock).not.toContain("lower(");
    expect(capacityBlock).not.toContain("btrim(");
    expect(capacityBlock).not.toContain("not exists");
    expect(reader).toContain(
      "'attending_count', (v_capacity_usage ->> 'total_occupied_seats')::integer",
    );
    expect(reader).not.toContain("v_registration_count");
    expect(reader).not.toContain("v_guest_count");
    expect(rosterBlock).toContain("lower(btrim(target.display_name))");
    expect(rosterBlock).toContain("and not exists");
    expect(migration).toContain(
      "revoke all on function public.get_event_invitation_by_slug(text, text) from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.get_event_invitation_by_slug(text, text) to anon, authenticated",
    );
  });

  it("keeps token RSVP, reader reload, and invitation rename on the same canonical count", async () => {
    const verifier = (await readFile(guestInvitationVerifierPath, "utf8")).toLowerCase();
    const duplicateResponseAt = verifier.indexOf("duplicatemanualattending.payload.attending_count === 7");
    const duplicateReloadAt = verifier.indexOf(
      "get_event_invitation_by_slug(${slug}, ${tokens.duplicatemanualtoken})",
      duplicateResponseAt,
    );
    const duplicateEqualityAt = verifier.indexOf(
      "same-name rsvp response and reload reader must agree at canonical seven",
      duplicateReloadAt,
    );
    const renameAt = verifier.indexOf(
      "organizer_edit_event_invitation_target(${tokens.duplicatemanualtargetid}",
      duplicateEqualityAt,
    );
    const renamedReloadAt = verifier.indexOf(
      "get_event_invitation_by_slug(${slug}, ${tokens.duplicatemanualtoken})",
      renameAt,
    );
    const renameInvariantAt = verifier.indexOf(
      "invitation rename must not change canonical capacity",
      renamedReloadAt,
    );
    const responseReloadAt = verifier.indexOf(
      "rsvp response and reload reader must agree",
      renameInvariantAt,
    );

    expect(duplicateResponseAt).toBeGreaterThanOrEqual(0);
    expect(duplicateReloadAt).toBeGreaterThan(duplicateResponseAt);
    expect(duplicateEqualityAt).toBeGreaterThan(duplicateReloadAt);
    expect(renameAt).toBeGreaterThan(duplicateEqualityAt);
    expect(renamedReloadAt).toBeGreaterThan(renameAt);
    expect(renameInvariantAt).toBeGreaterThan(renamedReloadAt);
    expect(responseReloadAt).toBeGreaterThan(renameInvariantAt);
    expect(verifier).toContain("attending.payload.attending_count === 8");
    expect(verifier).toContain("aggregate count must match canonical capacity at eight");
    expect(verifier).not.toContain("restore exactly one manual attendee seat");
    expect(verifier).not.toContain("de-duplicated roster at capacity");
  });

  it("verifies split-pool rejection and merge admission", async () => {
    const verifier = (await readFile(manualRosterCapacityVerifierPath, "utf8")).toLowerCase();
    const splitAt = verifier.indexOf("split invite-pool envelope");
    const splitRejectAt = verifier.indexOf("pre-release second invite", splitAt);
    const unchangedAt = verifier.indexOf("rejected invite response must leave usage and target unchanged", splitRejectAt);
    const releaseAt = verifier.indexOf("deadline merge invite envelope", unchangedAt);
    const mergedAt = verifier.indexOf("deadline merge should admit the second invite while total has room", releaseAt);

    expect(splitAt).toBeGreaterThanOrEqual(0);
    expect(splitRejectAt).toBeGreaterThan(splitAt);
    const splitSqlStateAt = verifier.indexOf('"53300"', splitAt);
    expect(splitSqlStateAt).toBeGreaterThan(splitAt);
    expect(splitSqlStateAt).toBeLessThan(splitRejectAt);
    expect(unchangedAt).toBeGreaterThan(splitRejectAt);
    expect(releaseAt).toBeGreaterThan(unchangedAt);
    expect(mergedAt).toBeGreaterThan(releaseAt);
  });

  it("requires a same-name manual seat to block token attending at capacity one", async () => {
    const verifier = (await readFile(manualRosterCapacityVerifierPath, "utf8")).toLowerCase();
    const scenarioAt = verifier.indexOf("same-name identities stay independent");
    const manualAt = verifier.indexOf(
      "await addmanual(tx, conservativeidentityeventid, \"same person\")",
      scenarioAt,
    );
    const rejectLabelAt = verifier.indexOf(
      "same-name invitation must not reuse manual capacity",
      manualAt,
    );
    const rejectStateAt = verifier.lastIndexOf('"53300"', rejectLabelAt);
    const rollbackAt = verifier.indexOf(
      "same-name rejection must leave target pending and usage unchanged",
      rejectLabelAt,
    );

    expect(scenarioAt).toBeGreaterThanOrEqual(0);
    expect(manualAt).toBeGreaterThan(scenarioAt);
    expect(rejectLabelAt).toBeGreaterThan(manualAt);
    expect(rejectStateAt).toBeGreaterThan(manualAt);
    expect(rejectStateAt).toBeLessThan(rejectLabelAt);
    expect(rollbackAt).toBeGreaterThan(rejectLabelAt);
  });

  it("counts same-name held registrations independently and keeps usage stable across renames", async () => {
    const verifier = (await readFile(manualRosterCapacityVerifierPath, "utf8")).toLowerCase();
    const scenarioAt = verifier.indexOf("conservative rename-invariant capacity");
    const firstManualAt = verifier.indexOf(
      "await addmanual(tx, identityrenameeventid, \"duplicate held\")",
      scenarioAt,
    );
    const secondManualAt = verifier.indexOf(
      "await addmanual(tx, identityrenameeventid, \"duplicate held\")",
      firstManualAt + 1,
    );
    const independentAt = verifier.indexOf(
      "same-name held registrations must each consume one seat",
      secondManualAt,
    );
    const manualRenameAt = verifier.indexOf(
      "organizer_edit_manual_participant(${renamefirstmanualid}",
      independentAt,
    );
    const inviteRenameAt = verifier.indexOf(
      "organizer_edit_event_invitation_target(${renametargetid}",
      manualRenameAt,
    );
    const invariantAt = verifier.indexOf(
      "manual and invitation renames must not change capacity usage",
      inviteRenameAt,
    );

    expect(scenarioAt).toBeGreaterThanOrEqual(0);
    expect(firstManualAt).toBeGreaterThan(scenarioAt);
    expect(secondManualAt).toBeGreaterThan(firstManualAt);
    expect(independentAt).toBeGreaterThan(secondManualAt);
    expect(manualRenameAt).toBeGreaterThan(independentAt);
    expect(inviteRenameAt).toBeGreaterThan(manualRenameAt);
    expect(invariantAt).toBeGreaterThan(inviteRenameAt);
  });

  it("subtracts only the invitation on decline without restoring same-name registrations", async () => {
    const verifier = (await readFile(manualRosterCapacityVerifierPath, "utf8")).toLowerCase();
    const scenarioAt = verifier.indexOf("conservative decline keeps registrations visible");
    const firstManualAt = verifier.indexOf(
      "await addmanual(tx, identitydeclineeventid, \"shared label\")",
      scenarioAt,
    );
    const secondManualAt = verifier.indexOf(
      "await addmanual(tx, identitydeclineeventid, \"shared label\")",
      firstManualAt + 1,
    );
    const attendingAt = verifier.indexOf("'attending'", secondManualAt);
    const attendingAssertionAt = verifier.indexOf(
      "same-name attending must count both registrations plus the invitation",
      attendingAt,
    );
    const declinedAt = verifier.indexOf("'declined'", attendingAssertionAt);
    const declinedAssertionAt = verifier.indexOf(
      "decline must subtract only the invitation without restoring hidden registrations",
      declinedAt,
    );

    expect(scenarioAt).toBeGreaterThanOrEqual(0);
    expect(firstManualAt).toBeGreaterThan(scenarioAt);
    expect(secondManualAt).toBeGreaterThan(firstManualAt);
    expect(attendingAt).toBeGreaterThan(secondManualAt);
    expect(attendingAssertionAt).toBeGreaterThan(attendingAt);
    expect(declinedAt).toBeGreaterThan(attendingAssertionAt);
    expect(declinedAssertionAt).toBeGreaterThan(declinedAt);
  });

  it("verifies a two-seat FIFO head blocks a fitting one-seat tail", async () => {
    const verifier = (await readFile(manualRosterCapacityVerifierPath, "utf8")).toLowerCase();
    const scenarioAt = verifier.indexOf("two-seat fifo head blocks one-seat tail");
    const headAt = verifier.indexOf("fifo head two seats", scenarioAt);
    const tailAt = verifier.indexOf("fifo tail one seat", headAt);
    const promoteAt = verifier.indexOf(
      "select public.promote_next_waitlisted_locked(${fifoseatseventid}, 'public')",
      tailAt,
    );
    const assertionAt = verifier.indexOf(
      "a fitting fifo tail must not bypass a non-fitting head",
      promoteAt,
    );

    expect(scenarioAt).toBeGreaterThanOrEqual(0);
    expect(headAt).toBeGreaterThan(scenarioAt);
    expect(tailAt).toBeGreaterThan(headAt);
    expect(promoteAt).toBeGreaterThan(tailAt);
    expect(assertionAt).toBeGreaterThan(promoteAt);
  });

  it("reads back organizer and system promotion actors with real usage snapshots", async () => {
    const verifier = (await readFile(manualRosterCapacityVerifierPath, "utf8")).toLowerCase();
    const organizerActorAt = verifier.indexOf(
      "manual promotion audit actor should be the fixture owner",
    );
    const organizerBeforeAt = verifier.indexOf(
      "manual promotion audit before total should be zero",
      organizerActorAt,
    );
    const organizerAfterAt = verifier.indexOf(
      "manual promotion audit after total should be one",
      organizerBeforeAt,
    );
    const systemScenarioAt = verifier.indexOf("system promotion actor is null", organizerAfterAt);
    const systemActorAt = verifier.indexOf(
      "system promotion audit actor must be null",
      systemScenarioAt,
    );
    const systemUsageAt = verifier.indexOf(
      "system promotion audit must capture zero-to-one usage",
      systemActorAt,
    );
    const systemOutboxAt = verifier.indexOf(
      "system manual promotion must not create an outbox row",
      systemUsageAt,
    );

    expect(organizerActorAt).toBeGreaterThanOrEqual(0);
    expect(organizerBeforeAt).toBeGreaterThan(organizerActorAt);
    expect(organizerAfterAt).toBeGreaterThan(organizerBeforeAt);
    expect(systemScenarioAt).toBeGreaterThan(organizerAfterAt);
    expect(systemActorAt).toBeGreaterThan(systemScenarioAt);
    expect(systemUsageAt).toBeGreaterThan(systemActorAt);
    expect(systemOutboxAt).toBeGreaterThan(systemUsageAt);
  });

  it("separates system and organizer promotion actors while auditing real envelope snapshots", async () => {
    const migration = (await readFile(manualRosterCapacityFixPath, "utf8")).toLowerCase();
    const core = extractSqlFunction(
      migration,
      "create or replace function public.promote_next_waitlisted_locked_core(\n" +
        "  p_event_id uuid,\n" +
        "  p_freed_pool public.seat_pool,\n" +
        "  p_actor_user_id uuid\n" +
        ")",
    );
    const wrapper = extractSqlFunction(
      migration,
      "create or replace function public.promote_next_waitlisted_locked(\n" +
        "  p_event_id uuid,\n" +
        "  p_freed_pool public.seat_pool\n" +
        ")",
    );

    const eventLockAt = core.indexOf("from public.events");
    const envelopeAt = core.indexOf("usage_before := public.event_capacity_usage(p_event_id)");
    const registrationLockAt = core.indexOf("from public.registrations");
    expect(eventLockAt).toBeLessThan(envelopeAt);
    expect(envelopeAt).toBeLessThan(registrationLockAt);
    expect(core).toContain("for update");
    expect(core).toContain("usage_before := public.event_capacity_usage(p_event_id)");
    expect(core).toContain("usage_after := public.event_capacity_usage(p_event_id)");
    expect(core).toContain("usage_before ->> 'merged'");
    expect(core).toContain("usage_before -> 'available' ->> 'total'");
    expect(core).toContain("usage_before -> 'available' ->> p_freed_pool::text");
    expect(core).toContain("'seats', next_reg.seats");
    expect(core).toContain("'seat_pool', next_reg.seat_pool");
    expect(core).toContain("'capacity_usage', usage_before");
    expect(core).toContain("'capacity_usage', usage_after");
    expect(core).toContain("p_actor_user_id");
    expect(core).not.toMatch(/event_row\.capacity\s*[-+*/]/);
    expect(core).not.toContain("invite_reserved_seats");
    expect(wrapper).toContain(
      "perform public.promote_next_waitlisted_locked_core(p_event_id, p_freed_pool, null)",
    );

    for (const [rpc, next] of [
      ["organizer_add_manual_participant", "organizer_edit_manual_participant"],
      ["organizer_edit_manual_participant", "organizer_remove_manual_participant"],
      ["organizer_remove_manual_participant", null],
    ] as const) {
      const start = migration.indexOf(`create or replace function public.${rpc}`);
      const end = next
        ? migration.indexOf(`create or replace function public.${next}`, start)
        : migration.indexOf("revoke all on function public.organizer_add_manual_participant", start);
      const body = migration.slice(start, end);
      expect(body).toContain("promote_next_waitlisted_locked_core");
      expect(body).toContain("v_actor_user_id");
    }
  });

  it("makes manual admission consume the envelope without re-deriving capacity arithmetic", async () => {
    const migration = (await readFile(manualRosterCapacityFixPath, "utf8")).toLowerCase();
    const start = migration.indexOf(
      "create or replace function public.organizer_add_manual_participant",
    );
    const end = migration.indexOf(
      "create or replace function public.organizer_edit_manual_participant",
      start,
    );
    const add = migration.slice(start, end);

    expect(add).toContain("usage_before := public.event_capacity_usage(p_event_id)");
    expect(add).toContain("usage_before ->> 'merged'");
    expect(add).toContain("usage_before -> 'available' ->> 'total'");
    expect(add).toContain("usage_before -> 'available' ->> 'public'");
    expect(add).toContain("promote_next_waitlisted_locked_core");
    expect(add).not.toContain("held_total_seats");
    expect(add).not.toContain("held_pool_seats");
    expect(add).not.toContain("effective_capacity");
    expect(add).not.toMatch(/event_row\.capacity\s*[-+*/]/);
    expect(add).not.toContain("invite_reserved_seats");
  });

  it("routes manual FIFO promotion through the legal waitlisted -> offered -> confirmed state path", async () => {
    const migration = (await readFile(manualRosterCapacityFixPath, "utf8")).toLowerCase();
    const promoteStart = migration.indexOf(
      "create or replace function public.promote_next_waitlisted_locked",
    );
    const promoteEnd = migration.indexOf(
      "create or replace function public.organizer_add_manual_participant",
      promoteStart,
    );
    const promote = migration.slice(promoteStart, promoteEnd);

    expect(promoteStart).toBeGreaterThanOrEqual(0);
    expect(promote).not.toContain(
      "when next_reg.user_id is null then 'confirmed'::public.registration_status",
    );
    expect(promote).toMatch(
      /update\s+public\.registrations[\s\S]+set\s+status\s*=\s*'offered'[\s\S]+if\s+next_reg\.user_id\s+is\s+null\s+then[\s\S]+update\s+public\.registrations[\s\S]+set\s+status\s*=\s*'confirmed'/,
    );
  });

  it("inserts manual rows in a trigger-legal waitlisted state before any held state", async () => {
    const migration = (await readFile(manualRosterCapacityFixPath, "utf8")).toLowerCase();
    const addStart = migration.indexOf(
      "create or replace function public.organizer_add_manual_participant",
    );
    const addEnd = migration.indexOf(
      "create or replace function public.organizer_edit_manual_participant",
      addStart,
    );
    const add = migration.slice(addStart, addEnd);

    expect(addStart).toBeGreaterThanOrEqual(0);
    expect(add).toMatch(
      /insert\s+into\s+public\.registrations[\s\S]+values\s*\([\s\S]+p_event_id\s*,\s*null\s*,\s*'waitlisted'/,
    );
    expect(add).not.toMatch(/p_event_id\s*,\s*null\s*,\s*new_status/);
    expect(add).toMatch(
      /update\s+public\.registrations[\s\S]+set\s+status\s*=\s*'offered'[\s\S]+update\s+public\.registrations[\s\S]+set\s+status\s*=\s*new_status/,
    );
  });

  it("requires both total capacity and the public pool to have room", async () => {
    const migration = (await readFile(manualRosterCapacityFixPath, "utf8")).toLowerCase();
    const addStart = migration.indexOf(
      "create or replace function public.organizer_add_manual_participant",
    );
    const addEnd = migration.indexOf(
      "create or replace function public.organizer_edit_manual_participant",
      addStart,
    );
    const add = migration.slice(addStart, addEnd);

    expect(add).toContain("pool_merged := (usage_before ->> 'merged')::boolean");
    expect(add).toContain("usage_before -> 'available' ->> 'total'");
    expect(add).toContain("usage_before -> 'available' ->> 'public'");
    expect(add).not.toContain("held_total_seats");
    expect(add).not.toContain("held_pool_seats");
    expect(add).not.toContain("effective_capacity");
  });

  it("caps FIFO promotion by total capacity as well as the selected seat pool", async () => {
    const migration = (await readFile(manualRosterCapacityFixPath, "utf8")).toLowerCase();
    const promoteStart = migration.indexOf(
      "create or replace function public.promote_next_waitlisted_locked",
    );
    const promoteEnd = migration.indexOf(
      "create or replace function public.organizer_add_manual_participant",
      promoteStart,
    );
    const promote = migration.slice(promoteStart, promoteEnd);

    expect(promote).toContain("usage_before -> 'available' ->> 'total'");
    expect(promote).toContain("usage_before -> 'available' ->> p_freed_pool::text");
    expect(promote).toContain("next_reg.seats > v_available_seats");
    expect(promote).not.toMatch(/event_row\.capacity\s*[-+*/]/);
    expect(promote).not.toContain("invite_reserved_seats");
  });

  it("queues requested confirmed rows and lets the canonical FIFO helper choose the head", async () => {
    const migration = (await readFile(manualRosterCapacityFixPath, "utf8")).toLowerCase();
    const addStart = migration.indexOf(
      "create or replace function public.organizer_add_manual_participant",
    );
    const addEnd = migration.indexOf(
      "create or replace function public.organizer_edit_manual_participant",
      addStart,
    );
    const add = migration.slice(addStart, addEnd);
    const insertAt = add.indexOf("insert into public.registrations");
    const confirmedBranchAt = add.indexOf("if p_status = 'confirmed' then");
    const promoteAt = add.indexOf("perform public.promote_next_waitlisted_locked", confirmedBranchAt);

    expect(insertAt).toBeGreaterThanOrEqual(0);
    expect(confirmedBranchAt).toBeGreaterThan(insertAt);
    expect(promoteAt).toBeGreaterThan(confirmedBranchAt);
  });

  it("locks the parent event before the manual registration in edit and remove", async () => {
    const migration = (await readFile(manualRosterCapacityFixPath, "utf8")).toLowerCase();

    for (const [rpcName, nextRpcName] of [
      ["organizer_edit_manual_participant", "organizer_remove_manual_participant"],
      ["organizer_remove_manual_participant", null],
    ] as const) {
      const rpcStart = migration.indexOf(`create or replace function public.${rpcName}`);
      const rpcEnd = nextRpcName
        ? migration.indexOf(`create or replace function public.${nextRpcName}`, rpcStart)
        : migration.indexOf("revoke all on function public.organizer_add_manual_participant", rpcStart);
      const rpc = migration.slice(rpcStart, rpcEnd);
      const eventLockAt = rpc.indexOf(
        "select * into event_row from public.events where id = target_event_id for update",
      );
      const registrationLockAt = rpc.indexOf(
        "select * into reg from public.registrations where id = p_registration_id for update",
      );

      expect(rpc).toContain(
        "select event_id into target_event_id from public.registrations where id = p_registration_id",
      );
      expect(eventLockAt).toBeGreaterThanOrEqual(0);
      expect(registrationLockAt).toBeGreaterThan(eventLockAt);
    }
  });

  it("recovers expected SQL failures before resetting the simulated API role", async () => {
    const verifier = (await readFile(manualRosterCapacityVerifierPath, "utf8")).toLowerCase();
    const helperStart = verifier.indexOf("async function expectrolesqlstate");
    const helperEnd = verifier.indexOf("async function insertevent", helperStart);
    const helper = verifier.slice(helperStart, helperEnd);
    const rollbackAt = helper.indexOf("rollback to savepoint manual_roster_expected_failure");
    const resetRoleAt = helper.indexOf("reset role");

    expect(helperStart).toBeGreaterThanOrEqual(0);
    expect(rollbackAt).toBeGreaterThanOrEqual(0);
    expect(resetRoleAt).toBeGreaterThan(rollbackAt);
  });

  it("reads back zero residue after the rollback-only single-connection fixture", async () => {
    const verifier = (await readFile(manualRosterCapacityVerifierPath, "utf8")).toLowerCase();
    const catchAt = verifier.indexOf("} catch (error) {");
    const readbackAt = verifier.indexOf("await assertrollbackzeroresidue()", catchAt);
    const passAt = verifier.indexOf("manual roster capacity rollback verifier: pass", catchAt);

    expect(verifier).toContain("async function assertrollbackzeroresidue()");
    expect(readbackAt).toBeGreaterThan(catchAt);
    expect(passAt).toBeGreaterThan(readbackAt);
  });

  it("provides an aggregate-only conservative capacity preflight with a nonzero hard stop", async () => {
    const verifier = (await readFile(manualRosterCapacityVerifierPath, "utf8")).toLowerCase();
    const helperStart = verifier.indexOf("async function readconservativecapacitypreflight()");
    const helperEnd = verifier.indexOf("\ntry {", helperStart);
    const helper = verifier.slice(helperStart, helperEnd);
    const callAt = verifier.indexOf("await readconservativecapacitypreflight()", helperEnd);
    const fixtureAt = verifier.indexOf("await sql.begin", callAt);

    expect(helperStart).toBeGreaterThanOrEqual(0);
    expect(helper).toContain("select count(*)::integer as over_limit_event_count");
    expect(helper).toContain("registration.status in ('offered', 'pending_organizer_confirmation', 'confirmed')");
    expect(helper).toContain("target.response = 'attending'");
    expect(helper).toContain("event.invite_pool_released_at is null");
    expect(helper).not.toContain("display_name");
    expect(helper).not.toContain("event.slug");
    expect(helper).not.toContain("event.title");
    expect(callAt).toBeGreaterThan(helperEnd);
    expect(fixtureAt).toBeGreaterThan(callAt);
    expect(verifier).toContain("if (overlimiteventcount > 0)");
    expect(verifier).toContain("conservative capacity preflight hard stop");
  });

  it("covers the manual-first invitation response order without overriding the token RPC", async () => {
    const verifier = (await readFile(manualRosterCapacityVerifierPath, "utf8")).toLowerCase();
    const scenarioAt = verifier.indexOf("reverse-order invitation capacity");
    const addAt = verifier.indexOf("await addmanual(tx, reverseinviteeventid", scenarioAt);
    const rejectAt = verifier.indexOf('"53300"', addAt);

    expect(scenarioAt).toBeGreaterThanOrEqual(0);
    expect(addAt).toBeGreaterThan(scenarioAt);
    expect(rejectAt).toBeGreaterThan(addAt);
  });

  it("covers total capacity when attending invitees exceed the reserved invite pool", async () => {
    const verifier = (await readFile(manualRosterCapacityVerifierPath, "utf8")).toLowerCase();
    const scenarioAt = verifier.indexOf("split invite-pool envelope");
    const firstManualAt = verifier.indexOf("await addmanual(tx, poolcapacityeventid", scenarioAt);
    const secondManualAt = verifier.indexOf(
      "await addmanual(tx, poolcapacityeventid",
      firstManualAt + 1,
    );
    const waitlistAssertionAt = verifier.indexOf(
      "public pool must stop at its split limit",
      secondManualAt,
    );

    expect(scenarioAt).toBeGreaterThanOrEqual(0);
    expect(firstManualAt).toBeGreaterThan(scenarioAt);
    expect(secondManualAt).toBeGreaterThan(firstManualAt);
    expect(waitlistAssertionAt).toBeGreaterThan(secondManualAt);
  });

  it("reads back zero residue after committed concurrency fixture cleanup", async () => {
    const verifier = (await readFile(manualRosterConcurrencyVerifierPath, "utf8")).toLowerCase();
    const finallyAt = verifier.indexOf("} finally {\n  try {\n    await cleanup()");
    const cleanupAt = verifier.indexOf("await cleanup()", finallyAt);
    const readbackAt = verifier.indexOf("await assertzeroresidue()", cleanupAt);

    expect(verifier).toContain("async function assertzeroresidue()");
    expect(cleanupAt).toBeGreaterThan(finallyAt);
    expect(readbackAt).toBeGreaterThan(cleanupAt);
  });

  it("preflights exact applied catalog definitions instead of filesystem migration presence", async () => {
    const verifier = (await readFile(manualRosterConcurrencyVerifierPath, "utf8")).toLowerCase();

    expect(verifier).toContain("to_regprocedure('public.event_capacity_usage(uuid)')");
    expect(verifier).toMatch(
      /to_regprocedure\(\s*'public\.promote_next_waitlisted_locked_core\(uuid,public\.seat_pool,uuid\)'\s*\)/,
    );
    expect(verifier).toMatch(
      /to_regprocedure\(\s*'public\.respond_to_event_invitation\(text,text,text\)'\s*\)/,
    );
    expect(verifier).toContain("capacity_definition?.includes(\"'within_limits'\")");
    expect(verifier).toContain("promotion_definition?.includes(\"p_actor_user_id\")");
    expect(verifier).toContain("response_definition?.includes(\"usage_after\")");
    expect(verifier).not.toContain("namespace.nspname = 'public'");
  });

  it("races a manual add against token RSVP without exceeding the shared envelope", async () => {
    const verifier = (await readFile(manualRosterConcurrencyVerifierPath, "utf8")).toLowerCase();
    const scenarioAt = verifier.indexOf("same-seat manual/invite concurrency");
    const raceAt = verifier.indexOf("promise.allsettled", scenarioAt);
    const expectedCapacityAt = verifier.indexOf(
      'inviteresult.reason?.code !== "53300"',
      raceAt,
    );
    const envelopeAt = verifier.indexOf(
      "public.event_capacity_usage(${crosssourceeventid})",
      expectedCapacityAt,
    );
    const limitAt = verifier.indexOf(
      "cross-source race must keep total occupancy at one and within limits",
      envelopeAt,
    );

    expect(scenarioAt).toBeGreaterThanOrEqual(0);
    expect(raceAt).toBeGreaterThan(scenarioAt);
    expect(expectedCapacityAt).toBeGreaterThan(raceAt);
    expect(envelopeAt).toBeGreaterThan(expectedCapacityAt);
    expect(limitAt).toBeGreaterThan(envelopeAt);
    expect(verifier).toContain(
      "delete from public.event_invitation_targets where event_id = ${crosssourceeventid}",
    );
    expect(verifier).not.toContain("retry");
  });

  it("treats every deadlock as a concurrency failure instead of retrying it away", async () => {
    const verifier = (await readFile(manualRosterConcurrencyVerifierPath, "utf8")).toLowerCase();

    expect(verifier).not.toContain("40p01");
    expect(verifier).not.toContain("addwithretry");
    expect(verifier).not.toContain("attemptsleft");
    expect(verifier).toContain("promise.allsettled");
    expect(verifier).toContain('result.status === "rejected"');
  });

  it("emits a fixed safe diagnostic for PostgreSQL class 53 without retaining rejection details", async () => {
    const moduleUrl = pathToFileURL(manualRosterConcurrencyVerifierPath);
    moduleUrl.searchParams.set("contract", String(Date.now()));
    const verifierModule = await import(moduleUrl.href).catch(() => ({}));
    expect(verifierModule.buildSafeConcurrencyDiagnostic).toBeTypeOf("function");

    const diagnostic = verifierModule.buildSafeConcurrencyDiagnostic({
      phase: "manual_race",
      reason: {
        code: "53300",
        message: "SENSITIVE user@example.invalid 00000000-0000-4000-8000-000000000000",
        stack: "SENSITIVE STACK",
        query: "select sensitive",
        parameters: ["SENSITIVE PARAMETER"],
        address: "127.0.0.1",
        port: 59322,
        dsn: "postgresql://sensitive",
      },
      pool: { configured: 10, observed: null, inflight: 2 },
      settled: { manual_f: 4, manual_r: 2, cross_f: 0, cross_r: 0 },
      server: { max: 100, active: 7 },
    });

    expect(diagnostic).toEqual({
      phase: "manual_race",
      pg_code: "53300",
      pg_class: "53",
      pool: { configured: 10, observed: null, inflight: 2 },
      settled: { manual_f: 4, manual_r: 2, cross_f: 0, cross_r: 0 },
      server: { max: 100, active: 7 },
    });
    expect(Object.keys(diagnostic)).toEqual([
      "phase",
      "pg_code",
      "pg_class",
      "pool",
      "settled",
      "server",
    ]);
    expect(JSON.stringify(diagnostic)).not.toMatch(
      /sensitive|message|stack|query|parameters|address|port|dsn|@|00000000-/i,
    );
  });

  it("preserves a nested PostgreSQL code through a phase failure without exposing its cause", async () => {
    const moduleUrl = pathToFileURL(manualRosterConcurrencyVerifierPath);
    moduleUrl.searchParams.set("nested-contract", String(Date.now()));
    const verifierModule = await import(moduleUrl.href);
    const reason = Object.freeze({
      phase: "cross_source_race",
      cause: {
        code: "08006",
        message: "SENSITIVE CONNECTION MESSAGE",
        address: "127.0.0.1",
        port: 59322,
      },
    });

    const diagnostic = verifierModule.buildSafeConcurrencyDiagnostic({
      phase: reason.phase,
      reason,
      pool: { configured: 10, observed: null, inflight: 1 },
      settled: { manual_f: 6, manual_r: 0, cross_f: 1, cross_r: 1 },
      server: { max: 100, active: 8 },
    });

    expect(diagnostic.pg_code).toBe("08006");
    expect(diagnostic.pg_class).toBe("08");
    expect(JSON.stringify(diagnostic)).not.toMatch(/sensitive|message|address|port|127\.0\.0\.1/i);
  });

  it("wraps immutable data-flow phases and records only aggregate settled outcomes", async () => {
    const verifier = await readFile(manualRosterConcurrencyVerifierPath, "utf8");
    const lowerVerifier = verifier.toLowerCase();

    expect(verifier).toContain("class ConcurrencyPhaseFailure extends Error");
    expect(verifier).toContain('super("CONCURRENCY_PHASE_FAILURE", { cause })');
    expect(verifier).toContain('const INTERNAL_PHASE = Symbol("concurrency.phase")');
    expect(verifier).toMatch(
      /Object\.defineProperty\(this, INTERNAL_PHASE, \{[\s\S]*?writable: false,[\s\S]*?configurable: false/,
    );
    expect(verifier).toContain("this.code = readPostgresCode(cause)");
    expect(verifier).toContain("async function runConcurrencyPhase(phase, operation)");
    for (const phase of [
      "preflight",
      "fixture_setup",
      "manual_race",
      "cross_source_race",
      "readback",
      "cleanup",
    ]) {
      expect(verifier).toContain(`runConcurrencyPhase("${phase}"`);
    }

    expect(verifier).toContain("function recordSettled(kind, results)");
    expect(verifier).toContain('recordSettled("manual", results)');
    expect(verifier).toContain('recordSettled("cross", [manualResult, inviteResult])');
    expect(lowerVerifier).not.toContain("reason?.message");
    expect(lowerVerifier).not.toContain("reason.message");
  });

  it("limits connection diagnostics to aggregate pool and server telemetry in one JSON line", async () => {
    const verifier = await readFile(manualRosterConcurrencyVerifierPath, "utf8");
    const poolAt = verifier.indexOf("const poolState = {");
    const inflightAt = verifier.indexOf("async function withInflight(operation)", poolAt);
    const incrementAt = verifier.indexOf("poolState.inflight += 1", inflightAt);
    const tryAt = verifier.indexOf("try {", incrementAt);
    const finallyAt = verifier.indexOf("finally {", tryAt);
    const decrementAt = verifier.indexOf("poolState.inflight -= 1", finallyAt);
    const serverAt = verifier.indexOf("async function readServerAggregate()");
    const serverEnd = verifier.indexOf("\n  }", serverAt);
    const serverHelper = verifier.slice(serverAt, serverEnd);

    expect(poolAt).toBeGreaterThanOrEqual(0);
    expect(verifier.slice(poolAt, inflightAt)).toContain("configured: POOL_MAX");
    expect(verifier.slice(poolAt, inflightAt)).toContain("observed: null");
    expect(incrementAt).toBeGreaterThan(inflightAt);
    expect(tryAt).toBeGreaterThan(incrementAt);
    expect(finallyAt).toBeGreaterThan(tryAt);
    expect(decrementAt).toBeGreaterThan(finallyAt);
    expect(verifier).toContain("return withInflight(() => asOwner");
    expect(verifier).toContain("return withInflight(() => asAnonymous");

    expect(serverAt).toBeGreaterThanOrEqual(0);
    expect(serverHelper).toContain("show max_connections");
    expect(serverHelper).toContain("count(*)::integer as active");
    expect(serverHelper).toContain("from pg_stat_activity");
    expect(serverHelper).not.toMatch(/pid|usename|query|client_addr|application_name/i);
    expect(verifier).toContain('const INTERNAL_TELEMETRY = Symbol("concurrency.telemetry")');
    expect(verifier).toContain("const diagnostic = buildSafeTopLevelDiagnostic(error)");
    expect(verifier).not.toContain("error?.safeDiagnostic");
    expect(verifier).toContain('process.stderr.write(`${JSON.stringify(diagnostic)}\\n`)');
    expect(verifier).not.toMatch(/console\.error\([^)]*(?:error|reason|cause)/i);
    expect(verifier).not.toMatch(/process\.stderr\.write\([^)]*(?:message|stack|query|parameters)/i);
  });

  it("keeps unavailable diagnostic counters null instead of inventing zero", async () => {
    const moduleUrl = pathToFileURL(manualRosterConcurrencyVerifierPath);
    moduleUrl.searchParams.set("null-contract", String(Date.now()));
    const verifierModule = await import(moduleUrl.href);
    const diagnostic = verifierModule.buildSafeConcurrencyDiagnostic({
      phase: "bootstrap",
      reason: {},
      pool: { configured: null, observed: null, inflight: null },
      settled: { manual_f: null, manual_r: null, cross_f: null, cross_r: null },
      server: { max: null, active: null },
    });

    expect(diagnostic.pool).toEqual({ configured: null, observed: null, inflight: null });
    expect(diagnostic.settled).toEqual({
      manual_f: null,
      manual_r: null,
      cross_f: null,
      cross_r: null,
    });
    expect(diagnostic.server).toEqual({ max: null, active: null });
  });

  it("rebuilds top-level diagnostics from an internal phase token and ignores spoofed fields", async () => {
    const moduleUrl = pathToFileURL(manualRosterConcurrencyVerifierPath);
    moduleUrl.searchParams.set("sink-contract", String(Date.now()));
    const verifierModule = await import(moduleUrl.href);
    expect(verifierModule.runConcurrencyPhase).toBeTypeOf("function");
    expect(verifierModule.buildSafeTopLevelDiagnostic).toBeTypeOf("function");

    const fakeCause = Object.assign(new Error("SENSITIVE STACK AND MESSAGE"), {
      code: "53300",
      phase: "cross_source_race",
      query: "select sensitive",
      safeDiagnostic: {
        phase: "manual_race",
        host: "sensitive.internal",
        token: "SECRET_TOKEN",
        password: "SECRET_PASSWORD",
        uuid: "00000000-0000-4000-8000-000000000000",
        email: "user@example.invalid",
        query: "select sensitive",
        stack: "SENSITIVE STACK",
      },
    });
    let wrappedFailure;
    try {
      await verifierModule.runConcurrencyPhase("preflight", async () => {
        throw fakeCause;
      });
    } catch (error) {
      wrappedFailure = error;
    }

    const diagnostic = verifierModule.buildSafeTopLevelDiagnostic(wrappedFailure);
    expect(diagnostic).toEqual({
      phase: "preflight",
      pg_code: "53300",
      pg_class: "53",
      pool: { configured: null, observed: null, inflight: null },
      settled: { manual_f: null, manual_r: null, cross_f: null, cross_r: null },
      server: { max: null, active: null },
    });
    expect(Object.keys(diagnostic)).toEqual([
      "phase",
      "pg_code",
      "pg_class",
      "pool",
      "settled",
      "server",
    ]);
    expect(JSON.stringify(diagnostic)).not.toMatch(
      /sensitive|safeDiagnostic|host|token|password|uuid|email|query|stack|@|00000000-/i,
    );
  });

  it("never mutates managed auth identities and requires explicit local fixture identities", async () => {
    for (const verifierPath of [
      manualRosterCapacityVerifierPath,
      manualRosterConcurrencyVerifierPath,
      guestInvitationVerifierPath,
    ]) {
      const verifier = (await readFile(verifierPath, "utf8")).toLowerCase();

      expect(verifier).not.toMatch(/\b(?:insert\s+into|update|delete\s+from)\s+auth\.users\b/);
      expect(verifier).not.toMatch(/\b(?:insert\s+into|update|delete\s+from)\s+public\.users\b/);
      expect(verifier).toContain("gather_join_test_owner_user_id");
      expect(verifier).toContain("existing local dedicated fixture identity");
    }

    const guestVerifier = (await readFile(guestInvitationVerifierPath, "utf8")).toLowerCase();
    const ownerEnvAt = guestVerifier.indexOf(
      "const ownerid = process.env.gather_join_test_owner_user_id",
    );
    const memberEnvAt = guestVerifier.indexOf(
      "const memberid = process.env.gather_join_test_member_user_id",
    );
    const clientAt = guestVerifier.indexOf("const sql = postgres(databaseurl");
    const identityPreflightAt = guestVerifier.indexOf("const [fixtureidentities] = await sql`");
    const fixtureScopeAt = guestVerifier.indexOf("await sql.begin", identityPreflightAt);
    const identityPreflight = guestVerifier.slice(identityPreflightAt, fixtureScopeAt);

    expect(ownerEnvAt).toBeGreaterThanOrEqual(0);
    expect(memberEnvAt).toBeGreaterThan(ownerEnvAt);
    expect(clientAt).toBeGreaterThan(memberEnvAt);
    expect(guestVerifier.slice(0, clientAt)).toContain("refusing a non-local guest invitation verifier database");
    expect(guestVerifier.slice(0, clientAt)).toContain("if (ownerid === memberid)");
    expect(identityPreflightAt).toBeGreaterThan(clientAt);
    expect(identityPreflight).toContain("join public.users app_user on app_user.id = auth_user.id");
    expect(identityPreflight).toContain("where auth_user.id in (${ownerid}, ${memberid})");
    expect(identityPreflight).toContain("identity_count !== 2");
    expect(identityPreflight).toContain("isolated local fixture identities");
    expect(identityPreflight).not.toContain("limit 1");
  });

  it("uses an explicit authenticated non-organizer identity for manual roster denial", async () => {
    const verifier = (await readFile(manualRosterCapacityVerifierPath, "utf8")).toLowerCase();
    const ownerEnvAt = verifier.indexOf(
      "const ownerid = process.env.gather_join_test_owner_user_id",
    );
    const nonOrganizerEnvAt = verifier.indexOf(
      "const nonorganizerid = process.env.gather_join_test_member_user_id",
    );
    const clientAt = verifier.indexOf("const sql = postgres(databaseurl");
    const identityPreflightAt = verifier.indexOf("const [fixtureidentities] = await sql`");
    const fixtureScopeAt = verifier.indexOf("await sql.begin", identityPreflightAt);
    const identityPreflight = verifier.slice(identityPreflightAt, fixtureScopeAt);
    const membershipAt = verifier.indexOf("insert into public.organizer_members", fixtureScopeAt);
    const firstEventAt = verifier.indexOf("await insertevent", membershipAt);
    const membershipFixture = verifier.slice(membershipAt, firstEventAt);
    const nonOrganizerDenialAt = verifier.indexOf(
      '"authenticated",\n      nonorganizerid,',
      firstEventAt,
    );

    expect(ownerEnvAt).toBeGreaterThanOrEqual(0);
    expect(nonOrganizerEnvAt).toBeGreaterThan(ownerEnvAt);
    expect(clientAt).toBeGreaterThan(nonOrganizerEnvAt);
    expect(verifier.slice(0, clientAt)).toContain("if (ownerid === nonorganizerid)");
    expect(identityPreflightAt).toBeGreaterThan(clientAt);
    expect(identityPreflight).toContain("join auth.users auth_user on auth_user.id = app_user.id");
    expect(identityPreflight).toContain("where auth_user.id in (${ownerid}, ${nonorganizerid})");
    expect(identityPreflight).toContain("identity_count !== 2");
    expect(identityPreflight).toContain("isolated local fixture identities");
    expect(membershipFixture).toContain("${ownerid}");
    expect(membershipFixture).not.toContain("${nonorganizerid}");
    expect(nonOrganizerDenialAt).toBeGreaterThan(firstEventAt);
    expect(verifier.slice(nonOrganizerDenialAt)).toContain("authenticated non-organizer manual add");
    expect(verifier).not.toContain("staffid");
    expect(verifier).not.toContain("staff manual add");
  });

  it("reads back guest invitation zero residue after the rollback fixture", async () => {
    const verifier = (await readFile(guestInvitationVerifierPath, "utf8")).toLowerCase();
    const helperStart = verifier.indexOf("async function assertrollbackzeroresidue()");
    const helperEnd = verifier.indexOf("\ntry {", helperStart);
    const helper = verifier.slice(helperStart, helperEnd);
    const catchAt = verifier.lastIndexOf("} catch (error) {");
    const readbackAt = verifier.indexOf("await assertrollbackzeroresidue()", catchAt);
    const passAt = verifier.indexOf(
      "guest invitation rollback zero-residue verifier: pass",
      readbackAt,
    );

    expect(helperStart).toBeGreaterThanOrEqual(0);
    for (const table of [
      "public.organizers",
      "public.organizer_members",
      "public.events",
      "public.registrations",
      "public.event_invitation_targets",
      "public.audit_logs",
      "public.outbox_events",
    ]) {
      expect(helper).toContain(`from ${table}`);
    }
    expect(helper).toContain("where id = ${organizerid}");
    expect(helper).toContain("where id = ${eventid} or id = ${othereventid}");
    expect(helper).toContain("where event_id = ${eventid} or event_id = ${othereventid}");
    expect(helper).toContain("rollback left ${count} fixture row(s) in ${table}");
    expect(readbackAt).toBeGreaterThan(catchAt);
    expect(passAt).toBeGreaterThan(readbackAt);
  });

  it("audits normalized manual names, actor identity, and actual capacity snapshots", async () => {
    const migration = (await readFile(manualRosterCapacityFixPath, "utf8")).toLowerCase();
    const addStart = migration.indexOf(
      "create or replace function public.organizer_add_manual_participant",
    );
    const addEnd = migration.indexOf(
      "create or replace function public.organizer_edit_manual_participant",
      addStart,
    );
    const add = migration.slice(addStart, addEnd);
    const editEnd = migration.indexOf(
      "create or replace function public.organizer_remove_manual_participant",
      addEnd,
    );
    const edit = migration.slice(addEnd, editEnd);
    const verifier = (await readFile(manualRosterCapacityVerifierPath, "utf8")).toLowerCase();

    expect(add).toContain("normalized_display_name text := btrim(coalesce(p_display_name, ''))");
    expect(add).toContain("returning * into new_reg");
    expect(add).toContain("'display_name', new_reg.manual_display_name");
    expect(edit).toContain("normalized_display_name text := nullif(btrim(coalesce(p_display_name, '')), '')");
    expect(edit).toContain("returning * into after_reg");
    expect(verifier).toContain('"  manual a  "');
    expect(verifier).toContain('"manual a"');
    expect(verifier).toContain('"  edited head  "');
    expect(verifier).toContain('"edited head"');
    expect(verifier).toContain("manual add row should store normalized manual a");
    expect(verifier).toContain("manual add audit should store normalized manual a");
    expect(verifier).toContain("manual edit row should store normalized edited head");
    expect(verifier).toContain("manual edit audit should store normalized edited head");
    expect(verifier).toContain("manual add audit actor");
    expect(verifier).toContain("manual add audit before total");
    expect(verifier).toContain("manual add audit after total");
    expect(verifier).toContain("manual edit audit actor");
    expect(verifier).toContain("manual edit audit before total");
    expect(verifier).toContain("manual edit audit after total");
  });

  it("fails closed on invalid or unsafe concurrency dimensions before opening the database", async () => {
    const verifier = (await readFile(manualRosterConcurrencyVerifierPath, "utf8")).toLowerCase();
    const parserAt = verifier.indexOf("function parsestrictpositiveinteger");
    const dimensionsAt = verifier.indexOf("const n = parsestrictpositiveinteger");
    const clientAt = verifier.indexOf("const sql = postgres");

    expect(parserAt).toBeGreaterThanOrEqual(0);
    expect(verifier).toContain("/^[1-9]\\d*$/");
    expect(verifier).toContain("number.issafeinteger");
    expect(verifier).toContain("const max_capacity = 50");
    expect(verifier).toContain("const max_racers = 100");
    expect(verifier).toContain("if (capacity > max_capacity)");
    expect(verifier).toContain("if (n <= capacity)");
    expect(verifier).toContain("if (n > max_racers)");
    expect(dimensionsAt).toBeGreaterThan(parserAt);
    expect(clientAt).toBeGreaterThan(dimensionsAt);
  });

  it("recomputes manual audit capacity usage before and after each mutation", async () => {
    const migration = (await readFile(manualRosterCapacityFixPath, "utf8")).toLowerCase();

    for (const [rpcName, nextMarker] of [
      ["organizer_add_manual_participant", "create or replace function public.organizer_edit_manual_participant"],
      ["organizer_edit_manual_participant", "create or replace function public.organizer_remove_manual_participant"],
      ["organizer_remove_manual_participant", "revoke all on function public.organizer_add_manual_participant"],
    ] as const) {
      const rpcStart = migration.indexOf(`create or replace function public.${rpcName}`);
      const rpcEnd = migration.indexOf(nextMarker, rpcStart);
      const rpc = migration.slice(rpcStart, rpcEnd);

      expect(rpc).toContain("usage_before := public.event_capacity_usage");
      expect(rpc).toContain("usage_after := public.event_capacity_usage");
      expect(rpc).toContain("'capacity_usage', usage_before");
      expect(rpc).toContain("'capacity_usage', usage_after");
      expect(rpc.indexOf("usage_after := public.event_capacity_usage")).toBeGreaterThan(
        rpc.indexOf("update public.registrations"),
      );
    }
  });

  it("keeps manual roster writes on the canonical event lock, capacity, and FIFO path", async () => {
    const migration = (await readFile(manualRosterCapacityFixPath, "utf8")).toLowerCase();

    expect(manualRosterCapacityFixPath).toMatch(
      /supabase\/migrations\/20260815060000_manual_roster_capacity_seat_engine_fix\.sql$/,
    );
    expect(migration).toContain("create or replace function public.emit_registration_event(");
    expect(migration).toContain("if p_recipient_user_id is not null then");
    expect(migration).toContain("create or replace function public.promote_next_waitlisted_locked");
    expect(migration).toContain("if next_reg.user_id is null then");

    for (const rpcName of [
      "organizer_add_manual_participant",
      "organizer_edit_manual_participant",
      "organizer_remove_manual_participant",
    ]) {
      const rpcStart = migration.indexOf(`create or replace function public.${rpcName}`);
      const nextRpcStart = migration.indexOf("create or replace function public.", rpcStart + 1);
      const rpc = migration.slice(rpcStart, nextRpcStart === -1 ? undefined : nextRpcStart);

      expect(rpcStart).toBeGreaterThanOrEqual(0);
      expect(rpc).toContain("security definer");
      expect(rpc).toContain("set search_path = pg_catalog, public, extensions");
      expect(rpc).toContain("is_organizer_admin");
      expect(rpc).toContain("for update");
      expect(rpc).toContain("sweep_event_locked");
      expect(rpc).toContain("event_capacity_usage");
      expect(rpc).toContain("insert into public.audit_logs");
      expect(rpc).not.toContain("insert into public.outbox_events");
    }

    expect(migration).toContain("perform public.promote_next_waitlisted_locked");
    expect(migration).toContain("order by waitlisted_at, id");
    expect(migration).toContain("manual waitlisted participant is not eligible for confirmation");
    expect(migration).toContain("revoke all on function public.organizer_add_manual_participant");
    expect(migration).toContain("grant execute on function public.organizer_add_manual_participant");
    expect(migration).not.toMatch(/\b(drop|truncate|delete)\s+/);
    expect(migration).not.toMatch(/alter\s+table\s+public\.events\s+disable\s+row\s+level\s+security/);
  });
});
