import { withSecurityHeaders } from "./response-security";
import { handleLineAuthCallback, handleLineAuthStart, type LineAuthEnv } from "./line-auth";

interface Env extends LineAuthEnv {
  SUPABASE_PUBLISHABLE_KEY?: string;
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

const LINE_AUTH_START_PATHS = new Set([
  "/app/auth/line/start",
  "/app/auth/line/authorize",
]);
const LINE_AUTH_CALLBACK_PATHS = new Set([
  "/app/auth/line/callback",
  "/app/line/callback",
]);
const PUBLIC_EVENTS_PATH = "/app/api/public-events";
const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_Qc-0shSK0ISVXiWmo8AtaQ_Wmu_5xU7";
// The Workers Route matches the full "/app/*" path, but the Vite build
// output (dist/client) is flat — index.html and assets/ sit at its root,
// not under an "app/" subdirectory. The ASSETS binding matches requests
// against files in that directory literally, so the "/app" prefix has to
// be stripped before handing the request off, or every asset request
// (JS/CSS) 404s into the SPA fallback and comes back as text/html.
const ASSET_PATH_PREFIX = "/app";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === PUBLIC_EVENTS_PATH) {
      return withSecurityHeaders(await handlePublicEvents(request, env), { includeCacheControl: false });
    }

    if (LINE_AUTH_START_PATHS.has(url.pathname)) {
      return withSecurityHeaders(await handleLineAuthStart(request, env));
    }
    if (LINE_AUTH_CALLBACK_PATHS.has(url.pathname)) {
      return withSecurityHeaders(await handleLineAuthCallback(request, env));
    }

    const assetUrl = new URL(request.url);
    if (assetUrl.pathname.startsWith(ASSET_PATH_PREFIX)) {
      assetUrl.pathname = assetUrl.pathname.slice(ASSET_PATH_PREFIX.length) || "/";
    }
    const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
    if (assetResponse.status === 404 && !assetUrl.pathname.startsWith("/assets/")) {
      const indexUrl = new URL(assetUrl);
      indexUrl.pathname = "/";
      indexUrl.search = "";
      return withSecurityHeaders(await env.ASSETS.fetch(new Request(indexUrl, request)));
    }
    return withSecurityHeaders(assetResponse);
  },
};

async function handlePublicEvents(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "GET", "Cache-Control": "no-store" },
    });
  }

  const now = new Date().toISOString();
  const query = new URLSearchParams({
    select: "slug,title,starts_at,ends_at,location_name,location_address,capacity",
    status: "eq.published",
    visibility: "eq.public",
    ends_at: `gte.${now}`,
    order: "starts_at.asc",
    limit: "24",
  });
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/events?${query.toString()}`, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY ?? FALLBACK_PUBLISHABLE_KEY,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return new Response(JSON.stringify({ error: "public_events_unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const payload = (await response.json()) as unknown;
  const events = Array.isArray(payload)
    ? payload.map((event) => {
        const row = event as Record<string, unknown>;
        return {
          slug: typeof row.slug === "string" ? row.slug : "",
          title: typeof row.title === "string" ? row.title : "",
          starts_at: typeof row.starts_at === "string" ? row.starts_at : "",
          ends_at: typeof row.ends_at === "string" ? row.ends_at : "",
          location_name: typeof row.location_name === "string" ? row.location_name : null,
          location_address: typeof row.location_address === "string" ? row.location_address : null,
          capacity: typeof row.capacity === "number" ? row.capacity : null,
        };
      }).filter((event) => event.slug && event.title && event.starts_at && event.ends_at)
    : [];

  return new Response(JSON.stringify(events), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=60",
    },
  });
}
