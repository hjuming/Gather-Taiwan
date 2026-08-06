import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  cancelEvent,
  cancelRegistration,
  declarePayment,
  getEventBySlug,
  getMyRegistrationForEvent,
  registerForEvent,
  reportPaymentInstructions,
  verifyEventPasswordBySlug,
} from "../lib/api";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/useSession";
import { SafeRichText } from "../security/security";
import { REGISTRATION_STATUS_LABEL, type EventRow, type RegistrationRow } from "../lib/types";

const VISIBILITY_LABEL: Record<EventRow["visibility"], string> = {
  public: "公開活動",
  unlisted: "不公開列表",
  private: "私密活動",
};

function formatDateRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateFmt = new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  });
  const timeFmt = new Intl.DateTimeFormat("zh-TW", { timeStyle: "short", timeZone: "Asia/Taipei" });
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay ? `${dateFmt.format(start)} - ${timeFmt.format(end)}` : `${dateFmt.format(start)} - ${dateFmt.format(end)}`;
}

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();

  const [event, setEvent] = useState<EventRow | null | "not-found">(null);
  const [myRegistration, setMyRegistration] = useState<RegistrationRow | null>(null);
  const [isOrganizerAdmin, setIsOrganizerAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [showReportField, setShowReportField] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const row = await getEventBySlug(slug);
      setEvent(row ?? "not-found");
      if (row && session) {
        const reg = await getMyRegistrationForEvent(row.id);
        setMyRegistration(reg);

        const { data: adminCheck } = await supabase.rpc("is_organizer_admin", {
          p_organizer_id: row.organizer_id,
        });
        setIsOrganizerAdmin(Boolean(adminCheck));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取活動失敗");
    }
  }, [slug, session]);

  useEffect(() => {
    load();
  }, [load]);

  if (sessionLoading || event === null) return null;

  if (event === "not-found") {
    return (
      <div className="page">
        <h1>找不到這個活動</h1>
        <p style={{ color: "var(--muted)" }}>
          連結可能失效、活動是私密的、或需要密碼才能查看。
        </p>
        <div className="stack card">
          <div className="field">
            <label htmlFor="password">輸入活動密碼</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="banner banner--error">{error}</div>}
          <div className="actions">
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                if (!slug) return;
                if (!session) {
                  navigate(`/auth?redirect=${encodeURIComponent(`/e/${slug}`)}`);
                  return;
                }
                setError(null);
                setBusy(true);
                try {
                  const ok = await verifyEventPasswordBySlug(slug, password);
                  if (ok) {
                    await load();
                  } else {
                    setError("密碼錯誤，或此活動不需要密碼");
                  }
                } catch (err) {
                  setError(err instanceof Error ? err.message : "驗證失敗");
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              確認密碼
            </button>
          </div>
          {!session && (
            <p className="hint">需要先登入才能解鎖私密活動；登入後回到這頁再輸入密碼。</p>
          )}
        </div>
      </div>
    );
  }

  const isOpen = event.status === "published";
  const isCancelled = event.status === "cancelled";

  async function handleRegister(formEvent: FormEvent) {
    formEvent.preventDefault();
    if (!session) {
      navigate(`/auth?redirect=${encodeURIComponent(`/e/${slug}`)}`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await registerForEvent((event as EventRow).id);
      setNotice("報名已送出");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "報名失敗");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelRegistration() {
    if (!myRegistration) return;
    setError(null);
    setBusy(true);
    try {
      await cancelRegistration(myRegistration.id);
      setNotice("已取消報名");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "取消失敗");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeclarePayment() {
    if (!myRegistration) return;
    setError(null);
    setBusy(true);
    try {
      await declarePayment(myRegistration.id);
      setNotice("已標記完成付款聲明");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelEvent() {
    if (!window.confirm("確定要取消整場活動嗎？所有報名者都會收到通知。")) return;
    setError(null);
    setBusy(true);
    try {
      await cancelEvent((event as EventRow).id);
      setNotice("活動已取消");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "取消活動失敗");
    } finally {
      setBusy(false);
    }
  }

  async function handleReport(formEvent: FormEvent) {
    formEvent.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await reportPaymentInstructions((event as EventRow).id, reportNote);
      setNotice("已送出檢舉，感謝回報");
      setShowReportField(false);
      setReportNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "送出失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <p className="eyebrow">{VISIBILITY_LABEL[event.visibility]}</p>
      <h1>{event.title}</h1>
      {event.summary && <p style={{ color: "var(--muted)" }}>{event.summary}</p>}

      <div className="stack--tight" style={{ marginBottom: 24 }}>
        <div className="meta-line">
          <strong>時間</strong>
          <span>{formatDateRange(event.starts_at, event.ends_at)}</span>
        </div>
        {event.location_name && (
          <div className="meta-line">
            <strong>地點</strong>
            <span>
              {event.location_name}
              {event.location_address ? `・${event.location_address}` : ""}
            </span>
          </div>
        )}
        <div className="meta-line">
          <strong>費用</strong>
          <span>{Number(event.fee_amount) > 0 ? `NT$ ${event.fee_amount}` : "免費"}</span>
        </div>
        {event.capacity && (
          <div className="meta-line">
            <strong>人數上限</strong>
            <span>{event.capacity} 人</span>
          </div>
        )}
        {event.min_age && (
          <div className="meta-line">
            <strong>年齡限制</strong>
            <span>{event.min_age} 歲以上</span>
          </div>
        )}
      </div>

      {notice && <div className="banner banner--success">{notice}</div>}
      {error && <div className="banner banner--error">{error}</div>}

      {isCancelled && <div className="banner banner--error">此活動已由主辦人取消</div>}

      {event.description && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2>活動說明</h2>
          <SafeRichText html={event.description} />
        </div>
      )}

      {event.payment_instructions && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2>收款說明</h2>
          <SafeRichText html={event.payment_instructions} />
          {session && !showReportField && (
            <button type="button" className="btn-text" onClick={() => setShowReportField(true)}>
              檢舉這則收款說明
            </button>
          )}
          {showReportField && (
            <form className="stack--tight" onSubmit={handleReport}>
              <textarea
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                placeholder="說明可疑之處（選填）"
              />
              <div className="actions">
                <button type="submit" className="btn-secondary" disabled={busy}>
                  送出檢舉
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="card">
        <h2>報名</h2>

        {isOrganizerAdmin && (
          <div className="banner banner--info" style={{ marginBottom: 16 }}>
            你是這場活動的主辦人。
            {!isCancelled && (
              <>
                {" "}
                <button type="button" className="btn-text" onClick={handleCancelEvent} disabled={busy}>
                  取消整場活動
                </button>
              </>
            )}
          </div>
        )}

        {myRegistration ? (
          <div className="stack">
            <span
              className={`status-pill ${myRegistration.status === "confirmed" ? "status-pill--confirmed" : ""}`}
            >
              {REGISTRATION_STATUS_LABEL[myRegistration.status]}
            </span>
            {["offered", "pending_organizer_confirmation", "confirmed", "waitlisted"].includes(
              myRegistration.status,
            ) && (
              <div className="actions">
                {Number(event.fee_amount) > 0 && !myRegistration.payment_declared_at && (
                  <button type="button" className="btn-secondary" onClick={handleDeclarePayment} disabled={busy}>
                    我已完成付款
                  </button>
                )}
                <button type="button" className="btn-secondary" onClick={handleCancelRegistration} disabled={busy}>
                  取消我的報名
                </button>
              </div>
            )}
            {myRegistration.payment_declared_at && (
              <p className="hint">已於 {new Date(myRegistration.payment_declared_at).toLocaleString("zh-TW")} 聲明付款</p>
            )}
          </div>
        ) : isOpen ? (
          <form onSubmit={handleRegister} className="actions">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "送出中…" : "我要報名"}
            </button>
          </form>
        ) : (
          <p style={{ color: "var(--muted)" }}>目前未開放報名</p>
        )}
      </div>
    </div>
  );
}
