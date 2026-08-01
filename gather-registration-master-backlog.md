# 來聚一場：報名系統 Master Backlog

狀態：Gate 0。此文件是進入施工前的唯一完整 backlog，優先於
`gather-registration-mvp-plan.md` 的原始 8 工作包與修改指令書的 23 張工單。

> **作廢的指示**：任何「依 23 張工單索引施作」或「23 張工單即為完整
> backlog」的宣稱均已作廢。23 張工單是修改集；原 8 工作包亦不是可直接
> 施工的拆分。本文件保留兩者的需求來源，但以 canonical ID、相依與驗收
> 證據作為唯一施工順序。

## 使用規則與範圍

- 紅線：主辦人可公告費用及自己的收款說明；平台不得設計任何向參加者蒐集
  交易資料的欄位或流程。唯一付款資料為 `payment_declared_at` nullable
  timestamp，且不驅動狀態、容量或候補。
- 身分：Phase 1 只用不同 `sub` 的 dev JWT，所有查詢仍走 authenticated RLS；
  staging 須受 Access 保護。Phase 2 接 LINE 後，實體刪除 dev auth 的程式碼、
  header、cookie、env 與 import。
- D-1=A、D-2=B、D-3=A、D-10=A、D-11=A、D-13=A 已定案。LINE provider 與
  Care WEDO 完全獨立；Login 及 Messaging channel 同一 provider。
- 排程只採下方「單一工程師 critical path」的互斥工作包；canonical 工單列只標
  工時歸屬，不另列可相加的局部估時。Pilot baseline（P1-01…10、P1-13…18、
  P2-01…06）合計維持已呈報的 **65–95 人日**，不含 Gate 0 與外部審核等待。
  P1-11/P1-12 是可選的 Pilot 前增量 **+11–16 人日**。若時程不足，依本文 defer
  cutline 砍範圍，不壓縮驗收。

### 單一工程師 critical path（可加總）

| 工作包 | 互斥涵蓋範圍 | 人日 |
|---|---|---:|
| S1 基礎與 dev 安全 | P1-01、P1-03 | 6–8 |
| S2 資料、RLS 與 RBAC | P1-02、P1-04、P1-05 | 8–12 |
| S3 報名與席次引擎 | P1-06、P1-07、P1-08 | 11–17 |
| S4 活動產品與法遵輸入 | P1-09、P1-10、P1-13 | 7–10 |
| S5 通知、隱私與營運 | P1-14、P1-15、P1-16、P1-17 | 11–16 |
| S6 整合驗收 | P1-18；只計跨功能整合，不重算 S1–S5 的工單內測試 | 5–7 |
| S7 LINE 上線 | P2-01…P2-06；重用 S1–S5 的 auth、通知與安全基礎 | 17–25 |
| **Pilot baseline 合計** | **P1 必做 + Phase 2** | **65–95** |

P1-11 頭像為 +7–10 人日，P1-12 公開名單為 +4–6 人日；若兩者都選擇在
Pilot 前交付，增量為 +11–16 人日。每項工單內的單元／契約測試歸該工作包，
P1-18 只估跨模組 E2E、裝置、a11y 與 UAT，避免測試被重複計價。

## 決策矩陣（D-1～D-13）

| 決策 | 定案 | canonical 落點 |
|---|---|---|
| D-1 | A；獨立 provider、同 provider Login/Messaging | G0-03、P2-01、P3-03 |
| D-2 | B；已驗證 email + 站內通知，OA Pilot 後 | P1-14、P3-03 |
| D-3 | A；public/unlisted 免登入可讀，報名才登入 | P1-07、P1-10、P2-02 |
| D-4 | 頭像/暱稱可供參加者看；真實資料僅 owner/admin | P1-11、P1-12、P1-04 |
| D-5 | 蒐集生日，僅為 18+ 聲明；星座推導 | P1-13 |
| D-6 | 密碼 view access + 邀請資格雙層 | P1-07 |
| D-7 | dev JWT only；Phase 2 物理刪除 | P1-03、P2-05 |
| D-8 | verified-email match + one-time token invite | P1-07 |
| D-9 | invite/public 席次分池，deadline 後合併 | P1-08 |
| D-10 | seats 現在建模；攜伴 Pilot 後 | P1-06、P3-04 |
| D-11 | 主辦名單勾選報到，不做 QR | P3-01 |
| D-12 | 留言板取代花絮；僅外連結 | P3-02 |
| D-13 | 平台窗口；緊急 24h、一般 3 工作日 | P1-17、P3-02 |

