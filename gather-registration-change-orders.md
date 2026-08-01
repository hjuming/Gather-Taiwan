# 來聚一場報名系統：修正版修改指令書

適用文件：`gather-registration-mvp-plan.md`｜23 張**修改工單**｜Gate 0 裁決日：2026-08-02

> 本文件是原 MVP 計畫的修正版修改集，不是完整 master backlog。開發前必須先將原計畫、本文與 Gate 0 §4 合併為可施工 backlog；不得再以「依 23 張工單索引施作」取代基礎建設、canonical schema、CI、job 與營運工作。

---

## 0. 不可妥協契約

### 0.1 付款邊界（以資料流方向判定）

| 允許 | 禁止 |
|---|---|
| 主辦人公告自己的收款方式、帳號與付款說明 | 向參加者蒐集付款證明 |
| 活動顯示費用；費用變更通知有效報名者 | 參加者輸入金額、銀行、帳號、末碼、交易編號、截圖或轉帳時間 |
| `payment_declared_at` 一個 nullable timestamp 的自行聲明 | 任何平台判定、驗證或驅動流程的付款狀態 |

- 唯一判準是方向：主辦人揭露自己的資訊可行；平台蒐集參加者的交易資料不可行。
- 不存在「未繳費／已繳費／逾期未付」狀態或保證。`payment_declared_at` 僅供主辦人排序，絕不改變席次、狀態、候補或期限。
- Schema 可驗收：`registrations` 除 `payment_declared_at` 外沒有付款欄位；`event_fields` 建立時封鎖付款證明型欄位名稱；固定文案採 allowlist。
- 自由文字（活動描述、bio、留言、備註）只能 best-effort 偵測、警示並要求確認；不得宣稱零漏網或平台保證不存在付款資料。責任文案須明示勿填交易資訊，並提供檢舉／移除補救。

### 0.2 容量與權限

- 容量不變量不得有 feature flag、緊急 bypass 或直接 DML 例外。
- 權限與資料存取預設拒絕；跨租戶、猜 URL、過期 token 必須 fail-closed。
- 不得建立付款、訂單、退款、商家連線或交易證明資料表。

---

## 1. 定案決策

| 決策 | 定案 |
|---|---|
| D-1 | A：聚場專屬 LINE provider；同一 provider 下建立 Login channel 與 Messaging channel。 |
| D-2 | B：Pilot 使用已驗證 email＋站內通知；OA push 留待 Pilot 後。 |
| D-3 | A：public／unlisted 活動免登入可讀；按報名才登入。密碼活動先取得 view-access cookie；名單 API 一律登入。 |
| D-4 | 頭像／暱稱可供受邀者與參加者看；真實姓名與聯絡方式僅 owner／admin。 |
| D-5 | 蒐集生日作 18+ 聲明篩選；不是身分或年齡驗證。 |
| D-6 | 密碼＋邀請名單雙層。 |
| D-7 | Phase 1 僅 dev JWT 假登入：非 production、不同測試 `sub`、仍走 authenticated RLS；staging 受 Cloudflare Access 或等效保護。Phase 2 前實體刪除所有 dev-auth 程式碼、header、cookie、env、import。 |
| D-8 | 已驗證 email 比對型＋一次性 token 領取型並存。 |
| D-9 | A：席次分池；不做逐人保留、不新增 `reserved` 狀態。 |
| D-10 | A：現在採 `seats`；攜伴於 Pilot 後評估。 |
| D-11 | A：主辦台勾選報到；不做 QR。 |
| D-12 | 留言板取代獨立花絮；僅外部連結，不上傳媒體。 |
| D-13 | A：緊急違法／個資案件 24 小時內，一般檢舉 3 個工作日內；有稽核、申訴與平台最終下架權。無營運人力承諾不得開 T-23。 |

Care WEDO 僅可參考 OAuth、state／nonce 與 auto-login 經驗；不得沿用 channel、secret、callback 或使用者資料。兩系統 `line_user_id` 不互通。

---

## 2. Construction contract 與 canonical schema 差異

