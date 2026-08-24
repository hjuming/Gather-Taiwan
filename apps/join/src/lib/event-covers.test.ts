import { describe, expect, it } from "vitest";
import { isAllowedEventCoverUrl } from "../../shared/event-cover-policy";
import { EVENT_COVER_MAX_BYTES } from "./event-cover-validation";
import { validateEventCoverFile } from "./event-cover-validation";

const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("event cover upload policy", () => {
  it("accepts a PNG whose bytes match its declared MIME type", async () => {
    const file = new File([PNG_HEADER], "cover.jpg", { type: "image/png" });

    await expect(validateEventCoverFile(file)).resolves.toBeNull();
  });

  it("rejects a MIME-spoofed file before upload", async () => {
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "cover.png", { type: "image/png" });

    await expect(validateEventCoverFile(file)).resolves.toContain("格式與內容不一致");
  });

  it("does not treat inherited object properties as supported MIME types", async () => {
    const file = new File([PNG_HEADER], "cover", { type: "toString" });

    await expect(validateEventCoverFile(file)).resolves.toContain("請使用 JPG、PNG 或 WebP");
  });

  it("rejects files over the public bucket limit", async () => {
    const file = new File([new Uint8Array(EVENT_COVER_MAX_BYTES + 1)], "cover.png", { type: "image/png" });

    await expect(validateEventCoverFile(file)).resolves.toContain("小於 5 MB");
  });

  it("allows only the fixed public Storage URL shape", () => {
    expect(isAllowedEventCoverUrl(
      "https://anklbpkyesdmsubyfcna.supabase.co/storage/v1/object/public/gather-event-covers/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.webp",
    )).toBe(true);
    expect(isAllowedEventCoverUrl("https://evil.example/cover.webp")).toBe(false);
    expect(isAllowedEventCoverUrl("/uploads/../private.webp")).toBe(false);
  });
});
