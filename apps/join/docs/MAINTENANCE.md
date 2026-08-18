# 來聚一場：維護注意事項

## Wave 0 handoff boundary（2026-08-18）

- Current Git fixed point：`codex/gather-mvp@6622f72`；本輪文件 sync 不涉及 runtime source、migration 或資料寫入。
- Remote Supabase read-back：catalog `33`、指定 migrations present、function `9/9`、ACL PASS、RLS `8/8` enabled＋forced、aggregate `0`。
- Staging read-back：`gather-join-staging` version `82b00639-298b-4f73-aa91-d3169c75258a`；workers.dev homepage `200`；未帶 Access assertion 的 protected route `403`。
- Pages read-back：source `6622f72`；deployment `https://2625040c.neo-rechao.pages.dev` 與 canonical `https://gather.wedopr.com` 均 `200`。
- `staging.join.gather.wedopr.com` 尚無 DNS／custom domain／zone route；canonical staging host 維持 `UNVERIFIED`，不得自行補 route／DNS。
- Wave 0 尚待文件 sync 後的 independent Fresh re-review；Wave 1 維持 blocked。不要重跑 concurrency、不要新增資料庫、不要套用未授權 migration 或做 broad cleanup。

## 密鑰與帳號

- LINE channel secret、Supabase DB password、service role key 都不得進 Git、DOM 快照、
  screenshot、CI log 或維運文件。
- 2026-08-02 建立 Supabase 時，初始隨機 DB password 曾出現於受控工具輸出；
  已立即輪替，現行密碼僅在被 ignore 的 `0600` 本機檔。
- Staging LINE Login secret 曾在 Console DOM read-back 出現，已要求重新發行；在
  Phase 2 實際登入前必須再確認現行 secret 只存於部署環境。
- 搬用 Care WEDO OAuth 邏輯時，只可參考 state/nonce/fallback 寫法；不可搬
  channel id、secret、callback URL 或使用者資料。

## 資料庫

- Gather project ref 固定為 `anklbpkyesdmsubyfcna`。任何寫入前先比對 project ref、
  host 與 migration ledger；不可對 Signal/Care 專案操作。
- 使用 Session pooler 做 migration 時，user 必須是 `postgres.<project-ref>`，必須
  `sslmode=require`，並設定連線逾時。
- PostgreSQL `bigint` 經 `postgres` JavaScript driver 可能是十進位字串。運算前必須
  統一 `BigInt(value)`；不可對字串直接 `+ 1n`。
- 有限容量不得在 UI 端先讀後寫。必須使用事務、鎖、唯一約束、單一席次
  引擎與 deferred constraint trigger 共同維持。
- P1-04 已在維持 `ENABLE/FORCE RLS` 下新增最小 policy、欄位 grant 與 scoped RPC；
  base-table direct DML 與尚未開放的流程仍 fail-closed，不可用 service role 或暫時 grant 繞過。
- Owner transfer 同時受 partial unique 與 deferred「恰一位 owner」constraint trigger
  保護。若 caller 先把 constraints 改為 immediate，RPC 仍會在自身交易內延後該 trigger、
  完成雙更新後立刻重驗；不得拆成兩次 API update。
- `organizer_members.organizer_id/user_id` 與 `registrations.event_id/user_id` 均不可更新
  搬移；要換關聯須走明確撤銷／新建流程。registration 與 answer/idempotency/
  notification/outbox/audit 的活動歸屬另由 composite FK 防止跨租戶拼接。
- Terminal registration status 不可復活；新增狀態或轉移必須以新 migration 同步修改
  enum、transition function、席次占用集合與 verifier，不可只改前端文案。
- 已知 P2：`registration_answers` 目前同時保留原單欄 FK 與新增的 composite FK，正確性
  不受影響但會重複檢查。若 profiling／Advisor 證明需要清理，只能新增 forward-only
  migration 移除冗餘單欄 FK，不能改寫已套用 migration。
- `outbox_events.notification_kind` 必須包含收件對象語意。若後續改成 recipient 直接
  進 unique key，需以新 migration、併發測試及通知 replay 測試裁決，不可原地改舊表。

## LINE Login

- production 前在 LINE Console 逐字比對 callback URL，含 scheme、host、path、尾斜線
- LINE callback 若 Supabase 帳號查詢、建立、profile upsert 或 magic-link 產生失敗，應導回
  `line_error=account_provisioning_failed`；Worker log 只保留 operation/status，不讀取或輸出
  Supabase 上游 response body。
- LINE callback 使用的 `service_role` grant 只限 `public.users` 必要欄位；任何權限修正須以
  forward-only migration 記錄，並在 Dashboard 直接套用時同步留下 SQL/read-back 證據。
- 2026-08-10 正常 LINE production E2E 已通過，最終 URL 應為 `/app/` 且 DOM 有「我的報名」
  與「登出」；若出現 `/app/app/`，優先檢查 callback redirect 是否誤帶 app basename
  或大小寫錯誤。
- 現行正式路徑是 Worker 處理 LINE OAuth/OIDC callback，再以 server-only
  service-role bridge 建立 Supabase session。正常流程 PASS 不等於下方 failure matrix 或第二帳號 PASS。