1. 最終帳號一律 LINE Login；Phase 1 暫以 dev JWT 取代，不建立 email/password 或 magic-link 身分系統。
2. 主辦人於建立第一場前、參加者於送出第一筆報名前，均完成帳號層 email 驗證；後續各場沿用。電話選填。
3. `users.line_user_id` 在 Phase 1 為**唯一一欄** `text NULL UNIQUE`；Phase 2 回填、清理後才遷移 `NOT NULL UNIQUE`。不可重複定義欄位。
4. `users` 含 `legal_name`、`birth_date`、已驗證 email、帳號暱稱／頭像快照與公開簡介。LINE 原始 profile 只作回復預設用；真實姓名仍由表單／帳號蒐集，永不公開。
5. `registrations` 新增 `user_id`、`seats int not null default 1 check (seats > 0)`、`seat_pool`、`waitlisted_at`、`offer_expires_at`、`transition_version`、`roster_consent boolean not null default false`、`payment_declared_at`、`confirm_deadline_at`、`checked_in_at/by/seats`、顯示身分 snapshot。MVP API 必須拒絕 `seats > 1`；多席僅 DB fixture／內部測試可覆蓋。
6. `events` 新增 `roster_visibility`、`roster_show_capacity`、密碼 hash、`invite_only`、`min_age`、`invite_reserved_seats`、`invite_pool_deadline`、不可逆的 `invite_pool_released_at`。`capacity IS NULL` 時禁止 reserved seats 與 pool deadline。
7. `event_invitees` 需有 type、key、有效／撤銷／領取狀態與時間；token 只存 hash。`event_blocklist` 主鍵為 `(event_id, user_id)`。
8. 新增 `idempotency_requests(actor_user_id, operation, key_hash, event_id, request_fingerprint, result_registration_id, response_status, created_at)`；唯一鍵為 `(actor_user_id, operation, key_hash)`。刪除舊 `uq_reg_idem(event_id,idempotency_key)`。
9. 保留 active registration partial unique：同一 `(event_id,user_id)` 在 `offered/pending_organizer_confirmation/confirmed/waitlisted` 最多一筆；另明訂帳號刪除前必須取消或結束其 active registration，避免匿名化後重報雙重占席。
10. `outbox_events` 以 `(registration_id, transition_version, notification_kind)` 唯一。每個實際轉移／收件人各一筆，不可用單一 event outbox 壓掉多位候補通知。
11. owner 唯一性、status enum、合法狀態轉移、FK、索引與 RLS policy 必須列入 canonical schema，而非隱含於 UI。

### 2.1 席次引擎（T-06／T-18 共用）

- 所有報名、offer 接受／逾時、確認、取消、移除、capacity／reserved／deadline 變更**只能**走同組 DB RPC。
- RPC 第一動作固定鎖 `events`：`SELECT … FOR UPDATE`；鎖內以 DB 時鐘清過期 offer、重算 `SUM(seats)`、驗證資格與不變量、更新資料和 outbox，再同 transaction 提交。
- 期限前同時維持：invite occupied `≤ reserved`、public occupied `≤ capacity-reserved`、total `≤ capacity`。調低 capacity 或調高 reserved 亦須全部驗證。
- 期限後寫入 `invite_pool_released_at` 且不可恢復分池；新報名進公開池、兩候補隊列合併依 `(waitlisted_at,id)` 取用；既有 `seat_pool` 只作稽核，僅驗證 total `≤ capacity`。
- 釋位一律同鎖 event 後遞補。所有 App role 對 capacity 與 registration 狀態的直接寫入權撤銷；deferred trigger 重算並拒絕繞過 RPC 的違規寫入。

---

## 3. 修改工單

### T-01（P0，拆為 T-01a／T-01b）LINE Provider／Channel

#### T-01a（立即）LINE 拓撲與設定紀錄

- 建聚場專屬 provider；先建立 OA、啟用 Messaging API 並指定此 provider，再建立 staging／production Login channel。
- 記錄 provider／channel 歸屬、環境、callback 路徑與責任人，不記錄 secret；逐字核對網域、路徑、大小寫、尾斜線。
- 驗收：兩種 channel 同 provider、環境設定表完整、secret 不進版控。此工單不宣稱可完成登入 E2E。

