![Gather Taiwan](https://gather.wedopr.com/uploads/gather-platform-og-v2-natural.png)

# 聚場台灣 Gather Taiwan

相招，聚一場。

聚場台灣（Gather Taiwan）是一個 Culture Platform，致力於把台灣人的相聚文化，轉化為可被參與、傳承與分享的文化體驗。

## Site Structure

| Route | Role |
| --- | --- |
| `/` | Gather Taiwan 首頁，說明文化平台定位、相聚文化、Gatherings、Stories 與合作方向 |
| `/gatherings` | 聚場地圖中層頁，看見不同季節、城市、食物與地方故事的聚場場景 |
| `/neo-rechao` | Signature Gathering proposal page · 新熱炒運動 |
| `/moonlight-bbq` | Gathering proposal page · 月光開烤燒肉聚會 |
| `/contact` | 聯絡我們頁面，承接品牌、場地、食物、音樂、影像與地方故事合作訊息 |

## Registration Application

「來聚一場」報名系統於 [`apps/join`](./apps/join/README.md) 獨立開發，現以
`https://gather.wedopr.com/app/*` 的 Cloudflare Workers Route 與本靜態文化主站共存。實作的
產品真實來源與維運規則見：

- [`apps/join/docs/SSOT.md`](./apps/join/docs/SSOT.md)
- [`apps/join/docs/DEVELOPMENT.md`](./apps/join/docs/DEVELOPMENT.md)
- [`apps/join/docs/MAINTENANCE.md`](./apps/join/docs/MAINTENANCE.md)

## Current engineering handoff（2026-08-18）

目前工程固定點是 branch `codex/gather-mvp`、HEAD `fd5a3d3`、working tree clean。
這是 Wave 0 manual roster 的收尾階段，不代表 Wave 0 已接受關閉；Wave 1 維持 blocked、不得開始。

| Gate | 最新結果 | 證據 |
| --- | --- | --- |
| Local／isolated runtime | PASS | cleanup zero-residue；phase-aware concurrency one-shot `confirmed=1 / waitlisted=5`；catalog `33`、ACL PASS、RLS `8/8`、aggregate `0` |
| Remote Supabase | PASS（REMOTE read-back） | 兩支指定 migration present；function `9/9` conforming；ACL PASS；RLS `8/8` enabled＋forced；aggregate `0` |
| GitHub CI | PASS | Draft PR #1；run `32148850377` 的 `verify`、`local-supabase`、Pages check 均 PASS |
| Staging | PASS（workers.dev public URL gate） | `gather-join-staging` version `82b00639-298b-4f73-aa91-d3169c75258a`；homepage `200`；無 Access assertion 的 protected route `403` |
| Pages | PASS（PRODUCTION read-back） | source `fd5a3d3`；deployment [`bb3f7583.neo-rechao.pages.dev`](https://bb3f7583.neo-rechao.pages.dev) 與 [`gather.wedopr.com`](https://gather.wedopr.com) 均 `200` |
| Independent Fresh review | pending | 前一輪 reviewer `Russell` 為 `READY_WITH_BLOCKERS`；文件已同步，尚待重新交 Fresh 複核 |

已知邊界：`staging.join.gather.wedopr.com` 尚無 DNS／custom domain／zone route，因此只能宣稱 workers.dev staging gate，不能宣稱 canonical staging host 或同源瀏覽器 UAT 已驗收。約 593 kB bundle warning 與 Node engine warning 保留為非阻擋風險，未擴大本輪 scope。

下一工程團隊請先讀 [`docs/squad/NEXT-TEAM-KICKOFF.md`](./docs/squad/NEXT-TEAM-KICKOFF.md)，再依序讀 `docs/squad/LEDGER.md`、`implementation-control-log.md`、`docs/squad/HANDOFF.md`。

目前 P1-04 domain policy 已有正式雲端 9/9 證據；P1-06/P1-08 核心席次／候補
序列與併發證據亦 PASS。canonical hardening A/B 已完成 SUM(seats)、strict FIFO、兩池
deadline 順序與敏感欄位 direct UPDATE revoke；仍不把完整 LINE failure matrix、staging
與第二帳號 E2E 放大為已完成。

## 2026-08-15 進度摘要（可直接接續）

- 完成項目
  - `apps/join`：P1-01-A/B 與 P1-02 已完成主要驗收，且有本機與雲端回讀資料。
  - LINE 專屬 provider / OA / Messaging API / staging、production Login channels
    已完成「同一 provider 建立」拓撲，並完成圖示上線（`512x512` 圖示）。
  - join 站點 icons 已納入版本：`apps/join/public/favicon_io/*` 與
    `apps/join/public/site.webmanifest`，`apps/join/index.html` 已加入 favicon 連結。
  - `jose` 已安裝，並補齊 dev-auth 測試環境（`vite.config.ts` 為測試 node
    environment；`security.test.tsx` 明確標註 jsdom）。
  - P1-03（非 production dev auth harness）已完成正式驗收：typecheck/lint/test/
    build/smoke 與 build:staging/smoke:staging 全綠，production build 靜態掃描
    確認零 dev-auth 殘留。證據：`apps/join/docs/evidence/p1-03-green.md`。
- 已知未完成/待續
  - P1-03 harness 尚未接線真實 Cloudflare Access／`AUTH_RATE_LIMITER` binding，
    未部署至任何環境；P1-04 的多 sub RLS 強制力已完成正式雲端驗證。
  - B migration 已撤銷 `authenticated` 對容量／兩池敏感欄位的 direct UPDATE；容量 RPC
    ACL 與正式 Worker／前端路徑已完成 read-back。
  - P1-06/P1-08 已證明 sequential 11/11、`8 搶 3 = 3/5`、`41 搶 40 = 40/1`，並補上
    `SUM(seats)`、兩池 deadline merge/release 與 strict FIFO 的 rollback／遠端證據；完整
    failure matrix 仍另列未完成。
  - LINE 正常授權 production E2E 已 PASS；拒絕、無 email、incognito、過期 state/nonce
    與第二個獨立帳號的完整失敗矩陣尚未完成。
- 當前接力文件（優先看）
  - `apps/join/docs/SSOT.md`
  - `apps/join/docs/DEVELOPMENT.md`
  - `apps/join/docs/MAINTENANCE.md`
  - `implementation-control-log.md`
  - `line-t01a-settings-record.md`

## Content Boundary

本網站目前為文化平台提案與合作溝通用途。

- 不構成正式公告
- 文化主站不直接提供報名；未來報名功能只由獨立 `apps/join` 產品提供
- 不提供票務
- 不提供完整活動行事曆；聚場地圖僅顯示公開活動摘要
- 不提供會員或付款功能
- 不列未確認合作夥伴 logo
- 不把潛在接觸對象寫成合作事實
- 不使用活動型 structured data
- 不寫成定案日期、場地、容量、陣容、合作或城市巡迴

## Canonical

- Home: `https://gather.wedopr.com/`
- Gathering Map: `https://gather.wedopr.com/gatherings`
- Signature Gathering: `https://gather.wedopr.com/neo-rechao`
- Season Gathering: `https://gather.wedopr.com/moonlight-bbq`
- Contact: `https://gather.wedopr.com/contact`

## Redirects

`/Neo-Rechao` 與舊 Design Composer 匯出路徑導向 `/neo-rechao`。

## Technical Notes

- Static HTML / CSS / JavaScript
- Cloudflare Pages
- Contact form uses a Cloudflare Pages Function at `/api/contact`
- Email is routed through the Gather Taiwan email module: `functions/_shared/gather-email.js`
- EmailJS values are loaded from Cloudflare Pages environment variables; local development can use `.env.local`
- Structured data uses safe platform / creative work types only
- `uploads/` stores active public visual assets
- High-misread-risk legacy assets should stay in Knowledge OS or a local non-public archive, not in the public website repo

## EmailJS Setup

Local `.env.local` should use these keys:

```env
EMAILJS_SERVICE_ID=service_py2gq7e
EMAILJS_TEMPLATE_ID=template_6970fud
EMAILJS_PUBLIC_KEY=VxaEkKp7MjM20ERo8
EMAILJS_PRIVATE_KEY=
GATHER_CONTACT_CC_EMAIL=gather@wedopr.com
```

`EMAILJS_TEMPLATE_ID` should point to one EmailJS template that sends the acknowledgement email to the user. The default receiving inbox is `gather@wedopr.com`.

`EMAILJS_PRIVATE_KEY` is optional for the local file but recommended for server-side production usage. Do not commit `.env.local`; use Cloudflare Pages environment variables for production.

The HTML template is stored at:

```text
email-templates/gather-taiwan-contact-emailjs.html
```

EmailJS template settings:

```text
To Email: {{to_email}}
To Name: {{to_name}}
From Name: 聚場台灣 Gather Taiwan
From Email: Use Default Email Address
Reply To: gather@wedopr.com
Bcc: gather@wedopr.com
Subject: {{auto_reply_subject}}
```

Use a fixed, valid Bcc email in the EmailJS dashboard for manual testing. A malformed address such as `name@gmail,com`, or a variable like `{{cc_email}}` without a matching playground parameter, can trigger `Gmail_API: Invalid Bcc header`.

If EmailJS is already configured with `To Email: {{email}}`, it will still work because the contact API sends both `email` and `to_email`. Prefer `{{to_email}}` for consistency with this module.

The EmailJS template should support these variables:

```text
name
email
phone
role
page
title
subject
topic
to_name
to_email
from_name
from_email
from_phone
reply_to
auto_reply_subject
message
source
website_url
submitted_at
submitted_at_taipei
brand_email
```

The contact API still sends `cc_email` from `GATHER_CONTACT_CC_EMAIL`, so teams may use `{{cc_email}}` in Bcc / CC for deployment tests. If using EmailJS Playground, add `cc_email` as a template parameter before testing.

© 2026 Gather Taiwan.

[WEDO International Marketing Group.](https://www.wedopr.com/) All rights reserved.
