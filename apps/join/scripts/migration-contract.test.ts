import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
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
const guestInvitationVerifierPath = resolve(process.cwd(), "scripts/verify-guest-invitations.mjs");

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

  it("only deduplicates a registration against an invitee who is actually attending", async () => {
    const migration = (await readFile(canonicalSeatEngineHardeningPath, "utf8")).toLowerCase();
    const responseStart = migration.indexOf("create or replace function public.respond_to_event_invitation(");
    const responseEnd = migration.indexOf("create function public.update_event_capacity_settings(");
    const response = migration.slice(responseStart, responseEnd);

    expect(migration).toContain("and target.response = 'attending'");
    expect(responseStart).toBeGreaterThanOrEqual(0);
    expect(response).toContain("p_invitee_token text");
    expect(response).toContain("p_response text");
    expect(response).not.toContain("p_display_name");
    expect(response.match(/and target\.response = 'attending'/g)?.length).toBeGreaterThanOrEqual(2);
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
