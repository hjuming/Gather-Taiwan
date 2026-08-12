import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Worker asset response security headers", () => {
  it("returns only safe fields for future public map events", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        slug: "event-20260817-qwq",
        title: "泰山高中同學會",
        starts_at: "2026-08-17T10:30:00.000Z",
        ends_at: "2026-08-17T13:30:00.000Z",
        location_name: "神牛燒肉建國店",
        location_address: "台北市中山區建國北路二段88號",
        capacity: 30,
        fee_amount: "800",
        gathering_type: "harbor_dinner",
        cover_image_url: null,
        organizer_id: "must-not-leak",
      },
    ]), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      new Request("https://gather.wedopr.com/app/api/public-events"),
      {
        ASSETS: { fetch: async () => new Response("should not serve assets") },
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        LINE_CHANNEL_ID: "test-channel-id",
        LINE_CHANNEL_SECRET: "test-channel-secret",
        LINE_CALLBACK_URL: "https://gather.wedopr.com/app/line/callback",
        APP_BASE_URL: "https://gather.wedopr.com/app",
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=60, s-maxage=60");
    expect(await response.json()).toEqual([{
      slug: "event-20260817-qwq",
      title: "泰山高中同學會",
      starts_at: "2026-08-17T10:30:00.000Z",
      ends_at: "2026-08-17T13:30:00.000Z",
      location_name: "神牛燒肉建國店",
      location_address: "台北市中山區建國北路二段88號",
      capacity: 30,
      fee_amount: 800,
      gathering_type: "harbor_dinner",
      cover_image_url: null,
    }]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("select=slug%2Ctitle%2Cstarts_at%2Cends_at%2Clocation_name%2Clocation_address%2Ccapacity%2Cfee_amount%2Cgathering_type%2Ccover_image_url"),
      expect.objectContaining({ headers: expect.objectContaining({ apikey: "sb_publishable_test" }) }),
    );
    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestedUrl).toContain("status=eq.published");
    expect(requestedUrl).toContain("visibility=eq.public");
    expect(requestedUrl).toContain("ends_at=gte.");
  });

  it("returns organizer name and an aggregate count without exposing the roster", async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: string) => {
      const url = new URL(input);
      if (url.pathname.endsWith("/events")) {
        return new Response(JSON.stringify([{
          id: "event-id",
          organizer_id: "organizer-id",
          capacity: 20,
          roster_show_capacity: true,
        }]), { status: 200 });
      }
      if (url.pathname.endsWith("/organizers")) {
        return new Response(JSON.stringify([{ display_name: "大稻埕桌邊" }]), { status: 200 });
      }
      if (url.pathname.endsWith("/registrations")) {
        return new Response(JSON.stringify([{ seats: 2 }, { seats: 1 }]), { status: 200 });
      }
      return new Response("unexpected", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      new Request("https://gather.wedopr.com/app/api/event-summary?slug=demo-harbor-dinner"),
      {
        ASSETS: { fetch: async () => new Response("should not serve assets") },
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        LINE_CHANNEL_ID: "test-channel-id",
        LINE_CHANNEL_SECRET: "test-channel-secret",
        LINE_CALLBACK_URL: "https://gather.wedopr.com/app/line/callback",
        APP_BASE_URL: "https://gather.wedopr.com/app",
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      organizerDisplayName: "大稻埕桌邊",
      registrationCount: 3,
      capacity: 20,
      showCapacity: true,
    });
    const registrationUrl = String(fetchMock.mock.calls.find(([input]) => String(input).includes("/registrations?"))?.[0]);
    expect(registrationUrl).toContain("select=seats");
    expect(registrationUrl).toContain("status=in.%28offered%2Cpending_organizer_confirmation%2Cconfirmed%29");
    expect(registrationUrl).not.toContain("display_name");
  });

  it("does not accept writes on the public map endpoint", async () => {
    const response = await worker.fetch(
      new Request("https://gather.wedopr.com/app/api/public-events", { method: "POST" }),
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

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });

  it("searches Taiwan addresses only when the user explicitly requests it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        place_id: 123,
        osm_type: "node",
        osm_id: 456,
        display_name: "魚菜居酒屋, 台北市中山區建國北路一段1號, 臺灣",
        lat: "25.0001",
        lon: "121.0002",
        type: "restaurant",
        name: "魚菜居酒屋",
      },
    ]), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      new Request("https://gather.wedopr.com/app/api/address-search?q=%E9%AD%9A%E8%8F%9C%E5%B1%85%E9%85%92%E5%B1%8B"),
      {
        ASSETS: { fetch: async () => new Response("should not serve assets") },
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
        LINE_CHANNEL_ID: "test-channel-id",
        LINE_CHANNEL_SECRET: "test-channel-secret",
        LINE_CALLBACK_URL: "https://gather.wedopr.com/app/line/callback",
        APP_BASE_URL: "https://gather.wedopr.com/app",
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=300, s-maxage=300");
    expect(await response.json()).toEqual([{
      place_id: 123,
      osm_type: "node",
      osm_id: 456,
      display_name: "魚菜居酒屋, 台北市中山區建國北路一段1號, 臺灣",
      lat: "25.0001",
      lon: "121.0002",
      type: "restaurant",
    }]);
    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    const requestOptions = fetchMock.mock.calls[0][1] as RequestInit;
    expect(requestedUrl).toContain("https://nominatim.openstreetmap.org/search?");
    expect(requestedUrl).toContain("countrycodes=tw");
    expect(requestedUrl).toContain("limit=5");
    expect(requestOptions.headers).toEqual(expect.objectContaining({
      "User-Agent": expect.stringContaining("GatherTaiwan"),
      Referer: "https://gather.wedopr.com/app/",
    }));
  });

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
      "default-src 'self'; connect-src 'self' https://anklbpkyesdmsubyfcna.supabase.co; img-src 'self' https://anklbpkyesdmsubyfcna.supabase.co; frame-src https://www.google.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
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
