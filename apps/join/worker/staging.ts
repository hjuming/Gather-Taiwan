import { withSecurityHeaders } from "./response-security";
import {
  isAllowedDevSubject,
  verifyCloudflareAccess,
  signSupabaseDevJwt,
  type AccessClaims,
  type DevAuthEnv,
  type VerifyCloudflareAccess,
} from "./dev-auth";

interface AssetsOnlyEnv {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

interface AuthRateLimiter {
  limit: (args: { key: string }) => Promise<{ success: boolean }>;
}

export interface StagingEnv extends AssetsOnlyEnv {
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  SUPABASE_JWT_SECRET: string;
  SUPABASE_AUTH_ISSUER: string;
  DEV_AUTH_SUBJECTS: string;
  AUTH_RATE_LIMITER?: AuthRateLimiter | null;
}

interface CreateStagingWorkerConfig {
  verifyAccess: VerifyCloudflareAccess;
  signDevJwt?: (subject: string, env: DevAuthEnv) => Promise<string>;
}

type ErrorPayload = { message: string };

const DEV_SESSION_PATH = "/__dev/session";
const DEV_SESSION_COOKIE = "__Host-gather-dev-session";
const DEV_SESSION_TTL_SECONDS = 10 * 60;

function responseWithJson(status: number, payload: ErrorPayload): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function createStagingWorker({
  verifyAccess,
  signDevJwt = signSupabaseDevJwt,
}: CreateStagingWorkerConfig) {
  return {
    async fetch(request: Request, env: StagingEnv): Promise<Response> {
      const requestUrl = new URL(request.url);
      if (requestUrl.pathname === DEV_SESSION_PATH) {
        return handleDevSessionRequest(request, env, verifyAccess, signDevJwt);
      }

      const assetResponse = await env.ASSETS.fetch(request);
      return withSecurityHeaders(assetResponse);
    },
  };
}

function isRequestOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

async function handleDevSessionRequest(
  request: Request,
  env: StagingEnv,
  verifyAccess: VerifyCloudflareAccess,
  signDevJwt: (subject: string, env: DevAuthEnv) => Promise<string>,
): Promise<Response> {
  if (request.method !== "POST") {
    return responseWithJson(405, { message: "Method not allowed" });
  }
  if (!isRequestOriginAllowed(request)) {
    return responseWithJson(403, { message: "Forbidden" });
  }

  const accessAssertion = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!accessAssertion) {
    return responseWithJson(403, { message: "Missing Access assertion" });
  }

  const requestBody = await request.json().catch(() => null);
  if (!requestBody || typeof requestBody.subject !== "string") {
    return responseWithJson(400, { message: "Invalid request body" });
  }

  const requestedSubject = requestBody.subject.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedSubject)) {
    return responseWithJson(400, { message: "Invalid subject" });
  }

  if (!isAllowedDevSubject(requestedSubject, env as DevAuthEnv)) {
    return responseWithJson(403, { message: "Subject is not allowed" });
  }

  let claims: AccessClaims;
  try {
    claims = await verifyAccess(accessAssertion, env);
  } catch {
    return responseWithJson(403, { message: "Invalid Access assertion" });
  }

  if (!env.AUTH_RATE_LIMITER || typeof env.AUTH_RATE_LIMITER.limit !== "function") {
    return responseWithJson(503, { message: "Auth throttle unavailable" });
  }
  const rateLimit = await env.AUTH_RATE_LIMITER.limit({
    key: `access:${claims.subject}`,
  });
  if (!rateLimit.success) {
    return new Response(null, {
      status: 429,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }

  const token = await signDevJwt(requestedSubject, env);
  const headers = new Headers();
  headers.set(
    "Set-Cookie",
    `${DEV_SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${DEV_SESSION_TTL_SECONDS}`,
  );
  headers.set("Cache-Control", "no-store");
  return new Response(null, { status: 204, headers });
}

export default createStagingWorker({
  verifyAccess: verifyCloudflareAccess,
  signDevJwt: signSupabaseDevJwt,
});
