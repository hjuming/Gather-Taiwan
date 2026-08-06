import { useEffect, useState, type FormEvent } from "react";
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

export default function RosterManager({ eventId }: { eventId: string }) {
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

  const activeRoster = roster.filter((r) =>
    ["offered", "pending_organizer_confirmation", "confirmed", "waitlisted"].includes(r.status),
  );

  return (
    <div className="stack">
      <p className="hint" style={{ color: "var(--muted)" }}>
        自助報名的人不能在這裡編輯（他們自己管理自己的報名）；這裡只用來新增、編輯、
        移除你自己手動登記的參加者，例如口頭答應要來但沒有在網頁上報名的人。
      </p>

      {error && <div className="banner banner--error">{error}</div>}

      <form onSubmit={handleAdd} className="row" style={{ alignItems: "end" }}>
        <div className="field">
          <label htmlFor="roster-name">姓名</label>
          <input id="roster-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="roster-contact">聯絡方式（選填）</label>
          <input id="roster-contact" type="text" value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>
        <div className="actions">
          <button type="submit" className="btn-secondary" disabled={busy}>
            加入名單
          </button>
        </div>
      </form>

      <div className="registration-list">
        {activeRoster.length === 0 && <p className="hint">目前沒有報名紀錄。</p>}
        {activeRoster.map((row) => {
          const isManual = row.user_id === null;
          const name_ = row.manual_display_name ?? row.display_name_snapshot ?? "（未命名）";
          return (
            <div key={row.id} className="card" style={{ padding: 16 }}>
              {editingId === row.id ? (
                <div className="row" style={{ alignItems: "end" }}>
                  <div className="field">
                    <label>姓名</label>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>聯絡方式</label>
                    <input type="text" value={editContact} onChange={(e) => setEditContact(e.target.value)} />
                  </div>
                  <div className="actions">
                    <button type="button" className="btn-primary" onClick={() => saveEdit(row)} disabled={busy}>
                      儲存
                    </button>
                    <button type="button" className="btn-text" onClick={() => setEditingId(null)}>
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="meta-line" style={{ justifyContent: "space-between" }}>
                  <div>
                    <strong>{name_}</strong>
                    {isManual && row.manual_contact && (
                      <span style={{ marginLeft: 8 }}>{row.manual_contact}</span>
                    )}
                    {!isManual && <span className="status-pill status-pill--muted" style={{ marginLeft: 8 }}>自助報名</span>}
                  </div>
                  <span className="status-pill status-pill--confirmed">
                    {REGISTRATION_STATUS_LABEL[row.status]}
                  </span>
                </div>
              )}

              {isManual && editingId !== row.id && (
                <div className="actions" style={{ marginTop: 10 }}>
                  <select
                    value={row.status}
                    onChange={(e) => handleStatusChange(row, e.target.value as RegistrationRow["status"])}
                    disabled={busy}
                  >
                    {MANUAL_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {REGISTRATION_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn-text" onClick={() => startEdit(row)}>
                    編輯
                  </button>
                  <button type="button" className="btn-text" onClick={() => handleRemove(row)}>
                    移除
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
