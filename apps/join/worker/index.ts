import { withSecurityHeaders } from "./response-security";
import { handleLineAuthCallback, handleLineAuthStart, type LineAuthEnv } from "./line-auth";
import { isAllowedCoverImageUrl } from "../shared/event-cover-policy";
import { getEventSocialDescription, getEventSocialFacts, type EventFeeMode } from "../shared/event-social-facts";

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
const EVENT_DOCUMENT_PATTERN = /^\/app\/e\/([a-z0-9][a-z0-9-]{2,95})\/?$/;
const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_Qc-0shSK0ISVXiWmo8AtaQ_Wmu_5xU7";
const DEFAULT_EVENT_OG_IMAGE = "/uploads/gather-home-hero-documentary-v1.jpg";
const EVENT_OG_IMAGES: Record<string, string> = {
  friends_dinner: "/uploads/gather-neo-rechao-cheers-v1.jpg",
  class_reunion: "/uploads/gather-harbor-dinner-documentary-v1.jpg",
  family_gathering: "/uploads/gather-local-banquet-v1.jpg",
  birthday_celebration: "/uploads/gather-moonlight-charcoal-v1.jpg",
  reading_workshop: "/uploads/gather-tea-table-v1.jpg",
  interest_meetup: "/uploads/gather-winter-table-v1.jpg",
  market_breakfast: "/uploads/gather-market-morning-documentary-v1.jpg",
  harbor_dinner: "/uploads/gather-harbor-dinner-documentary-v1.jpg",
  rechao: "/uploads/gather-neo-rechao-cheers-v1.jpg",
  moonlight_grill: "/uploads/gather-moonlight-charcoal-v1.jpg",
  riverside_picnic: "/uploads/gather-bg-riverside-table-v1.jpg",
  local_banquet: "/uploads/gather-local-banquet-v1.jpg",
  winter_hotpot: "/uploads/gather-winter-table-v1.jpg",
  temple_festival: "/uploads/gather-bg-local-festival-supply-v1.jpg",
  tea_table: "/uploads/gather-tea-table-v1.jpg",
  other: DEFAULT_EVENT_OG_IMAGE,
};
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
    const eventDocumentMatch = EVENT_DOCUMENT_PATTERN.exec(url.pathname);
    if (request.method === "GET" && eventDocumentMatch) {
      return withSecurityHeaders(await handleEventDocument(request, env, eventDocumentMatch[1]), {
        includeCacheControl: false,
      });
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

interface SocialEvent {
  title: string;
  summary: string | null;
  starts_at: string;
  ends_at: string;
  location_name: string | null;
  location_address: string | null;
  fee_amount: string | number;
  fee_mode: EventFeeMode | null;
  payment_instructions: string | null;
  capacity: number | null;
  gathering_type: string | null;
  cover_image_url: string | null;
  visibility: "public" | "unlisted" | "private";
}

async function handleEventDocument(request: Request, env: Env, slug: string): Promise<Response> {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = assetUrl.pathname.slice(ASSET_PATH_PREFIX.length) || "/";
  let assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
  if (assetResponse.status === 404) {
    assetUrl.pathname = "/";
    assetUrl.search = "";
    assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
  }
  if (!assetResponse.ok || !env.SUPABASE_SERVICE_ROLE_KEY) return assetResponse;

  const event = await getSocialEvent(env, slug);
  if (!event) return assetResponse;

  const imageUrl = getSocialImageUrl(request, event);
  const canonicalUrl = new URL(`/app/e/${encodeURIComponent(slug)}`, request.url).toString();
  const facts = getEventSocialFacts(event);
  const title = facts.title;
  const description = getEventSocialDescription(event);
  const imageType = imageUrl.endsWith(".png") ? "image/png" : imageUrl.endsWith(".webp") ? "image/webp" : "image/jpeg";
  const html = await assetResponse.text();
  const socialHead = [
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${event.visibility === "private" ? "noindex, nofollow" : "index, follow"}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="聚場台灣 Gather Taiwan" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
    `<meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />`,
    `<meta property="og:image:type" content="${imageType}" />`,
    // Event covers may be organizer-uploaded and are not guaranteed to be
    // 1200x630. Omit dimensions unless we have measured the selected asset;
    // declaring a guessed size causes social crawlers to render a distorted
    // preview for custom covers.
    `<meta property="og:image:alt" content="${escapeHtml(`${event.title}｜聚場台灣活動代表圖`)}" />`,
    `<meta property="og:locale" content="zh_TW" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
  ].join("\n    ");
  const output = html.replace("</head>", `    ${socialHead}\n  </head>`);
  const headers = new Headers(assetResponse.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "public, max-age=60, s-maxage=60");
  if (event.visibility === "private") headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(output, { status: assetResponse.status, headers });
}

async function getSocialEvent(env: Env, slug: string): Promise<SocialEvent | null> {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRoleKey) {
    const query = new URLSearchParams({
      select: "title,summary,starts_at,ends_at,location_name,location_address,fee_amount,fee_mode,payment_instructions,capacity,gathering_type,cover_image_url,visibility",
      slug: `eq.${slug}`,
      status: "eq.published",
      limit: "1",
    });
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/events?${query.toString()}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
      },
    });
    if (response.ok) {
      const rows = (await response.json()) as Array<Partial<SocialEvent>>;
      const event = normalizeSocialEvent(rows[0]);
      if (event) return event;
    }
  }

  // Private invitation pages are intentionally hidden from the base-table REST
  // path. Reuse the existing narrowly-shaped anonymous invitation RPC so social
  // crawlers can receive event metadata without exposing the roster or secrets.
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY ?? FALLBACK_PUBLISHABLE_KEY;
  const invitationResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_event_invitation_by_slug`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ p_slug: slug, p_guest_key: null }),
  });
  if (!invitationResponse.ok) return null;
  return normalizeSocialEvent((await invitationResponse.json()) as Partial<SocialEvent>);
}

function normalizeSocialEvent(row: Partial<SocialEvent> | undefined): SocialEvent | null {
  if (!row || typeof row.title !== "string" || typeof row.starts_at !== "string" || typeof row.ends_at !== "string") return null;
  if (row.visibility !== "public" && row.visibility !== "unlisted" && row.visibility !== "private") return null;
  return {
    title: row.title,
    summary: typeof row.summary === "string" ? row.summary : null,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    location_name: typeof row.location_name === "string" ? row.location_name : null,
    location_address: typeof row.location_address === "string" ? row.location_address : null,
    fee_amount: typeof row.fee_amount === "string" || typeof row.fee_amount === "number" ? row.fee_amount : 0,
    fee_mode: row.fee_mode === "free" || row.fee_mode === "fixed" || row.fee_mode === "on_site_split" ? row.fee_mode : null,
    payment_instructions: typeof row.payment_instructions === "string" ? row.payment_instructions : null,
    capacity: typeof row.capacity === "number" ? row.capacity : null,
    gathering_type: typeof row.gathering_type === "string" ? row.gathering_type : null,
    cover_image_url: typeof row.cover_image_url === "string" ? row.cover_image_url : null,
    visibility: row.visibility,
  };
}

function getSocialImageUrl(request: Request, event: SocialEvent): string {
  const candidate = event.cover_image_url?.trim();
  const imagePath = candidate && isAllowedCoverImageUrl(candidate)
    ? candidate
    : EVENT_OG_IMAGES[event.gathering_type ?? ""] ?? DEFAULT_EVENT_OG_IMAGE;
  return new URL(imagePath, request.url).toString();
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

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