#### T-01b（Phase 2）LINE 實機驗收

- 實作完成後，staging／production 各以測試帳號登入並換 token；比對同 provider Login／Messaging userId。
- 驗收：Callback 註冊值與部署值逐字一致；未暴露 channel secret；E2E 證據可重跑。

### T-02（P1，Pilot 後 OA）通知通道

- Pilot 以已驗證 email＋站內通知；OA 是 Pilot 後加強通道，不是彌補 email 缺漏。通知依**每位收件人**寫入 `notifications`，記錄 channel、嘗試時間、送達／失敗／未讀狀態及不含敏感內容的 failure reason。
- outbox worker 有 lease、有限重試與 dead-letter；同一 `(registration_id,transition_version,notification_kind)` 不重複建立通知。email 失敗時留下站內未讀及未送達記錄，不把「寄出」誤稱「送達」。
- owner/admin 可看及匯出最小欄位的「未送達名單」；整場取消逐筆送出並顯示已送達／失敗／未送達統計，未送達由主辦自行聯繫。
- **驗收**：重跑任務不產生第二則；100 筆取消演練的每收件人結果與 `notifications` 實際筆數一致；email 故障者出現在未送達名單且站內未讀可見；staff 不可檢視／匯出未送達名單。
- **回退**：Pilot 保持 email＋站內；OA 可獨立停用，不影響既有通知紀錄與 delivery audit。

### T-03（P0，Phase 2）LINE Login

- OAuth/OIDC 授權碼流程在後端換 token；驗 state、nonce；登入由原生點擊啟動。首版全環境標準 OAuth，不做 LIFF。
- state 不符：丟棄原 code，產生全新 state／nonce，不沿用未驗證 `return_to`，僅以 `disable_auto_login=true` 重授權一次；不得另設 email 登入回退。
- 驗收：iOS Safari／Android Chrome／兩種 LINE 內建瀏覽器登入後回原頁；state／redirect_uri 異常安全失敗；前端 bundle 無 secret。

### T-04（P0，Phase 2）email 綁定與帳號復原

- 主辦建立首場前、參加者首筆送出前均驗證 email；復原以已驗證 email 加人工或雙因素確認後轉移帳號，寫稽核。
- 驗收：未驗證 email 不能建立／送出；staging 復原演練有稽核。不得稱 LINE email scope 為唯一來源。

### T-05（P0，Phase 1）參加者交易資料防護

- 建 event field 時硬阻付款證明型欄位名稱；自由文字僅 best-effort 警示確認，並加勿填交易資訊與檢舉／移除流程。
- 驗收：證明型欄位建立與專用交易輸入 API 均被拒；schema 僅有允許的 `payment_declared_at`；不宣稱全庫或自由文字零命中。

### T-06（P0，Phase 1）capacity 調整

- 透過席次引擎檢查 capacity、reserved、release 狀態與期限；有限額時任何調降不得低於適用池已占席，調升於同一 transaction 產生合法候補 offer/outbox。
- `capacity` 數值改 `NULL`（不限）允許，但必須同步拒絕／清除 `invite_reserved_seats` 與 `invite_pool_deadline`；`NULL` 改數值時重新驗證總席次與所有尚適用的池不變量。不得以 UI、API 或設定開關 bypass。
- capacity／reserved 同時變更必以同一 RPC 的最終值驗證，不能先後分別通過；錯誤須回傳目前 total、invite、public occupied，但不得洩漏名單。
- **驗收**：35 confirmed 時 40→30 被拒並顯示占席；40 滿／10 候補時 40→45 恰產生 5 offer、5 outbox；NULL↔有限兩方向分別驗證；調升與新報名併發後三條不變量成立；不存在緊急關閉檢查功能。
- **回退**：只能以符合當前占席的新設定再次變更；容量不變量本身不可回退或停用。

### T-07（P1，Phase 1／2）共同協辦 RBAC

