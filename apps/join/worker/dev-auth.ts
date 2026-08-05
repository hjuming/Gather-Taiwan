import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import type { JWTVerifyGetKey, JWTPayload } from "jose";

const ACCESS_TEAM_DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/;
const ACCESS_AUDIENCE_RE = /^.+$/;
const SUPABASE_ISSUER_HOST_RE = /^([a-z0-9-]+\.)?supabase\.co$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CloudflareAccessEnv {
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
}

export interface SupabaseDevAuthEnv {
  SUPABASE_JWT_SECRET: string;
  SUPABASE_AUTH_ISSUER: string;
}

export interface DevAuthEnv extends CloudflareAccessEnv, SupabaseDevAuthEnv {
  DEV_AUTH_SUBJECTS: string;
}

export interface AccessClaims {
  subject: string;
  email?: string;
}

export interface SignDevJwt {
  (subject: string, env: DevAuthEnv): Promise<string>;
}

export interface VerifyCloudflareAccess {
  (assertion: string, env: CloudflareAccessEnv): Promise<AccessClaims>;
}

function validateAccessDomain(raw: string): string {
  const domain = raw.trim().toLowerCase();
  if (!ACCESS_TEAM_DOMAIN_RE.test(domain)) {
    throw new Error("Invalid ACCESS_TEAM_DOMAIN");
  }
  return domain;
}

function validateAudience(audience: string): string {
  const trimmed = audience.trim();
  if (!ACCESS_AUDIENCE_RE.test(trimmed)) {
    throw new Error("Invalid ACCESS_AUD");
  }
  return trimmed;
}

function validateSupabaseIssuer(raw: string): string {
  const issuer = new URL(raw.trim());
  if (issuer.protocol !== "https:") {
    throw new Error("SUPABASE_AUTH_ISSUER must use HTTPS");
  }
  if (issuer.pathname !== "/auth/v1") {
    throw new Error("SUPABASE_AUTH_ISSUER must be /auth/v1");
  }
  if (!SUPABASE_ISSUER_HOST_RE.test(issuer.hostname)) {
    throw new Error("SUPABASE_AUTH_ISSUER host is invalid");
  }
  if (issuer.search || issuer.hash) {
    throw new Error("SUPABASE_AUTH_ISSUER must not contain query or fragment");
  }
  return issuer.toString();
}

function validateJwtSecret(secret: string): Uint8Array {
  const raw = new TextEncoder().encode(secret ?? "");
  if (raw.length < 32) {
    throw new Error("SUPABASE_JWT_SECRET must be at least 32 bytes");
  }
  return raw;
}

function parseAllowlist(raw: string): Set<string> {
  return new Set(
    raw
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => UUID_RE.test(item)),
  );
}

function validateJwtPayloadSubject(subject: string): string {
  if (!UUID_RE.test(subject)) {
    throw new Error("Invalid subject");
  }
  return subject;
}

export function isAllowedDevSubject(subject: string, env: DevAuthEnv): boolean {
  return parseAllowlist(env.DEV_AUTH_SUBJECTS).has(subject);
}

export async function verifyCloudflareAccess(
  assertion: string,
  env: CloudflareAccessEnv,
): Promise<AccessClaims> {
  const jwkSetUrl = getAccessJwkSetUrl(env);
  const verifyWithKeySet = createRemoteJWKSet(jwkSetUrl);
  return verifyCloudflareAccessWithKeySet(
    assertion,
    {
      ACCESS_TEAM_DOMAIN: validateAccessDomain(env.ACCESS_TEAM_DOMAIN),
      ACCESS_AUD: validateAudience(env.ACCESS_AUD),
    },
    verifyWithKeySet,
  );
}

export async function verifyCloudflareAccessWithKeySet(
  assertion: string,
  env: CloudflareAccessEnv,
  keySet: JWTVerifyGetKey,
): Promise<AccessClaims> {
  const claims = await jwtVerify(assertion, keySet, {
    issuer: `https://${validateAccessDomain(env.ACCESS_TEAM_DOMAIN)}`,
    audience: validateAudience(env.ACCESS_AUD),
    algorithms: ["RS256"],
  });
  const payload = claims.payload as JWTPayload;
  if (typeof payload.sub !== "string" || payload.sub.trim().length === 0) {
    throw new Error("Invalid access token subject");
  }
  const email = typeof payload.email === "string" && payload.email.length > 0
    ? payload.email
    : undefined;

  return { subject: payload.sub, email };
}

function getAccessJwkSetUrl(env: CloudflareAccessEnv): URL {
  const domain = validateAccessDomain(env.ACCESS_TEAM_DOMAIN);
  validateAudience(env.ACCESS_AUD);
  return new URL(`https://${domain}/cdn-cgi/access/certs`);
}

export async function signSupabaseDevJwt(
  subject: string,
  env: DevAuthEnv,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payloadSubject = validateJwtPayloadSubject(subject);
  const secret = validateJwtSecret(env.SUPABASE_JWT_SECRET);
  const issuer = validateSupabaseIssuer(env.SUPABASE_AUTH_ISSUER);

  return await new SignJWT({ role: "authenticated", aal: "aal1" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience("authenticated")
    .setSubject(payloadSubject)
    .setIssuedAt(now)
    .setExpirationTime(now + 600)
    .sign(secret);
}
