/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getEventRoster,
  organizerAddManualParticipant,
  organizerConfirmRegistration,
  organizerDeclineRegistration,
  organizerEditManualParticipant,
  organizerRemoveManualParticipant,
  organizerRemoveRegistration,
} from "../lib/api";
import type { RegistrationRow } from "../lib/types";
import RosterManager from "./RosterManager";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("../lib/api", () => ({
  getEventRoster: vi.fn(),
  organizerAddManualParticipant: vi.fn(),
  organizerConfirmRegistration: vi.fn(),
  organizerDeclineRegistration: vi.fn(),
  organizerEditManualParticipant: vi.fn(),
  organizerRemoveManualParticipant: vi.fn(),
  organizerRemoveRegistration: vi.fn(),
}));

const baseRegistration: RegistrationRow = {
  id: "registration-1",
  event_id: "event-1",
  user_id: "member-1",
  status: "pending_organizer_confirmation",
  seats: 1,
  seat_pool: "public",
  waitlisted_at: null,
  offered_at: null,
  offer_expires_at: null,
  payment_declared_at: null,
  display_name_snapshot: "線上報名者",
  manual_display_name: null,
  manual_contact: null,
  added_by_user_id: null,
};

let root: Root | null = null;

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`button not found: ${label}`);
  return button;
}

async function renderRoster(rows: RegistrationRow[]) {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.mocked(getEventRoster).mockResolvedValue(rows);
  await act(async () => {
    root?.render(<RosterManager eventId="event-1" capacity={10} />);
    await Promise.resolve();
  });
  return container;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(organizerAddManualParticipant).mockResolvedValue("manual-1");
  vi.mocked(organizerConfirmRegistration).mockResolvedValue();
  vi.mocked(organizerDeclineRegistration).mockResolvedValue();
  vi.mocked(organizerEditManualParticipant).mockResolvedValue();
  vi.mocked(organizerRemoveManualParticipant).mockResolvedValue();
  vi.mocked(organizerRemoveRegistration).mockResolvedValue();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
    await Promise.resolve();
  });
  root = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("online registration organizer actions", () => {
  it("exposes confirm, decline, and remove only for an online pending registration", async () => {
    const container = await renderRoster([baseRegistration]);

    expect(findButton(container, "確認報名")).toBeTruthy();
    expect(findButton(container, "婉拒報名")).toBeTruthy();
    expect(findButton(container, "移除")).toBeTruthy();

    await act(async () => {
      findButton(container, "確認報名").click();
      await Promise.resolve();
    });
    expect(organizerConfirmRegistration).toHaveBeenCalledWith(baseRegistration.id);

    await act(async () => {
      findButton(container, "婉拒報名").click();
      await Promise.resolve();
    });
    expect(organizerDeclineRegistration).toHaveBeenCalledWith(baseRegistration.id);

    await act(async () => {
      findButton(container, "移除").click();
      await Promise.resolve();
    });
    expect(organizerRemoveRegistration).toHaveBeenCalledWith(baseRegistration.id);
  });

  it("keeps remove available for confirmed online registrations but hides pending-only actions", async () => {
    const container = await renderRoster([{ ...baseRegistration, status: "confirmed" }]);

    expect(container.textContent).not.toContain("確認報名");
    expect(container.textContent).not.toContain("婉拒報名");

    await act(async () => {
      findButton(container, "移除").click();
      await Promise.resolve();
    });
    expect(organizerRemoveRegistration).toHaveBeenCalledWith(baseRegistration.id);
    expect(organizerRemoveManualParticipant).not.toHaveBeenCalled();
  });

  it("does not expose online actions for a manual participant row", async () => {
    const container = await renderRoster([{
      ...baseRegistration,
      id: "manual-1",
      user_id: null,
      manual_display_name: "手動加入者",
      status: "confirmed",
    }]);

    expect(container.textContent).not.toContain("確認報名");
    expect(container.textContent).not.toContain("婉拒報名");
    await act(async () => {
      findButton(container, "移除").click();
      await Promise.resolve();
    });
    expect(organizerRemoveManualParticipant).toHaveBeenCalledWith("manual-1");
    expect(organizerConfirmRegistration).not.toHaveBeenCalled();
    expect(organizerDeclineRegistration).not.toHaveBeenCalled();
  });
});
