// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  buildInviteeResponseUrl,
  consumeInviteeTokenFragment,
  getStoredInviteeToken,
  getInviteeTokenStorageKey,
  mergeGuestInvitationInvitee,
  normalizeGuestDisplayName,
  type GuestInvitationInvitee,
  type GuestInvitationResponse,
} from "./guest-invitations";

describe("guest invitation helpers", () => {
  it("uses a URL fragment for a personal response token and never puts it in the shared query", () => {
    const url = buildInviteeResponseUrl("event-20260813-gcrs", "private-token", "https://gather.wedopr.com");
    expect(url).toBe("https://gather.wedopr.com/app/e/event-20260813-gcrs#invitee_token=private-token");
    expect(new URL(url).search).toBe("");
  });

  it("consumes a personal response token into slug-isolated session storage and clears browser history", () => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/app/e/event-20260813-gcrs?source=line#invitee_token=private-token");
    expect(consumeInviteeTokenFragment("event-20260813-gcrs")).toBe("private-token");
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      "/app/e/event-20260813-gcrs?source=line",
    );
    expect(window.sessionStorage.getItem(getInviteeTokenStorageKey("event-20260813-gcrs"))).toBe("private-token");
    expect(getStoredInviteeToken("event-20260813-gcrs")).toBe("private-token");
    expect(window.localStorage.length).toBe(0);
  });

  it("does not reuse a personal token for a different event slug", () => {
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/app/e/event-a#invitee_token=token-for-event-a");
    consumeInviteeTokenFragment("event-a");
    expect(getStoredInviteeToken("event-b")).toBeNull();
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
