import { supabase } from "./supabase";
import type {
  EventFieldRow,
  EventInvitationTargetRow,
  EventRow,
  RegistrationRow,
  RegistrationStatus,
  EventFeeMode,
} from "./types";
import type {
  GuestInvitationEvent,
  GuestInvitationRosterResponse,
} from "./guest-invitations";
import { removeEventCover } from "./event-covers";

// events.password_hash is deliberately never granted to any role (P1-04) —
// a bare `select("*")` translates to a real `SELECT *` and Postgres refuses
// the whole query if it can't read every touched column, so every events
// query must enumerate columns explicitly instead of using "*".
const EVENT_COLUMNS =
  "id, organizer_id, created_by_user_id, slug, title, summary, description, " +
  "status, visibility, confirmation_mode, timezone, starts_at, ends_at, " +
  "registration_opens_at, registration_closes_at, location_name, location_address, " +
  "capacity, fee_amount, fee_mode, fee_currency, payment_instructions, roster_visibility, " +
  "roster_show_capacity, invite_only, min_age, invite_reserved_seats, " +
  "invite_pool_deadline, invite_pool_released_at, gathering_type, cover_image_url, " +
  "created_at, updated_at";

export interface PublicEventSummary {
  organizerDisplayName: string | null;
  registrationCount: number | null;
  capacity: number | null;
  showCapacity: boolean;
}

function randomIdempotencyKey(): string {
  return crypto.randomUUID();
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function ensureUserProfile(displayName: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("not signed in");

  const { data: existing } = await supabase.from("users").select("id").eq("id", user.id).maybeSingle();
  if (existing) return;

  const { error } = await supabase.from("users").insert({
    id: user.id,
    email: user.email ?? null,
    display_name: displayName,
  });
  if (error) throw error;
}

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  const { data, error } = await supabase.from("events").select(EVENT_COLUMNS).eq("slug", slug).maybeSingle();
  if (error) throw error;
  return (data as unknown as EventRow | null) ?? null;
}

