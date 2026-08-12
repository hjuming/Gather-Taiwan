import { describe, expect, it } from "vitest";
import {
  getGuestInvitationStorageKey,
  normalizeGuestDisplayName,
  type GuestInvitationResponse,
} from "./guest-invitations";

describe("guest invitation helpers", () => {
  it("uses a per-event browser key so the shared URL can remember a guest response", () => {
    expect(getGuestInvitationStorageKey("event-20260813-gcrs")).toBe("gather:guest-invite:event-20260813-gcrs");
  });

  it("normalizes names for matching a pre-added invitation target", () => {
    expect(normalizeGuestDisplayName("  哈蜜瓜  ")).toBe("哈蜜瓜");
  });

  it("keeps the response contract intentionally small", () => {
    const response: GuestInvitationResponse = "attending";
    expect(["attending", "declined"]).toContain(response);
  });
});
