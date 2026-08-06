# P1-10 GREEN 證據

日期：2026-08-06

## 範圍

建場精靈（單頁、非多步驟）、公開/unlisted/private 活動頁、報名表單、
confirm mode、取消流程（個人取消＋整場取消）、email 驗證碼登入（LINE 上線前
的暫代身分機制）、活動密碼解鎖後的實際檢視權限、所有共用自由文字沿用 P1-01
sanitizer（`SafeRichText`）輸出（來源：`gather-registration-master-backlog.md`
P1-10 列）。

## 範圍裁決

- **登入方式：email 驗證碼，非 LINE、非自建 dev-auth**。P1-03 的 dev-auth
  harness 需要真實 Cloudflare Access（staging-only），本機開發環境無法取得；
  LINE（P2-02）尚未接。Supabase 內建 email OTP 是既有、受信任的身分基礎，
  P1-14（email 驗證邊界）本來就假設它存在，這裡只是提前接上，讓「內部測試」
  真的有人能登入。新增 `sync_verified_email()` RPC：只信任 Supabase 自己的
  `auth.users.email_confirmed_at`（非客戶端宣稱），把它同步進
  `public.users.email_verified_at`（P1-04 的 UPDATE grant 本來就不讓客戶端
  直接寫這個欄位）。
- **活動密碼解鎖後的實際存取**：P1-07 只做了密碼驗證的 DB 原語，沒有把
  「驗證成功」轉成 RLS 看得到的權限——這在串 UI 時是一條死路：匿名訪客
  連活動 ID 都拿不到，無法呼叫 `verify_event_password(uuid, text)`。本
  Gate 補了 `event_password_grants` 表 + `verify_event_password_by_slug`
  （slug→id 在 DB 端解析，不對外洩漏活動是否存在）。**限制**：解鎖仍要求
  先登入（`auth.uid()` 存在才能記錄 grant）；真正匿名訪客的密碼預覽需要
  Worker 簽發短效 token，留給未來需要時再做，目前先用「登入→解鎖」這條較
  小的路徑。
- **整場取消**：新增 `cancel_event` RPC（admin/owner only），把活動設為
  `cancelled` 並把所有進行中報名轉為 `cancelled`，逐筆 outbox。
- **不含自訂報名欄位（`event_fields`）的建立 UI**：後端 RPC 已支援動態
  欄位（P1-06），但建場精靈與報名表單這輪只用內建欄位，動態問卷 UI 留待
  後續增量——不影響「報名／候補／取消」核心迴圈能不能跑。
- **不含主辦端的報名者名單管理頁**（confirm/decline pending、查看名單）；
  `organizer_confirm_registration`／`organizer_decline_registration`
  （P1-06）已可用，UI 化留待後續。

## 已完成

### 後端新增（4 個 forward-only migration）

- `20260806010000_p1_10_cancel_event.sql`：`cancel_event` RPC。
- `20260806020000_p1_10_sync_verified_email.sql`：`sync_verified_email` RPC。
- `20260806030000_p1_10_password_grants.sql`：`event_password_grants` 表、
  `has_verified_event_password`、`can_view_event`（`create or replace`，
  第二次修訂）、`events_select_password_verified` policy、
  `verify_event_password`（`create or replace`，加入 grant 寫入）。
- `20260806040000_p1_10_verify_password_by_slug.sql`：
  `verify_event_password_by_slug`（解決前端「拿不到活動 ID」的雞生蛋問題）。

四個都先在 `BEGIN...ROLLBACK` 交易內驗證通過才正式套用；套用後重跑對應
`apps/join/scripts/verify-p1-10-*.sql` 全部 PASS，殘留檢查為 0。

### 前端（全新，先前只有安全渲染骨架）

- `src/lib/supabase.ts`：Supabase client（URL／publishable key 為公開值，
  Supabase 自己標示「safe to share publicly」）。
- `src/lib/api.ts`：所有 RPC／表查詢的型別化封裝。
- `src/lib/useSession.ts`：session 狀態 hook。
- `src/pages/`：`HomePage`、`AuthPage`（email OTP）、`EventCreatePage`
  （單頁建場表單）、`EventPage`（活動頁＋報名＋密碼閘門＋付款聲明＋整場
  取消）、`MyRegistrationsPage`。
