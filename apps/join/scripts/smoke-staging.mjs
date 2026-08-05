import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const distDirectory = join(process.cwd(), "dist");
const requiredSourceFiles = [
  { file: join(process.cwd(), "worker/staging.ts"), marker: "createStagingWorker" },
  { file: join(process.cwd(), "worker/dev-auth.ts"), marker: "verifyCloudflareAccess" },
  { file: join(process.cwd(), "worker/response-security.ts"), marker: "withSecurityHeaders" },
];

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}

if (!existsSync(distDirectory)) {
  throw new Error("Build output is missing: run pnpm build:staging first.");
}

for (const { file, marker } of requiredSourceFiles) {
  const content = readFileSync(file, "utf8");
  if (!content.includes(marker)) {
    throw new Error(`${file} missing ${marker} implementation marker.`);
  }
}

const buildFiles = filesIn(distDirectory);
const stagingWorkerBundle = buildFiles.find((path) => path.includes("staging") && path.endsWith("index.js"))
  || buildFiles.find((path) => path.endsWith(".js") && path.includes("gather_join"));
if (!stagingWorkerBundle) {
  throw new Error("Staging Worker bundle is missing.");
}

const { default: builtStagingWorker } = await import(pathToFileURL(stagingWorkerBundle).href);
if (!builtStagingWorker?.fetch) {
  throw new Error("Built staging worker default export should include fetch.");
}

const response = await builtStagingWorker.fetch(
  new Request("https://staging.join.gather.wedopr.com/__dev/session", { method: "POST", headers: { Origin: "https://staging.join.gather.wedopr.com" } }),
  {
    ASSETS: {
      fetch: async () => new Response("staging asset", { status: 200 }),
    },
    ACCESS_TEAM_DOMAIN: "gather.cloudflareaccess.com",
    ACCESS_AUD: "gather-staging-aud",
    SUPABASE_JWT_SECRET: "s".repeat(32),
    SUPABASE_AUTH_ISSUER: "https://anklbpkyesdmsubyfcna.supabase.co/auth/v1",
    DEV_AUTH_SUBJECTS: "access",
    AUTH_RATE_LIMITER: {
      limit: async () => ({ success: true }),
    },
  },
);
if (response.status !== 403) {
  throw new Error(`Expected __dev/session to fail closed without assertion, got ${response.status}.`);
}

process.stdout.write(`Smoke staging passed: ${stagingWorkerBundle} imported and route fail-closed path validated.\n`);
