import { describe, expect, it } from "vitest";
import { COVER_IMAGE_CHOICES, GATHERING_TYPES, getGatheringType, resolveCoverImage } from "./gathering-types";

describe("gathering type choices", () => {
  it("includes a general friends dinner category without removing legacy scenes", () => {
    expect(getGatheringType("friends_dinner").label).toBe("朋友聚餐");
    expect(getGatheringType("rechao").label).toBe("熱炒聚會");
  });

  it("keeps the cover picker free of duplicate images", () => {
    expect(COVER_IMAGE_CHOICES.length).toBe(
      new Set(GATHERING_TYPES.map((type) => type.image)).size,
    );
  });

  it("versions saved custom covers so a cached failed response cannot persist", () => {
    const cover = "https://anklbpkyesdmsubyfcna.supabase.co/storage/v1/object/public/gather-event-covers/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg";
    expect(resolveCoverImage({ cover_image_url: cover, updated_at: "2026-08-13T00:25:33.647Z" })).toBe(
      `${cover}?v=2026-08-13T00%3A25%3A33.647Z`,
    );
  });
});
