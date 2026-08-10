export interface SecurityHeadersInput {
  includeCacheControl?: boolean;
}

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; connect-src 'self' https://anklbpkyesdmsubyfcna.supabase.co; frame-src https://www.google.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
} as const satisfies Record<string, string>;

export function withSecurityHeaders(
  response: Response,
  options: SecurityHeadersInput = {},
): Response {
  const headers = new Headers(response.headers);
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(header, value);
  }
  if (options.includeCacheControl !== false) {
    headers.set("Cache-Control", "no-store");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
