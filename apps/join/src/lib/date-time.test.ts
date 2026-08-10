import { describe, expect, it } from "vitest";
import {
  dateTimePartsToTaipeiIso,
  getDefaultEventDateTime,
  getTaipeiDateTimeParts,
  isValidTime,
} from "./date-time";

describe("event date/time helpers", () => {
  it("formats defaults in Taipei time with a same-day 18:30–21:30 window", () => {
    const defaults = getDefaultEventDateTime(new Date("2026-08-10T07:00:00.000Z"));
    expect(defaults.startsAt).toEqual({ date: "2026-08-10", time: "18:30" });
    expect(defaults.endsAt).toEqual({ date: "2026-08-10", time: "21:30" });
  });

  it("moves to tomorrow after the same-day window has ended", () => {
    const defaults = getDefaultEventDateTime(new Date("2026-08-10T14:00:00.000Z"));
    expect(defaults.startsAt.date).toBe("2026-08-11");
    expect(defaults.endsAt.date).toBe("2026-08-11");
  });

  it("converts Taipei wall time to an ISO timestamp", () => {
    expect(dateTimePartsToTaipeiIso({ date: "2026-08-10", time: "18:30" })).toBe("2026-08-10T10:30:00.000Z");
  });

  it("keeps the time display in 24-hour format", () => {
    expect(getTaipeiDateTimeParts(new Date("2026-08-10T10:30:00.000Z")).time).toBe("18:30");
    expect(isValidTime("21:30")).toBe(true);
    expect(isValidTime("9:30 PM")).toBe(false);
  });
});
