import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260805210000_p1_06_08_seat_engine.sql",
);

function functionSection(sql: string, header: string, nextHeader: string): string {
  const start = sql.indexOf(header);
  const end = sql.indexOf(nextHeader, start + header.length);
  if (start < 0 || end < 0) throw new Error(`missing organizer function section: ${header}`);
  return sql.slice(start, end);
}

describe("organizer online registration RPC contract", () => {
  it("keeps the three RPCs authenticated, organizer-admin-only, locked, and audited", async () => {
    const migration = await readFile(migrationPath, "utf8");
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
    const remove = functionSection(
      migration,
      "create function public.organizer_remove_registration",
      "create function public.organizer_block_participant",
    );

    for (const section of [confirm, decline, remove]) {
      expect(section).toContain("language plpgsql");
      expect(section).toContain("security definer");
      expect(section).toContain("public.is_organizer_admin");
      expect(section).toContain("from public.events where id = reg.event_id for update");
      expect(section).toContain("perform public.sweep_event_locked(reg.event_id)");
      expect(section).toContain("perform public.emit_registration_event");
      expect(section).toContain("actor_user_id");
    }

    expect(migration).toContain("grant execute on function public.organizer_confirm_registration(uuid) to authenticated");
    expect(migration).toContain("grant execute on function public.organizer_decline_registration(uuid) to authenticated");
    expect(migration).toContain("grant execute on function public.organizer_remove_registration(uuid, text) to authenticated");
    expect(migration).toContain("'registration.organizer_confirmed'");
    expect(migration).toContain("'registration.organizer_declined'");
    expect(migration).toContain("'registration.removed_by_organizer'");
  });

  it("keeps replay behavior explicit and does not imply key-based idempotency", async () => {
    const migration = await readFile(migrationPath, "utf8");
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
    const remove = functionSection(
      migration,
      "create function public.organizer_remove_registration",
      "create function public.organizer_block_participant",
    );

    expect(confirm).toContain("if reg.status <> 'pending_organizer_confirmation' then");
    expect(decline).toContain("if reg.status <> 'pending_organizer_confirmation' then");
    expect(remove).toContain("if reg.status not in ('offered', 'pending_organizer_confirmation', 'confirmed', 'waitlisted') then");
    expect(remove).toContain("return;");
    expect([confirm, decline, remove].join("\n")).not.toContain("p_idempotency_key");
    expect([confirm, decline, remove].join("\n")).not.toContain("idempotency_requests");
  });
});