- 角色矩陣：`owner` 唯一，可刪除活動、轉移 owner、管理成員及所有 admin 權限；`admin` 可改活動、確認／拒絕／移除名額、CSV、整場取消與群發；`staff` 僅看白名單名冊、確認／拒絕名額與報到，**不得**改活動、CSV、整場取消、群發、移除／封鎖或讀聯絡方式。
- 非 owner 不得移除、降級或轉移 owner；owner 轉移為雙方確認、單一 transaction、稽核流程。共同協辦 token 高熵、一次性、7 日有效、僅存 hash、可撤銷且接受時綁定登入帳號，不可轉讓。
- 移除協辦者後下一次 API 必須 403（不是 401）；所有名額決定寫操作者、角色、目標、前後狀態與時間。
- **驗收**：staff 的 CSV／活動編輯／整場取消／群發／移除封鎖均 403；非 owner 動 owner 403；撤銷／已用／過期 token 全拒；跨租戶猜 event id 403；既有分頁移除後下一 API 403。
- **回退**：可先只開 owner/admin，staff 延後；不得以回退放寬 owner 唯一或跨租戶權限。

### T-08（P1，Phase 1）語意去重與 request 冪等

- active partial unique 處理同活動同人；idempotency 由獨立請求表處理，不得以 `(event_id,key)` 共用不同使用者結果。
- key 在首次送出時產生；同 key 同 payload 回既有結果，同 key 不同 payload 回 409/422；明確重新報名使用新 key。
- 驗收：同 key 五連點、同使用者兩 key 併發、不同使用者同 key、重送後 offer／outbox 都只產生一次。

### T-09（P1，Phase 1）保存與刪帳

- 帳號資料至刪帳；活動答案於結束 30 日依政策匿名化／刪除；留言另 90 日及法定保全例外。備份刪除到期、audit 保存期須寫入 runbook。
- 有 active registration 的帳號不得直接匿名化；先取消／結束 active registration，維持席次正確性。
- 驗收：刪帳演練不留 LINE ID、答案或資產，且沒有重報雙占席。

### T-10（P1，Phase 1）registration-scoped RLS

- 主辦資料讀取只透過 registration-scoped view/RPC，依 owner/admin/staff 欄位白名單回傳；API 不接受任意 userId 查詢。
- 驗收：主辦 A 無法判斷 B 活動 user 是否存在；staff 看不到 email／電話；直接 table/API 繞行被拒。

### T-11（P2，Phase 1）offer 到期

- 以席次引擎 lazy refresh＋具 lease／重試／dead-letter 的 job 雙軌處理。不要讓可快取活動 GET 無限制寫入；refresh endpoint 必須 no-store 並冪等。
- 驗收：停 job 後下一次 refresh 正確釋位並遞補；job 重跑不重複通知。

### T-12（P1，Phase 1）頭像與暱稱

- 三層不可混用：系統身分 `line_user_id` 不可改且不出 API；帳號 profile 為 `display_name/avatar_asset_id`；報名以 `display_name_snapshot/avatar_asset_id_snapshot` 固定當時顯示。帳號 profile 變更不回溯；「我的報名」可逐場改 snapshot 並稽核。
- 初次 LINE profile 將圖片下載一次，轉存 `media_assets(source=line_import)`，不長期熱鏈 LINE CDN；失敗以首字母色塊 fallback。帳號暱稱限 2–20 字，拒 URL、email、連續空白及平台／主辦混淆保留字。
- 自訂上傳僅 jpeg/png/webp、≤5 MB、≤4096px；按檔案內容驗 MIME，server-side 重編碼及剝除 EXIF/GPS、產固定縮圖、不留原檔。bucket 不可公開列舉，storage key 高熵，僅簽章 URL／後端代理，並有每帳號日 rate limit。
- 主辦台及 CSV 永遠同時顯示真實姓名；owner/admin 可僅在自己活動把該筆 snapshot 退回預設，不可改帳號層。檢舉 asset 達門檻即 `blocked` 並停止提供；帳號刪除刪除實體檔。
- **驗收**：含 GPS EXIF 圖片輸出無 EXIF；猜 key／列 bucket 失敗；偽裝 PNG 執行檔拒絕；改帳號暱稱不改既有名單、逐場可改；跨活動移除不互相影響；刪帳後實體 asset 不存在。
- **回退**：上傳可 feature flag 關閉，退回 LINE 匯入頭像或色塊；既有 snapshot 保持不變。

