import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cancelRegistration, getMyRegistrations } from "../lib/api";
import { useSession } from "../lib/useSession";
import { REGISTRATION_STATUS_LABEL, type EventRow, type RegistrationRow } from "../lib/types";

export default function MyRegistrationsPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState<(RegistrationRow & { events: EventRow })[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  return (
    <div className="page">
      <p className="eyebrow">我的報名</p>
      <h1>我的活動</h1>

      {error && <div className="banner banner--error">{error}</div>}

      {active.length === 0 && past.length === 0 ? (
        <p className="empty-state">還沒有任何報名紀錄。</p>
      ) : (
        <>
          {active.length > 0 && (
            <div className="registration-list" style={{ marginBottom: 32 }}>
              {active.map((r) => (
                <div key={r.id} className="card">
                  <Link to={`/e/${r.events.slug}`} style={{ textDecoration: "none" }}>
                    <h2 style={{ marginBottom: 6 }}>{r.events.title}</h2>
                  </Link>
                  <span
                    className={`status-pill ${r.status === "confirmed" ? "status-pill--confirmed" : ""}`}
                  >
                    {REGISTRATION_STATUS_LABEL[r.status]}
                  </span>
                  <div className="actions" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleCancel(r.id)}
                      disabled={busyId === r.id}
                    >
                      取消報名
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {past.length > 0 && (
            <div className="stack--tight">
              <h2>過去紀錄</h2>
              <div className="registration-list">
                {past.map((r) => (
                  <div key={r.id} className="card" style={{ opacity: 0.7 }}>
                    <Link to={`/e/${r.events.slug}`} style={{ textDecoration: "none" }}>
                      <strong>{r.events.title}</strong>
                    </Link>
                    <div>
                      <span className="status-pill status-pill--muted">{REGISTRATION_STATUS_LABEL[r.status]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
