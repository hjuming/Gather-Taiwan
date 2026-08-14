import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { handleLineAuthCallback, handleLineAuthStart, type LineAuthEnv } from "./line-auth";

const env: LineAuthEnv = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
  LINE_CHANNEL_ID: "2010930927",
  LINE_CHANNEL_SECRET: "channel-secret-test-value",
  LINE_CALLBACK_URL: "https://gather.wedopr.com/app/line/callback",
  APP_BASE_URL: "https://gather.wedopr.com/app",
};

function cookieValue(headers: Headers, name: string): string | undefined {
  return headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
}

describe("handleLineAuthStart", () => {
  it("redirects to LINE's authorize endpoint with state/nonce and sets both as 600-second HttpOnly cookies", async () => {
    const request = new Request("https://gather.wedopr.com/app/auth/line/start");
    const response = await handleLineAuthStart(request, env);

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("Location")!);
    expect(location.origin + location.pathname).toBe("https://access.line.me/oauth2/v2.1/authorize");
    expect(location.searchParams.get("client_id")).toBe(env.LINE_CHANNEL_ID);
    expect(location.searchParams.get("redirect_uri")).toBe(env.LINE_CALLBACK_URL);
    expect(location.searchParams.get("scope")).toBe("profile openid email");

    const setCookies = response.headers.getSetCookie();
    expect(setCookies).toHaveLength(2);
    expect(setCookies.every((c) => c.includes("HttpOnly") && c.includes("Secure") && c.includes("SameSite=Lax"))).toBe(
      true,
    );
    expect(setCookies.every((c) => c.includes("Path=/;"))).toBe(true);
    expect(setCookies.every((c) => c.includes("Max-Age=600"))).toBe(true);
    expect(location.searchParams.get("state")).toBe(cookieValue(response.headers, "__Host-gather-line-oauth-state"));
  });
});

