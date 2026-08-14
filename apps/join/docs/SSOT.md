# 來聚一場：產品與技術 SSOT

最後更新：2026-08-15

## 產品目標

來聚一場是免費的聚會報名工具；聚場台灣同時是台灣聚會文化品牌網站，未來可
引入餐廳與聚會場所合作。使用者可用 LINE、email 驗證碼，或已設定密碼的登入 email 登入；完成會員登入後可以建立公開或
非公開活動、分享專用網址，並讓參加者確認報名。首個可驗收情境為「免費、公開、
不限名額」活動。

## 不可讓步邊界

- 系統不蒐集參加者付款證明、金額、末碼、交易編號或截圖，不判定付款狀態。
- 可顯示主辦人自行收款說明與活動費用，但平台不介入對帳。
- 文案不得宣稱「已付費」、「已驗證年齡」或「平台確認」。
- 容量不變量在報名、取消、候補晉升、capacity 調降與兩池分配都必須成立。
- RLS 與所有權限預設拒絕；跨租戶、猜 URL、過期 token 都 fail-closed。

## 已定案產品決策

- LINE provider：專屬「聚場台灣 Gather Taiwan」，不與 Care WEDO 共用。
- LINE Login：首版全走標準 OAuth，不做 LIFF 分支。
- Phase 1 dev auth：只允許 non-production 的不同 `sub` dev JWT，仍走
  `authenticated` role 與 RLS；Phase 2 上線前刪除程式碼。
- 邀請席次：一般池／邀請池分池，池內先報先得，不新增 `reserved` 狀態。
- Pilot 通知：email 加站內通知。
- 活動頁：公開活動免登入可讀；報名前才要求會員登入。登入方式可為 LINE、email 驗證碼，
  或已設定密碼的登入 email。
- 報名資格：參加者必須先註冊／登入會員，未登入者只能閱讀公開活動與進入登入引導。
- 帳號登入密碼：已完成 LINE 或 email 驗證的會員，可在 `/app/account/password` 設定密碼；
  帳號設定頁會顯示目前真正的 Auth 登入 email，並以 Supabase Auth confirmation flow 綁定新的
  登入 email。確認完成前維持原登入 email；`public.users.email` 只由
  `sync_verified_email()` 同步，不接受前端直接寫入。
- 公開揭露白名單：主辦人自訂顯示名稱、aggregate 報名人數、時間、地點與費用；公開頁
  不顯示參加者姓名。是否在報名後對參加者顯示姓名或只顯示人數，由主辦人設定，預設
  仍為 organizer-only。
- 非金流型對帳：規劃為主辦人專用的活動協作工具；平台不代收款、不介入實際收款、
  不對主辦人承諾代為對帳。任何付款欄位、確認狀態或保存週期的新增，必須另立 SSOT
  與 migration gate；本輪不變更資料表。Gather Taiwan 未來自辦活動的金流與真實對帳，
  另以不對外開放的 private workflow 評估。

## Phase 2 LINE 現行技術路徑與驗收邊界

- 正式網域現行由 Worker 處理 LINE OAuth/OIDC `state`/`nonce`、callback 與帳號
  provisioning，再以 server-only service-role bridge 建立 Supabase session；前端 bundle 不持有
  LINE channel secret 或 Supabase service-role key。
- 2026-08-10 正常授權的 production E2E 已 PASS，最終返回 `/app/` 並建立會話。
  這不代表完整 LINE 驗收；拒絕授權、無 email、incognito、過期 `state`/`nonce`
  與第二個獨立 LINE 帳號仍未完成。不得把單一帳號正常流程 PASS 放大為
  LINE Console、雙帳號或完整 failure matrix PASS。

## 環境與外部資源

