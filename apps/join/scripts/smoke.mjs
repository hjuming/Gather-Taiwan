import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const distDirectory = join(process.cwd(), "dist");
const sourceDirectories = [
  join(process.cwd(), "src"),
  join(process.cwd(), "worker/index.ts"),
  join(process.cwd(), "worker/response-security.ts"),
];
// worker/line-auth.ts legitimately references SUPABASE_SERVICE_ROLE_KEY by
// *name* (an env var property access, never a literal value) to run the
// LINE OAuth user-provisioning flow server-side — that's the correct place
// for elevated Supabase access to live. It's audited by every check except
// the bare "service_role" keyword scan (see forbiddenServiceRoleKeyword).
const privilegedWorkerSourceFiles = [join(process.cwd(), "worker/line-auth.ts")];
const configFiles = ["index.html", "package.json", "vite.config.ts", "wrangler.jsonc"].map((file) => join(process.cwd(), file));

// Checked everywhere — source, privileged worker source, and every build
// artifact including the Worker bundle: these are dangerous no matter
// where they end up, including inside a vendored dependency.
const forbiddenAnywhere = [
  new RegExp(["dev", "auth"].join("[-_ ]?"), "i"),
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

// Checked in regular source and the CLIENT bundle only — never the Worker
// bundle. A bare "service_role" mention in code that ships to the browser
// would be a real red flag; the same mention inside worker/line-auth.ts's
// compiled output is just its own legitimate env var name, server-side
// only, and is exempted the same way privilegedWorkerSourceFiles is exempt
// from this check in source form.
const forbiddenServiceRoleKeyword = [new RegExp(["service", "role"].join("[-_ ]?"), "i")];

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
  "Content-Security-Policy": "default-src 'self'; connect-src 'self' https://anklbpkyesdmsubyfcna.supabase.co; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
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
const allAuditedFiles = [...sourceFiles, ...privilegedWorkerSourceFiles, ...buildFiles];

for (const path of allAuditedFiles) {
  const content = readFileSync(path, "utf8");
  const match = forbiddenAnywhere.find((pattern) => pattern.test(content));
  if (match) throw new Error(`Forbidden production text ${match} found in ${path}`);
}
for (const path of [...sourceFiles, ...buildFiles.filter((path) => !path.includes("gather_join"))]) {
  const content = readFileSync(path, "utf8");
  const match = forbiddenServiceRoleKeyword.find((pattern) => pattern.test(content));
  if (match) throw new Error(`Forbidden production text ${match} found in ${path}`);
}
for (const path of [...sourceFiles, ...privilegedWorkerSourceFiles]) {
  const content = readFileSync(path, "utf8");
  const match = forbiddenHygiene.find((pattern) => pattern.test(content));
  if (match) throw new Error(`Forbidden hygiene text ${match} found in ${path}`);
}

const workerBundle = buildFiles.find((path) => path.endsWith("gather_join/index.js"));
if (!workerBundle) throw new Error("Built Worker bundle is missing.");

const { default: worker } = await import(pathToFileURL(workerBundle).href);
const response = await worker.fetch(new Request("https://gather.wedopr.com/app/"), {
  ASSETS: {
    fetch: async () => new Response("smoke asset", { status: 200 }),
  },
});

for (const [header, value] of Object.entries(expectedHeaders)) {
  if (response.headers.get(header) !== value) throw new Error(`Built Worker is missing ${header}.`);
}

process.stdout.write(`Smoke passed: built index, ${allAuditedFiles.length} audited files, and built Worker headers.\n`);