- LINE callback URL 以已部署環境與受控設定記錄為準，不猜測、不把 Console 未讀回的狀態寫成 PASS。
- RLS 身分只信任 `auth.uid()` 與 server-validated claims，不信任可自行編輯的
  `user_metadata`。
- 上線驗收必須包含：正常授權、拒絕授權、無 email、incognito、過期
  state/nonce、兩個獨立 LINE 帳號。

## Email／密碼與登入 email

- 密碼只交給 Supabase Auth；不得寫入 `public.users`、log、DOM 或文件。
- 已登入會員可在 `/app/account/password` 設定密碼；登入頁使用帳號設定頁顯示的 Auth 登入 email，
  不把 LINE 顯示 email 或公開會員資料 email 自動當成登入 email。
- 綁定新登入 email 必須走 Supabase Auth 的確認信流程；確認完成前維持原登入 email。
  前端不可直接寫入 `public.users.email_verified_at`；LINE server-only provisioning 可初始 upsert
  未確認的 email，Supabase Auth email 確認後才由 `sync_verified_email()` 同步驗證狀態。
- 目前沒有獨立的忘記密碼／reset flow；若忘記密碼，仍可用原本的 LINE 或 email 驗證碼登入後重新設定。
- LINE email scope 未提供或與既有 Auth 帳號衝突時，Worker 會使用 synthetic Auth email；
  介面必須顯示該目前登入 email，並明確標示它是 LINE 系統身份、引導使用者先綁定自己的
  email，避免使用者猜測或誤綁定其他帳號。
- 2026-08-15 已套用 `20260815050000_synthetic_line_verified_guard`：歷史 synthetic 身份的
  `public.users.email_verified_at` 已清除，保留 `auth.users`、email、LINE linkage 與其他關聯資料；
  `sync_verified_email()` 對 synthetic LINE email fail-closed，僅 authenticated 可執行。
  不得直接修改 managed `auth.users`；本次 migration 為 forward-only，回滾以後續 corrective
  migration 為準。

## 回滾

- 程式：回滾當次 Gate commit，不覆寫靜態主站或使用者的無關變更。
- DB：不修改已套用 migration；新增 forward-only corrective migration。破壞性回滾必須
  先有 backup／export、目標比對與人工核准。
- LINE：Login channel 在 E2E 前維持 Developing；若 callback 錯誤，先撤下發布並復原
  上一個已驗證 URL，不用 Care WEDO 設定代替。

## 2026-08-05 維運交接要點

- `apps/join` 圖示資產已完成站內上傳鏈路。
  - 來源圖：`favicon_io/android-chrome-512x512.png`
  - 存放：`apps/join/public/favicon_io/android-chrome-512x512.png`
  - `apps/join/index.html` 已掛載 icon link 與 manifest。
- T-01a 圖示回寫完成，OA/Messaging/staging login/production login 皆已完成線上
  read-back；詳見 `line-t01a-settings-record.md`。
- `vite.config.ts` 測試環境維持 `node` + `jsdom` 測試註解，`apps/join/src/security/
  security.test.tsx` 已補環境，確保 `sanitizeUrl`/`SafeExternalLink` suite 穩定。
- P1-03（dev-only auth harness）已完成正式驗收，見
  `apps/join/docs/evidence/p1-03-green.md`；過程中修正 `scripts/smoke-staging.mjs`
  既有 marker 檢查 bug（三檔誤共用同一符號）。
- 正式 Worker 已部署；當前 SSOT 記錄的最新 version 為
  `a5123237-c470-4047-a953-353aad4dc6a9`。真實 Cloudflare Access 接線、獨立 staging 驗收、
  LINE failure matrix 與第二個獨立帳號 E2E 仍待完成。
- Email magic-link 目前由正式 bundle 以
  `redirect_to=https://gather.wedopr.com/app/auth?redirect=…` 發送，保留原活動導向，並在
  session bootstrap 時補建 `public.users` profile；若使用者仍收到舊的 `localhost:3000` 連結，
  先確認信件是否為部署前寄出。Gather Supabase Dashboard 的 URL allowlist 尚未由目前操作員帳號
  read-back，不得宣稱該 Dashboard 設定已驗收。
- 2026-08-15 canonical seat-engine A 已以
  `20260814175513_canonical_seat_engine_hardening_a` 與
  `20260815030000_canonical_seat_engine_roster_dedupe_fix` 套用遠端；8 搶 3、41 搶 40
  真實並發、token/RLS rollback、lifecycle、以及多席／兩池 deadline rollback verifier 均 PASS。
  B 階段 direct UPDATE revoke、Worker／前端正式 read-back 已完成；自訂 OG 圖不再宣告固定尺寸。
  文化主站首頁仍由獨立 Pages 部署；`f02c069` metadata 修正已由 Git integration 發布，
  最新 deployment source `b3c1bf7`，正式首頁三組 description 已 read-back 一致。
- Production `/app/__dev/session` 由 Worker 明確回 404；不要把此 production guard 當成 staging
  Access 驗收，staging route、Access policy、rate limiter binding 與 owner-operated secrets 仍待接線。
- LINE channel secret 與 Supabase service-role key 只存部署環境；文件、前端 bundle 與 log 只能記變數名，不記值。