### T-13（P1，Phase 1）名單與公開簡介

- `event.visibility` 與 `event.roster_visibility` 完全正交。後者 enum 為 `organizer_only`（預設）／`registrants_only`／`event_viewers`；`event_viewers` 是已登入且通過活動 visibility（含密碼 view access）的使用者，匿名訪客永遠不得取得名單。
- 顯示條件是 roster enum 允許**且**該筆 `roster_consent=true`；consent 預設 false，主辦人日後打開名單不得曝光既有報名。公開簡介逐欄 opt-in，僅頭像、暱稱、bio、星座；真名、生日、email、電話永不可公開。
- `roster_show_capacity` 才能顯示「已接受／總席次」與空位佔位；人數仍包含未同意曝光者。主辦人／協辦人顯示可驗證的單位或真名，參加者可用暱稱。
- 名單不 SSR 到公開 HTML，經登入與 policy API、rate limit、noindex 提供；OG 絕不含名單、頭像或精確地點。
- **驗收**：公開活動＋`organizer_only` 時未登入及報名者皆無名單；opt-in 外的人不出現但統計正確；三種 enum 的 API 權限矩陣通過；公開 HTML／OG 無個人名單資料。
- **回退**：可強制所有活動回 `organizer_only`；不得以回退推翻既有 consent。

### T-14（P1，Phase 1）拒絕、移除與封鎖

- `declined` 是主辦人未確認名額；`removed_by_organizer` 是已生效或候補報名被主辦移除。兩者不占席、通知文案不同，且都不得對付款作結論。
- owner/admin 可由 confirmed、pending、offered、waitlisted 移除；同一席次 transaction 釋位、候補遞補與 outbox。可寫單一活動 `event_blocklist`；報名端先查 blocklist，命中拒絕且不透露原因；staff 不可操作。
- **驗收**：滿席移除 confirmed 一人恰遞補一人、一 notification；移除與新報名競爭不超賣；被封鎖者前後端拒絕不洩漏原因；staff 403；declined 與 removed 通知各自使用正確非付款語意。
- **回退**：blocklist 可獨立關閉；移除與既有 audit／狀態機不得關閉。

### T-15（P1，Phase 2）email 取得流程

- LINE email 可預填但仍驗證；無 scope 或使用者拒絕時手動輸入驗證。email 正規化、唯一性、重複帳號處理及退信／重送／退訂列為完整 backlog。
- 驗收：拒絕 scope 仍能完成首次驗證；第二場不重填；staff 無法讀聯絡方式。

### T-16（P1，Phase 1）年齡與星座

- 以活動起始日與活動時區算年齡；2/29 於平年視為 3/1。活動日期變更後重算，原先合格而變不合格者通知主辦裁量，不自動移除。
- 生日／真名不可公開或自行修改；星座由生日即時計算、預設不顯示，文案只稱參加者聲明。
- 驗收：前後端都擋不合資格；公開回應無生日／真名；文案無平台驗證年齡。

### T-17（P1，Phase 1）密碼與邀請資格

