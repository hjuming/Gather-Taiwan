import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";

// The app is deployed under gather.wedopr.com/app/* (same-origin path
// routing, not a separate subdomain — see implementation-control-log.md
// 2026-08-06) so Supabase Auth's session storage and any future cookie
// naturally share with the main static site.
const BASE_PATH = "/app/";

export default defineConfig(({ mode }) => ({
  base: mode === "test" ? "/" : BASE_PATH,
  plugins: mode === "test"
    ? [react()]
    : [
      react(),
      cloudflare({
        configPath: mode === "staging" ? "wrangler.staging.jsonc" : "wrangler.jsonc",
      }),
    ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "worker/**/*.test.ts", "scripts/**/*.test.ts"],
  },
}));
