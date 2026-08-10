import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  getEventRoster,
  organizerAddManualParticipant,
  organizerEditManualParticipant,
  organizerRemoveManualParticipant,
} from "../lib/api";
import { REGISTRATION_STATUS_LABEL, type RegistrationRow } from "../lib/types";

const MANUAL_STATUS_OPTIONS: RegistrationRow["status"][] = [
  "confirmed",
  "pending_organizer_confirmation",
  "waitlisted",
  "cancelled",
  "removed_by_organizer",
];

const ACTIVE_STATUSES: RegistrationRow["status"][] = [
  "offered",
  "pending_organizer_confirmation",
  "confirmed",
  "waitlisted",
];

function statusLabel(status: RegistrationRow["status"]): string {
  if (status === "offered") return "邀請中／待回覆";
  if (status === "pending_organizer_confirmation") return "未確認";
  return REGISTRATION_STATUS_LABEL[status];
}

export default function RosterManager({ eventId, capacity }: { eventId: string; capacity: number | null }) {
  const [roster, setRoster] = useState<RegistrationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editContact, setEditContact] = useState("");

  async function load() {
    try {
      setRoster(await getEventRoster(eventId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取名單失敗");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("請輸入姓名");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await organizerAddManualParticipant(eventId, name.trim(), contact.trim());
      setName("");
      setContact("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增失敗");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(row: RegistrationRow) {
    setEditingId(row.id);
    setEditName(row.manual_display_name ?? "");
    setEditContact(row.manual_contact ?? "");
  }

  async function saveEdit(row: RegistrationRow) {
    setError(null);
    setBusy(true);
    try {
      await organizerEditManualParticipant(row.id, { displayName: editName, contact: editContact });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(row: RegistrationRow, status: RegistrationRow["status"]) {
    setError(null);
    setBusy(true);
    try {
      await organizerEditManualParticipant(row.id, { status });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "狀態更新失敗（可能不是合法的狀態轉換）");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(row: RegistrationRow) {
    if (!window.confirm("確定要從名單移除這位參加者嗎？")) return;
    setError(null);
    setBusy(true);
    try {
      await organizerRemoveManualParticipant(row.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "移除失敗");
    } finally {
      setBusy(false);
    }
  }

  const activeRoster = roster.filter((row) => ACTIVE_STATUSES.includes(row.status));
  const stats = useMemo(() => {
    const seats = (rows: RegistrationRow[]) => rows.reduce((total, row) => total + Math.max(1, row.seats || 1), 0);
    return {
      total: seats(activeRoster),
      confirmed: seats(activeRoster.filter((row) => row.status === "confirmed")),
      pending: seats(activeRoster.filter((row) => row.status === "pending_organizer_confirmation")),
      invited: seats(activeRoster.filter((row) => row.status === "offered")),
      waitlisted: seats(activeRoster.filter((row) => row.status === "waitlisted")),
    };
  }, [activeRoster]);

  return (
    <div className="roster-manager">
      <p className="hint roster-manager__privacy">
        這裡顯示活動名單與參加者主動提供的聯絡方式。系統不會自動揭露參加者帳號的手機、Email 或 LINE 身分；請在報名欄位或手動名單中取得對方同意後再填寫。
      </p>

      {error && <div className="banner banner--error">{error}</div>}

      <div className="roster-stats" aria-label="參加者統計">
        <div><span>總人數</span><strong>{stats.total}{capacity ? ` / ${capacity}` : ""}</strong></div>
        <div><span>已確認</span><strong>{stats.confirmed}</strong></div>
        <div><span>未確認</span><strong>{stats.pending}</strong></div>
        <div><span>邀請中</span><strong>{stats.invited}</strong></div>
        <div><span>候補</span><strong>{stats.waitlisted}</strong></div>
      </div>

      <form onSubmit={handleAdd} className="roster-add-form">
        <div className="field">
          <label htmlFor="roster-name">姓名</label>
          <input id="roster-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：王小明" />
        </div>
        <div className="field">
          <label htmlFor="roster-contact">聯絡方式（參加者自願提供）</label>
          <input id="roster-contact" type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="手機／Email／LINE" />
        </div>
        <button type="submit" className="btn-secondary" disabled={busy}>加入名單</button>
      </form>

      <div className="registration-list">
        {activeRoster.length === 0 && <p className="hint">目前沒有有效報名紀錄。</p>}
        {activeRoster.map((row) => {
          const isManual = row.user_id === null;
          const name_ = row.manual_display_name ?? row.display_name_snapshot ?? "（未命名）";
          return (
            <article key={row.id} className="roster-entry">
              {editingId === row.id ? (
                <div className="roster-entry__edit">
                  <div className="field">
                    <label htmlFor={`edit-name-${row.id}`}>姓名</label>
                    <input id={`edit-name-${row.id}`} type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor={`edit-contact-${row.id}`}>聯絡方式</label>
                    <input id={`edit-contact-${row.id}`} type="text" value={editContact} onChange={(e) => setEditContact(e.target.value)} />
                  </div>
                  <div className="actions">
                    <button type="button" className="btn-primary" onClick={() => saveEdit(row)} disabled={busy}>儲存</button>
                    <button type="button" className="btn-text" onClick={() => setEditingId(null)}>取消</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="roster-entry__identity">
                    <strong>{name_}</strong>
                    <span className={`status-pill ${row.status === "confirmed" ? "status-pill--confirmed" : ""}`}>{statusLabel(row.status)}</span>
                    <span className="status-pill status-pill--muted">{isManual ? "手動加入" : "線上報名"}</span>
                  </div>
                  <p className="roster-entry__contact">
                    {row.manual_contact ? `聯絡方式：${row.manual_contact}` : isManual ? "尚未填寫聯絡方式" : "參加者未提供聯絡方式"}
                  </p>
                  {isManual && (
                    <div className="actions roster-entry__actions">
                      <select value={row.status} onChange={(e) => handleStatusChange(row, e.target.value as RegistrationRow["status"])} disabled={busy} aria-label={`${name_}報名狀態`}>
                        {MANUAL_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                      </select>
                      <button type="button" className="btn-text" onClick={() => startEdit(row)}>編輯</button>
                      <button type="button" className="btn-text" onClick={() => handleRemove(row)}>移除</button>
                    </div>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