| 資源 | 當前值 | 狀態 |
| --- | --- | --- |
| GitHub | `hjuming/Gather-Taiwan` | `codex/gather-mvp` 開發分支已推送 |
| 文化主站 | `https://gather.wedopr.com/` | 獨立靜態站，不可被 app build 覆寫 |
| 報名 App | `https://gather.wedopr.com/app/*`（Workers Route，2026-08-06 起改為同網域路徑，前為獨立子網域） | 現行 Worker version `3c47c470-2844-423e-ab92-022ef427ae46`；正式 `/app` 已載入 `index-CTlbf1Vx.js`，私密活動頁已 read-back 完整 OG metadata 與 `noindex` |
| Supabase org | `gather Taiwan` / `qqcraliqerxjcuyztkkf` | Free |
| Supabase project | `gather-taiwan` / `anklbpkyesdmsubyfcna` | Healthy, Tokyo |
| Supabase URL | `https://anklbpkyesdmsubyfcna.supabase.co` | 公開 project URL，非 secret |
| LINE OA | `@223fvgzc` | 專屬 provider |
| Messaging channel | `2010930919` | 已建立，Pilot 不作通知管道 |
| Staging Login | `2010930923` | Developing |
| Production Login | `2010930927` | Developing |

## 現行完成度

- P1-01-A：前端／Worker foundation 與 rich-text、external-link 安全契約完成。
- P1-01-B：Gather 雲端 migration ledger、probe RLS、全 table privilege 撤銷、
  PII-free seed、雙連線 serializable retry 已通過；Supabase Advisors 尚未讀回，
  狀態為 `PASS_WITH_DECLARED_FOLLOW_UP`，不是部署 readiness PASS。
- P1-02：canonical domain schema、完整活動／報名狀態 enum、owner 每 organizer
  恰一位與交易式轉移、合法 registration transition、開始後 INSERT 拒絕、membership
  identity 不可變、跨活動 composite FK、時區／DST、active registration／冪等／outbox
  unique seam 及交易資料邊界已在 Gather 雲端通過 read-back。後續 P1-04／Wave 03 僅以
  最小 RLS policy 與 SECURITY DEFINER RPC 開放既定流程；App role 仍無 direct domain-table DML。
- 站內表示資產：`apps/join/public/favicon_io/*` 與 `apps/join/public/site.webmanifest`
  已更新，與 LINE T-01a 圖示 read-back 一致。
- P1-03：dev JWT identity harness、Cloudflare Access 驗證、可信 rate-limit key、
  CSP/security headers 已完成正式驗收（`docs/evidence/p1-03-green.md`）；尚未
  接線真實 Cloudflare Access，未部署至任何環境。
- Wave 02：活動分享文字與 Worker OG metadata 共用時間、地點、費用、人數等活動
  事實，並以精準 Vitest 覆蓋 private `noindex` 與 OG image；Worker version
  `9c827648-c5e3-408e-b94e-eaa99007a2f7` 已部署，正式私密活動頁的
  `og:title`／`og:description`／`og:image`、`X-Robots-Tag: noindex, nofollow` 均已 read-back；
  MING 已完成未登入／非主辦人不顯示編輯控制項與實體 iPad 驗收。
- Wave 03 DB：`20260813110623_private_invitee_tokens` 已於 Gather 雲端套用。已發布私密
  invite-only 活動的 8 筆 legacy guest key hash 已作廢並留下 audit；回覆 RPC 改為僅接受
  個人 token 的三參數簽名，新增／移除／發 token 僅限 authenticated，匿名只可讀名單與持
  token 回覆。遠端 rollback fixture 已通過 token、ACL、容量、名單去重與無殘留驗證；Security
  Advisor 無 issue。Wave 03 Worker 已於 2026-08-14 部署（version
  `7992bf30-61d2-4450-b040-f04b9321a0a0`）；匿名正式私密頁 read-back 顯示名單與
  出席狀態為唯讀，並提示使用個人邀請連結回覆。主辦人可登入新版 UI 逐一重發個人連結。
