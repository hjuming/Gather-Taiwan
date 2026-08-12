import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  cancelEvent,
  deleteEventPermanently,
  duplicateEvent,
  getMyHostedEvents,
  updateEventCover,
} from "../lib/api";
import { copyEventCover } from "../lib/event-covers";
import { useSession } from "../lib/useSession";
import type { EventRow } from "../lib/types";
import { formatTaipeiDateTimeRange } from "../lib/date-time";

// status 講的是「這場活動辦不辦」，visibility 講的是「誰看得到」。
// 原本 published 寫「公開中」，會和旁邊的「不公開列表」直接打架。
const STATUS_LABEL: Record<EventRow["status"], string> = {
  draft: "草稿",
  published: "已開放報名",
  cancellation_pending: "取消處理中",
  cancelled: "已取消",
  cancellation_exception: "取消需處理",
};

type HostedFilter = "all" | "upcoming" | "past" | "cancelled";

function formatEventDate(event: EventRow): string {
  return formatTaipeiDateTimeRange(event.starts_at, event.ends_at);
}

function isRepeatableEvent(event: EventRow): boolean {
  return event.status === "cancelled" || new Date(event.ends_at).getTime() < Date.now();
}

function getRepeatEventTimes(event: EventRow): { startsAt: string; endsAt: string } {
  const sourceStart = new Date(event.starts_at).getTime();
  const sourceEnd = new Date(event.ends_at).getTime();
  const duration = Math.max(sourceEnd - sourceStart, 60 * 60 * 1000);
  const earliest = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const start = new Date(Math.max(sourceStart + 7 * 24 * 60 * 60 * 1000, earliest));
  start.setSeconds(0, 0);
  if (start.getTime() <= Date.now()) start.setMinutes(start.getMinutes() + 1);
  return { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + duration).toISOString() };
}

