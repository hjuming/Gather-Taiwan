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
