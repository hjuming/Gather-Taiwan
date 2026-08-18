// LINE Login (web flow, OIDC). Verification uses LINE's own server-side
// /oauth2/v2.1/verify endpoint rather than local JWT signature checking —
// LINE's web-login ID tokens are HS256-signed with the channel secret, and
// letting LINE do that check server-side removes an entire class of "we
// got the crypto slightly wrong" risk from a security-critical path.
//
// Session creation uses the Supabase Admin API (service_role key) to
// create-or-look-up the auth.users row for this LINE identity and mint a
// magiclink token, which the client then exchanges for a real session via
// supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }). This avoids
// needing a custom-OIDC-provider dashboard configuration (not available on
// every Supabase plan) while still never handling a user's password.

import { normalizeInternalRedirect } from "../shared/auth-redirect";

export interface LineAuthEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  LINE_CHANNEL_ID: string;
  LINE_CHANNEL_SECRET: string;
  LINE_CALLBACK_URL: string;
  APP_BASE_URL: string;
}

const STATE_COOKIE = "__Host-gather-line-oauth-state";
const NONCE_COOKIE = "__Host-gather-line-oauth-nonce";
const OAUTH_TTL_SECONDS = 10 * 60;

function randomToken(): string {
  return encode(crypto.getRandomValues(new Uint8Array(24)));
}

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export async function handleLineAuthStart(request: Request, env: LineAuthEnv): Promise<Response> {
  const url = new URL(request.url);
  const redirectTo = normalizeInternalRedirect(url.searchParams.get("redirect"));

  const state = randomToken();
  const nonce = randomToken();

  const authorizeUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", env.LINE_CHANNEL_ID);
  authorizeUrl.searchParams.set("redirect_uri", env.LINE_CALLBACK_URL);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("nonce", nonce);
  authorizeUrl.searchParams.set("scope", "profile openid email");

  const headers = new Headers({ Location: authorizeUrl.toString() });
  const cookieBase = `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${OAUTH_TTL_SECONDS}`;
  headers.append("Set-Cookie", `${STATE_COOKIE}=${state}; ${cookieBase}`);
  headers.append(
    "Set-Cookie",
    `${NONCE_COOKIE}=${nonce}|${encodeURIComponent(redirectTo)}; ${cookieBase}`,
  );
  if (request.method === "POST") {
    headers.delete("Location");
    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify({ location: authorizeUrl.toString() }), {
      status: 200,
      headers,
    });
  }
  return new Response(null, { status: 302, headers });
}

interface LineTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
}

interface LineVerifyResponse {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  nonce?: string;
  amr?: string[];
  name?: string;
  picture?: string;
  email?: string;
}

async function exchangeCodeForTokens(code: string, env: LineAuthEnv): Promise<LineTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: env.LINE_CALLBACK_URL,
    client_id: env.LINE_CHANNEL_ID,
    client_secret: env.LINE_CHANNEL_SECRET,
  });
  const response = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error(`LINE token exchange failed: ${response.status}`);
  }
  return (await response.json()) as LineTokenResponse;
}

async function verifyIdToken(idToken: string, env: LineAuthEnv): Promise<LineVerifyResponse> {
  const body = new URLSearchParams({ id_token: idToken, client_id: env.LINE_CHANNEL_ID });
  const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error(`LINE ID token verification failed: ${response.status}`);
  }
  return (await response.json()) as LineVerifyResponse;
}

interface SupabaseAdminUser {
  id: string;
  email: string;
}

function syntheticLineEmail(lineUserId: string): string {
  return `line+${lineUserId}@users.noreply.gather.wedopr.com`;
}

class SupabaseAdminError extends Error {
  constructor(
    readonly operation: string,
    readonly status: number,
  ) {
    super(`Supabase ${operation} failed: ${status}`);
    this.name = "SupabaseAdminError";
  }
}

function throwSupabaseAdminError(operation: string, response: Response): never {
  // Keep upstream response bodies out of Worker logs: they may contain account
  // details, schema hints, or provider diagnostics that are not user-facing.
  throw new SupabaseAdminError(operation, response.status);
}

async function findUserByLineId(lineUserId: string, env: LineAuthEnv): Promise<string | null> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/users`);
  url.searchParams.set("select", "id");
  url.searchParams.set("line_user_id", `eq.${lineUserId}`);
  const response = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });
  if (!response.ok) throwSupabaseAdminError("users lookup", response);
  const rows = (await response.json()) as { id: string }[];
  return rows[0]?.id ?? null;
}

async function createAuthUser(
  email: string,
  emailConfirmed: boolean,
  env: LineAuthEnv,
): Promise<SupabaseAdminUser> {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, email_confirm: emailConfirmed }),
  });
  if (!response.ok) throwSupabaseAdminError("admin user creation", response);
  return (await response.json()) as SupabaseAdminUser;
}

async function findAuthUserByEmail(email: string, env: LineAuthEnv): Promise<SupabaseAdminUser | null> {
  const url = new URL(`${env.SUPABASE_URL}/auth/v1/admin/users`);
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "1000");
  const response = await fetch(url, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY },
  });
  if (!response.ok) throwSupabaseAdminError("admin user list", response);
  const data = (await response.json()) as { users?: SupabaseAdminUser[] };
  return data.users?.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

async function getAuthUserById(userId: string, env: LineAuthEnv): Promise<SupabaseAdminUser> {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY },
  });
  if (!response.ok) throwSupabaseAdminError("admin user lookup", response);
  return (await response.json()) as SupabaseAdminUser;
}

async function upsertPublicUserRow(
  userId: string,
  lineUserId: string,
  displayName: string | undefined,
  email: string | undefined,
  emailVerified: boolean,
  env: LineAuthEnv,
): Promise<void> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/users`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      id: userId,
      line_user_id: lineUserId,
      display_name: displayName ?? null,
      email: email ?? null,
      email_verified_at: emailVerified ? new Date().toISOString() : null,
    }),
  });
  if (!response.ok) throwSupabaseAdminError("public.users upsert", response);
}

