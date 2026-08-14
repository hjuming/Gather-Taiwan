import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventRow } from "./types";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
    auth: { getUser: vi.fn() },
  },
}));

import {
  canSafelyRemoveNewEventCoverAfterUpdateFailure,
  updateEvent,
  updateEventCapacitySettings,
  type UpdateEventInput,
} from "./api";

const event = {
  id: "event-1",
  organizer_id: "organizer-1",
  created_by_user_id: "user-1",
  slug: "test-event",
  title: "原始活動",
  summary: null,
  description: null,
  status: "published",
  visibility: "private",
  confirmation_mode: "instant",
  timezone: "Asia/Taipei",
  starts_at: "2026-08-15T10:00:00+08:00",
  ends_at: "2026-08-15T12:00:00+08:00",
  registration_opens_at: null,
  registration_closes_at: null,
  location_name: "台北",
  location_address: null,
  capacity: 10,
  fee_amount: "0",
  fee_mode: "free",
  fee_currency: "TWD",
  payment_instructions: null,
  roster_visibility: "organizer_only",
  roster_show_capacity: false,
  invite_only: false,
  min_age: null,
  invite_reserved_seats: 2,
  invite_pool_deadline: "2026-08-14T10:00:00+08:00",
  invite_pool_released_at: null,
  gathering_type: "other",
  cover_image_url: null,
} satisfies EventRow;

const input: UpdateEventInput = {
  title: "更新後活動",
  summary: "簡介",
  description: "說明",
  visibility: "private",
  confirmationMode: "instant",
  startsAt: event.starts_at,
  endsAt: event.ends_at,
  locationName: "台北",
  locationAddress: "信義區",
  capacity: 12,
  inviteReservedSeats: 3,
  invitePoolDeadline: "2026-08-16T10:00:00+08:00",
  feeAmount: 0,
  feeMode: "free",
  paymentInstructions: "",
  minAge: null,
  gatheringType: "other",
  coverImageUrl: null,
};

function mockReadBack(row: EventRow) {
  const single = vi.fn().mockResolvedValue({ data: row, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  return { chain: { select }, select, eq, single };
}

beforeEach(() => {
  mocks.from.mockReset();
  mocks.rpc.mockReset();
});

describe("event update persistence", () => {
  it("writes non-sensitive fields directly and capacity settings through the one RPC path", async () => {
    const directEq = vi.fn().mockResolvedValue({ error: null });
    const directUpdate = vi.fn().mockReturnValue({ eq: directEq });
    const readBack = mockReadBack({ ...event, ...input, capacity: 12, invite_reserved_seats: 3, invite_pool_deadline: input.invitePoolDeadline });
    mocks.from.mockReturnValueOnce({ update: directUpdate }).mockReturnValueOnce(readBack.chain);
    mocks.rpc.mockResolvedValue({
      data: { event_id: event.id, capacity: 12, invite_reserved_seats: 3, invite_pool_deadline: input.invitePoolDeadline, invite_pool_released_at: null, registration_seats: 0, attending_invitee_count: 0, total_occupied_seats: 0 },
      error: null,
    });

    await expect(updateEvent(event.id, input)).resolves.toMatchObject({ id: event.id, capacity: 12 });

    expect(directUpdate).toHaveBeenCalledWith(expect.objectContaining({ title: input.title, location_address: input.locationAddress }));
    expect(directUpdate.mock.calls[0][0]).not.toHaveProperty("capacity");
    expect(directUpdate.mock.calls[0][0]).not.toHaveProperty("invite_reserved_seats");
    expect(directUpdate.mock.calls[0][0]).not.toHaveProperty("invite_pool_deadline");
    expect(mocks.rpc).toHaveBeenCalledWith("update_event_capacity_settings", {
      p_event_id: event.id,
      p_idempotency_key: expect.any(String),
      p_capacity: 12,
      p_invite_reserved_seats: 3,
      p_invite_pool_deadline: input.invitePoolDeadline,
    });
    expect(readBack.select).toHaveBeenCalled();
  });

  it("propagates capacity RPC errors without treating the save as successful", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("capacity rejected") });

    await expect(updateEventCapacitySettings(event.id, {
      capacity: null,
      inviteReservedSeats: event.invite_reserved_seats,
      invitePoolDeadline: event.invite_pool_deadline,
    })).rejects.toThrow("capacity rejected");
  });

  it("marks a failed capacity RPC after direct update as partially committed, so a new cover is retained", async () => {
    const directEq = vi.fn().mockResolvedValue({ error: null });
    const directUpdate = vi.fn().mockReturnValue({ eq: directEq });
    mocks.from.mockReturnValueOnce({ update: directUpdate });
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("capacity rejected") });

    let failure: unknown;
    try {
      await updateEvent(event.id, input);
    } catch (error) {
      failure = error;
    }

    expect((failure as Error).message).toContain("活動基本資料已儲存，但容量設定未更新");
    expect(canSafelyRemoveNewEventCoverAfterUpdateFailure(failure)).toBe(false);
  });
});
