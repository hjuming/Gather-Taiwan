import { createClient } from "@supabase/supabase-js";
import { supabaseFetch } from "./supabase-fetch";

// Both values below are the Supabase *publishable* key and project URL —
// explicitly designed to ship inside client bundles (Supabase's dashboard
// labels the key "safe to share publicly"). Access control is entirely on
// the server via Row Level Security; this key alone grants nothing.
const SUPABASE_URL = "https://anklbpkyesdmsubyfcna.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Qc-0shSK0ISVXiWmo8AtaQ_Wmu_5xU7";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: { fetch: supabaseFetch },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export async function verifyMagicLinkToken(tokenHash: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token_hash: tokenHash, type: "magiclink" }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { msg?: string } | null;
    throw new Error(payload?.msg ?? "登入驗證失敗");
  }

  const payload = (await response.json()) as {
    access_token: string;
    refresh_token: string;
  };
  const { data, error } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });
  if (error || !data.session) throw error ?? new Error("登入驗證失敗");
  return data.user;
}
