# Gather Join App

`apps/join` 是同網域路徑掛載在 `gather.wedopr.com/app/*` 的 Cloudflare Worker（2026-08-06
起改為此架構，之前是獨立子網域 `join.gather.wedopr.com`；見
`implementation-control-log.md` 2026-08-06 段），使用 React/Vite、
`@cloudflare/vite-plugin` 與 Worker static assets。透過 Cloudflare Workers Route
（`gather.wedopr.com/app/*`）與主站既有 Cloudflare Pages 部署（`gather-taiwan` 專案）
共存於同一個 zone；主站其餘路徑仍由 Pages 服務，不受影響。同網域讓 Supabase Auth
的 session 與未來 cookie 天然共用，不需處理跨子網域問題。Vite `base` 固定為
`/app/`（見 `vite.config.ts`），React Router `basename` 讀 `import.meta.env.BASE_URL`。

## 當前狀態（2026-08-15）

- P1-01～P1-09/13 已有分批歷史 evidence；其中 P1-04 有正式雲端 9/9 證據，
  P1-06/P1-08 的 canonical hardening A/B、核心 sequential／concurrency 與 direct UPDATE
  revoke 已完成 read-back；完整 failure matrix、staging 與第二帳號仍分開列為未完成。
- P1-10：網站 UI 已建立（Supabase client、型別化 API 層、路由、5 個頁面：
  首頁、email OTP 登入、建場表單、活動頁含報名/密碼閘門/付款聲明/整場取消、
  我的報名）。匿名與已登入主辦人正式瀏覽器 read-back 已涵蓋活動資訊、容量控制與名單
  管理控制項；正式資料儲存 round-trip 仍以隔離測試活動補驗。
- LINE 登入已完成正式 production 正常授權 E2E：LINE callback、Supabase Auth
  session、`/app/` authenticated DOM 均已驗證；email OTP 仍保留作為備援登入。
  正式 Cloudflare Access staging 接線仍未完成。
- P2-02 的 server-only Supabase grant 與本輪 B migration 均已完成正式 ledger／ACL read-back。
- production source 與 build output 不得含 dev-auth 或 service-role 字詞；`pnpm smoke`
  會檢查（掃描範圍已修正為安全性掃全部、程式碼衛生只掃自家原始碼，避免
  vendored 依賴內部字串造成誤判）。

## 當前可接手入口

- 本輪交接建議先讀：`../implementation-control-log.md`、
  `./docs/SSOT.md`、`./docs/DEVELOPMENT.md`、`./docs/MAINTENANCE.md`、
  `../line-t01a-settings-record.md`
- 本地驗證已建立：

```sh
pnpm test
pnpm test:security
pnpm typecheck
pnpm lint
pnpm build
pnpm smoke
```

若缺 `GATHER_JOIN_TEST_DATABASE_URL`，`pnpm test` 只會 skip 本機 DB suite；
這不能代替 migration / concurrency pass。

## 已確認完成

- P1-01-A/B、P1-02、P1-03：安全基礎、DB migration/seed、canonical schema、
  dev-auth harness。證據：`docs/evidence/p1-01-a-green.md`、
  `p1-01-b-green.md`、`p1-02-green.md`、`p1-03-green.md`。
- LINE T-01a：專屬 provider / OA / Messaging API / staging/login /
  production/login 建立完成，代表圖（icon）上傳驗證完成。
- P1-04：default-deny RLS、registration-scoped view/RPC、欄位白名單
  （`password_hash` 對任何角色都不可直接讀取）。
  證據：`docs/evidence/p1-04-green.md`。
- P1-05：owner/admin/staff RBAC（`add_organizer_member`／
  `revoke_organizer_member`）。證據：`docs/evidence/p1-05-green.md`。
- P1-06 / P1-08 核心證據：既有 `docs/evidence/p1-06-08-green.md` 保留當時的單席
  引擎、idempotency 與 lock-upgrade 死結修正證據；2026-08-14 Node 22 復驗為
  sequential 11/11、`8 搶 3 = confirmed 3 / waitlisted 5`、
  `41 搶 40 = confirmed 40 / waitlisted 1`，均無 oversell 且 fixture cleanup 完成。
  這些是核心不變量證據，不是 P1-06/P1-08 整體 closure。
- P1-07：雙邀請制（verified-email 自動資格＋one-time token）、event
  password 驗證（dummy-hash 統計容差）。
  證據：`docs/evidence/p1-07-green.md`。
- P1-09 / P1-13：付款聲明（無金額/帳號欄位）、`min_age` 強制、2/29 生日
  年齡計算。證據：`docs/evidence/p1-09-13-green.md`。
- P1-10：網站 UI（建場表單、活動頁、報名、我的報名、email OTP 登入）、
  activity password 解鎖的實際 RLS 授權路徑（`event_password_grants`）、
  整場取消（`cancel_event`）。證據：`docs/evidence/p1-10-green.md`。

