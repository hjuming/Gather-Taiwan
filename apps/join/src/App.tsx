import { SafeExternalLink, SafeRichText } from "./security/security";

export default function App() {
  return (
    <main>
      <p className="eyebrow">來聚一場</p>
      <h1>報名系統基礎已建立</h1>
      <SafeRichText html="<p>此獨立 App 目前只提供安全渲染基礎，尚未開放報名。</p>" />
      <SafeExternalLink href="https://gather.wedopr.com/">回到聚場台灣</SafeExternalLink>
    </main>
  );
}
