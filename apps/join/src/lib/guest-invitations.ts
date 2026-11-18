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
  guest_invitee_id: string | null;
  guest_response: GuestInvitationRosterResponse | null;
  guest_display_name: string | null;
}

const INVITEE_TOKEN_FRAGMENT_KEY = "invitee_token";
const INVITEE_TOKEN_STORAGE_PREFIX = "gather:invitee-token:";

export function buildInviteeResponseUrl(slug: string, token: string, origin = window.location.origin): string {
  const url = new URL(`/app/e/${encodeURIComponent(slug)}`, origin);
  url.hash = new URLSearchParams({ [INVITEE_TOKEN_FRAGMENT_KEY]: token }).toString();
  return url.toString();
}

export function getInviteeTokenStorageKey(slug: string): string {
  return `${INVITEE_TOKEN_STORAGE_PREFIX}${encodeURIComponent(slug)}`;
}

/** Personal links survive a refresh in the same tab, but never persist across browser sessions. */
export function getStoredInviteeToken(slug: string): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(getInviteeTokenStorageKey(slug))?.trim() || null;
}

/** Tokens are page capabilities: retain only in this tab's session storage, never URL history or local storage. */
export function consumeInviteeTokenFragment(slug: string): string | null {
  if (typeof window === "undefined") return null;
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const token = fragment.get(INVITEE_TOKEN_FRAGMENT_KEY)?.trim() || null;
  if (!token) return null;

  window.sessionStorage.setItem(getInviteeTokenStorageKey(slug), token);
  fragment.delete(INVITEE_TOKEN_FRAGMENT_KEY);
  const remainingFragment = fragment.toString();
  const cleanUrl = `${window.location.pathname}${window.location.search}${remainingFragment ? `#${remainingFragment}` : ""}`;
  window.history.replaceState(window.history.state, "", cleanUrl);
  return token;
}

export function normalizeGuestDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function mergeGuestInvitationInvitee(
  invitees: GuestInvitationInvitee[],
  updated: GuestInvitationInvitee,
): GuestInvitationInvitee[] {
  const updatedName = normalizeGuestDisplayName(updated.display_name).toLocaleLowerCase();
  const existingIndex = invitees.findIndex((invitee) =>
    invitee.id === updated.id
    || normalizeGuestDisplayName(invitee.display_name).toLocaleLowerCase() === updatedName,
  );
  if (existingIndex === -1) return [...invitees, updated];
  let replaced = false;
  return invitees.reduce<GuestInvitationInvitee[]>((next, invitee) => {
    const isSameInvitee = invitee.id === updated.id
      || normalizeGuestDisplayName(invitee.display_name).toLocaleLowerCase() === updatedName;
    if (!isSameInvitee) {
      next.push(invitee);
    } else if (!replaced) {
      next.push(updated);
      replaced = true;
    }
    return next;
  }, []);
}

export function guestResponseLabel(response: GuestInvitationRosterResponse | null): string {
  if (response === "attending") return "已回覆出席";
  if (response === "declined") return "已回覆不克出席";
  return "尚未回覆";
}
