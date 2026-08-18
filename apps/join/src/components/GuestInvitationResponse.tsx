import { useState } from "react";
import { respondToGuestInvitation } from "../lib/api";
import {
  guestResponseLabel,
  type GuestInvitationEvent,
  type GuestInvitationRosterResponse as ResponseValue,
} from "../lib/guest-invitations";

export default function GuestInvitationResponse({
  event,
  inviteeToken,
  busy,
  onUpdated,
  onError,
}: {
  event: GuestInvitationEvent;
  inviteeToken: string;
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
  const [saving, setSaving] = useState(false);

  async function submit(response: ResponseValue) {
    if (!event.guest_invitee_id) {
      onError("這個個人邀請連結已失效，請向主辦人索取新的連結。");
      return;
    }
    setSaving(true);
    try {
      const result = await respondToGuestInvitation(event.slug, inviteeToken, response);
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
        <p>{event.guest_display_name ? `嗨，${event.guest_display_name}。` : "請使用主辦人提供的個人邀請連結。"}</p>
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
      <p className="hint">不用註冊；保留原始個人邀請連結即可再次開啟並修改，主辦人重發後舊連結會失效。</p>
    </div>
  );
}
