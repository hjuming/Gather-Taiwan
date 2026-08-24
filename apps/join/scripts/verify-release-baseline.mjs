import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const reportPath = resolve(process.env.GATHER_JOIN_REPORT_PATH ?? ".reports/release-baseline.json");
const repoRoot = readGit(["rev-parse", "--show-toplevel"]) ?? "NOT_AVAILABLE";
const branch = readGit(["symbolic-ref", "--short", "HEAD"]) ?? "DETACHED_OR_NOT_AVAILABLE";
const head = readGit(["rev-parse", "HEAD"]) ?? "NOT_AVAILABLE";
const sourceRuntimeFixedPoint = process.env.GATHER_SOURCE_RUNTIME_FIXED_POINT ?? "83a38e8";
const ciCommitSha = process.env.GATHER_JOIN_CI_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "NOT_AVAILABLE";
const isCi = process.env.GITHUB_ACTIONS === "true" || process.env.GATHER_JOIN_CI_COMMIT_SHA !== undefined;
const evidenceTier = isCi ? "CI" : "LOCAL";
const ciRunId = process.env.GITHUB_RUN_ID ?? "NOT_AVAILABLE";
const ciRepository = process.env.GITHUB_REPOSITORY ?? "NOT_AVAILABLE";
const ciRunUrl =
  ciRunId !== "NOT_AVAILABLE" && ciRepository !== "NOT_AVAILABLE"
    ? `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${ciRepository}/actions/runs/${ciRunId}`
    : "NOT_AVAILABLE";

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
  return readVitestSkipData(output).count;
}

function readVitestSkipData(output) {
  const ansiEscape = new RegExp(
    `${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`,
    "g",
  );
  const plainOutput = output.replace(ansiEscape, "");
  const summary = plainOutput.split(/\r?\n/).find((line) => /^\s*Tests\s/.test(line));
  const match = summary?.match(/\|\s*(\d+)\s+skipped\b/);
  const skippedFiles = plainOutput
    .split(/\r?\n/)
    .flatMap((line) => {
      const skipped = line.match(/^\s*↓\s+(.+?)\s+\([^|]*\|\s*(\d+)\s+skipped\b/);
      return skipped ? [{ file: skipped[1], count: Number(skipped[2]) }] : [];
    });
  return {
    count: match ? Number(match[1]) : 0,
    skippedFiles,
  };
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
    ...(gate.id === "test"
      ? {
          observedSkipCount: readVitestSkipCount(result.stdout ?? ""),
          observedSkippedFiles: readVitestSkipData(result.stdout ?? "").skippedFiles,
        }
      : {}),
  };
}

const gateResults = gates.map(runGate);
const failedGates = gateResults.filter((gate) => gate.status !== "PASS");
const testGate = gateResults.find((gate) => gate.id === "test");
const observedSkipCount = testGate?.observedSkipCount ?? null;
const observedSkippedFiles = testGate?.observedSkippedFiles ?? [];
const expectedSkipCount = 1;
const expectedSkippedFiles = ["scripts/concurrency-harness.test.ts"];
const skipCountContract = observedSkipCount === expectedSkipCount;
const skipIdentityContract =
  observedSkippedFiles.length === expectedSkippedFiles.length &&
  observedSkippedFiles.every(
    (entry) => expectedSkippedFiles.includes(entry.file) && entry.count === 1,
  );
const skipContract = skipCountContract && skipIdentityContract ? "PASS" : "FAIL";
if (!skipCountContract) failedGates.push({ id: "expected-db-skip-count-contract" });
if (!skipIdentityContract) failedGates.push({ id: "expected-db-skip-identity-contract" });
const pnpmVersion = spawnSync("pnpm", ["--version"], { encoding: "utf8" });
const nodeMajor = Number(process.versions.node.split(".")[0]);
const report = {
  schema: "gather-join/phase1-release-baseline/v1",
  generatedAt: new Date().toISOString(),
  evidenceTier,
  scope: "Six deterministic app gates without a database connection",
  expectedSkipPolicy: {
    databaseSuite: "NOT_RUN",
    reason: "GATHER_JOIN_TEST_DATABASE_URL is removed for this hermetic baseline; DB runtime evidence requires a separately authorized local fixture gate.",
    expectedSkipCount,
    observedSkipCount,
    expectedSkippedFiles,
    observedSkippedFiles,
    contract: skipContract,
    unexpectedSkips: observedSkipCount === null ? "NOT_VERIFIED" : Math.max(0, observedSkipCount - expectedSkipCount),
    unexpectedSkippedFiles: observedSkippedFiles.filter(
      (entry) => !expectedSkippedFiles.includes(entry.file),
    ),
    alternativeEvidence: "CI local-supabase is a separate isolated runtime job; it is not substituted for this hermetic report.",
  },
  evidenceBoundaries: {
    databaseRuntime: {
      status: "NOT_RUN",
      reason: "The hermetic baseline removes GATHER_JOIN_TEST_DATABASE_URL; database runtime requires a separately authorized fixture gate.",
    },
    stagingSmoke: {
      status: "NOT_RUN",
      reason: "This report does not claim a current staging URL or canonical staging host read-back.",
    },
    cloudflareAccess: {
      status: "NOT_RUN",
      reason: "No Cloudflare Access assertion or protected staging session is exercised by this baseline.",
    },
    productionSemantic: {
      status: "NOT_RUN",
      reason: "Local build and smoke evidence cannot establish production semantic parity.",
    },
    deviceUAT: {
      status: "NOT_RUN",
      reason: "No rendered browser or physical-device UAT is exercised by this baseline.",
    },
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
      event: process.env.GITHUB_EVENT_NAME ?? "NOT_AVAILABLE",
      repository: ciRepository,
      commitSha: ciCommitSha,
      triggerSha: process.env.GITHUB_SHA ?? "NOT_AVAILABLE",
      sha: process.env.GITHUB_SHA ?? "NOT_AVAILABLE",
      runId: ciRunId,
      runUrl: ciRunUrl,
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