- 密碼採 argon2id 或 bcrypt 雜湊，絕不明文或寫 log；建場最低 6 字、拒純連號／重複，UI 說明弱密碼風險。per-IP 與 per-event rate limit、超限鎖定與告警；可信 IP 依 Cloudflare 受信 header 規則取得。
- 密碼錯誤、活動不存在、未發布採固定回應形狀、同 HTTP 狀態與 dummy hash 比對；驗收以統計容差檢查，不要求逐次時間完全相同。短效、event-scoped view-access cookie 僅授權讀內容，非帳號身分且不授權報名。
- 密碼活動 OG 只用通用文案；未設密碼但 invite-only 可顯示標題／時間，兩者均不含名單與精確地點。token 出現在 URL 時立刻清 URL，禁止進 referrer、analytics 與 log。
- invite email 匯入採小寫／去空白正規化，**不得**移 Gmail dot／`+tag`，只允許已驗證 email 比對；token 高熵、hash 儲存、可撤銷／設有效期、一次領取綁帳號不可轉讓。匯入、修改、刪除全寫 audit；名單遮罩，僅 owner/admin 可匯出。
- 不提供查詢是否受邀；非受邀者按鈕顯示僅限受邀且停用，後端同樣拒絕。
- **驗收**：錯密碼／不存在固定形狀且 timing 統計合格；超限有告警；密碼與 log 無明文；cookie 不跨活動；invite-only 前後端拒絕；遮罩名單及匯入 audit 正確；token 不出現在 referrer/log。
- **回退**：密碼可關閉並通知主辦，活動退回未設密碼的 visibility；邀請名單仍保留且不放寬資格。

### T-18（P0，Phase 1）席次分池與遞補

- 依 §2.1 實作唯一席次引擎與三條期限前不變量；`seat_pool`、兩隊候補、release 後併隊不可省略。
- 遞補排序為 `waitlisted_at,id`；取消後重報排隊尾。多席跳號只作內部 fixture 測試，MVP 正常 API 一席。
- 驗收：40 席／保留 10 時邀請 11、公開 31 並發不互侵；到期釋放 4 席恰產生 4 offer／通知；DB 直寫違反不變量被 deferred trigger 拒絕。

### T-19（P0，Phase 1）參加者自行聲明

- 管理頁單一「我已完成付款」按鈕只寫／清除 `payment_declared_at` 並稽核；主辦台標為「參加者聲明已付款」。
- 不可輸入交易資訊；不得影響 confirmation、expiry、capacity、候補或退款畫面。
- 驗收：已聲明但未確認仍會依期限 expired；UI/schema 無其他專用交易資料流程。

### T-20（P1，Phase 1）seats 基礎

- 所有容量與報到統計以 `SUM(seats)`；MVP API 強制 1，`seats=3` 僅 DB fixture 驗證未來跳號演算法。
- 驗收：現行併發測試改用席次總和；公開 API 拒絕大於 1。

### T-21（P2，Pilot 後）現場報到

- owner/admin/staff 可勾選 confirmed 名單報到、取消勾選並寫稽核；check-in RPC 首次勾選時把該 registration 當下 `seats` 複製為 `checked_in_seats`，不是以 SQL column default 引用另一欄。未來部分到場由受權 RPC 設定 0..seats。
- 提供搜尋、A4 列印名單（真名、暱稱、席次）與活動後確認／實到／未到／出席率；staff 可勾選但不可讀聯絡方式。參加者憑證只稱「已確認名額」。
- **驗收**：勾選／取消均有操作者稽核；統計等於 `checked_in_at` 非空的 `checked_in_seats` 總和；staff 無 email／電話；憑證無已付費語意。
- **回退**：可整體關閉報到畫面，不影響報名及既有稽核。

### T-22（P1，Phase 1）期限、群發與變更

- 僅仍占席的 pending 可由 owner/admin 單筆或整場延長 `confirm_deadline_at`，寫稽核並通知；已 expired／已釋位者不可復活，只能依既有流程重新排候補。offer 接受期限與接受後確認期限分欄位、分起算點。
- owner/admin 可群發純文字給：全部有效報名、已確認、待確認、候補四種明確分群；寫 `notifications`、每活動每日上限、不得成為交易資料蒐集流程。活動前一日與當日提醒可由主辦關閉。
- 時間、地點、費用、確認模式變更必通知所有有效報名者，活動頁顯示已更新及時間，變更前後值寫稽核。費用為主辦可公告資訊。
- **驗收**：延長後不在原時刻 expired、已釋位者延長被拒；四個群發分群收件人與實際名單相符；超頻拒絕；地點與費用各一次變更通知筆數一致；候補確認期限以接受時間起算。
- **回退**：群發與提醒可獨立關閉；重大變更通知、期限語意與稽核不可關閉。

