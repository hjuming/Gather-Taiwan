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
| `/moonlight-bbq` | Season Gathering proposal page · 月光開烤 |
| `/contact` | 聯絡我們頁面，承接品牌、場地、食物、音樂、影像與地方故事合作訊息 |

## Registration Application

「來聚一場」報名系統於 [`apps/join`](./apps/join/README.md) 獨立開發，未來以
`join.gather.wedopr.com` 作為獨立 deploy root，不覆寫本靜態文化主站。實作的
產品真實來源與維運規則見：

- [`apps/join/docs/SSOT.md`](./apps/join/docs/SSOT.md)
- [`apps/join/docs/DEVELOPMENT.md`](./apps/join/docs/DEVELOPMENT.md)
- [`apps/join/docs/MAINTENANCE.md`](./apps/join/docs/MAINTENANCE.md)

目前已完成 P1-01 foundation 與 P1-02 canonical database schema；domain tables 在
RLS policy 建立前仍維持 fail-closed。`apps/join` 的 LINE 登入、主辦建場、分享邀請與
參加者報名仍在後續 Gate，請勿把目前已就緒的資料表誤認為可直接上線。

## 2026-08-05 進度摘要（可直接接續）

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
    未部署至任何環境；「多 sub 受 RLS」的資料庫端強制力留待 P1-04。
  - P1-04 domain RLS policies 還未上線；目前完整 fail-closed。
  - P1-06/P1-08 冪等與席次引擎尚未上線。
  - LINE callback、token 驗證與真人 E2E 尚未完成（T-01b）。
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
- 不提供活動行事曆
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
