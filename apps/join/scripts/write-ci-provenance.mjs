import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const reportPath = resolve(process.env.GATHER_JOIN_REPORT_PATH ?? ".reports/release-baseline.json");
const manifestPath = resolve(
  process.env.GATHER_JOIN_PROVENANCE_PATH ?? ".reports/release-baseline-provenance.json",
);
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const commitSha = process.env.GATHER_JOIN_CI_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "NOT_AVAILABLE";
const runId = process.env.GITHUB_RUN_ID ?? "NOT_AVAILABLE";
const repository = process.env.GITHUB_REPOSITORY ?? "NOT_AVAILABLE";
const runUrl =
  runId !== "NOT_AVAILABLE" && repository !== "NOT_AVAILABLE"
    ? `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${repository}/actions/runs/${runId}`
    : "NOT_AVAILABLE";
const artifactUrl = process.env.GATHER_JOIN_BASELINE_ARTIFACT_URL ?? "NOT_AVAILABLE";
const artifactId = process.env.GATHER_JOIN_BASELINE_ARTIFACT_ID ?? "NOT_AVAILABLE";
const artifactName = process.env.GATHER_JOIN_BASELINE_ARTIFACT_NAME ?? "NOT_AVAILABLE";
const expectedArtifactName = `gather-join-release-baseline-${runId}`;
const expectedArtifactUrl =
  artifactId !== "NOT_AVAILABLE" && runUrl !== "NOT_AVAILABLE"
    ? `${runUrl}/artifacts/${artifactId}`
    : "NOT_AVAILABLE";

const mismatches = [];
if (report.evidenceTier !== "CI") mismatches.push("report.evidenceTier");
if (report.provenance?.repository?.head !== commitSha) mismatches.push("repository.head");
if (report.provenance?.ci?.commitSha !== commitSha) mismatches.push("ci.commitSha");
if (report.provenance?.ci?.runId !== runId) mismatches.push("ci.runId");
if (report.provenance?.ci?.runUrl !== runUrl) mismatches.push("ci.runUrl");
if (artifactUrl === "NOT_AVAILABLE") mismatches.push("baselineArtifact.url");
if (artifactId === "NOT_AVAILABLE") mismatches.push("baselineArtifact.id");
if (artifactName === "NOT_AVAILABLE") mismatches.push("baselineArtifact.name");
if (artifactName !== expectedArtifactName) mismatches.push("baselineArtifact.nameExact");
if (artifactUrl !== expectedArtifactUrl) mismatches.push("baselineArtifact.urlExact");

const manifest = {
  schema: "gather-join/phase1-release-provenance/v1",
  generatedAt: new Date().toISOString(),
  evidenceTier: "CI",
  sourceRuntimeEvidenceFixedPoint: report.provenance?.sourceRuntimeEvidenceFixedPoint ?? "NOT_AVAILABLE",
  baseline: {
    schema: report.schema,
    verdict: report.overall,
    failedGates: report.failedGates,
    evidenceBoundaries: report.evidenceBoundaries,
  },
  ci: {
    repository,
    event: process.env.GITHUB_EVENT_NAME ?? "NOT_AVAILABLE",
    commitSha,
    triggerSha: process.env.GITHUB_SHA ?? "NOT_AVAILABLE",
    runId,
    runUrl,
    workflow: process.env.GITHUB_WORKFLOW ?? "NOT_AVAILABLE",
    ref: process.env.GITHUB_REF ?? "NOT_AVAILABLE",
    headRef: process.env.GITHUB_HEAD_REF ?? "NOT_AVAILABLE",
    baseRef: process.env.GITHUB_BASE_REF ?? "NOT_AVAILABLE",
  },
  baselineArtifact: {
    name: artifactName,
    id: artifactId,
    url: artifactUrl,
  },
  exactMatch: mismatches.length === 0 ? "PASS" : "FAIL",
  mismatches,
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`CI provenance manifest: ${manifestPath}\n`);
process.stdout.write(`CI provenance exact match: ${manifest.exactMatch}\n`);
if (mismatches.length > 0) {
  process.stderr.write(`CI provenance mismatches: ${mismatches.join(", ")}\n`);
  process.exitCode = 1;
}
