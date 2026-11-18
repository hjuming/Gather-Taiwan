import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cancelRegistration, getMyRegistrations } from "../lib/api";
import { useSession } from "../lib/useSession";
import { REGISTRATION_STATUS_LABEL, type EventRow, type RegistrationRow } from "../lib/types";
import { formatTaipeiDateTimeRange } from "../lib/date-time";

type RegistrationView = "active" | "past";

function formatRegistrationDate(event: EventRow): string {
  return formatTaipeiDateTimeRange(event.starts_at, event.ends_at);
}

export default function MyRegistrationsPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState<(RegistrationRow & { events: EventRow })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [view, setView] = useState<RegistrationView>("active");

  async function load() {
    try {
      setRows(await getMyRegistrations());
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取失敗");
    }
  }

  useEffect(() => {
    if (session) load();
  }, [session]);

  useEffect(() => {
    if (!loading && !session) {
      navigate(`/auth?redirect=${encodeURIComponent("/me/registrations")}`, { replace: true });
    }
  }, [loading, session, navigate]);

  if (loading || !session) return null;

  const active = rows.filter((r) =>
    ["offered", "pending_organizer_confirmation", "confirmed", "waitlisted"].includes(r.status),
  );
  const past = rows.filter((r) => !active.includes(r));

  async function handleCancel(registrationId: string) {
    setBusyId(registrationId);
    setError(null);
    try {
      await cancelRegistration(registrationId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "取消失敗");
    } finally {
      setBusyId(null);
    }
  }

  const visibleRows = view === "active" ? active : past;

  return (
    <div className="page page--wide registrations-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">我參加的聚會</p>
          <h1>那些準備見面的日子</h1>
          <p>你已答應赴約、正在等候，或曾經坐過的那幾張桌子，都在這裡。</p>
        </div>
        <Link to="/events/new" className="btn-secondary">發起一場聚會</Link>
      </header>

      {error && <div className="banner banner--error" role="alert">{error}</div>}

      {active.length === 0 && past.length === 0 ? (
        <p className="empty-state">還沒有任何報名紀錄。</p>
      ) : (
        <>
          <div className="registration-overview" aria-label="報名總覽">
            <span><strong>{active.length}</strong> 接下來要見面</span>
            <span><strong>{past.length}</strong> 走過的聚會</span>
          </div>
          <div className="scroll-tabs" role="tablist" aria-label="報名紀錄篩選">
            <button type="button" role="tab" aria-selected={view === "active"} className={view === "active" ? "is-active" : ""} onClick={() => setView("active")}>接下來要見面<span>{active.length}</span></button>
            <button type="button" role="tab" aria-selected={view === "past"} className={view === "past" ? "is-active" : ""} onClick={() => setView("past")}>走過的聚會<span>{past.length}</span></button>
          </div>
          <div className="registration-list">
            {visibleRows.length === 0 && <p className="empty-state">這個分類目前沒有紀錄。</p>}
            {visibleRows.map((r) => (
              <article key={r.id} className="card registration-card">
                <div className="registration-card__head">
                  <div>
                    <span className={`status-pill ${r.status === "confirmed" ? "status-pill--confirmed" : "status-pill--muted"}`}>
                      {REGISTRATION_STATUS_LABEL[r.status]}
                    </span>
                    <Link to={`/e/${r.events.slug}`}><h2>{r.events.title}</h2></Link>
                  </div>
                  <span className="registration-card__date">{formatRegistrationDate(r.events)}</span>
                </div>
                <div className="registration-card__meta">
                  <span>{r.events.location_name || "地點待公布"}</span>
                  <span>{r.events.capacity ? `${r.events.capacity} 人上限` : "不限人數"}</span>
                </div>
                {view === "active" && (
                  <div className="actions registration-card__actions">
                    <Link to={`/e/${r.events.slug}`} className="btn-secondary">查看活動</Link>
                    <button type="button" className="btn-text" onClick={() => handleCancel(r.id)} disabled={busyId === r.id}>
                      {busyId === r.id ? "取消中…" : "取消報名"}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
