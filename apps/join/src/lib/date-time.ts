export interface DateTimeParts {
  date: string;
  time: string;
}

const TAIPEI_TIME_ZONE = "Asia/Taipei";

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function getTaipeiDateTimeParts(value = new Date()): DateTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TAIPEI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const date = `${getPart(parts, "year")}-${getPart(parts, "month")}-${getPart(parts, "day")}`;
  const time = `${getPart(parts, "hour")}:${getPart(parts, "minute")}`;
  return { date, time };
}

export function getDefaultEventDateTime(now = new Date()): { startsAt: DateTimeParts; endsAt: DateTimeParts } {
  const today = getTaipeiDateTimeParts(now);
  const currentMinutes = Number(today.time.slice(0, 2)) * 60 + Number(today.time.slice(3));
  const date = currentMinutes >= 21 * 60 + 30 ? addTaipeiDays(today.date, 1) : today.date;
  return {
    startsAt: { date, time: "18:30" },
    endsAt: { date, time: "21:30" },
  };
}

export function addTaipeiDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days, 0, 0, 0));
  return value.toISOString().slice(0, 10);
}

/** 兩個 YYYY-MM-DD 之間相差幾天（後者減前者）。輸入不合法時回 0，呼叫端就不會誤移日期。 */
export function daysBetween(from: string, to: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return 0;
  const parse = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

export function dateTimePartsToTaipeiIso(parts: DateTimeParts): string {
  return new Date(`${parts.date}T${parts.time}:00+08:00`).toISOString();
}

export function dateTimePartsToTimestamp(parts: DateTimeParts): number {
  return Date.parse(`${parts.date}T${parts.time}:00+08:00`);
}

export function isValidTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}