### T-23（P2，Pilot 後）聚會留言板

- 僅在 D-13 實際指定窗口與 SLA 後開工。做平鋪貼文、**一層**回覆（`reply_to_post_id` 只能指向頂層）與外部連結；不做多層回覆、編輯歷史、表情反應或平台內圖片／影片上傳。
- `event_posts` 含 author、body（≤2000）、reply、announcement、軟刪除欄位；`post_reports` 對 `(post_id,reporter_user_id)` 去重，含處理狀態／處理者。另有平台管理角色、法定保全例外、XSS sanitization 與 URL scheme allowlist。
- confirmed 可讀寫；waitlisted/pending 完全不可見；退出／移除者失權但既有貼文顯示已退出。API 強制 visibility，私密留言 noindex。外連不抓 OG，加 `nofollow noopener noreferrer` 與離站提示。
- 任何可見者可檢舉；owner/admin 可刪自己活動貼文並稽核；平台可最終下架／停權且不可被主辦覆蓋。作者可軟刪。自由文字依 T-05 僅 best-effort 警示、確認與事後移除，不可硬保證零漏網。
- 通知防風暴：預設僅 @提及者、自己貼文的回覆者；announcement 才全體通知且套 T-22 頻率上限；每人每活動每小時發文上限，使用者可關閉留言通知。保存 90 日，依隱私政策與法定保全分支處理。
- **驗收**：候補直連 403 且不洩漏內容；一層限制生效、媒體上傳不存在；普通留言不全體通知、announcement 筆數等於 confirmed；rate limit 與通知偏好生效；平台下架不可覆蓋；到期刪除與法定保全均有證據。
- **回退**：可關閉留言板並保留既有內容唯讀；不得繞過平台已下架內容。

---

## 4. 工單索引與正確順序

### Gate 0

1. 修正本文與紅線語意。
2. 產出完整 backlog：App scaffold、migration/seed、canonical enum/schema、測試 harness/固定時鐘、CI、outbox worker/job lease/DLQ、email 交付、平台客服、監控/SLO/runbook、CSP/XSS、URL/referrer、防刷可信 IP、時區/DST、owner DB 約束、備份刪除與 accessibility/mobile 驗收。
3. T-01a（只做 Console 拓撲和設定紀錄）。

### Phase 1

App／CI／migration／harness → canonical schema/status → dev JWT＋staging 保護 → T-10 → T-07 RBAC → T-20 → T-08 → T-17 資格模型 → 席次引擎（T-06＋T-18）→ T-11＋T-14 → T-05 → T-12 → T-13 → T-16、T-19 → T-22 → UAT。

### Phase 2

T-01b → T-03 → T-15 → T-04 → T-07 LINE 綁定 → 實體刪除 dev-auth → production build 靜態掃描＋未登入 API 401 E2E → UAT。

### Pilot 後

T-21 → T-23（D-13 已落實才可開始）。

---

## 5. 估時與上線前驗收

- 23 張工單本身沒有逐工時基準，不得宣稱某張被高估或低估。已知 Pilot 前 P0/P1/Phase 2 約 65–95 人日（單一工程師 13–19 週），T-21/T-23 另加 14–22 人日，且不含 App 基礎建設。
- 時程不可讓步時，優先延後 T-12、T-13、T-21、T-23；不得壓縮 RLS、席次引擎、冪等、email 或驗收。
- 上線前至少保留：兩池併發／capacity 調整／候補三方競爭、DB 直寫 trigger、idempotency 五種情境、跨租戶與 staff 403、付款欄位／文案 allowlist、email 寄送與退信、四種 LINE 瀏覽器登入、私密 OG、390px／鍵盤／錯誤狀態、帳號刪除、整場取消通知及 dev-auth 零殘留證據。

## 6. 未驗證事項

- Messaging channel 的實際 Console 流程須在 T-01a 以當日 Console 畫面確認。
- Care WEDO provider 歸屬與程式碼未在本文件驗證。
- 本文件只修正文件契約；若現有實作偏離，需以 canonical schema 和測試結果重新估範圍。
