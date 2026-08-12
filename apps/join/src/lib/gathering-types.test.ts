import { describe, expect, it } from "vitest";
import { COVER_IMAGE_CHOICES, GATHERING_TYPES, getGatheringType } from "./gathering-types";

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
});
