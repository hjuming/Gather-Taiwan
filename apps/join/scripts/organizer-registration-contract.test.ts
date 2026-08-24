import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260805210000_p1_06_08_seat_engine.sql",
);
const wave2MigrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260824130743_organizer_online_registration_idempotency.sql",
);

function functionSection(sql: string, header: string, nextHeader: string): string {
  const start = sql.indexOf(header);
  const end = sql.indexOf(nextHeader, start + header.length);
  if (start < 0 || end < 0) throw new Error(`missing organizer function section: ${header}`);
  return sql.slice(start, end);
}

function functionSectionToEnd(sql: string, header: string): string {
  const start = sql.indexOf(header);
  if (start < 0) throw new Error(`missing organizer function section: ${header}`);
  return sql.slice(start);
}

describe("organizer online registration RPC contract", () => {
  it("keeps the three RPCs authenticated, organizer-admin-only, locked, and audited", async () => {
    await readFile(migrationPath, "utf8");
    const migration = await readFile(wave2MigrationPath, "utf8");
    const confirm = functionSection(
      migration,
      "create function public.organizer_confirm_registration",
      "create function public.organizer_decline_registration",
    );
    const decline = functionSection(
      migration,
      "create function public.organizer_decline_registration",
      "create function public.organizer_remove_registration",
    );
    const remove = functionSectionToEnd(
      migration,
      "create function public.organizer_remove_registration",
    );

    for (const section of [confirm, decline, remove]) {
      expect(section).toContain("language plpgsql");
      expect(section).toContain("security definer");
      expect(section).toContain("public.is_organizer_admin");
      expect(section).toContain("from public.events where id = reg.event_id for update");
      expect(section).toContain("perform public.sweep_event_locked(reg.event_id)");
    expect(section).toContain("perform public.emit_registration_event");
    expect(section).toContain("actor_user_id");
    expect(section).toContain("reg.user_id is null");
    expect(section).toContain("p_idempotency_key");
    expect(section).toContain("public.idempotency_requests");
  }

    expect(migration).toContain("drop function public.organizer_confirm_registration(uuid)");
    expect(migration).toContain("drop function public.organizer_decline_registration(uuid)");
    expect(migration).toContain("drop function public.organizer_remove_registration(uuid, text)");
    expect(migration).toContain("grant execute on function public.organizer_confirm_registration(uuid, text) to authenticated");
    expect(migration).toContain("grant execute on function public.organizer_decline_registration(uuid, text) to authenticated");
    expect(migration).toContain("grant execute on function public.organizer_remove_registration(uuid, text, text) to authenticated");
    expect(migration).toContain("'registration.organizer_confirmed'");
    expect(migration).toContain("'registration.organizer_declined'");
    expect(migration).toContain("'registration.removed_by_organizer'");
  });

  it("keeps replay behavior explicit and key-based idempotency scoped to the new overloads", async () => {
    await readFile(migrationPath, "utf8");
    const migration = await readFile(wave2MigrationPath, "utf8");
    const confirm = functionSection(
      migration,
      "create function public.organizer_confirm_registration",
      "create function public.organizer_decline_registration",
    );
    const decline = functionSection(
      migration,
      "create function public.organizer_decline_registration",
      "create function public.organizer_remove_registration",
    );
    const remove = functionSectionToEnd(
      migration,
      "create function public.organizer_remove_registration",
    );

    expect(confirm).toContain("if reg.status <> 'pending_organizer_confirmation' then");
    expect(decline).toContain("if reg.status <> 'pending_organizer_confirmation' then");
    expect(remove).toContain("if reg.status not in ('offered', 'pending_organizer_confirmation', 'confirmed', 'waitlisted') then");
    expect(remove).toContain("return;");
    expect([confirm, decline, remove].join("\n")).toContain("p_idempotency_key");
    expect([confirm, decline, remove].join("\n")).toContain("idempotency_requests");
    expect([confirm, decline, remove].join("\n")).toContain("idempotency key reused with a different request");
  });
});
