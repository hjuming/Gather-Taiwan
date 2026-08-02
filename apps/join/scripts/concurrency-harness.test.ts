import { describe, expect, it } from "vitest";
import { runConcurrencyProbe } from "./concurrency-harness";

const databaseUrl = process.env.GATHER_JOIN_TEST_DATABASE_URL ?? "";

describe.skipIf(!databaseUrl)("P1-01 PostgreSQL concurrency harness", () => {
  it("uses two PostgreSQL connections and retries serializable contention to a deterministic read-back", async () => {
    const result = await runConcurrencyProbe(databaseUrl);

    expect(new Set(result.connectionPids).size).toBe(2);
    expect(result.attempts.every((attempts) => attempts >= 1)).toBe(true);
    expect(Math.max(...result.attempts)).toBeGreaterThan(1);
    expect(result.counter).toBe(2);
    expect(result.version).toBe(2n);
  }, 15_000);
});