## 未完成 / 下一階（可接手）

- P1-06/P1-08 canonical hardening A/B 已完成：容量以 `SUM(seats)`、attending 邀請者計入、
  strict FIFO／兩池 deadline merge 有遠端 rollback／併發證據，B 已撤銷 `authenticated` 與前端
  對 `capacity`、`invite_reserved_seats`、`invite_pool_deadline`、`invite_pool_released_at`
  的直接 UPDATE；仍以 conditional closure 管理完整 failure matrix 邊界。
- LINE 登入正常授權以外的失敗矩陣（拒絕、無 email、incognito、過期 state/nonce、
  第二個 LINE 帳號）尚待補跑。
- 部署 staging（真實 Cloudflare Access 接線、`AUTH_RATE_LIMITER` binding）
  ——需要使用者 Cloudflare 帳號操作；部署後才能完整驗證登入後的互動流程
  （目前只驗證了匿名可見頁面的真實瀏覽器渲染）。
- 自訂報名欄位（`event_fields`）的主辦端建立／編輯 UI；參加者端動態渲染、必填與選項驗證、
  `p_answers` 送出已完成（2026-08-08）。
- 主辦端報名者 confirm/decline/remove 的完整 UI 化仍待後續；本輪已完成邀請名單新增／編輯／移除。
- 通知：Phase-2 前續（隱私權條款、callback、secret 寫入後）。

## 2026-08-10 LINE production E2E 交接

- Worker 版本：`e0ba761b-a99f-4320-8d24-c3d29a18d38a`。
- 正常流程證據：fresh `/app/auth` → LINE authorize/login → callback → Supabase
  verify/setSession → `/app/`；DOM 讀到「我的報名」與「登出」。
- 重要修正：Supabase 新式 key 僅送 `apikey`、`public.users` upsert 最小 grant、
  CSP `connect-src` 只允許 Gather Supabase URL、預設 redirect 改為 router root。
- 本地驗證：`58 passed / 1 skipped`、typecheck/lint/build/smoke 全部 PASS。
- 仍不可宣稱：完整失敗矩陣、Cloudflare Access staging、P2-02 migration ledger 同步。

## 2026-08-10 iPad 導覽修正部署

- ✅ `TopNav` 以 `navigator.maxTouchPoints` 標記觸控裝置；iPadOS「要求桌面版網站」即使回報桌面寬度，仍使用漢堡抽屜導覽。
- ✅ Worker production version：`45b790b8-bf59-40d5-a090-b8925d88d8f7`，路由為 `gather.wedopr.com/app/*`。
- ✅ 正式資產回讀：`/app/assets/index-s6CRvfvH.css` 含 `.touch-nav` 規則；`/app/` HTTP 200、`cache-control: no-store`。
- ✅ 本地驗證：typecheck、lint、Vitest `71 passed / 1 skipped`、production build、static touch-nav contract、`git diff --check` PASS。
- ⚠️ 仍需使用實體 iPad 直式／橫式點擊漢堡與抽屜項目完成視覺 E2E；本次未修改 Supabase、LINE、付款資料或使用者資料。

## 2026-08-08 可接續進度：自訂報名欄位

- 活動頁會讀取既有 `event_fields`，依 `short_text`、`long_text`、`single_choice`、
  `multiple_choice`、`boolean` 動態呈現報名輸入。
- 必填欄位、選項白名單與 boolean 已回答狀態在送出前由純函式驗證；驗證通過後才將答案
  傳給既有 `register_for_event(p_answers)` RPC。
- 這一切只使用既有前端 API 與 schema，不新增 migration，也沒有修改 Supabase 專案設定。
- 主辦端建立／編輯 `event_fields` 仍留待下一個切片；在此之前可由受控 migration／管理流程
  建立欄位，不能讓前端接受任意欄位名稱或付款證明欄位。

## Local verification

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:security
pnpm build
pnpm smoke
```

P1-02 真 PostgreSQL 行為驗證另外執行：

```sh
GATHER_JOIN_TEST_DATABASE_URL='postgresql://…' pnpm verify:p1-02
```

驗證器只建立 synthetic fixture，整段包在 transaction 並於結束 `ROLLBACK`；不得使用
真實 LINE ID、email 或活動資料。

真 PostgreSQL gate 需要 `GATHER_JOIN_TEST_DATABASE_URL`。一般 `pnpm test` 在沒有
DB URL 時會明確 skip 併發整合測試，不代表 migration／併發已通過。
專屬雲端 Gate 的現行操作方式與回滾見 `docs/DEVELOPMENT.md` 與
`docs/MAINTENANCE.md`。

production Worker 已部署在 `gather.wedopr.com/app/*`；真實 Cloudflare Access staging
仍是獨立後續 Gate。完整產品狀態以 `docs/SSOT.md` 為準。
