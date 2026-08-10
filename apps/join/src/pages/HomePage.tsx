import { Link } from "react-router-dom";
import { useSession } from "../lib/useSession";

export default function HomePage() {
  const { session } = useSession();

  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__copy">
          <p className="eyebrow">聚場台灣<br /><span className="home-hero__brand-en">Gather Taiwan</span></p>
          <h1 id="home-title">相招，<em>聚一場。</em></h1>
          <p>有些台灣記憶，是從一張桌開始的。早餐店的鐵板聲、港邊的海風、中秋的炭香、熱炒桌的碰杯聲，都讓人有理由坐下來，和熟悉或剛認識的人一起留下故事。</p>
          <div className="home-hero__actions">
            <Link to="/events/new" className="btn-primary">發起一場聚會</Link>
            {session && <Link to="/me/hosting" className="btn-secondary">我發起的聚會</Link>}
            {!session && <Link to="/auth" className="btn-secondary">登入後開始</Link>}
          </div>
        </div>
        <div className="home-hero__signal" aria-label="來聚一場的使用方式">
          <span className="home-hero__signal-dot" />
          <span>一個連結</span>
          <span className="home-hero__signal-line" />
          <span>一桌相聚</span>
        </div>
      </section>

      <section className="home-workflow" aria-labelledby="workflow-title">
        <div>
          <p className="section-kicker">一場聚會怎麼開始</p>
          <h2 id="workflow-title">把想見的人，約到同一張桌子</h2>
        </div>
        <ol className="workflow-steps">
          <li><span>01</span><strong>寫下相聚的理由</strong><p>留下日期、時間、地點與這次想見面的人。</p></li>
          <li><span>02</span><strong>把邀請送出去</strong><p>把一個完整的聚會頁，貼進 LINE 群組。</p></li>
          <li><span>03</span><strong>看見誰會來</strong><p>報名、回覆與席次，都在同一張桌邊慢慢成形。</p></li>
        </ol>
      </section>

      <section className="home-note">
        <p className="section-kicker">讓相聚回到相聚</p>
        <p>這裡不替你收款，也不替你決定一場聚會該長什麼樣子。你留下自己的方式，大家帶著期待赴約。</p>
      </section>
    </div>
  );
}
