# Gather Join App

`apps/join` 是 `join.gather.wedopr.com` 的獨立 Cloudflare Worker deploy root，使用
React/Vite、`@cloudflare/vite-plugin` 與 Worker static assets；它不共用既有
`gather.wedopr.com` 靜態主站的部署輸出或 Functions。

## 當前狀態（2026-08-06）

- P1-01～P1-09/13（安全基礎、DB migration/seed、canonical schema、
  dev-auth harness、RLS、RBAC、單一席次引擎、邀請制、付款聲明與年齡把關）
  全部完成並在 Gather 專屬雲端 Supabase 通過交易內驗證＋套用＋再驗證。
- P1-10：網站 UI 已建立（Supabase client、型別化 API 層、路由、5 個頁面：
  首頁、email OTP 登入、建場表單、活動頁含報名/密碼閘門/付款聲明/整場取消、
  我的報名）。已用真實雲端資料在瀏覽器實際驗證匿名可見的頁面；登入後的
  互動流程尚未經瀏覽器實測（見下方「未完成」）。
- 登入機制目前是 Supabase email OTP（內部測試暫代方案），LINE 登入
  （P2-02）與正式 Cloudflare Access staging 部署（P1-03 dev-auth harness
  的實際上線）都還沒接線。
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
- P1-06 / P1-08：單一席次引擎（`register_for_event` 等 8 個 RPC）、
  idempotency、deadlock-free（併發測試抓到並修好一個真實 lock-upgrade
  死結）。證據：`docs/evidence/p1-06-08-green.md`。
- P1-07：雙邀請制（verified-email 自動資格＋one-time token）、event
  password 驗證（dummy-hash 統計容差）。
  證據：`docs/evidence/p1-07-green.md`。
- P1-09 / P1-13：付款聲明（無金額/帳號欄位）、`min_age` 強制、2/29 生日
  年齡計算。證據：`docs/evidence/p1-09-13-green.md`。
- P1-10：網站 UI（建場表單、活動頁、報名、我的報名、email OTP 登入）、
  activity password 解鎖的實際 RLS 授權路徑（`event_password_grants`）、
  整場取消（`cancel_event`）。證據：`docs/evidence/p1-10-green.md`。

## 未完成 / 下一階（可接手）

- LINE 真實登入（P2-02，取代/並行於 email OTP）——需要使用者 LINE
  Developer console 存取。
- 部署 staging（真實 Cloudflare Access 接線、`AUTH_RATE_LIMITER` binding）
  ——需要使用者 Cloudflare 帳號操作；部署後才能完整驗證登入後的互動流程
  （目前只驗證了匿名可見頁面的真實瀏覽器渲染）。
- 自訂報名欄位（`event_fields`）的建立與動態渲染 UI。
- 主辦端報名者名單管理頁面（confirm/decline/remove 的 UI 化）。
- 通知：Phase-2 前續（隱私權條款、callback、secret 寫入後）。

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

部署由後續環境 Gate 建立 staging／production Worker 後才處理；本目錄目前沒有
deploy script。完整產品狀態以 `docs/SSOT.md` 為準。
