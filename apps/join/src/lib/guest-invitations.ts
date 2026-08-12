export type GuestInvitationResponse = "attending" | "declined";
export type GuestInvitationRosterResponse = "pending" | GuestInvitationResponse;

export interface GuestInvitationInvitee {
  id: string;
  display_name: string;
  response: GuestInvitationRosterResponse;
}

export interface GuestInvitationEvent {
  id: string;
  organizer_id: string;
  created_by_user_id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  status: "published";
  visibility: "private";
  confirmation_mode: "instant" | "organizer_confirmed";
  timezone: string;
  starts_at: string;
  ends_at: string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  location_name: string | null;
  location_address: string | null;
  capacity: number | null;
  fee_amount: string | number;
  fee_mode: "free" | "fixed" | "on_site_split";
  fee_currency: string;
  payment_instructions: string | null;
  roster_visibility: string;
  roster_show_capacity: boolean;
  invite_only: true;
  min_age: number | null;
  invite_reserved_seats: number | null;
  invite_pool_deadline: string | null;
  invite_pool_released_at: string | null;
  gathering_type: string | null;
  cover_image_url: string | null;
  updated_at: string | null;
  organizer_display_name: string | null;
  attending_count: number;
  invitees: GuestInvitationInvitee[];
  guest_response: GuestInvitationRosterResponse | null;
  guest_display_name: string | null;
}

export function getGuestInvitationStorageKey(slug: string, displayName?: string): string {
  const suffix = displayName ? `:${encodeURIComponent(normalizeGuestDisplayName(displayName))}` : "";
  return `gather:guest-invite:${slug}${suffix}`;
}

export function normalizeGuestDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function getOrCreateGuestInvitationKey(slug: string, displayName?: string): string {
  if (typeof window === "undefined") return "";
  const storageKey = getGuestInvitationStorageKey(slug, displayName);
  const existing = window.localStorage.getItem(storageKey)?.trim();
  if (existing) return existing;

  const key = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(storageKey, key);
  return key;
}

export function guestResponseLabel(response: GuestInvitationRosterResponse | null): string {
  if (response === "attending") return "已回覆出席";
  if (response === "declined") return "已回覆不克出席";
  return "尚未回覆";
}
