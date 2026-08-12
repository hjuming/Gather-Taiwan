import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "..");
const deleteMigration = resolve(appRoot, "supabase/migrations/20260812165049_permanently_delete_event.sql");
const duplicateMigration = resolve(appRoot, "supabase/migrations/20260812165241_duplicate_event.sql");
const futureMigration = resolve(appRoot, "supabase/migrations/20260812165505_prevent_past_event_creation.sql");

describe("event lifecycle migration contracts", () => {
  it("keeps permanent deletion owner/admin-only, audited and explicit", async () => {
    const migration = (await readFile(deleteMigration, "utf8")).toLowerCase();
    expect(migration).toContain("create function public.delete_event_permanently");
    expect(migration).toContain("security definer");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("is_organizer_admin");
    expect(migration).toContain("event.deleted_permanently");
    expect(migration).toContain("delete from public.notifications");
    expect(migration).toContain("delete from public.outbox_events");
    expect(migration).toContain("delete from public.registration_answers");
    expect(migration).toContain("delete from public.registrations");
    expect(migration).toContain("delete from public.event_invitees");
    expect(migration).toContain("delete from public.event_fields");
    expect(migration).toContain("delete from public.events");
    expect(migration).toContain("revoke all on function public.delete_event_permanently");
    expect(migration).toContain("grant execute on function public.delete_event_permanently");
    expect(migration).not.toContain("drop table");
    expect(migration).not.toContain("truncate");
  });

  it("copies only safe repeat-event inputs and creates a fresh future event", async () => {
    const migration = (await readFile(duplicateMigration, "utf8")).toLowerCase();
    expect(migration).toContain("create function public.duplicate_event");
    expect(migration).toContain("security definer");
    expect(migration).toContain("is_organizer_admin");
    expect(migration).toContain("p_starts_at <= statement_timestamp()");
    expect(migration).toContain("event must be cancelled or completed");
    expect(migration).toContain("'published'");
    expect(migration).toContain("insert into public.event_fields");
    expect(migration).toContain("invitee_type = 'verified_email'");
    expect(migration).toContain("pending_organizer_confirmation");
    expect(migration).toContain("v_source.confirmation_mode = 'organizer_confirmed'");
    expect(migration).toContain("else 'confirmed'::public.registration_status");
    expect(migration).toContain("event.duplicated");
    expect(migration).not.toContain("one_time_token");
    expect(migration).not.toContain("registration_answers");
    expect(migration).toContain("revoke all on function public.duplicate_event");
    expect(migration).toContain("grant execute on function public.duplicate_event");
  });

  it("blocks only newly inserted events whose start is in the past", async () => {
    const migration = (await readFile(futureMigration, "utf8")).toLowerCase();
    expect(migration).toContain("before insert on public.events");
    expect(migration).toContain("new.starts_at <= statement_timestamp()");
    expect(migration).toContain("new events must start in the future");
    expect(migration).not.toContain("before update");
  });
});
