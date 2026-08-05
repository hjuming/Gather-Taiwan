import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  jwtVerify,
} from "jose";
import { describe, expect, it, vi } from "vitest";
import productionWorker from "./index";
import {
  signSupabaseDevJwt,
  verifyCloudflareAccessWithKeySet,
} from "./dev-auth";
import { createStagingWorker } from "./staging";

const devSubject = "11111111-1111-4111-8111-111111111111";

function createEnv(rateLimitSuccess = true) {
  const rateKeys: string[] = [];
  return {
    env: {
      ASSETS: {
        fetch: async () => new Response("asset", { status: 200 }),
      },
      ACCESS_TEAM_DOMAIN: "gather.cloudflareaccess.com",
      ACCESS_AUD: "gather-staging-aud",
      SUPABASE_JWT_SECRET: "s".repeat(32),
      SUPABASE_AUTH_ISSUER: "https://anklbpkyesdmsubyfcna.supabase.co/auth/v1",
      DEV_AUTH_SUBJECTS: devSubject,
      AUTH_RATE_LIMITER: {
        limit: async ({ key }: { key: string }) => {
          rateKeys.push(key);
          return { success: rateLimitSuccess };
        },
      },
    },
    rateKeys,
  };
}

function sessionRequest(subject = devSubject, forwardedFor = "198.51.100.1") {
  return new Request("https://staging.join.gather.wedopr.com/__dev/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cf-Access-Jwt-Assertion": "access.assertion.value",
      Origin: "https://staging.join.gather.wedopr.com",
      "X-Forwarded-For": forwardedFor,
      "CF-Connecting-IP": forwardedFor,
    },
    body: JSON.stringify({ subject }),
  });
}

describe("staging-only dev identity worker", () => {
  it("is absent from the production worker route graph", async () => {
    const response = await productionWorker.fetch(
      sessionRequest(),
      createEnv().env,
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("asset");
    expect(response.headers.has("Set-Cookie")).toBe(false);
  });

  it("requires a verified Access assertion before issuing a short-lived HttpOnly cookie", async () => {
    const verifyAccess = vi.fn(async () => ({ subject: "access-user-1" }));
    const signDevJwt = vi.fn(async () => "signed.supabase.jwt");
    const worker = createStagingWorker({ verifyAccess, signDevJwt });
    const { env, rateKeys } = createEnv();

    const response = await worker.fetch(sessionRequest(), env);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(verifyAccess).toHaveBeenCalledWith(
      "access.assertion.value",
      expect.objectContaining({ ACCESS_AUD: "gather-staging-aud" }),
    );
    expect(signDevJwt).toHaveBeenCalledWith(
      devSubject,
      expect.objectContaining({ SUPABASE_JWT_SECRET: expect.any(String) }),
    );
    expect(rateKeys).toEqual(["access:access-user-1"]);
    expect(response.headers.get("Set-Cookie")).toContain(
      "__Host-gather-dev-session=signed.supabase.jwt",
    );
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(response.headers.get("Set-Cookie")).toContain("Secure");
    expect(response.headers.get("Set-Cookie")).toContain("SameSite=Strict");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("fails closed without Access and ignores spoofed forwarding headers for rate identity", async () => {
    const verifyAccess = vi.fn(async () => ({ subject: "access-user-1" }));
    const worker = createStagingWorker({
      verifyAccess,
      signDevJwt: async () => "signed.supabase.jwt",
    });
    const { env, rateKeys } = createEnv();

    const missingAccess = new Request(sessionRequest());
    missingAccess.headers.delete("Cf-Access-Jwt-Assertion");
    expect((await worker.fetch(missingAccess, env)).status).toBe(403);

    expect((await worker.fetch(sessionRequest(devSubject, "203.0.113.8"), env)).status).toBe(204);
    expect((await worker.fetch(sessionRequest(devSubject, "192.0.2.99"), env)).status).toBe(204);
    expect(rateKeys).toEqual(["access:access-user-1", "access:access-user-1"]);
  });

  it("rejects cross-origin, non-allowlisted subjects, and exceeded rate limits", async () => {
    const worker = createStagingWorker({
      verifyAccess: async () => ({ subject: "access-user-1" }),
      signDevJwt: async () => "signed.supabase.jwt",
    });
    const allowed = createEnv();

    const crossOrigin = sessionRequest();
    crossOrigin.headers.set("Origin", "https://evil.example");
    expect((await worker.fetch(crossOrigin, allowed.env)).status).toBe(403);
    expect(
      (await worker.fetch(sessionRequest("22222222-2222-4222-8222-222222222222"), allowed.env)).status,
    ).toBe(403);

    const limited = createEnv(false);
    const limitedResponse = await worker.fetch(sessionRequest(), limited.env);
    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.headers.get("Retry-After")).toBe("60");
  });
});

describe("dev JWT and Cloudflare Access verification", () => {
  it("mints only a short-lived authenticated Supabase JWT for an allowlisted sub", async () => {
    const env = createEnv().env;
    const token = await signSupabaseDevJwt(devSubject, env);
    const { payload, protectedHeader } = await jwtVerify(
      token,
      new TextEncoder().encode(env.SUPABASE_JWT_SECRET),
      {
        issuer: env.SUPABASE_AUTH_ISSUER,
        audience: "authenticated",
      },
    );

    expect(protectedHeader.alg).toBe("HS256");
    expect(payload.sub).toBe(devSubject);
    expect(payload.role).toBe("authenticated");
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(600);
    expect(token).not.toContain(devSubject);
  });

  it("verifies Access signature, issuer, audience, and expiry", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const publicJwk = await exportJWK(publicKey);
    const keySet = createLocalJWKSet({
      keys: [{ ...publicJwk, alg: "RS256", kid: "access-key", use: "sig" }],
    });
    const issuer = "https://gather.cloudflareaccess.com";
    const now = Math.floor(Date.now() / 1000);
    const valid = await new SignJWT({ email: "reviewer@example.invalid" })
      .setProtectedHeader({ alg: "RS256", kid: "access-key" })
      .setIssuer(issuer)
      .setAudience("gather-staging-aud")
      .setSubject("access-user-1")
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(privateKey);
    const wrongAudience = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "access-key" })
      .setIssuer(issuer)
      .setAudience("wrong-aud")
      .setSubject("access-user-1")
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(privateKey);

    await expect(
      verifyCloudflareAccessWithKeySet(valid, createEnv().env, keySet),
    ).resolves.toEqual({
      subject: "access-user-1",
      email: "reviewer@example.invalid",
    });
    await expect(
      verifyCloudflareAccessWithKeySet(wrongAudience, createEnv().env, keySet),
    ).rejects.toThrow();
  });
});
