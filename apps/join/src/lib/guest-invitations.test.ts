import { describe, expect, it } from "vitest";
import {
  getGuestInvitationStorageKey,
  mergeGuestInvitationInvitee,
  normalizeGuestDisplayName,
  type GuestInvitationInvitee,
  type GuestInvitationResponse,
} from "./guest-invitations";

describe("guest invitation helpers", () => {
  it("uses a per-event browser key so the shared URL can remember a guest response", () => {
    expect(getGuestInvitationStorageKey("event-20260813-gcrs")).toBe("gather:guest-invite:event-20260813-gcrs");
    expect(getGuestInvitationStorageKey("event-20260813-gcrs", "哈蜜瓜")).toBe(
      "gather:guest-invite:event-20260813-gcrs:%E5%93%88%E8%9C%9C%E7%93%9C",
    );
  });

  it("normalizes names for matching a pre-added invitation target", () => {
    expect(normalizeGuestDisplayName("  哈蜜瓜  ")).toBe("哈蜜瓜");
  });

  it("keeps the response contract intentionally small", () => {
    const response: GuestInvitationResponse = "attending";
    expect(["attending", "declined"]).toContain(response);
  });

  it("replaces an updated invitee by id or normalized name without appending a duplicate", () => {
    const existing: GuestInvitationInvitee[] = [
      { id: "target-1", display_name: "哈蜜瓜", response: "pending" },
      { id: "target-2", display_name: "學長", response: "attending" },
    ];
    expect(mergeGuestInvitationInvitee(existing, {
      id: "response-key-1",
      display_name: " 哈蜜瓜 ",
      response: "attending",
    })).toEqual([
      { id: "response-key-1", display_name: " 哈蜜瓜 ", response: "attending" },
      { id: "target-2", display_name: "學長", response: "attending" },
    ]);
  });
});
