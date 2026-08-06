import { Link } from "react-router-dom";
import { useSession } from "../lib/useSession";

export default function HomePage() {
  const { session } = useSession();

  return (
    <div className="page">
      <p className="eyebrow">來聚一場・內部測試</p>
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
        <h2>目前狀態</h2>
        <p style={{ color: "var(--muted)" }}>
          這是內部測試版本：登入方式為 LINE 或 email 驗證碼。報名、候補、邀請制、活動密碼、
          付款聲明、主辦人手動名單管理都已可用；金流仍為主辦人自行約定，平台不代收款項。
        </p>
      </div>
    </div>
  );
}