- Wave 03 runtime E2E（2026-08-14）：主辦人登入後以「再次聚會」建立隔離測試活動，新增合成受邀者
  `Wave03測試A`；隔離瀏覽器以個人邀請連結僅顯示該受邀者可操作的狀態按鈕，回覆後出席人數由
  `6 / 8` 更新為 `7 / 8`，重新整理後狀態仍維持，主辦人頁同步 read-back 為 `7 / 8`。未暴露個人 token。
- Responsive follow-up（2026-08-14）：主辦人編輯頁在 iPad portrait 級距 `772 × 1072` 的開始／結束時間欄
  已改為單欄，四個時間選單可完整顯示；`390 × 844` 與 `1440 × 900` 亦完成無水平溢位 read-back。
  CSS 修正已隨 Worker version `7992bf30-61d2-4450-b040-f04b9321a0a0` 部署；正式活動頁 HTTP 200
  並載入 `index-BAV4Y7B6.css`，其 SHA-256 與本機 build 相同。
- Canonical hardening deploy（2026-08-15）：B migration 已完成 direct UPDATE revoke，Worker／前端
  已部署 version `e0fcc0c2-c834-480b-b9d3-424783e20b19`；正式 GET read-back 為 HTTP 200，
  私密活動 `X-Robots-Tag: noindex, nofollow`，OG description 含時間、地點、地址、費用與人數，
  自訂 OG 圖不再宣告未量測的固定尺寸，並載入 `index-1ihljKQ3.js`。匿名瀏覽器 read-back 無編輯／
  名單管理／狀態操作控制項；已登入主辦人可看到 capacity 儲存控制與名單新增／修改／移除控制項，
  本輪未儲存正式資料。
- Production `/app/__dev/session` 已由 Worker 明確 fail-closed 為 JSON 404，避免誤落入 Assets
  runtime；正式 POST read-back 為 HTTP 404、`Cache-Control: no-store`。
- Email magic-link profile bootstrap（2026-08-15）：`935de99` 讓 magic-link session 自動補建
  `public.users` profile，並保存送出 email 時的顯示名稱；Worker version
  `3c47c470-2844-423e-ab92-022ef427ae46` 已部署。正式 bundle 的 OTP request 已 read-back
  `redirect_to=https://gather.wedopr.com/app/`；本輪 B 身分 `gather@wedopr.com` 已成功建立 session，
  在 Wave 04 報名後「我的報名」顯示「已確認參加」。舊信件曾落到 `localhost:3000`，以正式 `/app/`
  重導後完成驗證；Gather Supabase Dashboard URL allowlist 未由目前操作員帳號讀回，仍列為 follow-up。
- Wave 04 隔離測試（2026-08-15）：活動 `event-20260815-wave-04-5mbn` 容量由 20 儲存為 8；
  主辦人建立後 reload 為 `0 / 8`，B email 身分報名後個人頁顯示 1 筆已確認報名。B 直接開啟
  `/edit` 顯示只有活動主人可編輯；未登入頁無編輯／名單管理／狀態控制項。未刪除測試活動。
- 文化主站首頁由獨立 Cloudflare Pages 提供；`f02c069` 的 metadata 修正已經由 Git integration
  部署，最新 Pages deployment source `b3c1bf7`，正式首頁三組 description 已 read-back 完全一致。
- Worker unit contract 已覆蓋 LINE 拒絕授權、state／nonce mismatch、無 email fallback 與
  cookie TTL／缺失後 fail-closed；未完成的是正式環境的同一 failure matrix（含 incognito）與
  第二個獨立 LINE 帳號 E2E。
  正式 callback 已做無憑證的 `access_denied` 與 synthetic state 負向 HTTP read-back，分別回到
  `line_error=line_declined` 與 `line_error=state_mismatch`；不等同完整登入失敗矩陣 PASS。