## Canonical 架構契約

1. 唯一席次引擎：所有 registration、offer、confirm、cancel、remove、expire、
   capacity/reserved/deadline 編輯只能走同一 DB RPC。第一步鎖 event row，鎖內
   清過期 offer、重算 `SUM(seats)`、驗證資格與不變量，寫 registration/event/
   outbox 後同 transaction 提交；App role 不可直接改 capacity 或 status，
   deferred trigger 為最後防線。
2. 分池：期限前維持 invite ≤ reserved、public ≤ capacity-reserved、total ≤
   capacity。deadline 後寫入不可逆的 `invite_pool_released_at`，新報名進 public，
   兩候補列按 `(waitlisted_at, id)` 合併；歷史 `seat_pool` 僅供稽核。
3. 冪等：使用 `idempotency_requests(actor_user_id, operation, key_hash)`，另存
   request fingerprint、event、result 與 response。相同 key/相同 payload 回放；
   相同 key/不同 payload 409/422；outbox 唯一鍵為 registration + transition
   version + notification kind。
4. canonical schema 必含：完整 event/registration status enum、`seats`、
   `seat_pool`、`waitlisted_at`、`offer_expires_at`、`invite_pool_released_at`、
   invitee 有效/撤銷/領取狀態、outbox transition id、owner 唯一約束與
   `line_user_id NULL UNIQUE`（Phase 2 回填後才 NOT NULL）。

## Gate 0（現在；不得進入 Phase 1 程式）

| ID | 範圍與來源 | 相依 | 驗收證據 | 估時 |
|---|---|---|---|---:|
| G0-01 | 裁決同步：將付款方向性、best-effort 自由文字、D-1/2/3/10/11/13、T-03/T-06/T-08/T-10/T-13/T-17/T-20/T-22/T-23 的裁決寫入施工契約。來源：原 Task 1、T-05/06/08/10/13/17–23。 | — | 文件 read-back：無舊的 payment 零漏網、LIFF、RLS 直讀 users 或 capacity bypass。 | 1–2 |
| G0-02 | 建立本 Master Backlog，對照原 8 工作包與 T-01…T-23，補齊 Gate 0 缺漏。 | G0-01 | 本檔來源矩陣與 `rg` 覆蓋檢查。 | 1–2 |
| G0-03 / T-01a | LINE Console 拓撲：聚場獨立 provider；先 OA、啟用 Messaging API、指定 provider；建立 staging/prod Login channel，記錄 callback／資料使用揭露的目前狀態、定案責任，以及 secret 拓撲（不寫 secret）。 | G0-01 | Console read-back/設定紀錄；兩 Login/Messaging 同 provider；env 僅列變數名與 SET/UNSET；未部署項目須明列阻擋與責任角色。 | 1–2 + 審核等待 |

## Phase 1（功能、RLS、dev JWT；禁止真實登入）

