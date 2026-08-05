import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
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
