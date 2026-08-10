import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMyHostedEvents } from "../lib/api";
import { useSession } from "../lib/useSession";
import type { EventRow } from "../lib/types";

const STATUS_LABEL: Record<EventRow["status"], string> = {
  draft: "草稿",
  published: "公開中",
  cancellation_pending: "取消處理中",
  cancelled: "已取消",
  cancellation_exception: "取消需處理",
};

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

  if (loading || !session) return null;

  return (
    <div className="page page--wide">
      <p className="eyebrow">主辦人工作區</p>
      <h1>我發起的活動</h1>
      <p className="page-lede">從這裡進入活動頁，查看報名名單、複製分享內容，或管理這場聚會。</p>

      {error && <div className="banner banner--error">讀取活動失敗：{error}</div>}

      {events.length === 0 ? (
        <div className="card hosted-events-empty">
          <h2>還沒有發起活動</h2>
          <p>建立第一場聚會後，之後都會在這裡找到。</p>
          <Link to="/events/new" className="btn-primary">發起一場聚會</Link>
        </div>
      ) : (
        <div className="hosted-event-list">
          {events.map((event) => (
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
              <div className="actions hosted-event-card__actions">
                <Link to={`/e/${event.slug}`} className="btn-primary">管理活動</Link>
                <Link to={`/e/${event.slug}`} className="btn-secondary">查看活動頁</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