export async function getPublicEventSummary(slug: string): Promise<PublicEventSummary | null> {
  const response = await fetch(`/app/api/event-summary?slug=${encodeURIComponent(slug)}`, {
    headers: { Accept: "application/json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("活動摘要暫時讀不到");
  return (await response.json()) as PublicEventSummary;
}

export async function getGuestInvitationEvent(
  slug: string,
  inviteeToken: string | null = null,
): Promise<GuestInvitationEvent | null> {
  const { data, error } = await supabase.rpc("get_event_invitation_by_slug", {
    p_slug: slug,
    p_guest_key: inviteeToken,
  });
  if (error) throw error;
  return (data as GuestInvitationEvent | null) ?? null;
}

export async function respondToGuestInvitation(
  slug: string,
  inviteeToken: string,
  response: GuestInvitationRosterResponse,
): Promise<{
  id: string;
  guest_response: GuestInvitationRosterResponse;
  guest_display_name: string;
  attending_count: number;
  capacity: number | null;
}> {
  const { data, error } = await supabase.rpc("respond_to_event_invitation", {
    p_slug: slug,
    p_invitee_token: inviteeToken,
    p_response: response,
  });
  if (error) throw error;
  const result = data as {
    id: string;
    response: GuestInvitationRosterResponse;
    display_name: string;
    attending_count: number;
    capacity: number | null;
  };
  return {
    id: result.id,
    guest_response: result.response,
    guest_display_name: result.display_name,
    attending_count: result.attending_count,
    capacity: result.capacity,
  };
}

export async function getEventInvitationTargets(eventId: string): Promise<EventInvitationTargetRow[]> {
  const { data, error } = await supabase
    .from("event_invitation_targets")
    .select("id, event_id, display_name, response, responded_at, created_by_user_id, created_at, updated_at, revoked_at")
    .eq("event_id", eventId)
    .is("revoked_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as EventInvitationTargetRow[]) ?? [];
}

export async function organizerAddEventInvitationTarget(eventId: string, displayName: string): Promise<string> {
  const { data, error } = await supabase.rpc("organizer_add_event_invitation_target", {
    p_event_id: eventId,
    p_display_name: displayName,
  });
  if (error) throw error;
  return data as string;
}

export async function organizerRemoveEventInvitationTarget(targetId: string): Promise<void> {
  const { error } = await supabase.rpc("organizer_remove_event_invitation_target", {
    p_target_id: targetId,
  });
  if (error) throw error;
}

/** Plaintext is returned exactly once by the database; callers must not persist it. */
export async function organizerIssueEventInvitationToken(targetId: string): Promise<string> {
  const { data, error } = await supabase.rpc("organizer_issue_event_invitation_token", {
    p_target_id: targetId,
  });
  if (error) throw error;
  return data as string;
}

export async function organizerEditEventInvitationTarget(targetId: string, displayName: string): Promise<void> {
  const { error } = await supabase.rpc("organizer_edit_event_invitation_target", {
    p_target_id: targetId,
    p_display_name: displayName,
  });
  if (error) throw error;
}

export async function getEventFields(eventId: string): Promise<EventFieldRow[]> {
  const { data, error } = await supabase
    .from("event_fields")
    .select("*")
    .eq("event_id", eventId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data as EventFieldRow[]) ?? [];
}

export async function getMyRegistrationForEvent(eventId: string): Promise<RegistrationRow | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .in("status", ["offered", "pending_organizer_confirmation", "confirmed", "waitlisted"])
    .maybeSingle();
  if (error) throw error;
  return (data as RegistrationRow | null) ?? null;
}

export async function getEventRoster(eventId: string): Promise<RegistrationRow[]> {
  const { data, error } = await supabase
    .from("registrations")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as RegistrationRow[]) ?? [];
}

export async function organizerAddManualParticipant(
  eventId: string,
  displayName: string,
  contact: string,
  status: "confirmed" | "waitlisted" | "pending_organizer_confirmation" = "confirmed",
): Promise<string> {
  const { data, error } = await supabase.rpc("organizer_add_manual_participant", {
    p_event_id: eventId,
    p_display_name: displayName,
    p_contact: contact || null,
    p_status: status,
  });
  if (error) throw error;
  return data as string;
}

export async function organizerEditManualParticipant(
  registrationId: string,
  updates: { displayName?: string; contact?: string; status?: RegistrationStatus },
): Promise<void> {
  const { error } = await supabase.rpc("organizer_edit_manual_participant", {
    p_registration_id: registrationId,
    p_display_name: updates.displayName ?? null,
    p_contact: updates.contact ?? null,
    p_status: updates.status ?? null,
  });
  if (error) throw error;
}

export async function organizerRemoveManualParticipant(registrationId: string): Promise<void> {
  const { error } = await supabase.rpc("organizer_remove_manual_participant", {
    p_registration_id: registrationId,
  });
  if (error) throw error;
}

export async function getMyRegistrations(): Promise<(RegistrationRow & { events: EventRow })[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("registrations")
    .select(`*, events(${EVENT_COLUMNS})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as (RegistrationRow & { events: EventRow })[]) ?? [];
}

/** Events owned by an organizer identity the current user belongs to. */
export async function getMyHostedEvents(): Promise<EventRow[]> {
  const memberships = await getMyOrganizers();
  const organizerIds = [...new Set(memberships.map((membership) => membership.organizer_id))];
  if (organizerIds.length === 0) return [];

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .in("organizer_id", organizerIds)
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as EventRow[]) ?? [];
}

export async function registerForEvent(
  eventId: string,
  answers: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await supabase.rpc("register_for_event", {
    p_event_id: eventId,
    p_idempotency_key: randomIdempotencyKey(),
    p_answers: answers,
  });
  if (error) throw error;
  return data as string;
}

export async function cancelRegistration(registrationId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_registration", {
    p_registration_id: registrationId,
    p_idempotency_key: randomIdempotencyKey(),
  });
  if (error) throw error;
}

export async function declarePayment(registrationId: string): Promise<void> {
  const { error } = await supabase.rpc("declare_payment_for_registration", {
    p_registration_id: registrationId,
  });
  if (error) throw error;
}

export async function verifyEventPasswordBySlug(slug: string, password: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("verify_event_password_by_slug", {
    p_slug: slug,
    p_password: password,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function reportPaymentInstructions(eventId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc("report_event_payment_instructions", {
    p_event_id: eventId,
    p_note: note,
  });
  if (error) throw error;
}

export interface CreateEventInput {
  organizerId: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  visibility: "public" | "unlisted" | "private";
  confirmationMode: "instant" | "organizer_confirmed";
  timezone: string;
  startsAt: string;
  endsAt: string;
  locationName: string;
  locationAddress: string;
  capacity: number | null;
  feeAmount: number;
  feeMode: EventFeeMode;
  paymentInstructions: string;
  minAge: number | null;
  inviteOnly: boolean;
  gatheringType: string;
  coverImageUrl: string | null;
}

export async function createEvent(input: CreateEventInput): Promise<EventRow> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("not signed in");

  const { data, error } = await supabase
    .from("events")
    .insert({
      organizer_id: input.organizerId,
      created_by_user_id: userId,
      slug: input.slug,
      title: input.title,
      summary: input.summary || null,
      description: input.description || null,
      status: "published",
      visibility: input.visibility,
      confirmation_mode: input.confirmationMode,
      timezone: input.timezone,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      location_name: input.locationName || null,
      location_address: input.locationAddress || null,
      capacity: input.capacity,
      fee_amount: input.feeAmount,
      fee_mode: input.feeMode,
      payment_instructions: input.paymentInstructions || null,
      min_age: input.minAge,
      invite_only: input.inviteOnly,
      gathering_type: input.gatheringType,
      cover_image_url: input.coverImageUrl,
    })
    .select(EVENT_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as EventRow;
}

export interface UpdateEventInput {
  title: string;
  summary: string;
  description: string;
  visibility: "public" | "unlisted" | "private";
  confirmationMode: "instant" | "organizer_confirmed";
  startsAt: string;
  endsAt: string;
  locationName: string;
  locationAddress: string;
  capacity: number | null;
  feeAmount: number;
  feeMode: EventFeeMode;
  paymentInstructions: string;
  minAge: number | null;
  gatheringType: string;
  coverImageUrl: string | null;
}

/**
 * 更新既有聚會。欄位權限由資料庫的 events_update_admin policy 與 column grant 把關，
 * 這裡只送出主辦人可以改的欄位；slug 與 organizer 刻意不開放修改，避免既有分享連結失效。
 */
export async function updateEvent(eventId: string, input: UpdateEventInput): Promise<EventRow> {
  const { data, error } = await supabase
    .from("events")
    .update({
      title: input.title,
      summary: input.summary || null,
      description: input.description || null,
      visibility: input.visibility,
      confirmation_mode: input.confirmationMode,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      location_name: input.locationName || null,
      location_address: input.locationAddress || null,
      capacity: input.capacity,
      fee_amount: input.feeAmount,
      fee_mode: input.feeMode,
      payment_instructions: input.paymentInstructions || null,
      min_age: input.minAge,
      gathering_type: input.gatheringType,
      cover_image_url: input.coverImageUrl,
    })
    .eq("id", eventId)
    .select(EVENT_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as EventRow;
}

export async function updateEventCover(eventId: string, coverImageUrl: string | null): Promise<EventRow> {
  const { data, error } = await supabase
    .from("events")
    .update({ cover_image_url: coverImageUrl })
    .eq("id", eventId)
    .select(EVENT_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as EventRow;
}

export async function cancelEvent(eventId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_event", { p_event_id: eventId });
  if (error) throw error;
}

export interface DuplicatedEventReference {
  id: string;
  slug: string;
}

export async function duplicateEvent(
  eventId: string,
  startsAt: string,
  endsAt: string,
): Promise<DuplicatedEventReference> {
  const { data, error } = await supabase.rpc("duplicate_event", {
    p_event_id: eventId,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
  });
  if (error) throw error;
  if (!data || typeof data.id !== "string" || typeof data.slug !== "string") {
    throw new Error("新聚會建立成功，但回傳資料不完整，請到「我發起的聚會」確認。");
  }
  return { id: data.id, slug: data.slug };
}

/**
 * Storage 代表圖必須在活動資料刪除前清理，因為 Storage delete policy 會
 * 透過仍存在的 event_id 驗證主辦權；兩步任一失敗都不假裝已完成。
 */
export async function deleteEventPermanently(eventId: string, coverImageUrl: string | null): Promise<void> {
  if (coverImageUrl) await removeEventCover(coverImageUrl);
  const { error } = await supabase.rpc("delete_event_permanently", { p_event_id: eventId });
  if (error) {
    throw new Error(`活動資料刪除失敗；若代表圖已清理，請再次執行永久刪除：${error.message}`);
  }
}

export async function createOrganizer(slug: string, displayName: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_organizer", {
    p_slug: slug,
    p_display_name: displayName,
  });
  if (error) throw error;
  return data as string;
}

export interface OrganizerMembership {
  organizer_id: string;
  role: "owner" | "admin" | "staff";
  organizers: { id: string; slug: string; display_name: string };
}

export async function getMyOrganizers(): Promise<OrganizerMembership[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("organizer_members")
    .select("organizer_id, role, organizers(id, slug, display_name)")
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (error) throw error;
  return (data as unknown as OrganizerMembership[]) ?? [];
}
