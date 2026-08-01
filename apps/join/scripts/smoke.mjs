import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const distDirectory = join(process.cwd(), "dist");
const sourceDirectories = [join(process.cwd(), "src"), join(process.cwd(), "worker"), join(process.cwd(), "scripts")];
const configFiles = ["index.html", "package.json", "vite.config.ts", "wrangler.jsonc"].map((file) => join(process.cwd(), file));
const forbidden = [
  new RegExp(["dev", "auth"].join("[-_ ]?"), "i"),
  new RegExp(["service", "role"].join("[-_ ]?"), "i"),
  /AKIA[0-9A-Z]{16}/,
  /sk_(?:live|test)_[A-Za-z0-9]{16,}/,
  new RegExp(["-----BEGIN ", "PRIVATE", " KEY-----"].join("[A-Z ]*")),
  /(?:api[_-]?key|secret|token)\s*[:=]\s*["'][^"']{12,}/i,
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
  const match = forbidden.find((pattern) => pattern.test(content));
  if (match) throw new Error(`Forbidden production text ${match} found in ${path}`);
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