- P1-06/P1-08 canonical hardening A（2026-08-15）已套用兩支 forward-only migration：
  `20260814175513_canonical_seat_engine_hardening_a` 與
  `20260815030000_canonical_seat_engine_roster_dedupe_fix`。容量使用 `SUM(seats)`，
  attending 邀請者計入容量；strict FIFO、pool release-before-promote、capacity settings
  idempotency 與 organizer RPC ACL 已由遠端 read-back 證明。Node 22 真實遠端 concurrency
  `8 搶 3` 得到 `confirmed=3 / waitlisted=5`，`41 搶 40` 得到
  `confirmed=40 / waitlisted=1`，兩次均無 oversell 且隨機 synthetic fixture cleanup 完成。
  `41 搶 40` 是最多 10 條 DB connection 的 request burst，不代表 41 條獨立連線。
  private roster corrective migration 保留 active target 名稱去重，但容量只對 attending target 去重，
  rollback guest verifier、lifecycle verifier、RLS／ACL 負向 read-back 均 PASS。
  多席 strict-FIFO／兩池 deadline merge／capacity RPC 冪等的真實 rollback fixture 已 PASS；
  B 階段已撤銷 `authenticated` 對 `events.capacity`／邀請池欄位的 direct UPDATE，並完成
  capacity RPC ACL、負向權限與 Worker／前端正式路徑 read-back。P1-06/P1-08 仍以核心席次／
  併發證據作 conditional closure，不把未完成的完整 failure matrix 放大為已完成。
  P1-04 domain policy 已完成雲端 9/9 驗證，不得再列為未完成。Wave 03 前端 Worker 部署與
  匿名／主辦人 token 流程已完成；主辦、邀請名單與報名
  UI 已可在正式 `/app/` 唯讀看到。

## P1-02 資料模型裁決

- 時間一律存 `timestamptz` 絕對時間，另存有效 IANA `timezone` 供顯示；DB fixture
  覆蓋 2/29 與 America/New_York DST 邊界。
- 新報名最晚於 `starts_at` 關閉。活動開始後仍可修正文案，但時間、時區、容量、
  confirmation mode、年齡與邀請池等安全關鍵設定不可修改。
- initial registration 只允許依 confirmation mode 建立 `confirmed`／
  `pending_organizer_confirmation` 或 `waitlisted`；後續僅能依明確矩陣轉移，
  `offer_expired/expired/declined/cancelled/removed_by_organizer` 不可復活。
- registration answer、idempotency result、notification、outbox 與 audit 只要同時帶
  registration/event，就由 composite FK 保證屬於同一活動；membership 的 organizer/user
  identity 不可用 UPDATE 搬移。
- 免費費用的 canonical 值為 `fee_amount = 0`；可顯示主辦收款說明，但參加者資料只
  允許 `payment_declared_at`，不得新增付款證明或平台判定欄位。
- `outbox_events` 沿用裁決的三欄 unique；需要不同收件人的同一轉移時，
  `notification_kind` 必須包含明確收件對象語意，避免以相同 kind 壓掉通知。
- check-in 欄位依 Master Backlog 優先序延至 P3-01；頭像 asset 欄位延至選配 P1-11，
  本 Gate 不為未啟用功能提前蒐集資料。
- 正式資料庫不建立 synthetic owner 或預設活動。免費／公開／不限額活動只先作
  transaction rollback fixture；待 P1-03 的受支援 dev identity 或真實 LINE owner
  存在後，才建立可操作的預設活動。
- P1-02 owner transfer 只證明單一交易、唯一 owner 與 audit seam；T-07 要求的雙方確認、
  token 與 owner/admin/staff 完整 RBAC workflow 仍屬 P1-05，尚未完成。

## 真實來源優先序

1. `gather-registration-master-backlog.md`（完整 backlog 與裁決整併的 canonical 來源）
2. `gather-registration-change-orders.md`
3. `gate0-validation-report.md`
4. 本 SSOT 的已實作環境與狀態記錄
5. `implementation-control-log.md` 的執行證據

若文件與 live read-back 衝突，不得修改驗收來迁就現狀；先停止寫入、記錄差異並修正實作或
更新裁決。