| ID | 範圍與來源 | 相依 | 驗收證據 | 工時歸屬 |
|---|---|---|---|---:|
| P1-01 | 獨立 `join.gather.wedopr.com` App scaffold、staging/prod、migration framework、seed、固定 clock、可重跑 concurrency harness、CI；安裝並設定通用 XSS sanitizer、URL scheme allowlist、安全 external-link renderer。來源：原 Task 2、4.1 缺漏。 | G0-* | 兩環境獨立 deploy/rollback；migration seed；CI 跑 type/lint/test；固定時鐘競態重跑；惡意 HTML/`javascript:`/非 allowlist scheme 皆不能執行或渲染成可點連結。 | S1 |
| P1-02 | canonical schema、status enum、owner DB unique/transfer transaction、活動時區/DST、開始後報名/編輯規則與 migration tests。來源：原 Task 3–5、T-20、4.1 缺漏。 | P1-01 | schema contract test；2/29、DST、活動日期變更、owner 唯一性案例。 | S2 |
| P1-03 | dev JWT identity harness、Cloudflare Access 等效 staging 保護、可信 client-IP/rate-limit 規則、CSP/security headers。來源：D-7、4.1 缺漏。 | P1-01 | 多 `sub` 仍受 RLS；production build 無 dev auth；spoofed IP 不影響 limit。 | S1 |
| P1-04 / T-10 | default-deny RLS、registration-scoped view/RPC、欄位白名單、API 不接受任意 userId。 | P1-02,P1-03 | 跨租戶、猜 URL、列舉與 staff PII 皆 403/空結果；DB 直寫受拒。 | S2 |
| P1-05 / T-07 | owner/admin/staff RBAC、協辦邀請 token、撤銷、owner transfer、audit log。 | P1-04 | staff 敏感 API 403；撤銷後下次 API 403；唯一 owner 與轉移稽核。 | S2 |
| P1-06 / T-20,T-08 | seats=1 MVP 合約、active registration unique、獨立 idempotency request/replay 規則、deadlock/serialization retry。 | P1-02,P1-04 | 五連按、同 key 異 payload、兩 key/兩 user 併發、DB fixture seats=3；公開 API 拒 seats>1。 | S3 |
| P1-07 / T-17 | event visibility/password view cookie、雙邀請制、email normalization、URL token 的 referrer/log 防漏與即時清 URL。 | P1-04,P1-06 | password dummy-hash 統計容差；cookie 只能讀該活動；token 撤銷/領取/匯入稽核；非受邀 API 拒絕。 | S3 |
| P1-08 / T-06,T-18,T-11,T-14 | 單一席次引擎、兩池→合併、capacity/reserved/deadline 編輯、lazy+job expiry、`declined` 與 `removed_by_organizer` 語意分離、remove/blocklist 與完整 audit。 | P1-02,P1-06,P1-07 | 41 搶 40、兩池、deadline 合併、三方競爭、調降拒絕、每收件人一個 outbox、無超賣；staff remove/block 403；移除後同池遞補，封鎖不洩漏原因。 | S3 |
| P1-09 / T-05,T-19 | 主辦收款說明與費用顯示；禁止參加者專用付款欄位/流程；`payment_declared_at` 唯一 SSOT；自由文字 best-effort 警示/確認、責任文案與檢舉入口。 | P1-02 | schema/UI/API scan；欄位名稱封鎖；聲明不影響 expiry/seat；文案 allowlist。 | S4 |
| P1-10 | 建場精靈、公開/unlisted/private 活動頁、表單、confirm mode、取消流程與 LINE 分享/安全 OG；所有共用自由文字以 P1-01 sanitizer/rendering contract 輸出。來源：原 Task 4、6、7。 | P1-04,P1-08,P1-09 | EiMBA 40 席於 3 分鐘建立；私密 OG 無敏感資料；活動說明/收款說明的惡意 HTML/外部 URL 安全呈現；整場取消鎖新報名並逐筆 outbox。 | S4 |
| P1-11 / T-12（可延後） | profile 三層身分、頭像 upload/re-encode/EXIF 清除、private storage、asset moderation/report，snapshot 與刪帳實體刪除；停用時一律色塊 fallback。 | P1-04,P1-10 | EXIF=空、偽圖拒絕、不可列 bucket、跨活動快照隔離；功能 flag 關閉時無 upload endpoint/UI，仍可報名。 | Optional +7–10 |
| P1-12 / T-13（可延後） | roster consent default false、profile field opt-in、登入 roster API、匿名不取名單、SSR/OG anti-scrape；未交付時固定 `organizer_only`。 | P1-04,P1-10 | consent 前後、主辦人日後開 roster 不自動曝光舊報名、status/HTML/API/OG 與 PII 負面 E2E；功能未交付時 roster API 不存在。 | Optional +4–6 |
| P1-13 / T-16 | legal name/birth-date/18+ 聲明、星座推導、申訴稽核、活動日期變更重算與主辦裁量。 | P1-02,P1-04 | API/UI 年齡雙拒、2/29 規則、公開回應零 legal/birth 欄位、文案掃描。 | S4 |
| P1-14 | **Phase 1 email 邊界**：以 dev-JWT 帳號人工輸入並驗證 email；寄件網域 SPF/DKIM/DMARC、provider、退信/重送/退訂、站內通知、outbox worker、lease/retry/DLQ。LINE email scope 不是本項前提。來源：原 Task 7、T-02（D-2=B 基礎）、T-15。 | P1-01,P1-04 | 手動 email 驗證；重跑不重送；退信/DLQ/站內未讀可見；整場取消收件數與 notification 相符。 | S5 |
| P1-15 / T-22 | pending 才可延期限、offer/confirm 兩期限、群發 rate-limit、重大變更 diff/通知、前日/當日提醒；收件群組與狀態白名單明確化。 | P1-08,P1-14 | expired 不可復活；變更通知對帳；群發上限；accept 後重新起算；每一群組僅送允許狀態，費用變更通知保留。 | S5 |
| P1-16 / T-09 | 保存/匿名化、active registration 的帳號刪除規則、audit PII/保存期、backup 中刪除真正到期日、隱私政策/DSAR；頭像/roster 功能未啟用時走無 asset、無公開 roster 路徑。 | P1-02,P1-14 | 刪帳不留 identity；統計保留；owner/active 拒絕；備份與匿名化演練；無頭像/無公開名單 baseline 同樣通過。 | S5 |
| P1-17 | 平台 admin/客服/申訴後台、監控 SLO、容量/worker 告警、incident runbook、備份 RPO15/RTO4 演練。來源：原 Task 7、4.1 缺漏。 | P1-08,P1-14,P1-16 | alert test、dead-letter re-drive、RPO/RTO restore、客服 audit trail。 | S5 |
| P1-18 | 390px、鍵盤、a11y、錯誤狀態、手機 60 秒登記、併發/隱私/取消/UAT 與 Pilot gate。來源：原 Task 8。 | P1-03…P1-10,P1-13…P1-17；P1-11/12 僅在選擇交付時加入 | **baseline**（色塊、`organizer_only`）與**enhanced**（頭像/roster）各自列條件驗收；E2E 錄影、a11y report、負面安全測試、Pilot checklist 全過。 | S6 |

