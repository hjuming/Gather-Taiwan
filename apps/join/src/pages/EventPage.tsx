import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  cancelEvent,
  cancelRegistration,
  declarePayment,
  getEventBySlug,
  getEventFields,
  getMyRegistrationForEvent,
  registerForEvent,
  reportPaymentInstructions,
  verifyEventPasswordBySlug,
} from "../lib/api";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/useSession";
import { SafeRichText } from "../security/security";
import { REGISTRATION_STATUS_LABEL, type EventFieldRow, type EventRow, type RegistrationRow } from "../lib/types";
import RosterManager from "../components/RosterManager";
import { validateEventAnswers, type EventAnswer } from "../lib/event-fields";
import { copyText, getEventShareText, getEventShareUrl, getGoogleMapsSearchUrl, getLineShareUrl } from "../lib/event-links";

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
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Taipei",
  });
  const dateKeyFmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Taipei",
  });
  const timeFmt = new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Taipei",
  });
  const sameDay = dateKeyFmt.format(start) === dateKeyFmt.format(end);
  return sameDay ? `${dateFmt.format(start)} - ${timeFmt.format(end)}` : `${dateFmt.format(start)} - ${dateFmt.format(end)}`;
}

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();

  const [event, setEvent] = useState<EventRow | null | "not-found">(null);
  const [fields, setFields] = useState<EventFieldRow[]>([]);
  const [answers, setAnswers] = useState<Record<string, EventAnswer>>({});
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
      setFields([]);
      setAnswers({});
      if (row) {
        const eventFields = await getEventFields(row.id);
        setFields(eventFields);
      }
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
    const answerError = validateEventAnswers(fields, answers);
    if (answerError) {
      setError(answerError);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await registerForEvent((event as EventRow).id, answers);
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

  async function handleShare() {
    const eventRow = event as EventRow;
    const url = getEventShareUrl(eventRow.slug);
    const text = getEventShareText(eventRow, url);
    setError(null);
    try {
      if (navigator.share) {
        await navigator.share({ title: eventRow.title, text, url });
        setNotice("已開啟分享面板");
      } else {
        await copyText(url);
        setNotice("活動連結已複製，可以貼到 LINE 群組或聊天室");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("分享失敗，請改用複製連結");
    }
  }

  async function handleCopyLink() {
    setError(null);
    try {
      await copyText(getEventShareUrl((event as EventRow).slug));
      setNotice("活動連結已複製");
    } catch {
      setError("複製失敗，請手動複製瀏覽器網址");
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
              <a
                className="map-link"
                href={getGoogleMapsSearchUrl(event) ?? undefined}
                target="_blank"
                rel="noreferrer"
              >
                {event.location_name}
              </a>
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

      <div className="event-share" aria-label="分享活動">
        <button type="button" className="btn-primary" onClick={handleShare}>
          分享活動
        </button>
        <button type="button" className="btn-secondary" onClick={handleCopyLink}>
          複製活動連結
        </button>
        <a
          className="btn-secondary event-share__line"
          href={getLineShareUrl(getEventShareText(event, getEventShareUrl(event.slug)))}
          target="_blank"
          rel="noreferrer"
        >
          分享到 LINE
        </a>
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
          <form onSubmit={handleRegister} className="stack">
            {session && fields.length > 0 && (
              <div className="stack--tight">
                <h3>報名資料</h3>
                <p className="hint">請填寫主辦人需要的資料；標示「必填」的欄位不能留白。</p>
                {fields.map((field) => (
                  <EventFieldInput
                    key={field.id}
                    field={field}
                    value={answers[field.field_key]}
                    onChange={(value) => setAnswers((previous) => ({ ...previous, [field.field_key]: value }))}
                  />
                ))}
              </div>
            )}
            <div className="actions">
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "送出中…" : session ? "我要報名" : "登入後報名"}
              </button>
            </div>
          </form>
        ) : (
          <p style={{ color: "var(--muted)" }}>目前未開放報名</p>
        )}
      </div>

      {isOrganizerAdmin && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2>參加者名單管理</h2>
          <RosterManager eventId={event.id} />
        </div>
      )}
    </div>
  );
}

function EventFieldInput({
  field,
  value,
  onChange,
}: {
  field: EventFieldRow;
  value: EventAnswer;
  onChange: (value: EventAnswer) => void;
}) {
  const fieldId = `event-field-${field.id}`;
  const requiredLabel = field.is_required ? "（必填）" : "（選填）";

  if (field.field_type === "short_text" || field.field_type === "long_text") {
    return (
      <div className="field">
        <label htmlFor={fieldId}>
          {field.label} {requiredLabel}
        </label>
        {field.field_type === "long_text" ? (
          <textarea
            id={fieldId}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <input
            id={fieldId}
            type="text"
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </div>
    );
  }

  if (field.field_type === "single_choice") {
    return (
      <div className="field">
        <label htmlFor={fieldId}>
          {field.label} {requiredLabel}
        </label>
        <select id={fieldId} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)}>
          <option value="">請選擇</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.field_type === "multiple_choice") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className="field fieldset-reset">
        <legend>
          {field.label} {requiredLabel}
        </legend>
        <div className="choice-list">
          {(field.options ?? []).map((option) => (
            <label key={option} className="check-field">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(event) =>
                  onChange(
                    event.target.checked ? [...selected, option] : selected.filter((item) => item !== option),
                  )
                }
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <label className="check-field" htmlFor={fieldId}>
      <input
        id={fieldId}
        type="checkbox"
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
      />
      {field.label} {requiredLabel}
    </label>
  );
}
