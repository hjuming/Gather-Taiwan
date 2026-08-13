import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  cancelEvent,
  cancelRegistration,
  declarePayment,
  getEventBySlug,
  getEventFields,
  getGuestInvitationEvent,
  getPublicEventSummary,
  getMyRegistrationForEvent,
  registerForEvent,
  respondToGuestInvitation,
  reportPaymentInstructions,
  verifyEventPasswordBySlug,
} from "../lib/api";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/useSession";
import { SafeRichText } from "../security/security";
import { REGISTRATION_STATUS_LABEL, type EventFieldRow, type EventRow, type RegistrationRow } from "../lib/types";
import type { PublicEventSummary } from "../lib/api";
import RosterManager from "../components/RosterManager";
import InvitationManager from "../components/InvitationManager";
import PrivateEventInlineEditor from "../components/PrivateEventInlineEditor";
import { validateEventAnswers, type EventAnswer } from "../lib/event-fields";
import {
  copyText,
  getEventShareText,
  getEventShareUrl,
  getGoogleMapsEmbedUrl,
  getGoogleMapsSearchUrl,
  getLineShareUrl,
} from "../lib/event-links";
import { getGatheringTypeLabel, resolveCoverImage } from "../lib/gathering-types";
import { formatTaipeiDateTimeRange } from "../lib/date-time";
import { formatEventFee } from "../lib/event-fee";
import {
  getOrCreateGuestInvitationKey,
  mergeGuestInvitationInvitee,
  type GuestInvitationEvent,
  type GuestInvitationInvitee,
  type GuestInvitationRosterResponse,
} from "../lib/guest-invitations";

const VISIBILITY_LABEL: Record<EventRow["visibility"], string> = {
  public: "公開活動",
  unlisted: "不公開列表",
  private: "私密活動",
};

