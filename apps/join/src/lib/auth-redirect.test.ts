import { describe, expect, it } from "vitest";
import { normalizeInternalRedirect } from "../../shared/auth-redirect";

describe("normalizeInternalRedirect", () => {
  it.each([
    [undefined, "/"],
    ["", "/"],
    ["https://evil.example/phish", "/"],
    ["//evil.example/phish", "/"],
    ["/\\evil.example/phish", "/"],
    ["javascript:alert(1)", "/"],
  ])("rejects unsafe redirect %s", (raw, expected) => {
    expect(normalizeInternalRedirect(raw)).toBe(expected);
  });

  it("keeps a same-origin app path and query while removing the hash", () => {
    expect(normalizeInternalRedirect("/e/demo?from=auth#private-token")).toBe("/e/demo?from=auth");
  });
});
