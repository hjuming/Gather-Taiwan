import type { EventRow } from "./types";
import { getEventSocialFacts } from "../../shared/event-social-facts";

function buildLocationQuery(location: { location_name?: string | null; location_address?: string | null }): string | null {
  const query = [location.location_name?.trim(), location.location_address?.trim()].filter(Boolean).join(" ");
  return query || null;
}

export function getGoogleMapsSearchUrl(event: Pick<EventRow, "location_name" | "location_address">): string | null {
  if (!event.location_name?.trim()) return null;
  const query = buildLocationQuery(event);
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// 免金鑰的 Google 地圖內嵌預覽；不提供地址自動完成建議，只依目前輸入內容顯示對應地圖。
export function getGoogleMapsEmbedUrl(location: { location_name?: string | null; location_address?: string | null }): string | null {
  const query = buildLocationQuery(location);
  if (!query) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

export function getEventShareUrl(slug: string): string {
  return new URL(`/app/e/${encodeURIComponent(slug)}`, window.location.origin).toString();
}

export function getEventShareText(
  event: Pick<
    EventRow,
    "title" | "summary" | "starts_at" | "ends_at" | "location_name" | "location_address" | "fee_amount" | "capacity"
  > & Partial<Pick<EventRow, "fee_mode" | "payment_instructions">>,
  url: string,
): string {
  const facts = getEventSocialFacts(event);
  return [
    facts.title,
    facts.summary,
    "",
    `📅 ${facts.dateRange}`,
    `📍 ${facts.location}`,
    facts.address,
    `💰 ${facts.fee}`,
    `👥 ${facts.capacity}`,
    "",
    "確認出席狀況",
    url,
  ].join("\n");
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
