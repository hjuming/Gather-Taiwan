import { withSecurityHeaders } from "./response-security";
import { handleLineAuthCallback, handleLineAuthStart, type LineAuthEnv } from "./line-auth";
import { isAllowedCoverImageUrl } from "../shared/event-cover-policy";

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
const EVENT_SUMMARY_PATH = "/app/api/event-summary";
const ADDRESS_SEARCH_PATH = "/app/api/address-search";
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
    if (url.pathname === EVENT_SUMMARY_PATH) {
      return withSecurityHeaders(await handleEventSummary(request, env), { includeCacheControl: false });
    }
    if (url.pathname === ADDRESS_SEARCH_PATH) {
      return withSecurityHeaders(await handleAddressSearch(request), { includeCacheControl: false });
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
    select: "slug,title,starts_at,ends_at,location_name,location_address,capacity,fee_amount,gathering_type,cover_image_url",
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
        const feeAmount = typeof row.fee_amount === "number" || typeof row.fee_amount === "string"
          ? Number(row.fee_amount)
          : Number.NaN;
        return {
          slug: typeof row.slug === "string" ? row.slug : "",
          title: typeof row.title === "string" ? row.title : "",
          starts_at: typeof row.starts_at === "string" ? row.starts_at : "",
          ends_at: typeof row.ends_at === "string" ? row.ends_at : "",
          location_name: typeof row.location_name === "string" ? row.location_name : null,
          location_address: typeof row.location_address === "string" ? row.location_address : null,
          capacity: typeof row.capacity === "number" ? row.capacity : null,
          fee_amount: Number.isFinite(feeAmount) ? feeAmount : null,
          gathering_type: typeof row.gathering_type === "string" && /^[a-z][a-z0-9_]{1,39}$/.test(row.gathering_type)
            ? row.gathering_type
            : null,
          cover_image_url: typeof row.cover_image_url === "string" && isAllowedCoverImageUrl(row.cover_image_url)
            ? row.cover_image_url
            : null,
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

async function handleEventSummary(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "GET", "Cache-Control": "no-store" },
    });
  }

  const slug = new URL(request.url).searchParams.get("slug")?.trim() ?? "";
  if (!/^[a-z0-9][a-z0-9-]{2,95}$/.test(slug)) {
    return new Response(JSON.stringify({ error: "invalid_slug" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "event_summary_unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    Accept: "application/json",
  };
  const eventQuery = new URLSearchParams({
    select: "id,organizer_id,capacity,roster_show_capacity",
    slug: `eq.${slug}`,
    status: "eq.published",
    visibility: "in.(public,unlisted)",
    limit: "1",
  });
  const eventResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/events?${eventQuery.toString()}`, { headers });
  if (!eventResponse.ok) return eventSummaryUnavailable();

  const events = (await eventResponse.json()) as Array<{
    id?: string;
    organizer_id?: string;
    capacity?: number | null;
    roster_show_capacity?: boolean;
  }>;
  const event = events[0];
  if (!event?.id || !event.organizer_id) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const organizerQuery = new URLSearchParams({
    select: "display_name",
    id: `eq.${event.organizer_id}`,
    limit: "1",
  });
  const organizerResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/organizers?${organizerQuery.toString()}`, { headers });
  if (!organizerResponse.ok) return eventSummaryUnavailable();
  const organizers = (await organizerResponse.json()) as Array<{ display_name?: string | null }>;
  const organizerDisplayName = organizers[0]?.display_name?.trim() || null;

  const showCapacity = event.roster_show_capacity === true && typeof event.capacity === "number";
  let registrationCount: number | null = null;
  if (showCapacity) {
    const registrationQuery = new URLSearchParams({
      select: "seats",
      event_id: `eq.${event.id}`,
      status: "in.(offered,pending_organizer_confirmation,confirmed)",
    });
    const registrationResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/registrations?${registrationQuery.toString()}`,
      { headers },
    );
    if (!registrationResponse.ok) return eventSummaryUnavailable();
    const registrations = (await registrationResponse.json()) as Array<{ seats?: number | null }>;
    registrationCount = registrations.reduce(
      (total, registration) => total + Math.max(1, Number(registration.seats) || 1),
      0,
    );
  }

  return new Response(JSON.stringify({
    organizerDisplayName,
    registrationCount,
    capacity: typeof event.capacity === "number" ? event.capacity : null,
    showCapacity,
  }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function eventSummaryUnavailable(): Response {
  return new Response(JSON.stringify({ error: "event_summary_unavailable" }), {
    status: 502,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

interface AddressSearchResult {
  place_id: number;
  osm_type: string;
  osm_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string | null;
}

async function handleAddressSearch(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", Allow: "GET", "Cache-Control": "no-store" },
    });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 120) {
    return new Response(JSON.stringify({ error: "invalid_query" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const searchUrl = new URL("https://nominatim.openstreetmap.org/search");
  searchUrl.search = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "tw",
    layer: "address,poi",
    limit: "5",
    dedupe: "1",
    "accept-language": "zh-TW",
  }).toString();

  try {
    const response = await fetch(searchUrl, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "zh-TW",
        Referer: "https://gather.wedopr.com/app/",
        "User-Agent": "GatherTaiwan/1.0 (+https://gather.wedopr.com/app/)",
      },
    });
    if (!response.ok) {
      return new Response(JSON.stringify({ error: "address_search_unavailable" }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    const payload = (await response.json()) as unknown;
    const results: AddressSearchResult[] = Array.isArray(payload)
      ? payload.map((item) => {
          const row = item as Record<string, unknown>;
          return {
            place_id: typeof row.place_id === "number" ? row.place_id : 0,
            osm_type: typeof row.osm_type === "string" ? row.osm_type : "",
            osm_id: typeof row.osm_id === "number" ? row.osm_id : 0,
            display_name: typeof row.display_name === "string" ? row.display_name : "",
            lat: typeof row.lat === "string" ? row.lat : "",
            lon: typeof row.lon === "string" ? row.lon : "",
            type: typeof row.type === "string" ? row.type : null,
          };
        }).filter((item) => item.display_name && item.lat && item.lon)
      : [];

    return new Response(JSON.stringify(results), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "address_search_unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}
