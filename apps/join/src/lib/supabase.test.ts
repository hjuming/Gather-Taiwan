import { describe, expect, it, vi } from "vitest";
import { supabaseFetch } from "./supabase-fetch";

describe("supabaseFetch", () => {
  it("does not send the publishable API key as a JWT bearer", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    const publishableKey = ["sb_publishable", "test-key"].join("_");
    await supabaseFetch("https://project.supabase.co/auth/v1/verify", {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
      },
    });

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get("apikey")).toBe(publishableKey);
    expect(headers.get("authorization")).toBeNull();
    fetchMock.mockRestore();
  });

  it("preserves a real access-token bearer after sign-in", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    await supabaseFetch("https://project.supabase.co/rest/v1/users", {
      headers: { Authorization: "Bearer eyJreal-session-token" },
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers((init as RequestInit).headers).get("authorization")).toBe("Bearer eyJreal-session-token");
    fetchMock.mockRestore();
  });
});
