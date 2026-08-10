import type { EventRow } from "./types";

export function getGoogleMapsSearchUrl(event: Pick<EventRow, "location_name" | "location_address">): string | null {
  if (!event.location_name?.trim()) return null;
  const query = [event.location_name.trim(), event.location_address?.trim()].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function getEventShareUrl(slug: string): string {
  return new URL(`/app/e/${encodeURIComponent(slug)}`, window.location.origin).toString();
}

export function getEventShareText(event: Pick<EventRow, "title" | "starts_at" | "ends_at" | "location_name">, url: string): string {
  const start = new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Taipei",
  }).format(new Date(event.starts_at));
  const end = new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Taipei",
  }).format(new Date(event.ends_at));
  return [
    `一起來聚一場：${event.title}`,
    `時間：${start}–${end}`,
    event.location_name ? `地點：${event.location_name}` : null,
    url,
  ].filter(Boolean).join("\n");
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
