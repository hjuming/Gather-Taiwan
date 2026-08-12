import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMyHostedEvents } from "../lib/api";
import { useSession } from "../lib/useSession";
import type { EventRow } from "../lib/types";

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
  const date = new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Taipei",
  }).format(new Date(event.starts_at));
  const end = new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Taipei",
  }).format(new Date(event.ends_at));
  return `${date}–${end}`;
}

export default function MyHostedEventsPage() {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HostedFilter>("all");

  async function load() {
    setError(null);
    try {
      setEvents(await getMyHostedEvents());
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取活動失敗");
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

      {error && <div className="banner banner--error" role="alert">讀取聚會失敗：{error}</div>}

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
              </div>
            </article>
          ))}
          </div>
        </>
      )}
    </div>
  );
}
