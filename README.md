![Gather Taiwan](https://gather.wedopr.com/uploads/gather-platform-og-v2-natural.png)

# 聚場台灣 Gather Taiwan

相招，聚一場。

聚場台灣（Gather Taiwan）是一個 Culture Platform，致力於把台灣人的相聚文化，轉化為可被參與、傳承與分享的文化體驗。

## Site Structure

| Route | Role |
| --- | --- |
| `/` | Gather Taiwan 首頁，說明文化平台定位、相聚文化、Gatherings、Stories 與合作方向 |
| `/gatherings` | 聚場地圖中層頁，整理不同季節、城市、食物與地方故事的聚場入口 |
| `/neo-rechao` | Signature Gathering proposal page · 新熱炒運動 |
| `/moonlight-bbq` | Season Gathering proposal page · 月光開烤 |
| `/contact` | 聯絡我們頁面，承接品牌、場地、食物、音樂、影像與地方故事合作訊息 |

## Content Boundary

本網站目前為文化平台提案與合作溝通用途。

- 不構成正式公告
- 不提供報名
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
- Contact form uses a Cloudflare Pages Function at `/api/contact` and EmailJS environment variables (`EMAILJS_*` or `VITE_EMAILJS_*`); secrets stay in the deployment environment
- Structured data uses safe platform / creative work types only
- `uploads/` stores active public visual assets
- High-misread-risk legacy assets should stay in Knowledge OS or a local non-public archive, not in the public website repo

© 2026 Gather Taiwan.

[WEDO International Marketing Group.](https://www.wedopr.com/) All rights reserved.
