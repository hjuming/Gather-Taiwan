import { describe, expect, it } from "vitest";
import worker from "./index";

describe("Worker asset response security headers", () => {
  it("preserves the asset response while adding strict browser headers", async () => {
    const response = await worker.fetch(
      new Request("https://gather.wedopr.com/app/"),
      {
        ASSETS: {
          fetch: async () => new Response("asset body", {
            status: 201,
            headers: { "X-Asset": "preserved" },
          }),
        },
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        LINE_CHANNEL_ID: "test-channel-id",
        LINE_CHANNEL_SECRET: "test-channel-secret",
        LINE_CALLBACK_URL: "https://gather.wedopr.com/app/auth/line/callback",
        APP_BASE_URL: "https://gather.wedopr.com/app",
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

  it("strips the /app path prefix before asking ASSETS for a file", async () => {
    let requestedPath: string | undefined;
    await worker.fetch(
      new Request("https://gather.wedopr.com/app/assets/index-abc123.js"),
      {
        ASSETS: {
          fetch: async (req: Request) => {
            requestedPath = new URL(req.url).pathname;
            return new Response("js body");
          },
        },
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        LINE_CHANNEL_ID: "test-channel-id",
        LINE_CHANNEL_SECRET: "test-channel-secret",
        LINE_CALLBACK_URL: "https://gather.wedopr.com/app/auth/line/callback",
        APP_BASE_URL: "https://gather.wedopr.com/app",
      },
    );

    expect(requestedPath).toBe("/assets/index-abc123.js");
  });

  it("maps the bare /app root to / for ASSETS", async () => {
    let requestedPath: string | undefined;
    await worker.fetch(
      new Request("https://gather.wedopr.com/app"),
      {
        ASSETS: {
          fetch: async (req: Request) => {
            requestedPath = new URL(req.url).pathname;
            return new Response("index body");
          },
        },
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        LINE_CHANNEL_ID: "test-channel-id",
        LINE_CHANNEL_SECRET: "test-channel-secret",
        LINE_CALLBACK_URL: "https://gather.wedopr.com/app/auth/line/callback",
        APP_BASE_URL: "https://gather.wedopr.com/app",
      },
    );

    expect(requestedPath).toBe("/");
  });
});