async function generateMagicLinkTokenHash(email: string, env: LineAuthEnv): Promise<string> {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "magiclink", email }),
  });
  if (!response.ok) throwSupabaseAdminError("generate_link", response);
  const data = (await response.json()) as { hashed_token?: string; properties?: { hashed_token?: string } };
  const hashedToken = data.hashed_token ?? data.properties?.hashed_token;
  if (!hashedToken) throw new Error("Supabase generate_link returned no hashed_token");
  return hashedToken;
}

export async function handleLineAuthCallback(request: Request, env: LineAuthEnv): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const lineError = url.searchParams.get("error");

  const clearCookies = new Headers();
  clearCookies.append("Set-Cookie", `${STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
  clearCookies.append("Set-Cookie", `${NONCE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);

  function failure(message: string): Response {
    const target = new URL(`${env.APP_BASE_URL}/auth`);
    target.searchParams.set("line_error", message);
    const headers = new Headers(clearCookies);
    headers.set("Location", target.toString());
    return new Response(null, { status: 302, headers });
  }

  if (lineError) return failure("line_declined");
  if (!code || !returnedState) return failure("missing_code_or_state");

  const storedState = readCookie(request, STATE_COOKIE);
  const nonceCookie = readCookie(request, NONCE_COOKIE);
  if (!storedState || storedState !== returnedState || !nonceCookie) {
    return failure("state_mismatch");
  }
  const [storedNonce, redirectToRaw] = nonceCookie.split("|");
  let redirectTo = "/";
  if (redirectToRaw) {
    try {
      redirectTo = normalizeInternalRedirect(decodeURIComponent(redirectToRaw));
    } catch {
      redirectTo = "/";
    }
  }

  let claims: LineVerifyResponse;
  try {
    const tokens = await exchangeCodeForTokens(code, env);
    claims = await verifyIdToken(tokens.id_token, env);
  } catch {
    return failure("token_exchange_failed");
  }

  if (claims.nonce !== storedNonce) return failure("nonce_mismatch");
  if (claims.aud !== env.LINE_CHANNEL_ID) return failure("audience_mismatch");

  const lineUserId = claims.sub;
  const hasRealEmail = Boolean(claims.email);
  const email = claims.email ?? `line+${lineUserId}@users.noreply.gather.wedopr.com`;

  let tokenHash: string;
  try {
    let userId = await findUserByLineId(lineUserId, env);
    let authUser: SupabaseAdminUser;
    if (!userId) {
      try {
        authUser = await createAuthUser(email, hasRealEmail, env);
      } catch (error) {
        // A previous email-login account may already own LINE's email. Keep
        // LINE identity provisioning deterministic without merging accounts
        // by falling back to a private, collision-resistant auth email.
        if (!(error instanceof SupabaseAdminError) || error.status !== 422) throw error;
        const fallbackEmail = syntheticLineEmail(lineUserId);
        const existingFallback = await findAuthUserByEmail(fallbackEmail, env);
        authUser = existingFallback ?? (await createAuthUser(fallbackEmail, false, env));
      }
      userId = authUser.id;
      const authEmailMatchesClaim = Boolean(
        claims.email && authUser.email.trim().toLowerCase() === claims.email.trim().toLowerCase(),
      );
      await upsertPublicUserRow(userId, lineUserId, claims.name, claims.email, authEmailMatchesClaim, env);
    } else {
      authUser = await getAuthUserById(userId, env);
    }

    tokenHash = await generateMagicLinkTokenHash(authUser.email, env);
  } catch (error) {
    if (error instanceof SupabaseAdminError) {
      console.error("LINE account provisioning dependency failed", {
        operation: error.operation,
        status: error.status,
      });
    } else {
      console.error("LINE account provisioning dependency failed", { operation: "unknown" });
    }
    return failure("account_provisioning_failed");
  }

  const target = new URL(`${env.APP_BASE_URL}/auth/line/complete`);
  target.searchParams.set("token_hash", tokenHash);
  target.searchParams.set("redirect", redirectTo);
  const headers = new Headers(clearCookies);
  headers.set("Location", target.toString());
  return new Response(null, { status: 302, headers });
}
