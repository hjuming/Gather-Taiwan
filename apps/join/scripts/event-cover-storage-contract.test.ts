import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260812123918_p2_04_event_cover_storage.sql",
);

describe("event cover Storage migration contract", () => {
  it("keeps public reads and organizer-only writes explicit", async () => {
    const migration = (await readFile(migrationPath, "utf8")).toLowerCase();

    expect(migration).toContain("'gather-event-covers'");
    expect(migration).toContain("true,");
    expect(migration).toContain("5242880");
    expect(migration).toContain("array['image/jpeg', 'image/png', 'image/webp']");
    expect(migration).toMatch(/create policy gather_event_covers_insert[\s\S]+for insert[\s\S]+to authenticated/);
    expect(migration).toMatch(/create policy gather_event_covers_select[\s\S]+for select[\s\S]+to authenticated/);
    expect(migration).toMatch(/create policy gather_event_covers_delete[\s\S]+for delete[\s\S]+to authenticated/);
    expect(migration).toContain("drop constraint event_cover_image_url_internal");
    expect(migration).not.toContain("drop constraint if exists event_cover_image_url_internal");
    expect(migration).not.toContain("service_role");
  });
});
