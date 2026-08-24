export type EventFeeMode = "free" | "fixed" | "on_site_split";

export interface EventSocialFactsInput {
  title: string;
  summary?: string | null;
  starts_at: string;
  ends_at: string;
  location_name?: string | null;
  location_address?: string | null;
  fee_amount: string | number;
  fee_mode?: EventFeeMode | null;
  payment_instructions?: string | null;
  capacity: number | null;
}

function formatTaipeiDateTimeRange(startsAt: string, endsAt: string): string {
  const format = (value: string) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(value));
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
    const weekday = {
      Sun: "日",
      Mon: "一",
      Tue: "二",
      Wed: "三",
      Thu: "四",
      Fri: "五",
      Sat: "六",
    }[get("weekday")] ?? get("weekday");
    return { date: `${get("year")}-${get("month")}-${get("day")}`, weekday, time: `${get("hour")}:${get("minute")}` };
  };
  const start = format(startsAt);
  const end = format(endsAt);
  return `${start.date}（${start.weekday}）${start.time}–${start.date === end.date ? end.time : `${end.date}（${end.weekday}）${end.time}`}`;
}

function formatEventFee(event: Pick<EventSocialFactsInput, "fee_amount" | "fee_mode" | "payment_instructions">): string {
  const amount = Number(event.fee_amount);
  if (event.fee_mode === "on_site_split") return "現場結算後分攤";
  if (event.fee_mode === "fixed" || amount > 0) return `NT$ ${event.fee_amount}`;
  if (/現場|分攤/.test(event.payment_instructions ?? "")) return "現場結算後分攤";
  return "免費";
}

export function getEventSocialFacts(event: EventSocialFactsInput) {
  return {
    title: `來聚一場～${event.title}`,
    summary: event.summary?.trim() || "相招來聚會",
    dateRange: formatTaipeiDateTimeRange(event.starts_at, event.ends_at),
    location: event.location_name?.trim() || "尚未提供",
    address: event.location_address?.trim() || "地址待公布",
    fee: formatEventFee(event),
    capacity: event.capacity ? `${event.capacity} 人` : "不限人數",
  };
}

export function getEventSocialDescription(event: EventSocialFactsInput): string {
  const facts = getEventSocialFacts(event);
  return [facts.summary, facts.dateRange, facts.location, facts.address, facts.fee, facts.capacity].join("｜");
}
