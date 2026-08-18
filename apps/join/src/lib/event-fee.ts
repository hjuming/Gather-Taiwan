export type EventFeeMode = "free" | "fixed" | "on_site_split";

export function formatEventFee(event: {
  fee_amount: string | number;
  fee_mode?: EventFeeMode | null;
  payment_instructions?: string | null;
}): string {
  const amount = Number(event.fee_amount);
  if (event.fee_mode === "on_site_split") return "現場結算後分攤";
  if (event.fee_mode === "fixed" || amount > 0) return `NT$ ${event.fee_amount}`;

  // Backward-compatible read for events created before fee_mode existed.
  if (/現場|分攤/.test(event.payment_instructions ?? "")) return "現場結算後分攤";
  return "免費";
}