## Phase 2（LINE 上線；Phase 1 代碼不得殘留）

| ID | 範圍與來源 | 相依 | 驗收證據 | 工時歸屬 |
|---|---|---|---|---:|
| P2-01 / T-01b | 實機確認 staging/prod Login token，並比對同 provider Messaging userId。 | G0-03,P1-18 | 兩環境測試帳號結果與 console callback 逐字比對紀錄。 | S7 |
| P2-02 / T-03 | OAuth/OIDC、state/nonce、native click、一次 disable-auto-login retry、signed return_to、草稿復原；不做 LIFF。 | P2-01,P1-18 | iOS/Android Safari/Chrome/LINE browser 4 環境 E2E；state tamper 丟棄 code/return_to。 | S7 |
| P2-03 / T-15,T-04 | **Phase 2 email 邊界**：保留 P1 已驗證 email；LINE `email` scope 僅可預填、不得取代 platform verification；首次建立/首次報名前補驗證、帳號復原與 LINE userId 轉移人工/雙因素流程。 | P2-02,P1-14 | email scope 缺失仍完成；第二場不重填；scope email 與手動 email 都須 platform verified；staging recovery audit。 | S7 |
| P2-04 / T-07 | 協辦邀請綁 LINE 身分；Phase 2 schema `line_user_id NOT NULL` migration。 | P2-02,P2-03 | token 僅綁當次登入 user；migration/read-back；跨租戶仍拒絕。 | S7 |
| P2-05 | 物理刪 dev-auth：程式、header、cookie、env、import；未登入 API 401 與 production static scan。 | P2-04 | `rg` 零命中 allowlist；production E2E 未登入拒絕；無 service-role bypass。 | S7 |
| P2-06 | Phase 2 release UAT、production/staging secret 分離、CSP/回退「停新登入/禁止發布」演練。 | P2-01…P2-05 | rollout/recovery evidence、完整 LINE E2E、security scan。 | S7 |

