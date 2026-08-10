import type { EventRow } from "./types";

export function getGoogleMapsSearchUrl(event: Pick<EventRow, "location_name" | "location_address">): string | null {
  if (!event.location_name?.trim()) return null;
  const query = [event.location_name.trim(), event.location_address?.trim()].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function getEventShareUrl(slug: string): string {
  return new URL(`/app/e/${encodeURIComponent(slug)}`, window.location.origin).toString();
}

export function getEventShareText(
  event: Pick<
    EventRow,
    "title" | "summary" | "starts_at" | "ends_at" | "location_name" | "location_address" | "fee_amount" | "capacity"
  >,
  url: string,
): string {
  const start = formatTaipeiDateTime(event.starts_at);
  const end = formatTaipeiTime(event.ends_at);
  const mapsUrl = getGoogleMapsSearchUrl(event);
  const location = event.location_name
    ? mapsUrl
      ? `[${event.location_name}](${mapsUrl})`
      : event.location_name
    : "尚未提供";
  const fee = Number(event.fee_amount) > 0 ? `NT$ ${event.fee_amount}` : "免費";
  const capacity = event.capacity ? `${event.capacity} 人` : "不限人數";
  return [
    `來聚一場～${event.title}`,
    event.summary?.trim() || "相招來聚會",
    `${start} - ${end}`,
    location,
    event.location_address?.trim() || null,
    `**費用** ${fee}`,
    `**人數上限** ${capacity}`,
    url,
  ].filter(Boolean).join("\n");
}

function formatTaipeiDateTime(value: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Taipei",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}年${get("month")}月${get("day")}日 ${get("hour")}:${get("minute")}`;
}

function formatTaipeiTime(value: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Taipei",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")}`;
}

export function getLineShareUrl(text: string): string {
  return `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
}

export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "true");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("copy_failed");
}
