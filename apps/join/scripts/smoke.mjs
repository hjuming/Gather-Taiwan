import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const distDirectory = join(process.cwd(), "dist");
const sourceDirectories = [
  join(process.cwd(), "src"),
  join(process.cwd(), "worker/index.ts"),
  join(process.cwd(), "worker/response-security.ts"),
];
const configFiles = ["index.html", "package.json", "vite.config.ts", "wrangler.jsonc"].map((file) => join(process.cwd(), file));
// Checked in both our source and the built bundle: these patterns are
// dangerous wherever they end up, including inside a vendored dependency.
const forbiddenSecurity = [
  new RegExp(["dev", "auth"].join("[-_ ]?"), "i"),
  new RegExp(["service", "role"].join("[-_ ]?"), "i"),
  /AKIA[0-9A-Z]{16}/,
  /sk_(?:live|test)_[A-Za-z0-9]{16,}/,
  new RegExp(["-----BEGIN ", "PRIVATE", " KEY-----"].join("[A-Z ]*")),
  // Requires a *complete* quoted credential-shaped value (base64/JWT/hex
  // alphabet, 20+ chars, closing quote required) — not just "12+ chars
  // after a quote", which false-matched benign library internals like
  // `token:"access_token"` (a config key name, not a secret) once
  // @supabase-js entered the bundle.
  /(?:api[_-]?key|secret|token)\s*[:=]\s*["'][A-Za-z0-9+/_.=-]{20,}["']/i,
];

// Checked in our source only, never the built bundle: these are authoring
// hygiene issues, not shipping risks. Scanning the bundle for them stopped
// being viable the moment a real npm dependency entered it — @supabase-js's
// own internals legitimately contain console.log calls we don't control
// and can't remove, and scanning minified vendor code for "TODO"/"FIXME"
// substrings is just noise.
const forbiddenHygiene = [
  new RegExp(["console", "\\.", "log"].join("")),
  new RegExp(["debug", "ger"].join("")),
  new RegExp(["TO", "DO"].join("")),
  new RegExp(["FIX", "ME"].join("")),
];
const expectedHeaders = {
  "Content-Security-Policy": "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
};

function filesIn(directory) {
  if (!existsSync(directory)) {
    return [];
  }
  if (!lstatSync(directory).isDirectory()) {
    return [directory];
  }
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}

if (!existsSync(distDirectory)) throw new Error("Build output is missing: run pnpm build first.");

const buildFiles = filesIn(distDirectory);
if (!buildFiles.some((path) => path.endsWith("index.html"))) {
  throw new Error("Built index.html is missing.");
}

const sourceFiles = [...sourceDirectories.flatMap(filesIn), ...configFiles];
for (const path of [...sourceFiles, ...buildFiles]) {
  const content = readFileSync(path, "utf8");
  const match = forbiddenSecurity.find((pattern) => pattern.test(content));
  if (match) throw new Error(`Forbidden production text ${match} found in ${path}`);
}
for (const path of sourceFiles) {
  const content = readFileSync(path, "utf8");
  const match = forbiddenHygiene.find((pattern) => pattern.test(content));
  if (match) throw new Error(`Forbidden hygiene text ${match} found in ${path}`);
}

const workerBundle = buildFiles.find((path) => path.endsWith("gather_join/index.js"));
if (!workerBundle) throw new Error("Built Worker bundle is missing.");

const { default: worker } = await import(pathToFileURL(workerBundle).href);
const response = await worker.fetch(new Request("https://join.gather.wedopr.com/"), {
  ASSETS: {
    fetch: async () => new Response("smoke asset", { status: 200 }),
  },
});

for (const [header, value] of Object.entries(expectedHeaders)) {
  if (response.headers.get(header) !== value) throw new Error(`Built Worker is missing ${header}.`);
}

process.stdout.write(`Smoke passed: built index, ${sourceFiles.length + buildFiles.length} audited files, and built Worker headers.\n`);
