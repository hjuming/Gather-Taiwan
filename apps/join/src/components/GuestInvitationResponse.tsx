import { useEffect, useState } from "react";
import { respondToGuestInvitation } from "../lib/api";
import {
  guestResponseLabel,
  normalizeGuestDisplayName,
  type GuestInvitationEvent,
  type GuestInvitationResponse as ResponseValue,
} from "../lib/guest-invitations";

export default function GuestInvitationResponse({
  event,
  guestKey,
  busy,
  onUpdated,
  onError,
}: {
  event: GuestInvitationEvent;
  guestKey: string;
  busy: boolean;
  onUpdated: (result: {
    id: string;
    guest_response: ResponseValue;
    guest_display_name: string;
    attending_count: number;
    capacity: number | null;
  }) => void;
  onError: (message: string) => void;
}) {
  const [displayName, setDisplayName] = useState(event.guest_display_name ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (event.guest_display_name) setDisplayName(event.guest_display_name);
  }, [event.guest_display_name]);

  async function submit(response: ResponseValue) {
    const normalizedName = normalizeGuestDisplayName(displayName);
    if (!normalizedName) {
      onError("請先輸入你的名字，讓主辦人知道是誰回覆。");
      return;
    }
    setSaving(true);
    try {
      const result = await respondToGuestInvitation(event.slug, guestKey, normalizedName, response);
      onUpdated(result);
    } catch (error) {
      onError(error instanceof Error && error.message.includes("額滿") ? "這場聚會目前已額滿。" : "回覆沒有送出，請稍後再試。");
    } finally {
      setSaving(false);
    }
  }

  const responseLabel = guestResponseLabel(event.guest_response);
  return (
    <div className="guest-invitation-response">
      <div className="guest-invitation-response__intro">
        <p className="section-kicker">回覆邀請</p>
        <h2>你會來嗎？</h2>
        <p>填上名字後，選擇一個回覆即可。</p>
      </div>
      <div className="field">
        <label htmlFor="guest-display-name">你的名字</label>
        <input
          id="guest-display-name"
          type="text"
          value={displayName}
          onChange={(event_) => setDisplayName(event_.target.value)}
          placeholder="例如：哈蜜瓜"
          maxLength={80}
          disabled={busy || saving}
        />
      </div>
      <p className="guest-invitation-response__status" aria-live="polite">
        目前狀態：<strong>{responseLabel}</strong>
      </p>
      <div className="actions guest-invitation-response__actions">
        <button type="button" className="btn-primary" onClick={() => submit("attending")} disabled={busy || saving}>
          {saving ? "送出中…" : "我要出席"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => submit("declined")} disabled={busy || saving}>
          這次不克出席
        </button>
      </div>
      <p className="hint">不用註冊；之後回到同一個網址，就能修改自己的回覆。</p>
    </div>
  );
}
