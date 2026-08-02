import { describe, expect, it } from "vitest";
import {
  SERIALIZABLE_MODE,
  nextProbeState,
  normalizeProbeVersion,
} from "./concurrency-harness";

describe("PostgreSQL concurrency harness primitives", () => {
  it("increments the bigint version without mixing number and bigint", () => {
    expect(nextProbeState({ counter: 0, version: 0n })).toEqual({
      counter: 1,
      version: 1n,
    });
  });

  it("normalizes PostgreSQL bigint strings before arithmetic", () => {
    expect(normalizeProbeVersion("0")).toBe(0n);
    expect(normalizeProbeVersion("9223372036854775807")).toBe(9223372036854775807n);
    expect(() => normalizeProbeVersion("1.5")).toThrow(/integer/i);
  });

  it("uses valid PostgreSQL transaction characteristics", () => {
    expect(SERIALIZABLE_MODE).toBe("isolation level serializable");
  });
});
