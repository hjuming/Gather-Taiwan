# P1-14 GREEN 證據：LINE 真實登入（前端整合）

日期：2026-08-06

## 範圍

延續使用者審完 P1-10 後提出的三項需求之一：「用 LINE 和 EMAIL 註冊／登入」。
本次是前端整合這一段——把已經寫好並單元測試過的 Worker 端 LINE OAuth 流程
（`worker/line-auth.ts`，見前一個 evidence 段落／control log）接上實際可
點擊的登入頁與回呼收尾頁，讓「使用 LINE 登入」變成使用者真的能操作的路徑，
而不只是後端可用。

## 變更內容

- `src/pages/AuthPage.tsx`：新增 `LINE_ERROR_LABEL` 對照表，把 Worker 端
  導回的 `line_error` query param（`line_declined`／
  `missing_code_or_state`／`state_mismatch`／`nonce_mismatch`／
  `audience_mismatch`／`token_exchange_failed`）轉成中文錯誤訊息 banner；
  新增「使用 LINE 登入」按鈕，連到 `/app/auth/line/start?redirect=...`；
  移除舊的「LINE 登入上線後會取代這個流程」過時文案。
- `src/pages/LineAuthCompletePage.tsx`（新檔）：Worker 端完成 LINE OAuth
  與 Admin API `generate_link` 後，會把使用者導回這個頁面並帶
  `token_hash`；這頁呼叫 `supabase.auth.verifyOtp({ token_hash, type:
  "magiclink" })` 把它換成真正的 client-side session，然後呼叫
  `ensureUserProfile`／`sync_verified_email` 作為保底（Worker 端已經
  provision 過 profile，這裡失敗不阻擋登入，只是 best-effort 補齊），最後
  導向原本要去的頁面。
- `src/App.tsx`：新增 `/auth/line/complete` route。
- `src/pages/HomePage.tsx`：更新「目前狀態」卡片文案，從「登入方式為
  email 驗證碼（LINE 登入之後會取代它）」改成「登入方式為 LINE 或 email
  驗證碼」，並補上「主辦人手動名單管理都已可用」，反映 P1-11 與本次的
  實際可用狀態。

## 已通過

- `pnpm typecheck && pnpm lint && pnpm test`：全部 PASS
  （41 passed / 1 skipped，含既有的 `worker/line-auth.test.ts` 9 項）。
- `pnpm build && pnpm smoke`：PASS。
- `pnpm build:staging && pnpm smoke:staging`：PASS（兩次 build 之間執行
  `rm -rf dist`，避免 P1-10 段落記錄過的「prod／staging bundle 共存汙染
  smoke 掃描」問題重演）。

## 過程中修正

- `LineAuthCompletePage.tsx` 初版寫成
  `await supabase.rpc("sync_verified_email").catch(() => undefined)`，
  `tsc -b`（project-reference build，比單純 `tsc --noEmit` 嚴格）回報
  `PostgrestFilterBuilder` 沒有 `.catch` 方法。改成 `try/catch` 包住
  `ensureUserProfile` 與 `supabase.rpc(...)` 兩個 await，語意不變（best-effort
  保底，失敗不阻擋登入），型別正確。

## 不屬於本 Gate（仍待處理）

- LINE Developers Console 的 Callback URL（正式與 staging 兩個 channel）
  目前都還是空的，尚未填入 `https://gather.wedopr.com/app/auth/line/callback`
  或對應 staging 網址——填之前無法對真實 LINE 帳號做端對端手動測試。
- Cloudflare Worker secrets（`LINE_CHANNEL_SECRET`、
  `SUPABASE_SERVICE_ROLE_KEY` 等）尚未透過 `wrangler secret put` 設定。
- `wrangler deploy` 與 Workers Route 啟用尚未執行——這會影響正式對外服務
  的網域，依規定需要使用者明確確認後才執行，目前刻意保留未做。
- 主站靜態頁面（任務 #11）尚未加上共用登入／會員導覽連結。
