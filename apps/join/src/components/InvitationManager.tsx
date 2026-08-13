import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  getEventInvitationTargets,
  organizerAddEventInvitationTarget,
  organizerEditEventInvitationTarget,
  organizerRemoveEventInvitationTarget,
} from "../lib/api";
import { copyText, getEventShareUrl } from "../lib/event-links";
import type { EventInvitationTargetRow } from "../lib/types";

const RESPONSE_LABEL: Record<EventInvitationTargetRow["response"], string> = {
  pending: "待回覆",
  attending: "已回覆出席",
  declined: "不克出席",
};

export default function InvitationManager({
  eventId,
  slug,
  capacity,
}: {
  eventId: string;
  slug: string;
  capacity: number | null;
}) {
  const [targets, setTargets] = useState<EventInvitationTargetRow[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  async function load() {
    try {
      setTargets(await getEventInvitationTargets(eventId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取邀請名單失敗");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("請輸入受邀朋友的名字");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await organizerAddEventInvitationTarget(eventId, name.trim());
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增邀請對象失敗");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(target: EventInvitationTargetRow) {
    if (!window.confirm(`確定要移除「${target.display_name}」的邀請紀錄嗎？`)) return;
    setBusy(true);
    setError(null);
    try {
      await organizerRemoveEventInvitationTarget(target.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "移除邀請對象失敗");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(target: EventInvitationTargetRow) {
    setEditingId(target.id);
    setEditingName(target.display_name);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function handleEdit(event: FormEvent, target: EventInvitationTargetRow) {
    event.preventDefault();
    const nextName = editingName.trim();
    if (!nextName) {
      setError("請輸入受邀朋友的名字");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await organizerEditEventInvitationTarget(target.id, nextName);
      cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "修改邀請對象失敗");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyLink() {
    try {
      await copyText(getEventShareUrl(slug));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("複製失敗，請手動複製網址");
    }
  }

  const stats = useMemo(() => ({
    pending: targets.filter((target) => target.response === "pending").length,
    attending: targets.filter((target) => target.response === "attending").length,
    declined: targets.filter((target) => target.response === "declined").length,
  }), [targets]);

  return (
    <div className="invitation-manager">
      <div className="invitation-manager__intro">
        <p className="hint">把同一個網址傳給朋友，他們不用註冊，輸入自己的名字後就能選出席或不克出席。拿到網址的人可以看到受邀暱稱、修改回覆，請只分享給受邀朋友。</p>
        <div className="actions">
          <button type="button" className="btn-secondary" onClick={handleCopyLink} disabled={busy}>
            {copied ? "已複製邀請網址 ✓" : "複製共用邀請網址"}
          </button>
        </div>
      </div>

      {error && <div className="banner banner--error" role="alert">{error}</div>}

      <div className="roster-stats" aria-label="邀請回覆統計">
        <div><span>已回覆出席</span><strong>{stats.attending}{capacity ? ` / ${capacity}` : ""}</strong></div>
        <div><span>待回覆</span><strong>{stats.pending}</strong></div>
        <div><span>不克出席</span><strong>{stats.declined}</strong></div>
      </div>

      <form className="roster-add-form" onSubmit={handleAdd}>
        <div className="field">
          <label htmlFor="invitation-target-name">先加入受邀名單</label>
          <input
            id="invitation-target-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：哈蜜瓜"
            maxLength={80}
            disabled={busy}
          />
        </div>
        <button type="submit" className="btn-secondary" disabled={busy}>加入待回覆名單</button>
      </form>

      <div className="registration-list">
        {targets.length === 0 && <p className="hint">還沒有預先加入的受邀朋友；收到回覆後也會自動出現在這裡。</p>}
        {targets.map((target) => (
          <article key={target.id} className="roster-entry invitation-manager__entry">
            {editingId === target.id ? (
              <form className="invitation-manager__edit" onSubmit={(event) => handleEdit(event, target)}>
                <label htmlFor={`invitation-edit-${target.id}`}>受邀名稱</label>
                <input
                  id={`invitation-edit-${target.id}`}
                  type="text"
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  maxLength={80}
                  disabled={busy}
                />
                <div className="actions">
                  <button type="submit" className="btn-primary" disabled={busy}>儲存</button>
                  <button type="button" className="btn-text" onClick={cancelEdit} disabled={busy}>取消</button>
                </div>
              </form>
            ) : (
              <>
                <div className="roster-entry__identity">
                  <strong>{target.display_name}</strong>
                  <span className={`status-pill ${target.response === "attending" ? "status-pill--confirmed" : target.response === "declined" ? "status-pill--declined" : "status-pill--muted"}`}>
                    {RESPONSE_LABEL[target.response]}
                  </span>
                </div>
                <div className="actions roster-entry__actions">
                  <button type="button" className="btn-secondary" onClick={() => startEdit(target)} disabled={busy}>修改</button>
                  <button type="button" className="btn-text" onClick={() => handleRemove(target)} disabled={busy}>移除</button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
