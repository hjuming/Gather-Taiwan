export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <strong>聚場台灣 Gather Taiwan</strong>
          <span>相招，聚一場。</span>
          <span>
            © 2026 Gather Taiwan.{" "}
            <a href="https://www.wedopr.com/">WEDO International Marketing Group.</a>
          </span>
        </div>
        <nav aria-label="頁尾導覽">
          <a href="/">聚場台灣首頁</a>
          <a href="/gatherings/">聚場地圖</a>
          <a href="/app/me/registrations">我的報名</a>
          <a href="/contact/">聯絡我們</a>
          <a href="/privacy/">隱私權政策</a>
          <a href="/terms/">服務條款</a>
        </nav>
      </div>
    </footer>
  );
}
