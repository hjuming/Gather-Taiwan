import { describe, expect, it } from "vitest";
import { createEventSlug, createSlug, slugify } from "./slug";

describe("slug helpers", () => {
  it("removes non-ASCII characters instead of generating an invalid slug", () => {
    expect(slugify("泰山高中同學會")).toBe("");
    expect(slugify("EiMBA 傳承聚")).toBe("eimba");
  });

  it("uses an ASCII fallback and respects organizer/event limits", () => {
    const organizerSlug = createSlug("泰山高中同學會", "organizer", 63);
    const eventSlug = createSlug("115 屆新生訓練迎新晚會", "event", 95);

    expect(organizerSlug).toMatch(/^[a-z0-9][a-z0-9-]{1,62}$/);
    expect(eventSlug).toMatch(/^[a-z0-9][a-z0-9-]{2,94}$/);
  });

  it("keeps the event date visible in shared event slugs", () => {
    expect(createEventSlug("泰山高中同學會", "2026-08-17", 95)).toMatch(/^event-20260817-[a-z0-9]{4}$/);
  });
});
