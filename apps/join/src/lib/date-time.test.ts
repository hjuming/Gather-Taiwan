import { describe, expect, it } from "vitest";
import {
  addTaipeiDays,
  dateTimePartsToTaipeiIso,
  daysBetween,
  formatTaipeiDateTimeRange,
  getDefaultEventDateTime,
  getTaipeiDateTimeParts,
  isFutureDateTime,
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

  it("never treats a start time in the past as a valid new event time", () => {
    const now = new Date("2026-08-10T10:31:00.000Z");
    expect(isFutureDateTime({ date: "2026-08-10", time: "18:30" }, now)).toBe(false);
    expect(isFutureDateTime({ date: "2026-08-11", time: "18:30" }, now)).toBe(true);
  });

  it("converts Taipei wall time to an ISO timestamp", () => {
    expect(dateTimePartsToTaipeiIso({ date: "2026-08-10", time: "18:30" })).toBe("2026-08-10T10:30:00.000Z");
  });

  it("shows the Taipei weekday next to the date", () => {
    expect(formatTaipeiDateTimeRange("2026-08-13T10:30:00.000Z", "2026-08-13T13:30:00.000Z"))
      .toBe("2026-08-13（四）18:30–21:30");
    expect(formatTaipeiDateTimeRange("2026-08-13T16:30:00.000Z", "2026-08-14T01:30:00.000Z"))
      .toBe("2026-08-14（五）00:30–09:30");
  });

  it("keeps the time display in 24-hour format", () => {
    expect(getTaipeiDateTimeParts(new Date("2026-08-10T10:30:00.000Z")).time).toBe("18:30");
    expect(isValidTime("21:30")).toBe(true);
    expect(isValidTime("9:30 PM")).toBe(false);
  });

  // 建立表單靠這兩個函式讓結束日期跟著開始日期移動；跨月與跨年是最容易算錯的地方。
  it("counts whole days between two dates, including across months and years", () => {
    expect(daysBetween("2026-08-11", "2026-09-12")).toBe(32);
    expect(daysBetween("2026-08-11", "2026-08-11")).toBe(0);
    expect(daysBetween("2026-09-12", "2026-08-11")).toBe(-32);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2); // 2028 是閏年
  });

  it("returns 0 rather than shifting dates when input is malformed", () => {
    expect(daysBetween("", "2026-09-12")).toBe(0);
    expect(daysBetween("2026-8-1", "2026-09-12")).toBe(0);
  });

  it("shifts a date by the day count the form computed", () => {
    expect(addTaipeiDays("2026-08-11", 32)).toBe("2026-09-12");
    expect(addTaipeiDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addTaipeiDays("2026-09-12", -32)).toBe("2026-08-11");
  });
});
