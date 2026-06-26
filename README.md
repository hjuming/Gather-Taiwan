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
