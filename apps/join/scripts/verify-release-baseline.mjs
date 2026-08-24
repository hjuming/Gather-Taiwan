import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const reportPath = resolve(process.env.GATHER_JOIN_REPORT_PATH ?? ".reports/release-baseline.json");
const repoRoot = readGit(["rev-parse", "--show-toplevel"]) ?? "NOT_AVAILABLE";
const branch = readGit(["symbolic-ref", "--short", "HEAD"]) ?? "DETACHED_OR_NOT_AVAILABLE";
const head = readGit(["rev-parse", "HEAD"]) ?? "NOT_AVAILABLE";
const sourceRuntimeFixedPoint = process.env.GATHER_SOURCE_RUNTIME_FIXED_POINT ?? "83a38e8";

const gates = [
  { id: "typecheck", args: ["typecheck"] },
  { id: "lint", args: ["lint"] },
  {
    id: "test",
    args: ["test"],
    prepareEnv(env) {
      delete env.GATHER_JOIN_TEST_DATABASE_URL;
    },
  },
  { id: "test:security", args: ["test:security"] },
  { id: "build", args: ["build"] },
  { id: "smoke", args: ["smoke"] },
];

function readGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

function gitProbe(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  return {
    status: result.status,
    value: result.status === 0 ? result.stdout.trim() : "NOT_AVAILABLE",
  };
}

function gitDiffStatus(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status === 0) return "CLEAN";
  if (result.status === 1) return "DIFF_PRESENT";
  return "NOT_VERIFIED";
}

function readVitestSkipCount(output) {
  const ansiEscape = new RegExp(
    `${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`,
    "g",
  );
  const plainOutput = output.replace(ansiEscape, "");
  const summary = plainOutput.split(/\r?\n/).find((line) => /^\s*Tests\s/.test(line));
  const match = summary?.match(/\|\s*(\d+)\s+skipped\b/);
  return match ? Number(match[1]) : 0;
}

function runGate(gate) {
  const startedAt = Date.now();
  const env = { ...process.env };
  gate.prepareEnv?.(env);
  const result = spawnSync("pnpm", gate.args, {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return {
    id: gate.id,
    command: ["pnpm", ...gate.args].join(" "),
    status: result.status === 0 ? "PASS" : "FAIL",
    exitCode: result.status,
    signal: result.signal ?? null,
    durationMs: Date.now() - startedAt,
    ...(gate.id === "test" ? { observedSkipCount: readVitestSkipCount(result.stdout ?? "") } : {}),
  };
}

const gateResults = gates.map(runGate);
const failedGates = gateResults.filter((gate) => gate.status !== "PASS");
const testGate = gateResults.find((gate) => gate.id === "test");
const observedSkipCount = testGate?.observedSkipCount ?? null;
const expectedSkipCount = 1;
const skipContract = observedSkipCount === expectedSkipCount ? "PASS" : "FAIL";
if (skipContract !== "PASS") failedGates.push({ id: "expected-db-skip-contract" });
const pnpmVersion = spawnSync("pnpm", ["--version"], { encoding: "utf8" });
const nodeMajor = Number(process.versions.node.split(".")[0]);
const report = {
  schema: "gather-join/phase1-release-baseline/v1",
  generatedAt: new Date().toISOString(),
  evidenceTier: "LOCAL",
  scope: "Six deterministic app gates without a database connection",
  expectedSkipPolicy: {
    databaseSuite: "NOT_RUN",
    reason: "GATHER_JOIN_TEST_DATABASE_URL is removed for this hermetic baseline; DB runtime evidence requires a separately authorized local fixture gate.",
    expectedSkipCount,
    observedSkipCount,
    contract: skipContract,
    unexpectedSkips: observedSkipCount === null ? "NOT_VERIFIED" : Math.max(0, observedSkipCount - expectedSkipCount),
  },
  provenance: {
    sourceRuntimeEvidenceFixedPoint: sourceRuntimeFixedPoint,
    repository: {
      root: repoRoot,
      branch,
      head,
      upstream: readGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]) ?? "NOT_AVAILABLE",
      originHead: readGit(["rev-parse", `refs/remotes/origin/${branch}`]) ?? "NOT_AVAILABLE",
      workingTree: gitProbe(["status", "--porcelain"]).value === "" ? "CLEAN" : "DIRTY",
      diffCheck: gitProbe(["diff", "--check"]).status === 0 ? "PASS" : "FAIL",
      diffFromOrigin: gitDiffStatus(["diff", "--quiet", `origin/${branch}...HEAD`]),
    },
    runtime: {
      node: process.version,
      pnpm: pnpmVersion.status === 0 ? pnpmVersion.stdout.trim() : "NOT_AVAILABLE",
      engine: nodeMajor >= 22 ? "PASS" : "WARN_UNSUPPORTED_NODE_ENGINE",
    },
    ci: {
      provider: "GitHub Actions",
      sha: process.env.GITHUB_SHA ?? "NOT_AVAILABLE",
      runId: process.env.GITHUB_RUN_ID ?? "NOT_AVAILABLE",
      workflow: process.env.GITHUB_WORKFLOW ?? "NOT_AVAILABLE",
      ref: process.env.GITHUB_REF ?? "NOT_AVAILABLE",
      headRef: process.env.GITHUB_HEAD_REF ?? "NOT_AVAILABLE",
      baseRef: process.env.GITHUB_BASE_REF ?? "NOT_AVAILABLE",
    },
    deployment: {
      url: process.env.GATHER_JOIN_DEPLOYMENT_URL ?? "NOT_VERIFIED",
      sourceMetadata: "NOT_VERIFIED",
    },
  },
  gates: gateResults,
  overall: failedGates.length === 0 ? "PASS_WITH_EXPECTED_SKIP" : "FAIL",
  failedGates: failedGates.map((gate) => gate.id),
};

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`Release baseline report: ${reportPath}\n`);
process.stdout.write(`Release baseline verdict: ${report.overall}\n`);
if (failedGates.length > 0) {
  process.stderr.write(`Failed gates: ${failedGates.map((gate) => gate.id).join(", ")}\n`);
  process.exitCode = 1;
}
