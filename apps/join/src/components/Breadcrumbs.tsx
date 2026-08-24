import { Link, useLocation } from "react-router-dom";

function getCurrentLabel(pathname: string): string | null {
  if (pathname === "/") return null;
  if (pathname === "/auth") return "開始報名";
  if (pathname === "/auth/line/complete") return "登入中";
  if (pathname === "/events/new") return "發起一場聚會";
  if (pathname === "/me/registrations") return "我的報名";
  if (pathname === "/me/hosting") return "我發起的聚會";
  if (/^\/e\/[^/]+\/edit$/.test(pathname)) return "編輯聚會";
  if (/^\/e\/[^/]+$/.test(pathname)) return "聚會頁";
  return null;
}

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const currentLabel = getCurrentLabel(pathname);

  return (
    <div className="site-breadcrumb-wrap">
      <nav className="site-breadcrumb" aria-label="麵包屑導覽">
        <a href="/">聚場台灣</a>
        <span aria-hidden="true">/</span>
        {currentLabel ? <Link to="/">來聚一場</Link> : <span aria-current="page">來聚一場</span>}
        {currentLabel && (
          <>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{currentLabel}</span>
          </>
        )}
      </nav>
    </div>
  );
}
