import { describe, expect, it } from "vitest";
import worker from "./index";

describe("Worker asset response security headers", () => {
  it("starts LINE OAuth from the uncached authorize path", async () => {
    const response = await worker.fetch(
      new Request("https://gather.wedopr.com/app/auth/line/authorize?redirect=%2Fevents%2Fdemo"),
      {
        ASSETS: { fetch: async () => new Response("should not serve assets") },
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        LINE_CHANNEL_ID: "test-channel-id",
        LINE_CHANNEL_SECRET: "test-channel-secret",
        LINE_CALLBACK_URL: "https://gather.wedopr.com/app/auth/line/callback",
        APP_BASE_URL: "https://gather.wedopr.com/app",
      },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("https://access.line.me/oauth2/v2.1/authorize");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns the authorize URL as JSON for a same-origin POST client", async () => {
    const response = await worker.fetch(
      new Request("https://gather.wedopr.com/app/auth/line/authorize", {
        method: "POST",
        body: new URLSearchParams({ redirect: "/events/demo" }),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }),
      {
        ASSETS: { fetch: async () => new Response("should not serve assets") },
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        LINE_CHANNEL_ID: "test-channel-id",
        LINE_CHANNEL_SECRET: "test-channel-secret",
        LINE_CALLBACK_URL: "https://gather.wedopr.com/app/auth/line/callback",
        APP_BASE_URL: "https://gather.wedopr.com/app",
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect((await response.json()).location).toContain("https://access.line.me/oauth2/v2.1/authorize");
  });

  it("handles the uncached LINE callback path", async () => {
    const response = await worker.fetch(
      new Request("https://gather.wedopr.com/app/line/callback?code=dummy&state=dummy"),
      {
        ASSETS: { fetch: async () => new Response("should not serve assets") },
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        LINE_CHANNEL_ID: "test-channel-id",
        LINE_CHANNEL_SECRET: "test-channel-secret",
        LINE_CALLBACK_URL: "https://gather.wedopr.com/app/line/callback",
        APP_BASE_URL: "https://gather.wedopr.com/app",
      },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/app/auth?line_error=state_mismatch");
  });

  it("serves the SPA shell from the Worker without Pages fallback caching", async () => {
    const requestedPaths: string[] = [];
    const response = await worker.fetch(
      new Request("https://gather.wedopr.com/app/auth"),
      {
        ASSETS: {
          fetch: async (request: Request) => {
            const path = new URL(request.url).pathname;
            requestedPaths.push(path);
            return path === "/" ? new Response("index body") : new Response("missing", { status: 404 });
          },
        },
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        LINE_CHANNEL_ID: "test-channel-id",
        LINE_CHANNEL_SECRET: "test-channel-secret",
        LINE_CALLBACK_URL: "https://gather.wedopr.com/app/line/callback",
        APP_BASE_URL: "https://gather.wedopr.com/app",
      },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("index body");
    expect(requestedPaths).toEqual(["/auth", "/"]);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

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
      "default-src 'self'; connect-src 'self' https://anklbpkyesdmsubyfcna.supabase.co; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
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
