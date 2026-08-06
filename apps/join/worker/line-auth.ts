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
  const redirectTo = url.searchParams.get("redirect") ?? "/app/";

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
  const cookieBase = `HttpOnly; Secure; SameSite=Lax; Path=/app/auth/line; Max-Age=${OAUTH_TTL_SECONDS}`;
  headers.append("Set-Cookie", `${STATE_COOKIE}=${state}; ${cookieBase}`);
  headers.append(
    "Set-Cookie",
    `${NONCE_COOKIE}=${nonce}|${encodeURIComponent(redirectTo)}; ${cookieBase}`,
  );
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
  email?: string;
}

async function findUserByLineId(lineUserId: string, env: LineAuthEnv): Promise<string | null> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/users`);
  url.searchParams.set("select", "id");
  url.searchParams.set("line_user_id", `eq.${lineUserId}`);
  const response = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!response.ok) throw new Error(`Supabase users lookup failed: ${response.status}`);
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
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, email_confirm: emailConfirmed }),
  });
  if (!response.ok) {
    throw new Error(`Supabase admin user creation failed: ${response.status} ${await response.text()}`);
  }
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
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id: userId,
      line_user_id: lineUserId,
      display_name: displayName ?? null,
      email: email ?? null,
      email_verified_at: emailVerified ? new Date().toISOString() : null,
    }),
  });
  if (!response.ok) {
    throw new Error(`Supabase public.users upsert failed: ${response.status} ${await response.text()}`);
  }
}

async function generateMagicLinkTokenHash(email: string, env: LineAuthEnv): Promise<string> {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "magiclink", email }),
  });
  if (!response.ok) {
    throw new Error(`Supabase generate_link failed: ${response.status} ${await response.text()}`);
  }
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
  clearCookies.append("Set-Cookie", `${STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/app/auth/line; Max-Age=0`);
  clearCookies.append("Set-Cookie", `${NONCE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/app/auth/line; Max-Age=0`);

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
  const redirectTo = redirectToRaw ? decodeURIComponent(redirectToRaw) : "/app/";

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

  let userId = await findUserByLineId(lineUserId, env);
  if (!userId) {
    const created = await createAuthUser(email, hasRealEmail, env);
    userId = created.id;
    await upsertPublicUserRow(userId, lineUserId, claims.name, claims.email, hasRealEmail, env);
  }

  const tokenHash = await generateMagicLinkTokenHash(email, env);

  const target = new URL(`${env.APP_BASE_URL}/auth/line/complete`);
  target.searchParams.set("token_hash", tokenHash);
  target.searchParams.set("redirect", redirectTo);
  const headers = new Headers(clearCookies);
  headers.set("Location", target.toString());
  return new Response(null, { status: 302, headers });
}
