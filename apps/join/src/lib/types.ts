export type EventStatus =
  | "draft"
  | "published"
  | "cancellation_pending"
  | "cancelled"
  | "cancellation_exception";

export type EventVisibility = "public" | "unlisted" | "private";
export type ConfirmationMode = "instant" | "organizer_confirmed";
export type FieldType = "short_text" | "long_text" | "single_choice" | "multiple_choice" | "boolean";

export type RegistrationStatus =
  | "offered"
  | "pending_organizer_confirmation"
  | "confirmed"
  | "waitlisted"
  | "offer_expired"
  | "expired"
  | "declined"
  | "cancelled"
  | "removed_by_organizer";

export interface EventRow {
  id: string;
  organizer_id: string;
  created_by_user_id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  status: EventStatus;
  visibility: EventVisibility;
  confirmation_mode: ConfirmationMode;
  timezone: string;
  starts_at: string;
  ends_at: string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  location_name: string | null;
  location_address: string | null;
  capacity: number | null;
  fee_amount: string;
  fee_currency: string;
  payment_instructions: string | null;
  roster_visibility: string;
  roster_show_capacity: boolean;
  invite_only: boolean;
  min_age: number | null;
  invite_reserved_seats: number | null;
  invite_pool_deadline: string | null;
  invite_pool_released_at: string | null;
  gathering_type: string | null;
  cover_image_url: string | null;
  updated_at?: string | null;
}

export interface EventFieldRow {
  id: string;
  event_id: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  is_required: boolean;
  options: string[] | null;
  position: number;
}

export interface RegistrationRow {
  id: string;
  event_id: string;
  user_id: string | null;
  status: RegistrationStatus;
  seats: number;
  seat_pool: "invite" | "public";
  waitlisted_at: string | null;
  offered_at: string | null;
  offer_expires_at: string | null;
  payment_declared_at: string | null;
  display_name_snapshot: string | null;
  manual_display_name: string | null;
  manual_contact: string | null;
  added_by_user_id: string | null;
}

export const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = {
  offered: "候補遞補中，請確認出席",
  pending_organizer_confirmation: "已送出，等待主辦確認",
  confirmed: "已確認參加",
  waitlisted: "候補中",
  offer_expired: "遞補逾期",
  expired: "已過期",
  declined: "已婉拒",
  cancelled: "已取消",
  removed_by_organizer: "已由主辦移除",
};
