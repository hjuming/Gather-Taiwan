import { createClient } from "@supabase/supabase-js";

// Both values below are the Supabase *publishable* key and project URL —
// explicitly designed to ship inside client bundles (Supabase's dashboard
// labels the key "safe to share publicly"). Access control is entirely on
// the server via Row Level Security; this key alone grants nothing.
const SUPABASE_URL = "https://anklbpkyesdmsubyfcna.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Qc-0shSK0ISVXiWmo8AtaQ_Wmu_5xU7";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
