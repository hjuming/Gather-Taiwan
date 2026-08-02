import { describe, expect, it } from "vitest";
import { FixedClock, SystemClock } from "./clock";

describe("FixedClock", () => {
  it("always returns its configured instant without using global Date mocking", () => {
    const configured = new Date("2026-08-02T00:00:00.000Z");
    const clock = new FixedClock(configured);

    configured.setUTCFullYear(2030);

    expect(clock.now().toISOString()).toBe("2026-08-02T00:00:00.000Z");
  });
});

describe("SystemClock", () => {
  it("returns a real current Date instance", () => {
    expect(new SystemClock().now()).toBeInstanceOf(Date);
  });
});
