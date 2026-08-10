// New Supabase publishable/secret keys are API keys, not JWTs. Recent
// supabase-js versions may place the publishable key in Authorization while
// bootstrapping a request; the gateway rejects that value as a JWT. Keep the
// key in `apikey`, but preserve a real session JWT after sign-in.
export async function supabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const apiKey = headers.get("apikey");
  if (apiKey?.startsWith("sb_publishable_") && headers.get("authorization") === `Bearer ${apiKey}`) {
    headers.delete("authorization");
  }
  return fetch(input, { ...init, headers });
}