export default function MyHostedEventsPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HostedFilter>("all");
  const [cancellingEventId, setCancellingEventId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [repeatingEventId, setRepeatingEventId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setEvents(await getMyHostedEvents());
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取活動失敗");
    }
  }

  async function handleCancelEvent(event: EventRow) {
    if (!window.confirm("確定要取消這場聚會嗎？既有報名者會收到通知，活動紀錄會保留。")) return;
    setError(null);
    setNotice(null);
    setCancellingEventId(event.id);
    try {
      await cancelEvent(event.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "取消聚會失敗");
    } finally {
      setCancellingEventId(null);
    }
  }

  async function handleDeleteEvent(event: EventRow) {
    if (!window.confirm(`永久刪除「${event.title}」後，活動、報名、邀請、表單與代表圖都無法復原。確定要繼續嗎？`)) return;
    const typedTitle = window.prompt(`請輸入活動名稱「${event.title}」以確認永久刪除。`);
    if (typedTitle !== event.title) {
      setError("活動名稱不一致，已取消永久刪除。");
      return;
    }

    setError(null);
    setNotice(null);
    setDeletingEventId(event.id);
    try {
      await deleteEventPermanently(event.id, event.cover_image_url);
      setEvents((current) => current.filter((item) => item.id !== event.id));
      setNotice(`已永久刪除「${event.title}」。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "永久刪除聚會失敗");
    } finally {
      setDeletingEventId(null);
    }
  }

  async function handleRepeatEvent(event: EventRow) {
    if (!window.confirm("會建立一個新的報名連結，複製活動內容、地點、費用說明、報名欄位與未撤銷的邀請名單；舊活動不會被修改。新活動預設排在 7 天後，建立後仍可編輯日期。確定要再次聚會嗎？")) return;

    setError(null);
    setNotice(null);
    setRepeatingEventId(event.id);
    try {
      const times = getRepeatEventTimes(event);
      const duplicated = await duplicateEvent(event.id, times.startsAt, times.endsAt);
      let coverWarning: string | null = null;
      try {
        const copiedCoverUrl = await copyEventCover(event.cover_image_url, duplicated.id);
        if (copiedCoverUrl) await updateEventCover(duplicated.id, copiedCoverUrl);
      } catch (err) {
        coverWarning = err instanceof Error ? err.message : "代表圖複製失敗";
      }
      await load();
      setNotice(
        coverWarning
          ? `已建立新的聚會「${event.title}」，但代表圖未複製成功；請進入新活動的編輯頁補上。${coverWarning}`
          : `已建立新的聚會「${event.title}」，新連結已準備好。`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "再次聚會失敗");
    } finally {
      setRepeatingEventId(null);
    }
  }

  useEffect(() => {
    if (session) load();
  }, [session]);

  useEffect(() => {
    if (!loading && !session) {
      navigate(`/auth?redirect=${encodeURIComponent("/me/hosting")}`, { replace: true });
    }
  }, [loading, session, navigate]);

  const visibleEvents = useMemo(() => {
    const now = Date.now();
    return events.filter((event) => {
      if (filter === "cancelled") return event.status === "cancelled";
      if (filter === "upcoming") return event.status !== "cancelled" && new Date(event.ends_at).getTime() >= now;
      if (filter === "past") return event.status !== "cancelled" && new Date(event.ends_at).getTime() < now;
      return true;
    });
  }, [events, filter]);

  const filterItems: { id: HostedFilter; label: string; count: number }[] = [
    { id: "all", label: "全部", count: events.length },
    { id: "upcoming", label: "即將到來", count: events.filter((event) => event.status !== "cancelled" && new Date(event.ends_at).getTime() >= Date.now()).length },
    { id: "past", label: "已結束", count: events.filter((event) => event.status !== "cancelled" && new Date(event.ends_at).getTime() < Date.now()).length },
    { id: "cancelled", label: "已取消", count: events.filter((event) => event.status === "cancelled").length },
  ];

  if (loading || !session) return null;

  return (
    <div className="page page--wide">
      <p className="eyebrow">我發起的聚會</p>
      <h1>把每一場相聚，留在手邊</h1>
      <p className="page-lede">從這裡回到你邀請大家相見的地方，看看誰會來，也把最新消息送回群組。</p>

      {error && <div className="banner banner--error" role="alert">{error}</div>}
      {notice && <div className="banner" role="status">{notice}</div>}

      {events.length === 0 ? (
        <div className="card hosted-events-empty">
          <h2>還沒有發起聚會</h2>
          <p>建立第一場聚會後，之後都會在這裡找到。</p>
          <Link to="/events/new" className="btn-primary">發起一場聚會</Link>
        </div>
      ) : (
        <>
          <div className="hosted-overview" aria-label="聚會總覽">
            <span><strong>{events.length}</strong> 場聚會</span>
            <span><strong>{filterItems[1].count}</strong> 場等著見面</span>
          </div>
          <div className="scroll-tabs" role="tablist" aria-label="活動篩選">
            {filterItems.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                className={filter === item.id ? "is-active" : ""}
                onClick={() => setFilter(item.id)}
              >
                {item.label}<span>{item.count}</span>
              </button>
            ))}
          </div>
          <div className="hosted-event-list">
          {visibleEvents.length === 0 && <p className="empty-state">這個分類目前沒有聚會。</p>}
          {visibleEvents.map((event) => (
            <article key={event.id} className="card hosted-event-card">
              <div className="hosted-event-card__heading">
                <div>
                  <span className={`status-pill ${event.status === "published" ? "status-pill--confirmed" : "status-pill--muted"}`}>
                    {STATUS_LABEL[event.status]}
                  </span>
                  <h2>{event.title}</h2>
                </div>
                <span className="hosted-event-card__visibility">{event.visibility === "public" ? "公開活動" : event.visibility === "unlisted" ? "不公開列表" : "私密活動"}</span>
              </div>
              <div className="hosted-event-card__facts">
                <span><strong>時間</strong>{formatEventDate(event)}</span>
                <span><strong>地點</strong>{event.location_name || "尚未提供"}</span>
                <span><strong>人數</strong>{event.capacity ? `${event.capacity} 人` : "不限人數"}</span>
              </div>
              {/* 這兩顆原本都連到同一個網址、文案卻不同，等於同功能重複。
                  現在分成「改內容」與「看頁面」兩件真的不同的事。 */}
              <div className="actions hosted-event-card__actions">
                <Link to={`/e/${event.slug}`} className="btn-primary">打開聚會頁</Link>
                <Link to={`/e/${event.slug}/edit`} className="btn-secondary">編輯內容</Link>
                {isRepeatableEvent(event) && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleRepeatEvent(event)}
                    disabled={repeatingEventId === event.id || deletingEventId === event.id}
                  >
                    {repeatingEventId === event.id ? "建立中…" : "再次聚會"}
                  </button>
                )}
                {event.status !== "cancelled" && (
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => handleCancelEvent(event)}
                    disabled={cancellingEventId === event.id || deletingEventId === event.id || repeatingEventId === event.id}
                  >
                    {cancellingEventId === event.id ? "取消中…" : "取消聚會"}
                  </button>
                )}
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => handleDeleteEvent(event)}
                  disabled={deletingEventId === event.id || cancellingEventId === event.id || repeatingEventId === event.id}
                >
                  {deletingEventId === event.id ? "刪除中…" : "永久刪除"}
                </button>
              </div>
            </article>
          ))}
          </div>
        </>
      )}
    </div>
  );
}