## Pilot 後（明確不阻擋 Pilot）

| ID | 範圍與來源 | 相依 | 驗收證據 | 估時 |
|---|---|---|---|---:|
| P3-01 / T-21 | 勾選報到、`checked_in_seats`、出席統計、A4 名單、staff PII 邊界。 | P2-06 | 稽核、部分到場統計、列印與 staff 負面測試。 | 4–6 |
| P3-02 / T-23 | 留言板、@mention、report 去重、平台角色、法定保全例外；重用 P1-01/P1-10 的 sanitizer/link renderer，不另造安全基礎。自由文字付款偵測為 best-effort 警示/確認與檢舉移除，不宣稱零漏網。D-13 SLA 24h/3工作日與人力落實才可開工。 | P3-01,P1-01,P1-09,P1-10,P1-14,P1-17 | XSS/連結/權限/保存刪除/E2E；普通留言不群發、公告才群發；平台下架不可被主辦覆蓋；SLA on-call 記錄。 | 10–16 |
| P3-03 / T-02 | OA push adapter（非 Pilot 通知依賴），link consent、delivery result 與費用/opt-out 檢視。 | P2-01,P1-14 | 同 userId、outbox 只送一次、email fallback、不重複通知。 | 4–7 |
| P3-04 | 攜伴：seats>1 公開 API、companion PII/年齡聲明、跳號與部分到場 UX。來源：Deferred。 | P3-01 | 1–N seats 不變量、候補跳號、名單隱私。 | 6–10 |

## 來源矩陣與 defer cutline

| 舊來源 | 已被 canonical backlog 覆蓋 |
|---|---|
| 原 Task 1 | G0-01、P1-09、P1-13、P1-16、P3-02 |
| 原 Task 2 | P1-01 |
| 原 Task 3 | P1-02…P1-05、P2-01…P2-05 |
| 原 Task 4 | P1-07…P1-10、P1-13、P1-15 |
| 原 Task 5 | P1-06、P1-08、P1-15 |
| 原 Task 6 | P1-09…P1-12、P1-14 |
| 原 Task 7 | P1-10、P1-14…P1-17、P3-03 |
| 原 Task 8 | P1-18、P2-06 |
| T-01 | G0-03（設定）→ P2-01（真實 E2E） |
| T-02 | P1-14（D-2=B 的 email/站內基礎）→ P3-03（OA adapter） |
| T-03 | P2-02 |
| T-04 | P2-03 |
| T-05 | P1-09 |
| T-06 | P1-08 |
| T-07 | P1-05 → P2-04 |
| T-08 | P1-06 |
| T-09 | P1-16 |
| T-10 | P1-04 |
| T-11 | P1-08 |
| T-12 | P1-11 |
| T-13 | P1-12 |
| T-14 | P1-08 |
| T-15 | P1-14 → P2-03 |
| T-16 | P1-13 |
| T-17 | P1-07 |
| T-18 | P1-08 |
| T-19 | P1-09 |
| T-20 | P1-06 |
| T-21 | P3-01 |
| T-22 | P1-15 |
| T-23 | P3-02 |

Pilot 前不得切除：G0-*、P1-01…10、P1-13…18、P2-01…06。若必須縮範圍，依序延後 P1-11（自訂上傳頭像，保留色塊）、P1-12（公開名單，固定 organizer_only）、再延後 P3-*；每次 cut 必須更新此表與 UAT，不得以跳過 RLS、席次引擎、email/outbox、刪帳、告警或驗收取代。

## Done when

- [ ] Gate 0 三項全部有可讀證據；未經 G0-03 不啟動真實 LINE flow。
- [ ] Pilot gate 的每項 canonical acceptance evidence 已存放並由 fresh reviewer read-back。
- [ ] Phase 2 上線前 P2-05 靜態掃描與未登入 E2E 均通過。
- [ ] 任何後續工單引用本文 canonical ID；不以原 Task 或 T 編號單獨宣稱完成。