function formatDateRange(startsAt: string, endsAt: string): string {
  return formatTaipeiDateTimeRange(startsAt, endsAt);
}

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();

  const [event, setEvent] = useState<EventRow | null | "not-found">(null);
  const [guestInvitation, setGuestInvitation] = useState<GuestInvitationEvent | null>(null);
  const [publicSummary, setPublicSummary] = useState<PublicEventSummary | null>(null);
  const [fields, setFields] = useState<EventFieldRow[]>([]);
  const [answers, setAnswers] = useState<Record<string, EventAnswer>>({});
  const [myRegistration, setMyRegistration] = useState<RegistrationRow | null>(null);
  const [isOrganizerAdmin, setIsOrganizerAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [updatingInviteeId, setUpdatingInviteeId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [showReportField, setShowReportField] = useState(false);
  const [coverExpanded, setCoverExpanded] = useState(false);
  const [showInlineEditor, setShowInlineEditor] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const row = await getEventBySlug(slug);
      setPublicSummary(null);
      setFields([]);
      setAnswers({});
      setGuestInvitation(null);
      setIsOrganizerAdmin(false);
      if (!row) {
        const guestKey = getOrCreateGuestInvitationKey(slug);
        const guestEvent = await getGuestInvitationEvent(slug, guestKey).catch(() => null);
        if (guestEvent) {
          setGuestInvitation(guestEvent);
          setPublicSummary({
            organizerDisplayName: guestEvent.organizer_display_name,
            registrationCount: guestEvent.attending_count,
            capacity: guestEvent.capacity,
            showCapacity: guestEvent.capacity !== null,
          });
          setEvent(guestEvent as unknown as EventRow);
          return;
        }
        setEvent("not-found");
        return;
      }
      setEvent(row);
      if (row) {
        const [eventFields, summary] = await Promise.all([
          getEventFields(row.id),
          getPublicEventSummary(row.slug).catch(() => null),
        ]);
        setFields(eventFields);
        setPublicSummary(summary);
      }
      if (row && session) {
        const reg = await getMyRegistrationForEvent(row.id);
        setMyRegistration(reg);

        const { data: adminCheck } = await supabase.rpc("is_organizer_admin", {
          p_organizer_id: row.organizer_id,
        });
        const isAdmin = Boolean(adminCheck);
        setIsOrganizerAdmin(isAdmin);
        if (isAdmin && row.visibility === "private" && row.invite_only) {
          const hostGuestEvent = await getGuestInvitationEvent(
            row.slug,
            getOrCreateGuestInvitationKey(row.slug),
          ).catch(() => null);
          if (hostGuestEvent) setGuestInvitation(hostGuestEvent);
        }
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
  const isGuestInvitation = guestInvitation !== null;

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

  async function handleCopyLink() {
    setError(null);
    try {
      await copyText(getEventShareUrl((event as EventRow).slug));
      // 成功提示的橫幅在頁面最上方，但這顆按鈕在頁面中段——按下去看不到任何回饋。
      // 直接在按鈕上回報，兩秒後復原。
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setError("複製失敗，請手動複製瀏覽器網址");
    }
  }

  const eventUrl = getEventShareUrl(event.slug);
  const mapsUrl = getGoogleMapsSearchUrl(event);
  const mapEmbedUrl = getGoogleMapsEmbedUrl(event);
  const shareText = getEventShareText(event, eventUrl);
  const gatheringTypeLabel = getGatheringTypeLabel(event.gathering_type);

  function handleGuestUpdated(result: {
    id: string;
    guest_response: GuestInvitationRosterResponse;
    guest_display_name: string;
    attending_count: number;
  }) {
    setGuestInvitation((previous) => {
      if (!previous) return previous;
      const updatedInvitee: GuestInvitationInvitee = {
        id: result.id,
        display_name: result.guest_display_name,
        response: result.guest_response,
      };
      const invitees = mergeGuestInvitationInvitee(previous.invitees ?? [], updatedInvitee);
      return {
        ...previous,
        invitees,
        guest_response: result.guest_response,
        guest_display_name: result.guest_display_name,
        attending_count: result.attending_count,
      };
    });
    setPublicSummary((previous) => previous ? { ...previous, registrationCount: result.attending_count } : previous);
    setNotice(
      result.guest_response === "attending"
        ? "已確認出席。"
        : result.guest_response === "declined"
          ? "已記下不克出席。"
          : "已改為邀請中。",
    );
  }

  async function handleGuestStatusChange(invitee: GuestInvitationInvitee) {
    if (!guestInvitation) return;
    const nextResponse: GuestInvitationRosterResponse = {
      pending: "attending",
      attending: "declined",
      declined: "pending",
    }[invitee.response] as GuestInvitationRosterResponse;
    setUpdatingInviteeId(invitee.id);
    setError(null);
    try {
      const result = await respondToGuestInvitation(
        guestInvitation.slug,
        getOrCreateGuestInvitationKey(guestInvitation.slug, invitee.display_name),
        invitee.display_name,
        nextResponse,
      );
      handleGuestUpdated(result);
      const refreshed = await getGuestInvitationEvent(
        guestInvitation.slug,
        getOrCreateGuestInvitationKey(guestInvitation.slug),
      ).catch(() => null);
      if (refreshed) {
        setGuestInvitation(refreshed);
        setPublicSummary((previous) => previous ? { ...previous, registrationCount: refreshed.attending_count } : previous);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新出席狀態失敗");
    } finally {
      setUpdatingInviteeId(null);
    }
  }

  async function handleInlineEventSaved(updated: EventRow) {
    setEvent(updated);
    setShowInlineEditor(false);
    const refreshed = await getGuestInvitationEvent(
      updated.slug,
      getOrCreateGuestInvitationKey(updated.slug),
    ).catch(() => null);
    if (refreshed) {
      setGuestInvitation(refreshed);
      setPublicSummary((previous) => previous ? {
        ...previous,
        organizerDisplayName: refreshed.organizer_display_name,
        registrationCount: refreshed.attending_count,
        capacity: refreshed.capacity,
        showCapacity: refreshed.capacity !== null,
      } : previous);
    }
    setNotice("已儲存，這個頁面就是可以直接分享的邀請頁。");
  }

  async function handleCopyGuestShare() {
    try {
      await copyText(shareText);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setError("複製失敗，請手動複製聚會資訊");
    }
  }

  if (isGuestInvitation && guestInvitation) {
    const invitees = guestInvitation.invitees ?? [];
    const pendingCount = invitees.filter((invitee) => invitee.response === "pending").length;
    const declinedCount = invitees.filter((invitee) => invitee.response === "declined").length;

    const responseLabel = {
      attending: "已確認",
      pending: "邀請中",
      declined: "不克出席",
    } as const;

    return (
      <div className="guest-invitation-page">
        {notice && <div className="banner banner--success" aria-live="polite">{notice}</div>}
        {error && <div className="banner banner--error" role="alert">{error}</div>}

        <button
          type="button"
          className="btn-text guest-invitation-cover"
          onClick={() => setCoverExpanded(true)}
          aria-label="放大活動代表圖"
        >
          <img src={resolveCoverImage(guestInvitation)} alt={`${guestInvitation.title}代表圖`} />
        </button>

        <section className="guest-invitation-page__intro" aria-labelledby="guest-event-title">
          <p className="section-kicker">朋友邀請</p>
          <h1 id="guest-event-title">{guestInvitation.title}</h1>
          {guestInvitation.summary && <p className="guest-invitation-page__summary">{guestInvitation.summary}</p>}
        </section>

        <section className="guest-invitation-summary" aria-label="聚會資訊">
          <strong>{formatDateRange(guestInvitation.starts_at, guestInvitation.ends_at)}</strong>
          <strong>{guestInvitation.location_name || "尚未提供地點"}</strong>
          {guestInvitation.location_address && mapsUrl ? (
            <a className="guest-invitation-summary__address" href={mapsUrl} target="_blank" rel="noreferrer">
              {guestInvitation.location_address}
            </a>
          ) : guestInvitation.location_address ? (
            <span>{guestInvitation.location_address}</span>
          ) : null}
          <strong>{formatEventFee(guestInvitation)}</strong>
          <div className="guest-invitation-summary__people">
            <strong>
              {guestInvitation.capacity !== null
                ? `${guestInvitation.attending_count} / ${guestInvitation.capacity} 人`
                : `${guestInvitation.attending_count} 人`}
            </strong>
            <button type="button" className="btn-text guest-invitation-summary__share" onClick={handleCopyGuestShare}>
              {shareCopied ? "已複製" : "分享 ↗"}
            </button>
          </div>
        </section>

        {session && isOrganizerAdmin && (
          <section className="guest-invitation-host-tools" aria-label="主辦人設定">
            <div className="actions">
              <button type="button" className="btn-secondary" onClick={() => setShowInlineEditor((previous) => !previous)}>
                {showInlineEditor ? "關閉編輯" : "編輯聚會"}
              </button>
            </div>
            {showInlineEditor && (
              <PrivateEventInlineEditor event={event} onSaved={handleInlineEventSaved} onCancel={() => setShowInlineEditor(false)} />
            )}
          </section>
        )}

        <section className="guest-invitation-roster" aria-label="出席狀況">
          {session && isOrganizerAdmin && showInlineEditor ? (
            <InvitationManager
              eventId={event.id}
              slug={event.slug}
              capacity={event.capacity}
              embedded
              onChanged={async () => {
                const refreshed = await getGuestInvitationEvent(
                  event.slug,
                  getOrCreateGuestInvitationKey(event.slug),
                ).catch(() => null);
                if (refreshed) setGuestInvitation(refreshed);
              }}
            />
          ) : invitees.length > 0 ? (
            <>
              <p className="guest-invitation-roster__hint">點選狀態 確認是否出席。</p>
            <ul className="guest-invitation-roster__list">
              {invitees.map((invitee) => (
                <li key={invitee.id}>
                  <strong>{invitee.display_name}</strong>
                  <button
                    type="button"
                    className={`status-pill guest-invitation-roster__status ${invitee.response === "attending" ? "status-pill--confirmed" : invitee.response === "declined" ? "status-pill--declined" : "status-pill--muted"}`}
                    onClick={() => handleGuestStatusChange(invitee)}
                    disabled={updatingInviteeId !== null}
                    aria-label={`${invitee.display_name}目前${responseLabel[invitee.response]}，點選切換狀態`}
                  >
                    {responseLabel[invitee.response]}
                  </button>
                </li>
              ))}
            </ul>
            </>
          ) : <p className="hint">受邀名單尚未建立。</p>}
          {!(session && isOrganizerAdmin && showInlineEditor) && invitees.length > 0 && (
            <p className="guest-invitation-roster__stats">
              出席人數 {guestInvitation.attending_count}{guestInvitation.capacity !== null ? ` / ${guestInvitation.capacity}` : ""}
              （邀請中 {pendingCount} · 不克出席 {declinedCount}）
            </p>
          )}
        </section>

        {coverExpanded && (
          <div className="guest-invitation-lightbox" role="dialog" aria-modal="true" aria-label="活動代表圖">
            <button type="button" className="guest-invitation-lightbox__backdrop" onClick={() => setCoverExpanded(false)} aria-label="關閉代表圖" />
            <button type="button" className="btn-text guest-invitation-lightbox__close" onClick={() => setCoverExpanded(false)}>關閉</button>
            <img src={resolveCoverImage(guestInvitation)} alt={`${guestInvitation.title}代表圖`} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="event-page">
      <section className="event-hero" aria-labelledby="event-title">
        <img src={resolveCoverImage(event)} alt="" width="1672" height="941" fetchPriority="high" />
        <div className="event-hero__veil" />
        <div className="event-hero__copy">
          <p className="eyebrow">
            {VISIBILITY_LABEL[event.visibility]}
            {gatheringTypeLabel ? ` · ${gatheringTypeLabel}` : ""}
          </p>
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
            <strong>{formatEventFee(event)}</strong>
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

        {/* 分享只留兩個出口：一個主要（LINE，帶完整活動資訊）、一個備用（複製連結）。
            原本的「分享活動」「複製分享內容」與這兩個功能重疊，已移除以免選擇困難。 */}
        <section className="event-share event-share--full" aria-label="分享活動">
          <a className="btn-primary" href={getLineShareUrl(shareText)} target="_blank" rel="noreferrer">
            分享到 LINE
          </a>
          <button type="button" className="btn-secondary" onClick={handleCopyLink} aria-live="polite">
            {linkCopied ? "已複製 ✓" : "複製連結"}
          </button>
        </section>

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
            {/* 主辦人是這段文字的作者，不該看到「檢舉我自己」。 */}
            {session && !isOrganizerAdmin && !showReportField && (
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

          {publicSummary && (
            <div className="event-register__details" aria-label="報名說明">
              {publicSummary.organizerDisplayName && <p>由 {publicSummary.organizerDisplayName} 發起</p>}
              {publicSummary.showCapacity && publicSummary.registrationCount !== null && (
                <p>已報名 {publicSummary.registrationCount} / {publicSummary.capacity}</p>
              )}
              {isGuestInvitation ? (
                <>
                  <p>不用註冊，直接用這個網址回覆出席狀態</p>
                  <p>回到同一個網址，就能查看或修改自己的回覆。</p>
                </>
              ) : (
                <>
                  <p>用 LINE 登入即可，免密碼，約 30 秒</p>
                  <p>
                    報名後可回到本頁查看或取消（也可以從
                    <Link to="/me/registrations" className="event-register__link">我的報名</Link>進入）。
                  </p>
                </>
              )}
            </div>
          )}

          {session && isOrganizerAdmin && (
            <div className="banner banner--info event-admin-note">
              這是你邀請大家相見的聚會。
              {!isCancelled && (
                <>
                  <button type="button" className="btn-secondary" onClick={() => setShowInlineEditor((previous) => !previous)}>
                    {showInlineEditor ? "關閉編輯" : "編輯聚會"}
                  </button>
                  <button type="button" className="btn-text" onClick={handleCancelEvent} disabled={busy}>取消整場活動</button>
                </>
              )}
            </div>
          )}

          {session && isOrganizerAdmin && showInlineEditor && !isCancelled && (
            <PrivateEventInlineEditor event={event} onSaved={handleInlineEventSaved} onCancel={() => setShowInlineEditor(false)} />
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

        <section className="event-contact" aria-labelledby="event-contact-title">
          <div>
            <p className="section-kicker">需要確認細節？</p>
            <h2 id="event-contact-title">聯絡主辦人</h2>
            {publicSummary?.organizerDisplayName && (
              <p className="event-contact__organizer">這場活動由 {publicSummary.organizerDisplayName} 發起。</p>
            )}
            <p>
              主辦人若有留下聯絡方式，會放在活動說明或收款說明裡；若頁面沒有提供，
              可以聯絡聚場台灣並註明活動名稱，我們會協助確認活動資訊。
            </p>
          </div>
          <a className="btn-secondary" href={`/contact/?event=${encodeURIComponent(event.slug)}`}>
            聯絡聚場台灣
          </a>
        </section>

        {session && isOrganizerAdmin && (
          <section id="roster-title" className="event-section roster-section">
            <p className="section-kicker">這張桌子，誰會來</p>
            <h2>一起來的人</h2>
            {event.visibility === "private" && event.invite_only && (
              <>
                <h3>共用邀請回覆</h3>
                <InvitationManager eventId={event.id} slug={event.slug} capacity={event.capacity} />
              </>
            )}
            <RosterManager eventId={event.id} capacity={event.capacity} />
          </section>
        )}
      </div>

      {/* 底部只留一個動作。原本的「分享活動」與上方分享區重複，而「我要報名」
          其實只是錨點，按下去只會捲到頁尾再出現另一顆按鈕——未登入時直接送去登入。 */}
      <div className="mobile-action-dock" aria-label="活動快捷操作">
        {isOrganizerAdmin ? (
          <a href="#roster-title" className="btn-primary">看誰報名了</a>
        ) : isGuestInvitation ? (
          <a href="#registration-title" className="btn-primary">回覆出席狀態</a>
        ) : session ? (
          <a href="#registration-title" className="btn-primary">我要報名</a>
        ) : (
          <Link to={`/auth?redirect=${encodeURIComponent(`/e/${event.slug}`)}`} className="btn-primary">
            我要報名
          </Link>
        )}
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