- `src/components/TopNav.tsx`。
- `src/App.tsx`：react-router-dom 路由。
- 視覺風格：延續既有 `styles.css` 的暖色極簡系統（米白底、炭黑字、
  赭紅強調色、Noto Serif TC 標題），未套用罐頭 UI 元件庫。

## 過程中發現並修正的真實 bug（3 個）

1. **`events` 欄位白名單導致前端全面 401**：前端用 `select("*")`，
   Postgres 對 `SELECT *` 要求對「每一欄」都有權限，而 `password_hash`
   從 P1-04 起就刻意不授權給任何角色——這證明白名單設計本身正確運作，
   但要求所有 `events` 查詢改用明確欄位清單（`EVENT_COLUMNS` 常數）。
   透過瀏覽器直接對雲端 REST API 送請求重現、定位、驗證修正。
2. **`events` RLS 沒有真的接上 invitee 可見性**：`can_view_event()`
   helper（P1-07）把 invitee 考慮進去，但 `events` 表自己的 policy
   從未呼叫它——RLS policy 不會因為存在一個「看起來相關」的函式就自動套用。
   新增 `events_select_invitee` policy 修正。
3. **`verify_event_password` 對前端不可用**：需要事先知道活動的 UUID，
   但一個尚未解鎖的私密活動對前端來說連 ID 都拿不到（RLS 正確隱藏了它）。
   新增 slug-based 版本解決雞生蛋問題。

以上 3 個都是**先用瀏覽器對真實雲端資料庫實際跑過**才發現的，不是憑空
猜測；每一個都追加 forward-only migration 或前端修正並重新驗證通過。

## 驗證證據

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm smoke`：
  全部 PASS（`dist/` 每次驗證前先清空，避免 prod／staging 產物混在一起
  互相污染掃描結果——這本身也是本輪發現的一個測試方法論問題，已修正）。
- `pnpm build:staging && pnpm smoke:staging`：PASS。
- 瀏覽器（Claude Browser，非模擬）對本機 `vite dev` 實際渲染，資料來自
  雲端 Supabase 專案（非 mock）：
  - 首頁：桌面／手機寬度皆正常，無版面溢出。
  - 公開活動頁（真實建立的測試活動）：標題、時間、地點、費用、
    活動說明（含 `<strong>` 安全渲染）、收款說明、報名按鈕皆正確顯示。
  - 私密＋密碼活動：未解鎖時顯示「找不到這個活動」＋密碼輸入框，不洩漏
    活動是否存在；未登入時明確提示「需要先登入才能解鎖」。
  - `/events/new`、`/me/registrations`：未登入時正確導向
    `/auth?redirect=...`（實際檢查 `window.location.href` 確認 redirect
    參數正確）。
  - 登入頁（email OTP 表單）：手機寬度正常。
  - 測試資料事後以明確 SQL 清除，殘留檢查為 0。

## 明確未驗證（NOT_RUN，誠實記錄）

- **登入後的完整互動流程（報名／取消／建場）未經瀏覽器實際操作驗證**：
  沒有可用管道接收真實 email OTP 驗證碼（不是本 session 能收信的環境），
  也刻意不手刻 `auth.users` 密碼登入（風險：可能讓 Supabase Auth 內部狀態
  處於不一致，例如缺少對應的 `auth.identities` 列）。這些流程的**後端
  RPC 邏輯**已透過 `psql` 交易內測試詳盡覆蓋（見 P1-06/07/08/09/13 各
  evidence），**前端呼叫邏輯**通過 `pnpm typecheck` 與程式碼審閱，但兩者
  串接後的真實瀏覽器互動要等 P1-10 之後的 staging 部署（需要使用者的
  Cloudflare／LINE 帳號）才能完整驗證。
- 自訂報名欄位（`event_fields`）的建立與動態渲染 UI（見範圍裁決）。
- 主辦端報名者名單管理頁面。
- 密碼解鎖的匿名（未登入）訪客路徑（見範圍裁決）。
