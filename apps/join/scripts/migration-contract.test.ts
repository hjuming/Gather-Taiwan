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
