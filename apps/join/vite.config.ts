import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: mode === "test" ? [react()] : [react(), cloudflare()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "worker/**/*.test.ts"],
  },
}));
