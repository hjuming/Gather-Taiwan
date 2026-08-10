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
import {
  copyText,
  getEventShareText,
  getEventShareUrl,
  getGoogleMapsEmbedUrl,
  getGoogleMapsSearchUrl,
  getLineShareUrl,
} from "../lib/event-links";

const DEFAULT_HERO_IMAGE = `${import.meta.env.BASE_URL}assets/gather-event-hero-default-v1.png`;

const VISIBILITY_LABEL: Record<EventRow["visibility"], string> = {
  public: "公開活動",
  unlisted: "不公開列表",
  private: "私密活動",
};

function formatDateRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateFmt = new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
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
        // The activity URL is already the final plain-text line in `text`.
        // Passing it again as Web Share's `url` duplicates the link in LINE
        // and some iPad share targets, making the invitation harder to scan.
        await navigator.share({ title: eventRow.title, text });
        setNotice("已開啟分享面板");
      } else {
        await copyText(text);
        setNotice("活動分享內容已複製，可以貼到 LINE 群組或聊天室");
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
      setNotice("活動／邀請連結已複製");
    } catch {
      setError("複製失敗，請手動複製瀏覽器網址");
    }
  }

  async function handleCopyShareText() {
    setError(null);
    try {
      const eventRow = event as EventRow;
      await copyText(getEventShareText(eventRow, getEventShareUrl(eventRow.slug)));
      setNotice("完整活動資訊已複製");
    } catch {
      setError("複製失敗，請改用分享到 LINE");
    }
  }

  const eventUrl = getEventShareUrl(event.slug);
  const mapsUrl = getGoogleMapsSearchUrl(event);
  const mapEmbedUrl = getGoogleMapsEmbedUrl(event);
  const shareText = getEventShareText(event, eventUrl);

  return (
    <div className="event-page">
      <section className="event-hero" aria-labelledby="event-title">
        <img src={DEFAULT_HERO_IMAGE} alt="溫暖餐桌上的相聚時光" width="1672" height="941" fetchPriority="high" />
        <div className="event-hero__veil" />
        <div className="event-hero__copy">
          <p className="eyebrow">{VISIBILITY_LABEL[event.visibility]}</p>
          <h1 id="event-title">{event.title}</h1>
          <p>{event.summary || "相招來聚會"}</p>
        </div>
      </section>

      <div className="event-page__body">
        {notice && <div className="banner banner--success" aria-live="polite">{notice}</div>}
        {error && <div className="banner banner--error" role="alert">{error}</div>}
        {isCancelled && <div className="banner banner--error">此活動已由主辦人取消</div>}

        <nav className="section-rail" aria-label="活動內容導覽">
          <a href="#event-details">活動資訊</a>
          {event.description && <a href="#event-description">活動說明</a>}
          {event.payment_instructions && <a href="#event-payment">收款說明</a>}
          <a href="#registration-title">報名</a>
          {isOrganizerAdmin && <a href="#roster-title">誰會來</a>}
        </nav>

        <section id="event-details" className="event-facts" aria-label="活動基本資料">
          <div className="event-fact event-fact--wide">
            <span className="event-fact__label">日期與時間</span>
            <strong>{formatDateRange(event.starts_at, event.ends_at)}</strong>
          </div>
          <div className="event-fact event-fact--wide">
            <span className="event-fact__label">地點</span>
            {event.location_name ? (
              <a href={mapsUrl ?? undefined} target="_blank" rel="noreferrer">
                {event.location_name}
              </a>
            ) : (
              <strong>尚未提供</strong>
            )}
            {event.location_address && <span>{event.location_address}</span>}
            {mapEmbedUrl && (
              <div className="event-map">
                <iframe src={mapEmbedUrl} title="活動地點地圖" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                <a href={mapsUrl ?? undefined} target="_blank" rel="noreferrer" className="event-map__link">
                  在 Google 地圖開啟 ↗
                </a>
              </div>
            )}
          </div>
          <div className="event-fact">
            <span className="event-fact__label">費用</span>
            <strong>{Number(event.fee_amount) > 0 ? `NT$ ${event.fee_amount}` : "免費"}</strong>
          </div>
          <div className="event-fact">
            <span className="event-fact__label">人數上限</span>
            <strong>{event.capacity ? `${event.capacity} 人` : "不限人數"}</strong>
          </div>
          {event.min_age && (
            <div className="event-fact">
              <span className="event-fact__label">年齡限制</span>
              <strong>{event.min_age} 歲以上</strong>
            </div>
          )}
        </section>

        <section className="event-share event-share--full" aria-label="分享活動">
          <button type="button" className="btn-primary" onClick={handleShare}>
            分享活動
          </button>
          <a className="btn-secondary" href={getLineShareUrl(shareText)} target="_blank" rel="noreferrer">
            分享到 LINE
          </a>
          <button type="button" className="btn-secondary" onClick={handleCopyShareText}>
            複製分享內容
          </button>
          <button type="button" className="btn-text" onClick={handleCopyLink}>
            複製活動／邀請連結
          </button>
        </section>
        <p className="event-share__note">連結會把日期留在網址裡，方便大家辨認；私密聚會仍需要邀請或密碼才能進入。</p>

        {event.description && (
          <section id="event-description" className="event-section">
            <p className="section-kicker">這場相聚</p>
            <h2>活動說明</h2>
            <div className="event-richtext"><SafeRichText html={event.description} /></div>
          </section>
        )}

        {event.payment_instructions && (
          <section id="event-payment" className="event-section event-section--quiet">
            <p className="section-kicker">主人家的話</p>
            <h2>收款說明</h2>
            <div className="event-richtext"><SafeRichText html={event.payment_instructions} /></div>
            {session && !showReportField && (
              <button type="button" className="btn-text" onClick={() => setShowReportField(true)}>
                檢舉這則收款說明
              </button>
            )}
            {showReportField && (
              <form className="stack--tight" onSubmit={handleReport}>
                <textarea value={reportNote} onChange={(e) => setReportNote(e.target.value)} placeholder="說明可疑之處（選填）" />
                <button type="submit" className="btn-secondary" disabled={busy}>送出檢舉</button>
              </form>
            )}
          </section>
        )}

        <section className="event-register" aria-labelledby="registration-title">
          <div className="event-section__heading">
            <div>
              <p className="section-kicker">一起入席</p>
              <h2 id="registration-title">報名</h2>
            </div>
            {isOrganizerAdmin && <span className="status-pill status-pill--confirmed">這場聚會的主人</span>}
          </div>

          {isOrganizerAdmin && (
            <div className="banner banner--info event-admin-note">
              這是你邀請大家相見的聚會。
              {!isCancelled && <button type="button" className="btn-text" onClick={handleCancelEvent} disabled={busy}>取消整場活動</button>}
            </div>
          )}

          {myRegistration ? (
            <div className="stack">
              <span className={`status-pill ${myRegistration.status === "confirmed" ? "status-pill--confirmed" : ""}`}>
                {REGISTRATION_STATUS_LABEL[myRegistration.status]}
              </span>
              {["offered", "pending_organizer_confirmation", "confirmed", "waitlisted"].includes(myRegistration.status) && (
                <div className="actions">
                  {Number(event.fee_amount) > 0 && !myRegistration.payment_declared_at && (
                    <button type="button" className="btn-secondary" onClick={handleDeclarePayment} disabled={busy}>我已完成付款</button>
                  )}
                  <button type="button" className="btn-secondary" onClick={handleCancelRegistration} disabled={busy}>取消我的報名</button>
                </div>
              )}
              {myRegistration.payment_declared_at && <p className="hint">已聲明付款：{new Date(myRegistration.payment_declared_at).toLocaleString("zh-TW")}</p>}
            </div>
          ) : isOpen ? (
            <form onSubmit={handleRegister} className="stack">
              {session && fields.length > 0 && (
                <div className="stack--tight">
                  <h3>報名資料</h3>
                  <p className="hint">留下這場聚會想知道的事；標示「必填」的欄位不能留白。</p>
                  {fields.map((field) => (
                    <EventFieldInput key={field.id} field={field} value={answers[field.field_key]} onChange={(value) => setAnswers((previous) => ({ ...previous, [field.field_key]: value }))} />
                  ))}
                </div>
              )}
              <button type="submit" className="btn-primary event-register__cta" disabled={busy}>{busy ? "送出中…" : session ? "我要報名" : "登入後報名"}</button>
            </form>
          ) : <p className="hint">目前未開放報名</p>}
        </section>

        {isOrganizerAdmin && (
          <section id="roster-title" className="event-section roster-section">
            <p className="section-kicker">這張桌子，誰會來</p>
            <h2>一起來的人</h2>
            <RosterManager eventId={event.id} capacity={event.capacity} />
          </section>
        )}
      </div>

      <div className="mobile-action-dock" aria-label="活動快捷操作">
        <a href="#registration-title" className="btn-primary">{isOrganizerAdmin ? "回到報名區" : "我要報名"}</a>
        <button type="button" className="btn-secondary" onClick={handleShare}>分享活動</button>
      </div>
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