describe("handleLineAuthCallback", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let consoleErrorMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    consoleErrorMock.mockRestore();
  });

  function callbackRequest(params: Record<string, string>, cookies?: string): Request {
    const url = new URL("https://gather.wedopr.com/app/auth/line/callback");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const headers = new Headers();
    if (cookies) headers.set("Cookie", cookies);
    return new Request(url, { headers });
  }

  it("fails closed when LINE reports the user declined", async () => {
    const response = await handleLineAuthCallback(callbackRequest({ error: "access_denied" }), env);
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("Location")!);
    expect(location.searchParams.get("line_error")).toBe("line_declined");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when code or state is missing", async () => {
    const response = await handleLineAuthCallback(callbackRequest({}), env);
    const location = new URL(response.headers.get("Location")!);
    expect(location.searchParams.get("line_error")).toBe("missing_code_or_state");
  });

  it.each([
    {
      expiredCookie: "state",
      cookies: "__Host-gather-line-oauth-nonce=real-nonce|%2Fapp%2F",
    },
    {
      expiredCookie: "nonce",
      cookies: "__Host-gather-line-oauth-state=real-state",
    },
  ])("fails closed when browser expiry removes the $expiredCookie cookie", async ({ cookies }) => {
    const response = await handleLineAuthCallback(
      callbackRequest({ code: "abc", state: "real-state" }, cookies),
      env,
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("Location")!);
    expect(location.searchParams.get("line_error")).toBe("state_mismatch");
    expect(response.headers.getSetCookie().filter((cookie) => cookie.includes("Max-Age=0"))).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when the returned state does not match the cookie (CSRF)", async () => {
    const response = await handleLineAuthCallback(
      callbackRequest(
        { code: "abc", state: "attacker-supplied-state" },
        "__Host-gather-line-oauth-state=real-state; __Host-gather-line-oauth-nonce=some-nonce|%2Fapp%2F",
      ),
      env,
    );
    const location = new URL(response.headers.get("Location")!);
    expect(location.searchParams.get("line_error")).toBe("state_mismatch");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  function mockLineAndSupabase(overrides?: {
    tokenStatus?: number;
    verifyStatus?: number;
    verifyBody?: Partial<Record<string, unknown>>;
    userLookup?: unknown[];
    userLookupStatus?: number;
    adminUserStatuses?: number[];
    adminUsers?: SupabaseAdminUserFixture[];
    upsertStatus?: number;
    generateLinkStatus?: number;
  }) {
    let adminUserCall = 0;
    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "https://api.line.me/oauth2/v2.1/token") {
        return new Response(JSON.stringify({ access_token: "at", id_token: "idtok", token_type: "Bearer", expires_in: 3600 }), {
          status: overrides?.tokenStatus ?? 200,
        });
      }
      if (url === "https://api.line.me/oauth2/v2.1/verify") {
        return new Response(
          JSON.stringify({
            iss: "https://access.line.me",
            sub: "line-user-123",
            aud: env.LINE_CHANNEL_ID,
            exp: Math.floor(Date.now() / 1000) + 600,
            iat: Math.floor(Date.now() / 1000),
            nonce: "real-nonce",
            name: "測試使用者",
            email: "tester@line.example",
            ...overrides?.verifyBody,
          }),
          { status: overrides?.verifyStatus ?? 200 },
        );
      }
      if (url.startsWith(`${env.SUPABASE_URL}/rest/v1/users?`)) {
        return new Response(JSON.stringify(overrides?.userLookup ?? []), {
          status: overrides?.userLookupStatus ?? 200,
        });
      }
      if (url.startsWith(`${env.SUPABASE_URL}/auth/v1/admin/users`)) {
        if (new URL(url).search) {
          return new Response(JSON.stringify({ users: overrides?.adminUsers ?? [] }), { status: 200 });
        }
        const status = overrides?.adminUserStatuses?.[adminUserCall++] ?? 200;
        return new Response(
          JSON.stringify({
            id: status === 200 && adminUserCall > 1 ? "synthetic-user-uuid" : "new-user-uuid",
            email: status === 200 && adminUserCall > 1 ? "line+line-user-123@users.noreply.gather.wedopr.com" : "tester@line.example",
          }),
          { status },
        );
      }
      if (url === `${env.SUPABASE_URL}/auth/v1/admin/users/existing-user-uuid`) {
        return new Response(JSON.stringify({ id: "existing-user-uuid", email: "tester@line.example" }), { status: 200 });
      }
      if (url === `${env.SUPABASE_URL}/rest/v1/users`) {
        return new Response(null, { status: overrides?.upsertStatus ?? 201 });
      }
      if (url === `${env.SUPABASE_URL}/auth/v1/admin/generate_link`) {
        return new Response(JSON.stringify({ properties: { hashed_token: "the-hashed-token" } }), {
          status: overrides?.generateLinkStatus ?? 200,
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
  }

  type SupabaseAdminUserFixture = { id: string; email: string };

  it("fails closed on nonce mismatch (replay protection)", async () => {
    mockLineAndSupabase({ verifyBody: { nonce: "different-nonce" } });
    const response = await handleLineAuthCallback(
      callbackRequest(
        { code: "abc", state: "real-state" },
        "__Host-gather-line-oauth-state=real-state; __Host-gather-line-oauth-nonce=real-nonce|%2Fapp%2F",
      ),
      env,
    );
    const location = new URL(response.headers.get("Location")!);
    expect(location.searchParams.get("line_error")).toBe("nonce_mismatch");
  });

  it.each([
    ["LINE token exchange", { tokenStatus: 401 }],
    ["LINE ID token verification", { verifyStatus: 401 }],
  ])("fails closed when %s fails", async (_label, overrides) => {
    mockLineAndSupabase(overrides);
    const response = await handleLineAuthCallback(
      callbackRequest(
        { code: "abc", state: "real-state" },
        "__Host-gather-line-oauth-state=real-state; __Host-gather-line-oauth-nonce=real-nonce|%2Fapp%2F",
      ),
      env,
    );
    const location = new URL(response.headers.get("Location")!);
    expect(location.searchParams.get("line_error")).toBe("token_exchange_failed");
  });

  it("fails closed on audience mismatch (token minted for a different channel)", async () => {
    mockLineAndSupabase({ verifyBody: { aud: "some-other-channel-id" } });
    const response = await handleLineAuthCallback(
      callbackRequest(
        { code: "abc", state: "real-state" },
        "__Host-gather-line-oauth-state=real-state; __Host-gather-line-oauth-nonce=real-nonce|%2Fapp%2F",
      ),
      env,
    );
    const location = new URL(response.headers.get("Location")!);
    expect(location.searchParams.get("line_error")).toBe("audience_mismatch");
  });

  it("creates a new user, upserts the public profile, and redirects with a magic-link token hash", async () => {
    mockLineAndSupabase({ userLookup: [] });
    const response = await handleLineAuthCallback(
      callbackRequest(
        { code: "abc", state: "real-state" },
        "__Host-gather-line-oauth-state=real-state; __Host-gather-line-oauth-nonce=real-nonce|%2Fapp%2Fe%2Fsome-event",
      ),
      env,
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("Location")!);
    expect(location.origin + location.pathname).toBe("https://gather.wedopr.com/app/auth/line/complete");
    expect(location.searchParams.get("token_hash")).toBe("the-hashed-token");
    expect(location.searchParams.get("redirect")).toBe("/app/e/some-event");

    const createUserCall = fetchMock.mock.calls.find(([u]) => u === `${env.SUPABASE_URL}/auth/v1/admin/users`);
    expect(createUserCall).toBeTruthy();
    const createUserBody = JSON.parse((createUserCall![1] as RequestInit).body as string);
    expect(createUserBody).toEqual({ email: "tester@line.example", email_confirm: true });

    const upsertCall = fetchMock.mock.calls.find(
      ([u, init]) => u === `${env.SUPABASE_URL}/rest/v1/users` && (init as RequestInit)?.method === "POST",
    );
    const upsertBody = JSON.parse((upsertCall![1] as RequestInit).body as string);
    expect(upsertBody.line_user_id).toBe("line-user-123");
    expect(upsertBody.email_verified_at).not.toBeNull();

    const supabaseCalls = fetchMock.mock.calls.filter(([input]) => String(input).startsWith(env.SUPABASE_URL));
    expect(supabaseCalls.length).toBeGreaterThan(0);
    for (const [, init] of supabaseCalls) {
      const headers = new Headers((init as RequestInit | undefined)?.headers);
      expect(headers.get("apikey")).toBe(env.SUPABASE_SERVICE_ROLE_KEY);
      expect(headers.get("authorization")).toBeNull();
    }

    const clearedCookies = response.headers.getSetCookie();
    expect(clearedCookies.some((c) => c.startsWith("__Host-gather-line-oauth-state=;"))).toBe(true);
  });

  it("skips user creation when a matching line_user_id already exists", async () => {
    mockLineAndSupabase({ userLookup: [{ id: "existing-user-uuid" }] });
    await handleLineAuthCallback(
      callbackRequest(
        { code: "abc", state: "real-state" },
        "__Host-gather-line-oauth-state=real-state; __Host-gather-line-oauth-nonce=real-nonce|%2Fapp%2F",
      ),
      env,
    );

    const createUserCall = fetchMock.mock.calls.find(([u]) => u === `${env.SUPABASE_URL}/auth/v1/admin/users`);
    expect(createUserCall).toBeUndefined();
  });

  it("falls back to a synthetic auth email when LINE email already belongs to another auth user", async () => {
    mockLineAndSupabase({
      userLookup: [],
      adminUserStatuses: [422, 200],
      adminUsers: [],
    });
    const response = await handleLineAuthCallback(
      callbackRequest(
        { code: "abc", state: "real-state" },
        "__Host-gather-line-oauth-state=real-state; __Host-gather-line-oauth-nonce=real-nonce|%2Fapp%2F",
      ),
      env,
    );

    expect(response.status).toBe(302);
    const createCalls = fetchMock.mock.calls.filter(([u]) => u === `${env.SUPABASE_URL}/auth/v1/admin/users`);
    expect(createCalls).toHaveLength(2);
    const fallbackBody = JSON.parse((createCalls[1][1] as RequestInit).body as string);
    expect(fallbackBody.email).toBe("line+line-user-123@users.noreply.gather.wedopr.com");
    const location = new URL(response.headers.get("Location")!);
    expect(location.searchParams.get("token_hash")).toBe("the-hashed-token");
  });

  it("reuses a previously-created synthetic auth user after a partial provisioning retry", async () => {
    mockLineAndSupabase({
      userLookup: [],
      adminUserStatuses: [422],
      adminUsers: [{ id: "synthetic-user-uuid", email: "line+line-user-123@users.noreply.gather.wedopr.com" }],
    });
    const response = await handleLineAuthCallback(
      callbackRequest(
        { code: "abc", state: "real-state" },
        "__Host-gather-line-oauth-state=real-state; __Host-gather-line-oauth-nonce=real-nonce|%2Fapp%2F",
      ),
      env,
    );

    expect(response.status).toBe(302);
    const createCalls = fetchMock.mock.calls.filter(([u, init]) => u === `${env.SUPABASE_URL}/auth/v1/admin/users` && !(init as RequestInit | undefined)?.method);
    expect(createCalls).toHaveLength(0);
  });

  it("falls back to a placeholder email when LINE does not return one (email scope declined)", async () => {
    mockLineAndSupabase({ userLookup: [], verifyBody: { email: undefined } });
    await handleLineAuthCallback(
      callbackRequest(
        { code: "abc", state: "real-state" },
        "__Host-gather-line-oauth-state=real-state; __Host-gather-line-oauth-nonce=real-nonce|%2Fapp%2F",
      ),
      env,
    );

    const createUserCall = fetchMock.mock.calls.find(([u]) => u === `${env.SUPABASE_URL}/auth/v1/admin/users`);
    const createUserBody = JSON.parse((createUserCall![1] as RequestInit).body as string);
    expect(createUserBody.email).toBe("line+line-user-123@users.noreply.gather.wedopr.com");
    expect(createUserBody.email_confirm).toBe(false);
  });

  it("fails closed with a user-facing error when Supabase account lookup is forbidden", async () => {
    mockLineAndSupabase({ userLookupStatus: 403 });
    const response = await handleLineAuthCallback(
      callbackRequest(
        { code: "abc", state: "real-state" },
        "__Host-gather-line-oauth-state=real-state; __Host-gather-line-oauth-nonce=real-nonce|%2Fapp%2F",
      ),
      env,
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("Location")!);
    expect(location.searchParams.get("line_error")).toBe("account_provisioning_failed");
    expect(consoleErrorMock).toHaveBeenCalledWith("LINE account provisioning dependency failed", {
      operation: "users lookup",
      status: 403,
    });
    expect(JSON.stringify(consoleErrorMock.mock.calls)).not.toContain("service-role-test-key");
  });

  it.each([
    ["public profile upsert", { upsertStatus: 500 }],
    ["magic-link generation", { generateLinkStatus: 500 }],
  ])("fails closed when %s fails", async (_label, overrides) => {
    mockLineAndSupabase(overrides);
    const response = await handleLineAuthCallback(
      callbackRequest(
        { code: "abc", state: "real-state" },
        "__Host-gather-line-oauth-state=real-state; __Host-gather-line-oauth-nonce=real-nonce|%2Fapp%2F",
      ),
      env,
    );
    const location = new URL(response.headers.get("Location")!);
    expect(location.searchParams.get("line_error")).toBe("account_provisioning_failed");
  });
});
