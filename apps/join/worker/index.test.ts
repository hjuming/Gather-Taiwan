import { describe, expect, it } from "vitest";
import worker from "./index";

describe("Worker asset response security headers", () => {
  it("preserves the asset response while adding strict browser headers", async () => {
    const response = await worker.fetch(
      new Request("https://join.gather.wedopr.com/"),
      {
        ASSETS: {
          fetch: async () => new Response("asset body", {
            status: 201,
            headers: { "X-Asset": "preserved" },
          }),
        },
      },
    );

    expect(response.status).toBe(201);
    expect(await response.text()).toBe("asset body");
    expect(response.headers.get("X-Asset")).toBe("preserved");
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("Permissions-Policy")).toBe("geolocation=(), camera=(), microphone=()");
  });
});
