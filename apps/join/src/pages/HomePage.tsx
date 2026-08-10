import { Link } from "react-router-dom";
import { useSession } from "../lib/useSession";

export default function HomePage() {
  const { session } = useSession();

  return (
    <div className="page">
      <p className="eyebrow">聚場台灣・來聚一場</p>
      <h1>找個理由，聚一場</h1>
      <p style={{ color: "var(--fg)", fontSize: "1.05rem" }}>
        來聚一場是一個給朋友、社群發起小型聚會的報名工具——長桌晚餐、讀書會、深夜熱炒，
        不需要複雜的活動平台，一個連結就能開始收人。
      </p>

      <div className="actions" style={{ marginTop: 32 }}>
        <Link to="/events/new" className="btn btn-primary" style={{ textDecoration: "none" }}>
          發起一場聚會
        </Link>
        {session && (
          <Link to="/me/registrations" className="btn btn-secondary" style={{ textDecoration: "none" }}>
            我的報名
          </Link>
        )}
      </div>

      <div className="card" style={{ marginTop: 48 }}>
        <h2>一個連結，開始收人</h2>
        <p style={{ color: "var(--muted)" }}>
          登入後建立活動、設定時間與地點，再把活動連結貼到 LINE 群組。參加者填寫資料即可報名；
          金流由主辦人自行約定，平台不代收款項。
        </p>
      </div>
    </div>
  );
}
