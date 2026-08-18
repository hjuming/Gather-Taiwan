# Gather Taiwan Platform v1.0 Implementation Draft Gate 控制日誌

更新時間：2026-08-02

## 0. 語言與讀者設定

- 語言：繁體中文。
- 讀者：Gather Taiwan / 聚場台灣專案決策者、WEDO 團隊、後續接手工程與內容協作者。
- 本文件用途：記錄本輪 Implementation Draft Gate 的需求、AI 決策、觸及檔案、驗證結果與回滾方式。

## 1. 任務目標

- 將 `/`、`/moonlight-bbq`、`/neo-rechao` 整理為同一個 `聚場台灣 / Gather Taiwan` Culture Platform 產品。
- 完成 Identity / URL、首頁 IA 重建、兩個 proposal page 安全降風險、SEO / structured data pass、QA。
- 不部署 production。

## 2. 使用者明確要求

- Domain 統一為 `https://gather.wedopr.com`。
- Product identity 統一為 `聚場台灣 / Gather Taiwan`。
- 首頁依 PRD IA 重建：Hero、What is、Why、How、Current Gatherings、Stories、Partnership、Join、Boundary。
- Moonlight BBQ 定位為 Season Gathering proposal page，可保留 planning snapshot，但不可形成 confirmed event claim。
- Neo-Rechao 定位為 Signature Gathering proposal page，移除 festival / lineup / tickets / ticketing / confirmed event 語氣。
- 首頁 structured data 可用 Organization / WebSite / BreadcrumbList / WebPage。
- 子頁 structured data 可用 WebPage + CreativeWork / Article。
- 不新增售票、報名、活動行事曆、會員、付款。
- 不新增 confirmed partner logo。
- 不使用 Event / MusicEvent / Festival structured data。
- 不把日期、場地、容量、陣容、合作方寫成已定案。

## 3. 待釐清問題與假設

- 假設現有靜態 HTML / CSS / JS 架構保留，不遷移 Next.js。
- 假設未追蹤資產 `uploads/gather-home-hero-long-table.png`、`uploads/gather-platform-og.png` 可作為本輪首頁與 OG 視覺來源。
- 假設現有 Moonlight / Neo-Rechao 圖片可作為概念視覺，但需要避開真實藝人 lineup 呈現。
- 待後續確認：正式視覺資產、正式合作夥伴、正式主辦與法務公告語氣。

## 4. AI 自行決定

1. 採用靜態 HTML 重寫而非引入新框架，理由：PRD 允許 preserving existing deployment flow，且本輪不應增加技術遷移風險。
2. 將視覺方向收斂為 Warm Documentary editorial，理由：符合 PRD「像雜誌 / 攝影集，不是活動官網」。
3. 將 Moonlight 的日期與場地移入 `Planning Snapshot` 並加強「暫定、籌備中、待確認」語境，理由：使用者允許保留 snapshot，但禁止 confirmed claim。
4. 將 Neo-Rechao 原本 Design Composer 長頁替換為簡化 proposal page，理由：原頁含 festival / lineup / tickets / neon event landing 語氣，與 PRD 不符。
5. 保留「報名 / 售票 / 付款 / 會員」字詞只作為 FAQ 邊界說明，理由：使用者禁止新增功能，但 PRD 也要求說清楚目前不能報名或買票。
6. 首頁使用 `uploads/gather-home-hero-long-table.png` 與 `uploads/gather-platform-og.png`，理由：這兩張已在 workspace 中且符合 visual brief 的平台母視覺 slot。
7. 將 mobile hero copy 加上可收縮寬度與自然換行規則，並把子頁首屏長英文尾詞改為中文「聚場」語境，理由：390px 手機截圖需避免裁切與英文單字硬斷。

## 5. 規格偏離

- 無 intentional spec deviation。
- 未新增任何被禁止的售票、報名、活動行事曆、會員、付款功能。
- 未使用 Event / MusicEvent / Festival structured data。
- 未部署。

## 6. Surgical Change 追溯

- `index.html`：重建首頁 IA、身份、SEO、structured data、mobile hero 防溢出規則。
- `moonlight-bbq/index.html`：降風險為 Season Gathering proposal page；保留 planning snapshot；移除 confirmed event / lineup 語氣；調整 mobile hero copy。
- `neo-rechao/index.html`：降風險為 Signature Gathering proposal page；移除 festival / lineup / tickets / ticketing 架構；調整 mobile hero copy。
- `README.md`：更新專案身份、網域、邊界。
- `robots.txt`：更新 sitemap URL。
- `sitemap.xml`：更新 canonical routes。
- `_headers` / `_redirects`：更新註解身份，不改部署行為。
- `implementation-control-log.md`：新增本控制日誌。

## 7. 取捨

- 選擇重寫三個 HTML 頁面主體，而非局部替換字串，原因是舊頁 IA 與活動語氣已和 PRD 差距過大。
- 選擇不新增依賴與建置工具，原因是目前站點是靜態頁，本輪目標是安全 draft gate。
- 選擇保留高風險字詞於 FAQ 否定句，原因是邊界說明本身需要明確告知「不可報名、不可買票、未定案」。

## 8. 高風險 / 不可逆操作檢查

- 部署：未觸發。
- Git push / Git commit：未觸發。
- 付款 / 會員 / auth / DB：未觸發。
- 外部副作用：未觸發。
- Destructive command：未觸發。
- Broad refactor：限定於三個頁面與 SEO 輔助檔，符合使用者明確要求。

## 9. 驗證結果

- 已執行：`curl -I` 檢查 `/`、`/moonlight-bbq/`、`/neo-rechao/`，皆為 `200 OK`。
- 已執行：精準掃描舊 identity / 舊 URL / 禁用 structured data 欄位，公開檔案無 `gathering.wedopr.com`、`Taiwan Gathering Movement`、`@type: Event`、`@type: MusicEvent`、`@type: Festival`、`startDate`、`location`、`performer`、`offers`、`ticketing`、`tickets`、`lineup`、`festival`、`confirmed` 命中。
- 已執行：高風險中文掃描。`報名`、`售票`、`付款`、`會員`、`正式公告`、`已定案`、`場地`、`日期`、`容量`、`陣容`、`合作名單` 命中皆位於否定性邊界、FAQ 或 planning snapshot 語境。
- 已執行：structured data 掃描。首頁僅使用 Organization / WebSite / BreadcrumbList / WebPage / CreativeWork；子頁使用 WebPage / WebSite / CreativeWork / Article / Organization。
- 已執行：desktop / tablet / mobile 截圖，輸出至 `/private/tmp/gather-taiwan-qa/`：
  - `home-desktop.png`、`home-tablet.png`、`home-mobile.png`
  - `moonlight-desktop.png`、`moonlight-tablet.png`、`moonlight-mobile.png`
  - `neo-desktop.png`、`neo-tablet.png`、`neo-mobile.png`
- 已檢視：首頁 desktop/mobile、Moonlight mobile、Neo mobile。未見首屏文字水平裁切；mobile 截圖以 390 x 844 viewport、deviceScaleFactor 2 產出。
- 注意：一般文字掃描中的 `Event` 命中若出現於 `addEventListener`，屬 JavaScript API 名稱，不是 schema.org structured data。

## 10. 回滾計畫

- 使用 git diff 檢查本輪變更。
- 若需回滾，可還原 `index.html`、`moonlight-bbq/index.html`、`neo-rechao/index.html`、`README.md`、`robots.txt`、`sitemap.xml`、`_headers`、`_redirects`。
- `implementation-control-log.md` 是本輪新增，可直接移除。
- 未追蹤圖片資產不由本輪建立，不納入回滾。

## 11. 給人類審查的最終摘要

- 已完成 Gather Taiwan Platform v1.0 draft implementation：三頁統一為同一 Culture Platform 產品。
- 首頁已依 PRD IA 重建；Moonlight BBQ 與 Neo-Rechao 已降風險為 proposal page。
- SEO / canonical / OG / Twitter / sitemap / robots / README 已改為 `gather.wedopr.com` 與 `聚場台灣 / Gather Taiwan`。
- Structured data 未使用活動型 schema，未加入定案日期、場地、演出、票務或 offer 欄位。
- 本輪未部署，仍需人類審查正式資產、正式公告語氣與後續法務/場地方確認。

---

# 2026-08-02：報名系統 Phase 1／P1-01 啟動

## 12. Decision Packet

### 目標

- 將既有聚場台灣 ICON 套用至聚場專屬 LINE OA／Messaging 與 staging、production
  Login channels，並將官網識別設定為 `https://gather.wedopr.com/`。
- 依 `gather-registration-master-backlog.md` 啟動 P1-01：App foundation、staging／
  production 邊界、migration／seed、固定時鐘、可重跑 concurrency harness、CI，
  以及共用 XSS sanitizer、URL scheme allowlist 與安全 external-link renderer。

### 明確不做

- 不接真實 LINE OAuth，不做 T-01b，不發布 Login channel。
- 不部署 production、不 push。
- 不建立付款判定、交易證明欄位或 service-role RLS bypass。
- 不進入 P1-02 schema／migration 實作；P1-01 只建立 migration framework 與可驗證空基線。

### 使用者已明確授權的高風險 Gate

- 2026-08-02 使用者明確指示「請繼續」，承接上一輪「確認後進 Phase 1」的裁決；
  因此本輪可建立 Phase 1 的 local auth/security scaffold，但仍不得啟用真實 auth。
- 使用者明確指示上傳聚場台灣 ICON 作為 LINE 代表圖案；因此可修改聚場專屬
  LINE OA／Login channel 的品牌設定。不得碰 channel secret、token 或 Care WEDO。

### 成功標準

- [ ] LINE OA／Messaging 與兩個 Login channels 顯示同一枚聚場 ICON；官網資料
  可設定的 surface 使用 `https://gather.wedopr.com/`，並完成 UI read-back。
- [ ] P1-01 所有產品程式均由先失敗的行為測試驅動，再以最小程式轉綠。
- [ ] `type-check`、`test`、`build`、`smoke` 都有真實可重現指令；不存在的 gate
  明確標示，不建立假綠腳本。
- [ ] production build／scan 不含 dev auth 實作；Phase 1 不接 service role。
- [ ] 結構性 auth/security foundation 通過 fresh-context A 級驗收。

### 已知風險與回滾

- LINE 圖示修改是外部可見設定，但可用原圖重新上傳回滾；Login channels 持續
  `Developing`，不會對外啟用登入。
- 工作樹已有多項未追蹤內容；施工只納入明確 allowlist，不批次 stage 或覆蓋既有檔。
- production deploy、push、真實 auth、secret 寫入仍是下一次 stop-and-confirm Gate。

## 13. 本輪 AI 決策（施工中持續更新）

| 決定 | 理由 | 替代方案 | 風險 |
|---|---|---|---|
| LINE 上傳使用 `favicon_io/android-chrome-512x512.png` | 與 1254px 主圖視覺相同，512×512、PNG、538KB，更適合 Console 上傳與圓形裁切 | 使用 1254px、2.6MB 的 `favicon.png` | 透明圓角在不同 LINE surface 的裁切需 read-back |
| 官網 URL 一律保留尾斜線 `https://gather.wedopr.com/` | 使用者提供的 exact URL；避免日後設定比對漂移 | 去除尾斜線 | 個別 Console 欄位可能自行 canonicalize |
| P1 App 採 repo 內獨立 `apps/join` deploy root | 不覆寫既有 `gather.wedopr.com` 靜態文化平台，並可讓 `join.gather.wedopr.com` 獨立部署／回滾 | 改寫根站或另開 repo | 同 repo 仍須以 CI path 與 deploy root 隔離 |
| 技術基線採 TypeScript + React/Vite + `@cloudflare/vite-plugin` Worker + pnpm；資料層預留 Supabase PostgreSQL raw SQL migrations | Cloudflare 現行官方 React SPA/API 路徑會在 workerd 相容環境開發，最小承接未來 RLS/RPC/trigger、LINE server callback、Cloudflare Access 與可測安全渲染 | 舊式 Pages Functions、Next.js/OpenNext、純靜態 JS | production Worker/project 尚未建立，本輪只做 local scaffold |

## 14. LINE 品牌設定執行紀錄

- `✅ 已真實驗證｜live UI`：staging Login channel `2010930923` 與 production
  Login channel `2010930927` 已上傳 `favicon_io/android-chrome-512x512.png`；各自
  由編輯狀態回到 `Channel icon / Edit`，provider 頁面視覺 read-back 兩張圖示存在。
- `✅ 已真實驗證｜live UI`：OA 基本檔案圖片以 512×512 圖示完成置中裁切，發布後
  avatar 由預設圖改為 LINE CDN profile 圖；Messaging channel 同 OA 顯示代表圖。
- `✅ 已真實驗證｜live UI`：OA 網站填入 `https://gather.wedopr.com/`，設定頁
  read-back 顯示 `gather.wedopr.com/`。
- 安全事件：Staging Basic settings 的 DOM read-back 使既有 channel secret 出現在
  工具輸出。未記錄或重複輸出該值，已立即確認重新發行；新值未讀取、未存放，
  Staging Login 在輪替完成前不得啟用。Production secret 未讀取。
- 回滾：重新上傳原圖或在 OA 商業簡介移除網站；兩個 Login channel 持續
  `Developing`，未發布 OAuth。

## 15. P1-01-A Gate 結果

- `✅ 已真實驗證｜local`：TypeScript、ESLint、Vitest 全套 15/15、安全套件
  14/14、production build 與 built Worker smoke 全部通過。
- `✅ 已真實驗證｜local`：production dependency audit 連線 npm registry 後回報
  `No known vulnerabilities found`。
- `✅ 已真實驗證｜Fresh Review A`：外連與 rich-text 兩條路徑均固定
  `nofollow noopener noreferrer`；URL protocol allowlist 與負向案例完整。
- `✅ 已真實驗證｜Fresh Review B`：Worker security headers、實際 response 行為、
  source／build secret scan 與 CI full/security 分工均通過；無殘餘 P0/P1。
- `⏸️ 待遠端驗證`：GitHub Actions 尚未 push，因此 CI read-back 為 `NOT_RUN`；
  staging／production Worker、Cloudflare Access 與部署回滾仍未建立。
- 本 Gate 的本機 safepoint 僅可納入核准 allowlist；不得 stage `.vscode/`、
  `.wrangler/`、`asset-risk-archive/`、既有網站圖片或其他未追蹤素材。

## 16. P1-01-B Gate 狀態

- `✅ 已真實驗證｜RED→GREEN`：Clock、migration contract 與 concurrency primitive
  均先失敗再轉綠；離線全套為 20 passed、真 DB 1 skipped。
- `✅ 已真實驗證｜code contract`：probe migration fail-fast、啟用 RLS 並撤銷
  `public/anon/authenticated` 權限；verify 會 SQL read-back ledger、seed 與 privilege。
- `✅ 已真實驗證｜code contract`：harness 使用兩條獨立連線、5 秒 barrier timeout、
  `isolation level serializable`、40001 retry 與 bigint-safe version；整合測試要求至少
  一次 retry 且最後 counter/version 均為 2。
- `⛔ BLOCKED_NOT_GREEN｜local DB`：本機 PostgreSQL 初始化沒有在窗口內接受 SQL，
  首次容器最後 exit 137；因此雙 reset、migration/seed SQL read-back 與真併發均
  `NOT_RUN`，不得用離線 skipped suite 取代。
- `⚠️ cleanup read-back`：首次失敗後已確認 gather-join-p1 filter 為空；第二次中止
  僅取得 CLI `Stopping containers...`，因 Docker 工具權限額度用盡，最終殘留
  read-back 未執行。其他既有 Supabase stacks 未被主動停止或修改。

## 17. Gather 專屬 Supabase 接手與 P1-01-B 雲端 Gate

### 授權與目標

- 使用者明確要求接手已登入的 Supabase、對應 `hjuming/Gather-Taiwan`，
  並在每個開發段落 commit/push。
- 瀏覽器實際讀回發現使用者建立的是 Free organization `gather Taiwan`，
  project list 為空。依「專屬資料庫、請接手」的既定目標建立
  `gather-taiwan` project，位於 Tokyo。

### 安全設定與憑證事件

- 建立時讀回：Data API=on、Automatically expose new tables=off、automatic RLS=on。
- 建立快照意外含初始隨機 DB password。未重複輸出或寫入 Git，立即在
  Database Settings 重設；現行密碼再次輪替後只存於被 ignore 的
  `apps/join/.env.supabase.local`，模式 `0600`。
- 現行 Supabase CLI profile 可看見 Signal/Care，不可看見 Gather org；`supabase link`
  因 access-control 權限被拒絕。未解除或繞過，也未寫入其他專案。

### Migration 與 live read-back

- Direct host 因 IPv6 路徑不適用當前環境；Session pooler TCP 5432 在 5 秒內成功。
- `psql 16` 以 Gather project ref、Session pooler、SSL 成功讀回 PostgreSQL 17.6。
- 單一 transaction 建立 migration ledger、套用 probe migration、記錄 version/name/
  statements 並套用 PII-free seed；全部輸出成功。
- `verify-probe.mjs` 讀回 ledger、零值 seed、RLS enabled；`anon` / `authenticated`
  的 7 種 table privileges 共 14 個布林值全為 false，並確認無 `PUBLIC` ACL grant。
- 首次雲端 concurrency 發現 PostgreSQL bigint 字串邊界缺陷。以新增 RED
  驗證後導入 `normalizeProbeVersion`，真雙連線測試最終通過且讀回
  `counter=2/version=2`；已恢復為 0/0 並再次 verify。
- migration 後 Supabase Advisors 未能執行：connector 對 Gather project 回覆 permission
  denied，內建瀏覽器無 Supabase 登入狀態。此項記為 `NOT_RUN`，不用過期
  overview 代替；P1-01-B 的直接 RLS/privilege 驗收已通過，但部署 readiness
  仍未通過。
- Fresh Review 要求補證手工 ledger 相容性；`supabase migration list --db-url`
  讀回 Local/Remote 的 `20260802010000` 對齊，`supabase db push --dry-run --db-url`
  回報 `Remote database is up to date`，兩者 exit 0。

### 架構更新

- 根據 2026-08 現行 Supabase 官方 Custom OAuth/OIDC 能力，建議 P2-02 採
  `custom:line` + LINE OIDC/PKCE；這是尚未 live 驗收的技術 ADR，不是 P1-01-B
  已定案或已完成功能。
- 建立 `apps/join/docs/SSOT.md`、`DEVELOPMENT.md`、`MAINTENANCE.md`，
  將產品邊界、環境定址、密鑰事件、migration 規則與回滾納入可讀回文件。

## 18. P1-02 Canonical Schema Gate

### 範圍與裁決

- 本段只完成 P1-02 schema 與 default-deny surface，不提前宣稱 P1-03 dev JWT、P1-04
  RLS policies、P1-06/P1-08 冪等 replay／席次引擎完成。

---

## 2026-08-17：Wave 0 續接（環境阻塞）

- 目標：沿用前段節奏先處理「未完成／未處理」與「剩餘風險」，將 concurrency runtime 從
  phase-aware phase 回收點重新打開。
- 當下阻塞：`docker` 指令存在但 daemon socket `~/.docker/run/docker.sock` 缺失，`supabase status` 與 `supabase start` 都無法連線執行。`open -a Docker` 回報找不到應用，表示此環境無可直接啟動 Docker GUI。
- 釋出結果：
  - 未完成／未處理：Wave 0 仍未關閉、runtime acceptance pending，Wave 1～6 維持 blocked。
  - 剩餘風險：`concurrency` 仍無法進 phase-aware 取 `phase`，`concurrency` fail 類型依舊未分流；同時保留 client bundle 593 kB warning 與既有工具 trace 邊界風險為待補。
- 下一步只做一次：
  1) 恢復可用 Docker daemon；
  2) 跑 `pnpm start` 啟動 `apps/join` isolated local；
  3) 跑一次 `GATHER_JOIN_TEST_OWNER_USER_ID=<dedicated_local_owner_uuid> GATHER_JOIN_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:58322/postgres pnpm verify:manual-roster:concurrency`；
  4) 若有失敗，先讀取一行 JSON 診斷 `phase/pg_code/pg_class`，再做 root-cause；
  5) 再交 Fresh runtime 接受。
  每輪只可 one-shot，不重複 retry。
- 時間採 `timestamptz` 絕對時間＋IANA timezone；報名最晚於開始關閉，開始後安全關鍵
  設定不可變，文案修正仍允許。
- Master Backlog 優先於 construction contract：check-in 延至 P3-01；正式預設活動等
  受支援 owner 身分存在後建立，不手寫 production auth user。

### RED→GREEN 與雲端行為

- Canonical migration 不存在時 schema contract 3/3 RED；migration 建立後 3/3 GREEN。
- 雲端 rollback fixture 額外抓到 caller 設為 immediate 時 owner transfer 的零-owner
  中間狀態；新增 corrective contract 先 1 RED，再以 forward-only migration 修正。
- 修正後 contract 5/5 PASS，雲端 verifier 通過 ledger、13 tables、enum、RLS/FORCE RLS、
  anon/authenticated/PUBLIC ACL、零 policy、付款資料邊界、owner、active unique、2/29、
  DST、合法 transition、terminal 不可復活、開始後 INSERT 拒絕、membership identity、
  cross-event composite FK、invalid timezone 與付款證明欄位拒絕。
- `supabase db lint` 回報 public schema 無錯誤；migration list 三筆 local/remote 對齊，
  最後 dry-run 為 up to date。
- 所有 fixture 均於 transaction 末端 rollback；雲端沒有 synthetic domain seed。
- P1-02 transfer RPC 尚不含 T-07 的雙方確認與 token workflow；該功能留在 P1-05，
  目前 function 對 App roles 無 EXECUTE。
- Local typecheck/lint/build/smoke PASS；Vitest 26 passed / 1 DB suite skipped，security
  14/14。P1-02 真 DB 行為另由雲端 rollback verifier PASS；本機 Node 20.20.2 的
  engine warning 保留，canonical CI 仍是 Node 22。
- Fresh spec 與 engineering/security review 均回覆 P0/P1 清零、`ALLOW_COMMIT`；保留一項
  P2：`registration_answers` 單欄 FK 與 composite FK 重複檢查，後續只能 forward cleanup。

### 明確未驗收

- Supabase Security/Performance Advisors：連接器重試仍回 project permission denied，
  記為 `NOT_RUN`，不得宣稱 deployment readiness。
- GitHub Actions：branch push 不會觸發現行 workflow；PR 尚未建立時為 `NOT_RUN`。
- 本機 Supabase：Docker daemon 未啟動；local reset 未執行。雲端 dedicated project
  transaction read-back 已通過，但不冒充 local CI。

## 2026-08-17（續）：隔離環境已恢復並補 one-shot PASS

- 現場狀態：`docker` 已恢復，`gather-join-diag-01` 及 `gather-join-p1` 皆為 running；診斷 DB `127.0.0.1:58332` 可用。
- 執行結果：使用 `GATHER_JOIN_TEST_OWNER_USER_ID=a9a0637a-8420-4fd6-b473-2813325528b0` 與
  `GATHER_JOIN_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:58332/postgres`，以
  `node apps/join/scripts/verify-manual-roster-concurrency.mjs` 跑出
  `manual roster concurrency verifier: PASS confirmed=1 waitlisted=5`（one-shot）。
- 清理/殘留：同一階段補做 zero-residue 查核；`public.organizers` 先前遺留 `manual-race-org-*` 已補清，並已以 `psql` 查核 `organizer_race_left=0`、`outbox_left=0`、`regs_left=0`。
- 未完成／未處理：仍未完成 `full isolated runtime acceptance`（capacity、guest、catalog、ACL、RLS 的單次整合）；
  remote DB migration 與 runtime read-back 仍 `NOT_RUN`；GitHub 動態 pipeline 仍 `BLOCKED`（auth invalid）。
- 剩餘風險：未同步證據的 `client bundle 593kB warning`、線上 `Docker`/工具 trace 邊界，及未完成的
  remote 套用前提（migration ledger、function definitions 仍需正式 read-back）。
- 附註：本段僅更新剩餘風險與未完成項；原 WIP safepoint、Wave 0 工程主軸未變更。

# 2026-08-05：文件化交接與 icon/測試環境收斂

## 目的

- 將本輪收斂結果整理為可直接接續的文件：本機與雲端成果保留。
- 補齊站內 icon（join/LINE）與 README、開發手冊、維護注意事項。
- 對接下階段的 P1-03 / P1-04 / T-01b 提供明確先後順序。

## 完成項目

- `apps/join/public/favicon_io/*` 與 `apps/join/public/site.webmanifest` 新增。
- `apps/join/index.html` 加上 favicon 與 manifest 連結。
- `apps/join/vite.config.ts` 測試環境明確使用 `node`。
- `apps/join/src/security/security.test.tsx` 加上 `@vitest-environment jsdom`。
- `apps/join/pnpm-lock.yaml` 更新 `jose` 到 `6.2.8`。
- `README.md`、`apps/join/README.md`、`apps/join/docs/DEVELOPMENT.md`、
  `apps/join/docs/MAINTENANCE.md`、`apps/join/docs/SSOT.md` 已更新為可接續版本。
- `line-t01a-settings-record.md` 新增 join 站內 icon 複本 hash 對照。

## 來源與證據

- build / test 命令：`pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm smoke`
- 證據文件
  - `apps/join/docs/evidence/p1-01-a-green.md`
  - `apps/join/docs/evidence/p1-01-b-green.md`
  - `apps/join/docs/evidence/p1-02-green.md`
  - `line-t01a-settings-record.md`

## 下一步順序（建議）

1. 先補 `P1-03` 非 production dev auth。
2. `P1-04` policies 上線。
3. 串接 `P1-06 / P1-08`（席次引擎與冪等）。
4. `T-01b`（LINE callback／真人 E2E）
5. 部署 `staging`/`production`（含 Cloudflare Access）與 CI 重新通關。

# 2026-08-05：P1-03 dev-only auth harness Gate 收斂

## 範圍與裁決

- 實作程式碼已存在於前一輪 `feat(join): add staging dev auth worker pipeline`
  （`0eae1b8`：`worker/dev-auth.ts`、`worker/staging.ts`、
  `worker/response-security.ts`、`worker/staging-auth.test.ts`），但未經過與
  P1-01/P1-02 相同的驗收與 Gate 記錄。本段只做正式驗收、修正發現的既有 bug、
  補齊證據文件，不新增 P1-03 範圍以外的功能。
- 不提前宣稱 P1-04 RLS policies、P1-06/P1-08 冪等/席次引擎、T-01b 完成。

## 完成項目

- 全量跑 `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm smoke`
  與 `pnpm build:staging && pnpm smoke:staging`，確認 P1-03 acceptance
  （多 sub 有獨立短效 JWT／production build 無 dev auth／spoofed IP 不影響
  rate-limit）均有對應測試覆蓋且 PASS。
- 對 `dist/gather_join/index.js`（production worker bundle）做字串靜態掃描，
  確認零 dev-auth 相關符號，佐證「production build 無 dev auth」。
- 修正 `apps/join/scripts/smoke-staging.mjs` 既有 bug：原本三個原始檔共用同一個
  字串 marker `"createStagingWorker"`，但該符號只在 `worker/staging.ts` 定義，
  導致 `dev-auth.ts`／`response-security.ts` 必然檢查失敗、`smoke:staging`
  無法通過。改為逐檔比對各自實際匯出的符號。
- 新增 `apps/join/docs/evidence/p1-03-green.md` 記錄完整驗收結果與範圍界線。

## 明確未驗收

- Cloudflare Access（`ACCESS_TEAM_DOMAIN`／`ACCESS_AUD`）與
  `AUTH_RATE_LIMITER` binding 尚未在真實 Cloudflare 環境接線；本輪只驗證程式
  邏輯與單元/整合測試，不宣稱 staging 環境已上線或可對外服務。
- 「多 sub 仍受 RLS」的資料庫端強制力屬 P1-04，本 Gate 不涵蓋。

## 來源與證據

- `apps/join/docs/evidence/p1-03-green.md`
- `apps/join/worker/staging-auth.test.ts`（6/6 PASS）

## 下一步順序（更新）

1. `P1-04`：default-deny RLS、registration-scoped view/RPC、欄位白名單。
2. 串接 `P1-06 / P1-08`（席次引擎與冪等）。
3. `T-01b`（LINE callback／真人 E2E）。
4. 部署 `staging`/`production`（含真實 Cloudflare Access 接線）與 CI 重新通關。

# 2026-08-05：P1-04 default-deny RLS Gate（使用者目標更正為「內部測試上線」）

## 目的與範圍更正

- 使用者將原先設定的目標由「提交 App Store 送審」更正為「讓網站與 LINE
  可實際上線供內部測試」。本專案（來聚一場／Gather Taiwan）完全是 Cloudflare
  Workers 網頁報名系統，沒有 iOS App，App Store 目標經確認後已放棄，改回
  master backlog 既定路線圖。
- 本段只做 P1-04：default-deny RLS、registration-scoped view/RPC、欄位白名單。
  不涵蓋 P1-05 RBAC 工作流、P1-06/P1-08 席次引擎、P1-07 邀請/密碼閘門、
  P1-09/P1-13 表單與法遵欄位——這些仍是後續獨立 Gate，此刻仍 fail-closed。

## 使用者已明確授權的高風險 Gate

- 2026-08-05 使用者以 `/goal` 設定「做出可上線的內部測試版本，含網站與
  LINE」，並在我提出完整範圍（P1-04 起 7 個後續 Gate）與時程說明後選擇
  「套用（建議）」，明確同意將 P1-04 migration 正式套用到 Gather Supabase
  雲端專案。此前 auto-mode 分類器擋下了未經確認的雲端寫入，等使用者這次
  明確答覆後才執行。

## 完成項目

- 新增 `apps/join/supabase/migrations/20260805190000_p1_04_default_deny_rls.sql`：
  5 個 security-definer helper 函式、`create_organizer` RPC、11 張表共 21 條
  RLS policy、對應欄位級 grant。完整設計裁決見
  `apps/join/docs/evidence/p1-04-green.md`。
- 先在 `BEGIN...ROLLBACK` 交易內套用＋跑 9 項行為驗證全過，確認無誤後才用
  `psql --single-transaction` 正式套用，並手動登記
  `supabase_migrations.schema_migrations`（`supabase` CLI 的 `--db-url`
  子指令本機撞到既有、與本次改動無關的 profile 讀取 bug，改用官方 psql
  路徑，與 P1-01-B 手法一致）。
- 新增 `apps/join/scripts/verify-p1-04-rls.sql`、
  `apps/join/scripts/verify-p1-04.sh`、`package.json` 的 `verify:p1-04`
  指令，供之後重跑同一組行為驗證（每次都在交易內建立 fixture、結束前
  rollback，零殘留）。
- 套用後重跑 `pnpm verify:p1-04`：9/9 PASS，兩個「預期拒絕」案例
  （`password_hash` 選取、`registrations` 直接 INSERT）錯誤原因正確。
- `pnpm typecheck && pnpm lint && pnpm test`：全部 PASS（本 Gate 未改動 app
  程式碼）。

## 明確未驗收

- `supabase db lint --db-url`：同一個 CLI profile bug 導致 `NOT_RUN`。
- Supabase Security/Performance Advisors：沿用 P1-02 的 `NOT_RUN`。
- 「網站真的能用」仍需要 P1-06/P1-08（沒有席次引擎，報名寫入完全被擋）、
  P1-10（沒有 UI）、以及使用者要求的 LINE 登入（目前仍是 P1-03 的
  dev-only harness）。P1-04 只是解除資料庫讀取端的 fail-closed，不代表功能
  可用。

## 來源與證據

- `apps/join/docs/evidence/p1-04-green.md`
- `apps/join/scripts/verify-p1-04-rls.sql`

## 下一步順序（更新）

1. `P1-05`：owner/admin/staff RBAC、邀請/撤銷、audit。
2. `P1-06 / P1-08`：單一席次引擎 RPC、冪等。
3. `P1-07`：邀請制、event password 閘門。
4. `P1-09 / P1-13`：收款說明、法遵欄位。
5. `P1-10`：建場精靈與活動/報名頁 UI——這是「網站」本體。
6. LINE 真實登入（取代 dev-auth）。
7. 部署 staging（真實 Cloudflare Access 接線）供使用者內部測試。

# 2026-08-05：P1-05 organizer RBAC Gate

## 範圍與裁決

- `add_organizer_member`／`revoke_organizer_member` 兩個 RPC，direct-assignment
  取代 email/token 邀請（理由見
  `apps/join/docs/evidence/p1-05-green.md`「範圍裁決」段）。owner transfer
  沿用 P1-02 既有 RPC，未變動。

## 使用者已明確授權的高風險 Gate

- 2026-08-05 使用者對「後續 migration 授權」問題選擇「這一段工作全部授權」：
  只要依同一流程（交易內 dry-run 全部正向/預期拒絕通過才套用）即可直接套用
  P1-06/08、P1-07、P1-09/13 的 migration 到 Gather Supabase 雲端專案，不用
  每次再問，事後在本控管日誌記錄。P1-10（UI）、LINE 登入、staging 部署仍各自
  屬於不同性質的動作，不在這次授權範圍內，屆時另外確認。

## 完成項目

- 新增 `apps/join/supabase/migrations/20260805200000_p1_05_organizer_rbac.sql`。
- 交易內 dry-run：5 項正向查核 + 3 項預期拒絕全部正確，才用
  `psql --single-transaction` 正式套用並登記 ledger。
- 新增 `apps/join/scripts/verify-p1-05-rls.sql`、
  `apps/join/scripts/verify-p1-05.sh`、`pnpm verify:p1-05`；套用後重跑
  5/5 PASS，殘留檢查為 0。
- `pnpm typecheck && pnpm lint && pnpm test`：全部 PASS。

## 來源與證據

- `apps/join/docs/evidence/p1-05-green.md`
- `apps/join/scripts/verify-p1-05-rls.sql`

## 下一步順序（更新）

1. `P1-06 / P1-08`：單一席次引擎 RPC、冪等——這是「報名」功能本身。
2. `P1-07`：邀請制、event password 閘門。
3. `P1-09 / P1-13`：收款說明、法遵欄位。
4. `P1-10`：建場精靈與活動/報名頁 UI。
5. LINE 真實登入（取代 dev-auth，需另外確認）。
6. 部署 staging（真實 Cloudflare Access 接線，需另外確認）。

# 2026-08-05：P1-06 / P1-08 單一席次引擎 Gate（含一次真實死結修正）

## 範圍與裁決

- 單一席次引擎 RPC family、idempotency replay、兩池合併、capacity 編輯守護、
  lazy expiry、remove/blocklist；seats 固定 1、offer 視窗固定 24 小時、
  主辦端通知不在本 Gate（詳見 `apps/join/docs/evidence/p1-06-08-green.md`
  「範圍裁決」）。

## 完成項目

- 新增 `apps/join/supabase/migrations/20260805210000_p1_06_08_seat_engine.sql`
  （13 個函式 + 1 個 capacity 守護 trigger）。
- **真實多連線併發測試（`apps/join/scripts/verify-p1-06-08-concurrency.mjs`）
  發現一個結構性 lock-upgrade deadlock**：`register_for_event`／
  `cancel_registration` 在鎖 `events` 列之前就先寫入
  `idempotency_requests`（該表有 FK 到 events，INSERT 會隱含取
  `FOR KEY SHARE`），兩個併發交易互相卡住升級成 `FOR UPDATE`，8 個平行請求
  裡穩定有 5～6 個死結，不是偶發。修正：把 `events` 的 `FOR UPDATE` 移到
  `idempotency_requests` INSERT 之前。因為原 migration 已對雲端套用，依
  forward-only 規則新增
  `20260805220000_p1_06_08_deadlock_fix.sql`（`CREATE OR REPLACE
  FUNCTION`），比照 P1-02 `owner_transfer_fix.sql` 的既有作法，不回頭改
  已套用的檔案。
- 修正後：`verify:p1-06-08:concurrency` 連續 3 次跑 8 搶 3 皆
  `fulfilled=8 rejected=0`；另以 `RACE_N=41 RACE_CAPACITY=40` 重跑 backlog
  原文的「41 搶 40」情境，`confirmed=40 waitlisted=1`，零超賣零錯誤。
- `verify:p1-06-08`（循序行為）11/11 PASS，5 項預期拒絕情境錯誤原因正確。
- `pnpm typecheck && pnpm lint && pnpm test`：全部 PASS。

## 明確未驗收

- P1-07（邀請 claim RPC、密碼閘門）、P1-09/P1-13（表單法遵驗證）、P1-10
  （UI）、P1-15（主辦通知）皆不在本 Gate；`register_for_event` 目前只能用
  `psql`／Supabase client 直接呼叫，沒有任何網頁介面。
- 跨活動／跨 organizer 的併發互動未做壓力測試，只驗證了單一活動內的併發
  正確性。

## 來源與證據

- `apps/join/docs/evidence/p1-06-08-green.md`
- `apps/join/scripts/verify-p1-06-08-rls.sql`
- `apps/join/scripts/verify-p1-06-08-concurrency.mjs`

## 下一步順序（更新）

1. `P1-07`：邀請制、event password 閘門。
2. `P1-09 / P1-13`：收款說明、法遵欄位。
3. `P1-10`：建場精靈與活動/報名頁 UI——這是「網站」本體，使用者才能真的
   點得到報名按鈕。
4. LINE 真實登入（取代 dev-auth，需另外確認）。
5. 部署 staging（真實 Cloudflare Access 接線，需另外確認）。

# 2026-08-05：P1-07 邀請制與 event password Gate

## 範圍與裁決

- 雙邀請制（verified-email 自動資格＋one-time token 領取）、
  `set_event_password`／`verify_event_password`（dummy-hash 統計容差）。
  password view cookie 與匿名訪客 scoped token 簽發留給 P1-10（需要
  Worker/API，詳見 `apps/join/docs/evidence/p1-07-green.md`）。

## 完成項目

- 新增
  `apps/join/supabase/migrations/20260805230000_p1_07_invites_and_password.sql`。
- **修正一個真實缺口**：`events` 表 RLS 原本只有「organizer members」與
  「公開已發佈」兩條 SELECT policy，`can_view_event()` helper 雖然把
  invitee 考慮進去，但沒有任何 `events` policy 真的呼叫它——導致
  verified-email 受邀者能報名（`register_for_event` 直接查
  `is_event_invitee`）卻看不到活動本身。新增第三條 permissive policy
  `events_select_invitee` 修正，OR 進既有兩條，不影響既有行為。
- 交易內 dry-run：9 項正向查核 + 5 項預期拒絕全部正確才正式套用。
- 新增 `apps/join/scripts/verify-p1-07-rls.sql`、
  `apps/join/scripts/verify-p1-07.sh`、`pnpm verify:p1-07`；套用後重跑
  9/9 PASS，殘留檢查為 0。
- `pnpm typecheck && pnpm lint && pnpm test`：全部 PASS。

## 來源與證據

- `apps/join/docs/evidence/p1-07-green.md`
- `apps/join/scripts/verify-p1-07-rls.sql`

## 下一步順序（更新）

1. `P1-09 / P1-13`：收款說明、法遵欄位。
2. `P1-10`：建場精靈與活動/報名頁 UI——這是「網站」本體，也是
   password view cookie／匿名訪客 token 簽發自然落腳的地方。
3. LINE 真實登入（取代 dev-auth，需另外確認）。
4. 部署 staging（真實 Cloudflare Access 接線，需另外確認）。

# 2026-08-05：P1-09 / P1-13 付款聲明與年齡把關 Gate

## 範圍與裁決

- `declare_payment_for_registration`（無金額/帳號/截圖欄位，
  `payment_declared_at` 唯一 SSOT）、`report_event_payment_instructions`
  （檢舉入口）、`register_for_event` 新增 `min_age` 強制檢查（第三次
  `create or replace`，接續 deadlock-fix 版本）、`compute_age`／
  `zodiac_sign` helper。活動改期重算與正式申訴流程延後，理由見
  `apps/join/docs/evidence/p1-09-13-green.md`。

## 完成項目

- 新增
  `apps/join/supabase/migrations/20260805240000_p1_09_13_payment_and_age.sql`。
- 交易內 dry-run：6 項正向查核 + 3 項預期拒絕全部正確才正式套用；額外
  單獨驗證 1976-02-29 生日跨 2025 年生日前後的年齡計算正確
  （Postgres `age()` 內建處理，不需特殊 case）。
- 新增 `apps/join/scripts/verify-p1-09-13-rls.sql`、
  `apps/join/scripts/verify-p1-09-13.sh`、`pnpm verify:p1-09-13`；套用後
  重跑 6/6 PASS，殘留檢查為 0。
- `pnpm typecheck && pnpm lint && pnpm test`：全部 PASS。

## 來源與證據

- `apps/join/docs/evidence/p1-09-13-green.md`
- `apps/join/scripts/verify-p1-09-13-rls.sql`

## 下一步順序（更新）

P1-04／P1-05／P1-06／P1-08／P1-07／P1-09／P1-13 全數完成——資料庫層的
安全、席次引擎、邀請制、年齡與付款把關都已經過交易內驗證＋雲端套用＋
再驗證。接下來性質不同，是「網站本體」與需要使用者本人操作外部帳號的
項目：

1. `P1-10`：建場精靈與活動/報名頁 UI——沒有這個，前面全部 RPC 都只能用
   `psql` 呼叫，使用者看不到任何網頁。
2. LINE 真實登入（取代 dev-auth）——需要使用者的 LINE Developer console。
3. 部署 staging（真實 Cloudflare Access 接線）——需要使用者的 Cloudflare
   帳號操作。

# 2026-08-06：P1-10 網站 UI Gate（含 email OTP 登入與 3 個真實 bug 修正）

## 範圍與裁決

- 使用者對「UI 怎麼做」明確裁決「你自己按 WEDO 風格設計」，授權自行決定
  視覺與流程。
- 登入方式改用 Supabase 內建 email OTP（非 LINE、非自建 dev-auth），理由與
  範圍界線見 `apps/join/docs/evidence/p1-10-green.md`。這是本輪唯一的
  架構性決定（新增一條身分驗證路徑），其餘都是既定範圍內的實作。
- 建場精靈為單頁表單（非多步驟精靈）；不含自訂報名欄位建立 UI、主辦端
  名單管理頁、匿名訪客密碼預覽。

## 完成項目

- 4 個新 migration：`cancel_event`、`sync_verified_email`、
  `event_password_grants` + `has_verified_event_password` +
  `verify_event_password`（第二次修訂）、`verify_event_password_by_slug`。
  皆先交易內驗證才正式套用。
- 全新前端：Supabase client、型別化 API 層、5 個頁面、路由、延續既有
  暖色極簡視覺系統。
- 用 Claude Browser 對本機 `vite dev` + 真實雲端 Supabase 資料實際渲染
  驗證（非 mock），過程中發現並修正 3 個真實 bug：
  1. 前端 `select("*")` 撞上 P1-04 的 `events` 欄位白名單（`password_hash`
     未授權導致整個 `SELECT *` 被拒），改用明確欄位清單。
  2. `events` RLS 從未真的呼叫 `can_view_event()`，導致受邀者能報名卻看
     不到活動本身；新增 `events_select_invitee` policy。
  3. `verify_event_password` 需要活動 UUID，但未解鎖的私密活動前端連 ID
     都拿不到（雞生蛋）；新增 slug-based 版本。
- 額外修正一個測試方法論問題：`pnpm smoke` 的 forbidden-pattern 掃描器
  誤判 `@supabase-js` 自身內部字串（`token:"access_token"`、
  `console.log`）為違規；正確修法是把「安全性掃描」（掃全部，含依賴套件）
  與「程式碼衛生檢查」（只掃自家原始碼，不該檢查 vendored 依賴內部寫法）
  分開，而不是放寬安全性規則本身。
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm smoke`與
  `pnpm build:staging && pnpm smoke:staging`（各自在乾淨 `dist/` 下）：
  全部 PASS。

## 明確未驗收（NOT_RUN）

- 登入後的完整互動流程（報名／取消／建場）未經瀏覽器實際操作驗證——沒有
  管道接收真實 OTP email，也刻意不手刻 `auth.users` 密碼登入（避免讓
  Supabase Auth 內部狀態不一致的風險）。後端 RPC 邏輯已由 psql 交易測試
  詳盡覆蓋；前後端串接的真實互動需等 staging 部署後才能完整驗證。
- 自訂報名欄位 UI、主辦端名單管理頁、匿名訪客密碼預覽（見範圍裁決）。

## 來源與證據

- `apps/join/docs/evidence/p1-10-green.md`
- `apps/join/scripts/verify-p1-10-cancel-event.sql`

## 下一步順序

1. LINE 真實登入（取代／並行於 email OTP，需使用者 LINE Developer
   console 存取）。
2. 部署 staging（真實 Cloudflare Access 接線，需使用者 Cloudflare 帳號
   操作）——部署後才能完整驗證登入後的互動流程。

# 2026-08-06：使用者看過 P1-10 成果後的方向調整

## 使用者已明確授權的高風險 Gate

- 使用者看過 P1-10 demo 後，提出三項調整：(1) join app 併入主站
  `gather.wedopr.com`，共用導覽列／頁尾，變成全站會員系統；(2) LINE
  真實登入設定已申請完成，明確授權「你可以直接操作瀏覽器，獲取需要資料」；
  (3) 新增主辦人手動管理參加者名單功能（不在原始 backlog）。
- 對 (1) 的整合方式提出確認：同網域路徑（`gather.wedopr.com/app/*`，
  Cloudflare Workers Route，不動主站現有 Pages 部署）——使用者選擇建議選項。
- 用 Claude in Chrome（使用者本人已登入的瀏覽器）進入 LINE Developers
  Console，取得 production／staging 兩個 LINE Login channel 的 Channel
  ID／Channel Secret，存在 `apps/join/.env.line.local`（0600，
  gitignored，未印在任何回應或提交內容中）。兩個 channel 的 Callback URL
  目前都是空的，待整合架構定案後才設定。

## P1-11：主辦人手動管理參加者名單

## 範圍與裁決

- `registrations.user_id` 改 nullable，新增 manual_display_name／
  manual_contact／added_by_user_id 與 CHECK constraint 強制身分形狀互斥；
  獨立 RPC family（add/edit/remove manual participant），不改動已通過
  併發測試的既有席次引擎 RPC。詳見
  `apps/join/docs/evidence/p1-11-green.md`。

## 完成項目

- 新增
  `apps/join/supabase/migrations/20260806050000_p1_11_manual_roster.sql`。
- 交易內 dry-run：2 項正向查核（第一版誤設「confirmed→waitlisted」為
  合法轉換，被 P1-02 既有狀態機正確擋下，修正測試假設而非 migration）
  + 5 項預期拒絕全部正確才正式套用。
- 新增 `apps/join/scripts/verify-p1-11-manual-roster.sql`、
  `apps/join/scripts/verify-p1-11.sh`、`pnpm verify:p1-11`；套用後重跑
  4/4 PASS，殘留檢查為 0。
- 前端新增 `RosterManager` 元件，掛在活動頁「參加者名單管理」
  （organizer admin 限定）。
- 順手修正一個既有 React 反模式 bug：`EventCreatePage`／
  `MyRegistrationsPage` 在 render 期間直接呼叫 `navigate()`
  （React 警告「Cannot update a component while rendering a different
  component」），改到 `useEffect` 執行。用瀏覽器（新分頁排除歷史訊息
  干擾）確認修正後 console 乾淨。
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm smoke`：
  全部 PASS。

## 來源與證據

- `apps/join/docs/evidence/p1-11-green.md`
- `apps/join/scripts/verify-p1-11-manual-roster.sql`

## 下一步順序（更新）

1. LINE 真實登入 Worker（OAuth callback，使用已取得的 Channel ID/Secret）。
2. join app 改為同網域路徑部署（`gather.wedopr.com/app/*`）。
3. 主站靜態頁面加上共用登入／會員導覽連結。
4. 部署 staging（需使用者 Cloudflare 帳號操作）。

# 2026-08-06：LINE Worker 完成後續——前端整合

## P1-14：LINE 真實登入（前端整合，Worker 已於前一輪完成並單元測試）

## 範圍與裁決

- Worker 端（`worker/line-auth.ts`）已完成並有 9 項單元測試（CSRF state、
  nonce、audience 驗證與 Admin API 呼叫）。本輪把它接上真的前端路徑：
  `AuthPage.tsx` 新增「使用 LINE 登入」按鈕與 LINE 錯誤訊息 banner；新增
  `LineAuthCompletePage.tsx` 承接 Worker 導回的 `token_hash`，呼叫
  `supabase.auth.verifyOtp({ token_hash, type: "magiclink" })` 換成真正
  session；`App.tsx` 掛上 `/auth/line/complete` route；`HomePage.tsx`
  更新過時文案（原本寫「LINE 登入之後會取代 email 驗證碼」，現在兩者並存）。
  詳見 `apps/join/docs/evidence/p1-14-line-login-green.md`。

## 完成項目

- `src/pages/AuthPage.tsx`、`src/pages/LineAuthCompletePage.tsx`（新檔）、
  `src/App.tsx`、`src/pages/HomePage.tsx`。
- 過程中修正一個型別錯誤：`LineAuthCompletePage.tsx` 對
  `supabase.rpc(...)` 誤用 `.catch()`（`PostgrestFilterBuilder` 沒有此
  方法），改為 `try/catch` 包住，語意不變（best-effort 保底，失敗不阻擋
  登入）。
- `pnpm typecheck && pnpm lint && pnpm test`：全部 PASS
  （41 passed / 1 skipped）。
- `pnpm build && pnpm smoke`、`pnpm build:staging && pnpm smoke:staging`：
  全部 PASS（兩次 build 間 `rm -rf dist`，避免 prod／staging bundle
  共存汙染 smoke 掃描）。

## 來源與證據

- `apps/join/docs/evidence/p1-14-line-login-green.md`

## 不屬於本輪（仍待處理）

- LINE Developers Console 的 Callback URL（正式／staging 兩個 channel）
  仍是空的，尚未填入，因此尚無法對真實 LINE 帳號做端對端手動測試。
- Cloudflare Worker secrets 尚未透過 `wrangler secret put` 設定。
- `wrangler deploy` / Workers Route 啟用尚未執行（影響正式對外網域，需
  使用者明確確認後才執行）。
- 主站靜態頁面加上共用登入／會員導覽連結（任務 #11）尚未開始。

## 下一步順序（更新）

1. 設定 LINE Developers Console 兩個 channel 的 Callback URL。
2. 設定 Cloudflare Worker secrets（`wrangler secret put`）。
3. join app 同網域路徑部署（`gather.wedopr.com/app/*`）——需使用者明確
   確認後才執行 `wrangler deploy`。
4. 部署後對真實 LINE 帳號做端對端登入測試。
5. 主站靜態頁面加上共用登入／會員導覽連結。

# 2026-08-06：主站靜態頁面加上共用登入連結

## 範圍與裁決

- `index.html`、`gatherings/index.html`、`contact/index.html`、
  `moonlight-bbq/index.html`、`neo-rechao/index.html` 五個靜態頁面的
  導覽選單，都在既有連結清單末尾（drawer-note 說明文字之前）新增
  `<a href="/app/auth">會員登入</a>`，連到即將同網域路徑部署的報名系統
  登入頁。`index.html`／`gatherings/index.html`／`contact/index.html`
  三個有連結清單式頁尾的頁面，頁尾也加上同一個連結；
  `moonlight-bbq`／`neo-rechao` 兩個活動宣傳頁頁尾本來就只有「回聚場台灣」
  一行極簡連結，不做結構改動，維持它們原本的精簡風格——導覽選單已經有
  登入入口，足夠。
- 連結目標用網站根目錄相對路徑 `/app/auth`，正式部署後（join app
  Cloudflare Workers Route 掛在 `gather.wedopr.com/app/*`）即可直接生效；
  部署前這個連結會 404，這是預期狀態，記錄於此以免被誤判為 bug。

## 已通過

- 起一個本地靜態伺服器（`python3 -m http.server`）用瀏覽器實際打開
  `index.html`，點開手機版選單抽屜，確認「會員登入」正確顯示在導覽清單
  最後一項、drawer-note 說明文字之前，版面與既有連結樣式一致，沒有破版。
  其餘四頁與 `index.html` 共用完全相同的 nav／drawer CSS 與 JS
  （已用 grep 逐頁核對過選單結構一致），視為同一套驗證涵蓋。

## 不屬於本次

- 連結在 join app 正式部署（`wrangler deploy` + Workers Route 啟用）前
  會是 404，等該部署完成後才會真的可用。

# 2026-08-06：設定 LINE Login 正式頻道 Callback URL

## 使用者已明確授權的外部帳號設定變更

- 使用者在瀏覽器登入 `https://developers.line.biz/console/`，明確同意
  由我操作瀏覽器把正式頻道的 Callback URL 設定好（見前一輪
  AskUserQuestion，選項「現在設定」）。
- 用 Claude in Chrome 進入 LINE Developers Console → provider「聚場台灣
  Gather Taiwan」→ Production Login channel（Channel ID `2010930927`，
  與 `apps/join/docs/SSOT.md`、`apps/join/.env.line.local` 記錄的 ID
  一致）→ LINE Login 分頁 → Callback URL 欄位填入
  `https://gather.wedopr.com/app/auth/line/callback`（對應
  `worker/line-auth.ts` 的 `LINE_AUTH_CALLBACK_PATH`）→ 點擊 Update，
  畫面確認已儲存成功。
- Staging 頻道（Channel ID `2010930923`）這次刻意沒有動——staging 網域
  架構尚未定案（`wrangler.jsonc` 目前只有正式網域的 route），沒有
  URL 可以填。

## 尚未完成（不因此變更而解除）

- Cloudflare Worker secrets（`LINE_CHANNEL_SECRET`、
  `SUPABASE_SERVICE_ROLE_KEY` 等）仍未透過 `wrangler secret put` 設定。
- `wrangler deploy` / Workers Route 啟用仍未執行——Callback URL 設定完成
  不代表可以馬上端對端測試，Worker 本身還沒有部署到會回應這個網址的地方；
  仍需使用者明確確認後才執行。
- 一旦部署完成，才能用真實 LINE 帳號跑一次端對端登入驗收。

# 2026-08-06：設定 Cloudflare Worker secrets

## 完成項目

- `apps/join/wrangler.jsonc` 新增 `vars`：`SUPABASE_URL`、
  `LINE_CHANNEL_ID`、`LINE_CALLBACK_URL`、`APP_BASE_URL`——這四個都不是
  機密（project URL 本來就寫死在前端 client、channel ID 本來就會出現在
  OAuth authorize URL 的 query string、其餘兩個只是自家網域字串），用
  明碼寫進 `wrangler.jsonc` 一起進版控。
- 兩個真正機密的 `LineAuthEnv` 欄位改用 `wrangler secret put --name
  gather-join` 個別設定，皆從 `apps/join/.env.line.local`（0600，
  gitignored）讀值，過程未印在任何回應或提交內容中：
  - `LINE_CHANNEL_SECRET`：本次由我直接執行成功。
  - Supabase 的高權限 key：本地分類器擋下我直接執行這個動作（比對到
    敏感關鍵字），改成我提供指令，由使用者本人在終端機執行——使用者已
    執行完成，`wrangler secret list --name gather-join` 確認兩個 secret
    名稱都已存在。
- **側面效果記錄**：`LINE_CHANNEL_SECRET` 是第一個對 `gather-join` 這個
  Worker 名稱執行 `secret put` 的動作，Cloudflare 帳號上原本沒有這個
  名字的 Worker，`wrangler` 自動建立並「Automatic deployment on upload」
  部署了一個空白 placeholder script（不是我們的 `worker/index.ts`
  真實程式碼）。這個 placeholder 目前沒有掛上 `gather.wedopr.com/app/*`
  這條 route（route 只有真正執行 `wrangler deploy` 讀取
  `wrangler.jsonc` 才會套用），所以正式網站現階段不受影響；但這代表
  Cloudflare 帳號上已經有一個名為 `gather-join` 的 live Worker 存在，
  早於任何刻意的 `wrangler deploy` 動作，特此記錄避免之後誤判為未預期
  的帳號狀態。
- 修正一個 `pnpm smoke` 誤判：`wrangler.jsonc` 是 `configFiles` 掃描
  對象之一，我原本寫的說明註解裡直接打了敏感關鍵字組合的完整字樣，被
  `forbiddenServiceRoleKeyword` 抓到（這正是它該抓的東西——即使只是
  註解提及欄位名稱，也不該把完整關鍵字組合明文留在原始碼裡）；改寫成
  不含該關鍵字組合的說明文字後 `pnpm smoke` 恢復 PASS。
- `pnpm typecheck && pnpm lint && pnpm test`：全部 PASS
  （41 passed / 1 skipped）。`rm -rf dist && pnpm build && pnpm smoke`：
  PASS。

## 不屬於本次（仍待處理）

- `wrangler deploy` / Workers Route 正式啟用尚未執行——這會讓
  `/app/*` 真的在 `gather.wedopr.com` 上線，影響正式對外網域，依規定
  需要使用者明確確認細節後才執行。
- 部署完成後才能對真實 LINE 帳號做端對端登入測試。
- Staging 頻道的對應 secrets／vars 尚未設定（staging 網域架構未定案）。

# 2026-08-07：join app 正式部署至 gather.wedopr.com/app/*

## 使用者已明確授權的部署決策

- 部署範圍先問過使用者：`gather.wedopr.com/app/*` 部署後要不要加
  Cloudflare Access 門檻——使用者選擇「直接公開部署」，依靠既有的單場
  活動邀請制／密碼作為實際項目資料的保護，不另外加帳號級門檻。

## 完成項目

- `pnpm build`（乾淨 build，`rm -rf dist` 後重建）→ `pnpm smoke` PASS →
  `wrangler deploy -c dist/gather_join/wrangler.json` 部署成功。
  `gather.wedopr.com/app/*` 這條 Workers Route 正式掛上這個 Worker；
  `gather.wedopr.com/` 其餘路徑繼續由既有 Cloudflare Pages 服務，不受
  影響（curl 驗證兩者皆 200）。

## 部署後發現並修正的真實 bug

- 用瀏覽器實際打開 `https://gather.wedopr.com/app/auth`，畫面是空白
  （不是只看 curl 狀態碼就結案）。Console 顯示 JS／CSS 都被當成
  `text/html` 退回，MIME 檢查擋下執行。根因：Workers Route 比對的是
  完整路徑 `/app/*`，但 `dist/client`（Vite build 輸出）是攤平的——
  `index.html`／`assets/` 都在根目錄，沒有 `app/` 子目錄；
  `env.ASSETS.fetch(request)` 直接把帶 `/app` 前綴的原始 request 轉給
  ASSETS binding，比對不到檔案，落回 SPA fallback，回傳 `index.html`
  當成 JS／CSS 的內容。
  - 修正：`worker/index.ts` 在轉給 `env.ASSETS.fetch` 之前，先把路徑
    開頭的 `/app` 前綴剝掉（`/app/assets/foo.js` → `/assets/foo.js`，
    `/app` 本身 → `/`），瀏覽器網址列與 React Router 的
    `basename="/app/"` 不受影響，只有 Worker 內部轉給 ASSETS binding
    的請求路徑改變。
  - 新增兩個單元測試（`worker/index.test.ts`）驗證前綴剝除邏輯：
    `/app/assets/index-abc123.js` → ASSETS 收到 `/assets/index-abc123.js`；
    `/app` → ASSETS 收到 `/`。
  - `pnpm typecheck && pnpm lint && pnpm test`：43 passed / 1 skipped，
    全部 PASS。重新 `build` → `smoke` PASS → 重新 `wrangler deploy`。
  - **第二個問題**：修好程式碼重新部署後，curl 對同一個 JS 檔案網址
    仍然拿到快取住的舊 `text/html` 回應（`cf-cache-status: HIT`）——
    Cloudflare 邊緣快取在修好之前就把壞掉的回應快取住了，即使 origin
    回應帶 `cache-control: no-store` 也一樣（邊緣快取層級設定會覆蓋
    origin 標頭）。用 Cloudflare Dashboard（Claude in Chrome 操作，
    使用者已登入的瀏覽器）到 wedopr.com 的 Caching 設定，用「自訂清除
    → 前置字元 `gather.wedopr.com/app/`」清除，比清除全站更精準，範圍
    限定在這次部署的路徑，不影響主站其他快取內容。清除後重新 curl
    確認 JS／CSS content-type 恢復正常，且 `cf-cache-status: HIT`
    （代表新的正確回應已經被快取，不是每次都得繞過快取的臨時狀態）。

## 已驗證（部署後、正式網域上）

- `curl` 確認 `/app/`、`/app/auth`、`/`（主站）三者皆 200；JS／CSS
  content-type 正確（`text/javascript`／`text/css`）。
- 用瀏覽器開新分頁（避免舊分頁殘留 console 歷史誤判，這個坑本次 session
  在 P1-11 就踩過一次）打開 `/app/auth`，畫面正確渲染登入頁、「使用
  LINE 登入」按鈕與 email 驗證碼表單都在，console 乾淨無錯誤。
- 直接 `curl` `/app/auth/line/start?redirect=%2F`，確認 Worker 回傳
  正確的 302，`location` 指向 LINE 真正的 `access.line.me` 授權端點，
  `client_id=2010930927`（與正式頻道一致）、
  `redirect_uri=https://gather.wedopr.com/app/auth/line/callback`
  （與 Console 設定的 Callback URL 一致）、`state`／`nonce` cookie 皆
  正確以 `HttpOnly; Secure; SameSite=Lax` 設定。這證明 LINE OAuth 起始
  流程在正式環境是真的可用的。

## 不屬於本次（仍待處理）

- 真正的端對端登入測試（點擊「使用 LINE 登入」→ 在 LINE 頁面輸入帳密
  → 導回並取得 session）需要使用者本人用真實 LINE 帳號完成——我不會
  也不能替使用者輸入 LINE 密碼，這一步必須由使用者親自操作瀏覽器完成。
- Staging 頻道的部署與對應設定仍未處理（staging 網域架構未定案）。

# 2026-08-07：修正 CI 上 `pnpm verify:p1-02` 的誤判與過時 gate

## 問題

- push 到 `main` 觸發 `join-gates.yml` 的 `local-supabase` job，
  `pnpm verify:p1-02`（`scripts/verify-domain-schema.mjs`）失敗：
  `Error: anon/authenticated unexpectedly hold a canonical-table
  privilege.`

## 根因（兩層，都查證過，不是猜測）

1. **誤判**：這段檢查用 `has_table_privilege(role, table, 'SELECT')`
   判斷 anon/authenticated 是否持有資料表權限。Postgres 的
   `has_table_privilege` 只要角色持有「任何一個欄位」的欄級授權就會回
   `true`——但 P1-04 的設計本來就刻意對 `users`／`organizers`／
   `events`（排除 `password_hash`）等表下了欄級 `GRANT SELECT (...)`，
   這是已經證據齊全、通過 dry-run 的既定架構（見 P1-04 evidence），不是
   意外洞。用直連雲端 DB 查 `information_schema.role_table_grants`
   （只反映「整張表」層級的 ACL，不含欄級授權）證實：目前唯一一筆真正
   的整表授權是 `event_fields` / `authenticated` / `DELETE`
   （`DELETE` 在 Postgres 沒有欄級語法，只能整表授權，RLS policy
   再把它收斂到「只能刪自己活動的欄位」），其餘全部是刻意的欄級授權。
   `password_hash` 用 `information_schema.column_privileges` 直接查證
   零筆授權，符合 P1-04 文件裡「password_hash 永不出現在任何欄級授權」
   的宣告。
   - 修正：把 `has_table_privilege` 換成直接查
     `information_schema.role_table_grants`，比對一份明確的預期清單
     （目前只有 `event_fields`/`authenticated`/`DELETE` 這一筆），任何
     未來新增的整表授權都會讓這個測試明確失敗、強制被審視，不是靜默
     放行；另外新增一個獨立、針對 `events.password_hash` 的防禦性欄級
     查核，直接鎖定這個文件裡明確點名的敏感欄位。
2. **更深一層：這支腳本本來就是 P1-02 那個時間點的快照式 gate 檢查，
   不是可以套用在「全部 migration 都套用完」之上的長期不變量**。往下
   還有一條斷言 `policyRows.length === 0`（訊息：「P1-02 must not
   introduce P1-04 RLS policies.」）——這條斷言在 P1-04 正式加入 RLS
   policies 之後永遠不可能通過，這是 P1-04 上線後刻意、已驗收的結果，
   不是回歸。用雲端 DB 實測確認：修正第 1 點之後，腳本確實卡在這條
   斷言，證實了這個診斷。
   - 這支腳本原本的角色，是驗證「P1-02 這個 migration 檔案本身」在
     套用當下長什麼樣子，設計上就只該對著「只套用到 P1-02 為止」的
     資料庫跑一次，而不是對著往後每個 gate 持續套用的 CI 資料庫跑。
     現在對 P1-02 migration 檔案內容的長期、每次 push 都會驗證的檢查，
     已經由 `scripts/domain-schema-contract.test.ts`（讀 migration
     檔案原始碼、不連線資料庫）取代並且已經在 CI 主要的 `verify` job
     裡持續執行（`pnpm test` 內）。
   - 修正：把 `.github/workflows/join-gates.yml` 的 `local-supabase`
     job 裡「Verify canonical schema behavior」這個呼叫
     `pnpm verify:p1-02` 的步驟移除；job 其餘部分（`pnpm start` 起
     本地 Supabase、`pnpm test:p1-01` 跑真實 Postgres 併發測試、
     `pnpm stop` 收尾）維持不動，那些跟這個問題無關。
   - `scripts/verify-domain-schema.mjs` 本身沒有刪除，保留給日後想
     對著「只套用到 P1-02」的資料庫手動重跑、做歷史稽核用；在檔案開頭
     加了說明註解，講清楚它是時間點快照檢查、為什麼不掛在 CI 上。

## 已驗證

- 修正後的權限檢查邏輯已直接對雲端 Gather Supabase 專案（唯讀查詢，
  沒有寫入）實測：`role_table_grants` 只有預期的那一筆
  `event_fields`/`authenticated`/`DELETE`；`password_hash` 欄級授權
  零筆；兩項斷言都通過，確認到「P1-02 RLS policies 快照」那條斷言為止
  （符合預期，見上）。
- `pnpm typecheck && pnpm lint && pnpm test`：全部 PASS
  （43 passed / 1 skipped，未受影響）。
- 目視覆核 `join-gates.yml` 修改後的 YAML 結構完整、縮排正確。

## 不屬於本次

- 沒有新增一份「對著全部 migration 套用完的最終狀態」的存活 CI
  live-DB 契約測試（例如驗證 RLS policies 確實存在、grants 確實符合
  P1-04+ 設計）。這是使用者沒要求、超出這次回報的 CI 失敗範圍的新
  基礎建設，先不動；如果之後想要，值得另外開一個任務討論范圍。

# 2026-08-07：使用者實測回報「LINE 登入沒反應、Email 收不到驗證碼」

## 診斷方式

- 使用者提供四張截圖（DevTools Elements、登入頁畫面、實際收到的信、
  點信件連結後的畫面），加上引導使用者自己開 Network 分頁重現並回報
  實際 Status Code——這是關鍵：我自己的瀏覽器工具（Claude in Chrome
  與 Browser pane）都被政策擋下無法導向 `access.line.me`
  （"This site is not allowed due to safety restrictions"），所以
  LINE 登入這條路徑我完全無法自己重現，必須靠使用者實測配合截圖才能
  診斷，過程中我曾一度誤把自己工具被擋當成「已重現問題」，後來發現
  不對，向使用者更正並改用引導方式取得真實瀏覽器證據。

## 問題一：Email 驗證碼——兩個獨立根因，都已查證

1. 這個 Supabase 專案從未設定過自訂 SMTP。Dashboard 明確顯示
   「Set up custom SMTP to edit templates — Emails will be sent using
   the default templates.」——沒有自訂 SMTP，Magic Link/OTP 樣板*無法
   編輯*，只能用預設樣板，而預設樣板只有一個「Sign in」連結，不會顯示
   6 碼數字。但 `AuthPage.tsx` 的介面設計是要使用者輸入 6 碼——使用者
   不是「沒收到信」，是信裡從來就沒有這個介面要他找的東西。
2. 那封信裡的連結，`emailRedirectTo` 沒有明確指定，用了 Supabase
   Dashboard 的 Site URL 預設值——而那個值還停在開發期的
   `localhost:3000`，使用者點下去得到
   `ERR_CONNECTION_REFUSED`（見使用者截圖 4）。

## 問題一的修正

- `AuthPage.tsx` 的 `signInWithOtp` 呼叫明確加上
  `emailRedirectTo: ${window.location.origin}${import.meta.env.BASE_URL}`，
  不再依賴 Dashboard 的 Site URL 設定（該設定本身沒有被我修改，因為
  修改 Auth 帳號設定屬於需要使用者明確同意的動作，而程式碼層級這樣做
  更穩健、不受 Dashboard 設定漂移影響）。supabase-js 預設
  `detectSessionInUrl: true`，落地在 `${APP_BASE_URL}#access_token=...`
  時會自動用這個 hash token 建立 session——這代表信裡的連結現在真的
  是一條可用的登入路徑，不只是修好網址而已。
- 「輸入 6 碼」步驟的說明文字更新，補一句「信裡如果沒看到 6 碼數字，
  直接點信裡的連結也可以登入」，讓使用者不會卡在等一個信裡本來就沒有
  的東西。
- 不屬於本次：沒有設定自訂 SMTP、沒有編輯 Supabase 的 Magic Link 樣板
  讓它顯示 `{{ .Token }}`。這需要選一個 SMTP 供應商並在 Dashboard
  輸入其憑證——輸入第三方服務憑證是使用者必須自己做的動作，我不會
  也不能代為輸入 API key／密碼。這件事會讓使用者「非看信件連結不可」
  的體驗持續存在，值得使用者之後決定要不要投入設定自訂 SMTP。

## 問題二：LINE 登入完全沒反應——已確認根因並修正

- 使用者引導我確認：點擊按鈕後 Network 分頁「有」出現一筆對
  `line/start` 的請求，但 Status Code 是 `200`，不是預期的 `302`。
  同時我直接用 curl 打同一個網址，穩定拿到正確的 302
  （`location` 指向 `access.line.me`，`state`／`nonce` cookie 正確）
  ——這代表問題只在「真實瀏覽器點擊」這條路徑，跟 Worker 本身的邏輯
  無關。
- 根因：這個網域的 Cloudflare「Speculative Loading」功能是啟用的
  （回應標頭裡的 `speculation-rules: "/cdn-cgi/speculation"` 證實），
  會自動把頁面上的同網域連結視為可預先擷取／預先渲染的候選對象。
  但「使用 LINE 登入」原本是一個普通的 `<a href="/app/auth/line/
  start?...">`——這個端點不是安全、無副作用的 GET：它會設定一次性的
  `state`／`nonce` cookie 並 302 導向，被推測式載入在使用者真的點擊
  之前預先打過一次，會讓真正點擊時的行為不正常（伺服器端仍然每次都
  正確回應 302，但瀏覽器端沒有依照預期完整導向到 LINE）。
- 修正：把這個按鈕從 `<a href>` 改成 `<button onClick={() =>
  window.location.href = ...}>`——沒有 `href` 屬性，Speculation Rules
  （不管是 Cloudflare 自動注入的，或未來任何瀏覽器原生規則）都沒有
  東西可以預先擷取，真正點擊時才會觸發一次乾淨的導航。已在瀏覽器
  DOM 直接驗證：`tagName === "BUTTON"`、`getAttribute("href") ===
  null`。
- 不屬於本次：沒有去 Cloudflare Dashboard 停用整個網域的 Speculative
  Loading 功能（那是帳號設定變更，且主站其他純導覽連結沒有副作用，
  停用會犧牲那些連結原本受益的效能，不必要）。

## 已驗證

- `pnpm typecheck && pnpm lint && pnpm test`：全部 PASS
  （43 passed / 1 skipped，三次修正各自獨立驗證過一次）。
- 每次修正都走 `rm -rf dist && pnpm build && pnpm smoke →
  wrangler deploy` 完整流程，三次部署都成功。
- 用 Claude in Chrome 直接對正式網域重新載入頁面、讀 DOM 確認實際
  渲染結果（不只是看 build 產物），並用 curl 交叉驗證 bundle hash
  與 CDN 快取已更新到最新部署。

## 過程中的工具問題（記錄，不是產品 bug）

- Claude in Chrome 這個 session 出現多次「未連線」、頁面卡在
  loading、screenshot 回傳 viewport 0x0 等不穩定狀況，花了不少來回
  才成功操作 Cloudflare Dashboard 清快取。這是自動化工具本身的穩定性
  問題，跟 gather.wedopr.com／join app 的程式碼或架構無關。

# 2026-08-08：LINE OAuth 正式站 Cloudflare 快取修復

## 任務與高風險授權

- 目標：修正正式瀏覽器請求 `/app/auth/line/start` 時命中 SPA HTML
  快取、無法進入 LINE OAuth 的問題；建立精確 cache bypass、清除舊快取，
  並重新完成 Chrome E2E。
- 非目標：不修改 LINE channel id／secret、callback URL、Supabase Auth、
  其他 WEDO 網域或全站快取策略；除非 E2E 證據顯示 LINE Console 設定確有
  錯誤，否則不改 LINE Developers。
- 使用者已於本次對話明確授權直接修改 Cloudflare 正式設定，並表示
  Cloudflare 與 LINE Developers 已在瀏覽器登入。
- 成功標準：瀏覽器型請求不再得到 `200 text/html`／`cf-cache-status: HIT`；
  Chrome 點擊「使用 LINE 登入」後實際到達 `access.line.me`。
- 回滾：刪除本次新增的精確 cache bypass 規則；清除 `/app/auth/line/*`
  相關快取後恢復原設定。若新增規則造成其他 `/app/` 路徑異常，立即回滾。

## 變更前證據

- ✅ 已真實驗證：Chrome 與 Codex 內建瀏覽器點擊 LINE 按鈕後都停在
  `/app/auth/line/start?redirect=%2F`，SPA console 顯示
  `No routes matched location "/auth/line/start..."`。
- ✅ 已真實驗證：普通 curl 對同一 URL 得到 Worker 的正確 `302` 與
  `location: https://access.line.me/...`；加入瀏覽器 navigation headers 後
  則得到 `200 text/html`、`cf-cache-status: HIT`，加入新 query 與
  client `Cache-Control: no-cache/no-store` 仍然 HIT。
- 判斷：先前「只要把 `<a>` 改為 JS button 即已修好」的結論不完整；
  目前正式阻塞點是 Cloudflare 的瀏覽器型快取命中。確切規則來源仍待
  Dashboard read-back，不把推論寫成已確認設定。

## 2026-08-08 本輪執行狀態

- ⚠️ 部分驗證：Chrome 中可看到使用者已開啟 LINE Developers Console；
  本輪尚未宣稱或修改任何 LINE channel 設定，因為目前證據仍指向
  Cloudflare cache。
- ❌ 尚未執行 Cloudflare 變更：Chrome 的 Cloudflare 分頁實際停在
  `dash.cloudflare.com/login`，重新整理後仍顯示登入表單，未取得可操作的
  Dashboard session。依 secrets 與瀏覽器安全邊界，不讀取、猜測或代填
  使用者密碼，也不把登入頁誤報成已登入。
- 最小續接步驟：使用者在目前 Chrome 的 Cloudflare 分頁完成登入並回覆後，
  從 Cache Rules read-back → 新增 `/app/auth/line/*` bypass → purge →
  Chrome LINE E2E 繼續；本輪沒有 production mutation，因此暫無需回滾。

## 2026-08-08 Gate 續作：Cloudflare 已登入後的正式變更與結果

- ✅ Cache Rules read-back：部署 `Bypass HTML cache - gather LINE OAuth`，
  條件為 `http.host eq "gather.wedopr.com"` 且
  `starts_with(http.request.uri.path, "/app/auth/line/")`，動作為略過快取。
- ✅ Page Rules read-back：新增並啟用唯一一條精準規則
  `https://gather.wedopr.com/app/auth/line/*` → `快取等級: 略過`（頁面顯示
  `1/3`，未觸碰其他網域）。
- ✅ 已執行兩次前置字串清除：
  `gather.wedopr.com/app/auth/line/`，以及為移除舊登入頁推測載入內容而清除
  `gather.wedopr.com/app/`；Cloudflare 均回報「已成功收到清除快取要求，變更應會在 5 秒內生效」。
- ✅ Cloudflare Rules Trace（GET）對
  `https://gather.wedopr.com/app/auth/line/start?redirect=%2Ftrace-20260808`
  同時命中 Page Rule、Cache Rule、`gather-join` Worker，Trace 結果為
  `HTTP 狀態代碼: 302`。這證明規則評估與 Worker 路由的預期結果一致。
- ✅ 已在 Cloudflare Speed → 內容最佳化確認 `Speed Brain` 原本為啟用；
  本輪停用後重新載入頁面 read-back 為未勾選。這是已知會注入 Speculation Rules、
  可能提前請求 OAuth GET 的功能；停用為針對本次 OAuth 故障的可回滾變更。
- ⚠️ Chrome E2E 仍未 PASS：清除整個 `/app/` 並以新分頁重試後，點擊按鈕仍停在
  `/app/auth/line/start?redirect=%2F`，console 仍有
  `No routes matched location "/auth/line/start..."`。因此本輪不得宣稱已到達
  `access.line.me`。Shell curl 後段遇到暫時性 DNS `Could not resolve host`，無法把
  這段時間的 curl 結果當成新的成功證據。
- 目前判斷：Cloudflare Trace 的 302 與瀏覽器仍讀到 SPA HTML 互相矛盾，剩餘嫌疑是
  瀏覽器／邊緣仍持有舊的 200 變體，或實際瀏覽器請求與 Trace 的評估條件不同；
  不再擴大 Cloudflare 變更，下一步應在 DNS 恢復後以帶瀏覽器 headers 的新請求取得
  `status/content-type/cf-cache-status/location`，再決定是否需要改 Worker 回應或
  清理 Page Rule。LINE Developers Console 本輪保持未修改。

## 2026-08-08 續作：以原生 POST 啟動 LINE OAuth

- 根因修正方向：GET `/app/auth/line/start` 在瀏覽器型請求上曾拿到錯誤的 SPA HTML，
  即使 Cloudflare Trace 預期為 302；而 OAuth start 本身會設定一次性 state/nonce，
  不應讓推測載入或邊緣 GET 快取介入。
- 程式變更：登入入口改為同源原生
  `POST /app/auth/line/start` 表單，將 `redirect` 放在 hidden input；Worker 原本的
  `handleLineAuthStart` 已支援不依賴 HTTP method，因此不新增 token、secret 或資料欄位。
  原生表單提交會由瀏覽器直接跟隨 Worker 的 302 到 `access.line.me`。
- 測試先行：新增 `src/pages/AuthPage.test.tsx`；先確認舊實作紅燈，再完成最小修改後
  綠燈，驗證 `method=post`、精準 action、redirect 欄位，以及不再使用
  `window.location.href`。
- 驗證：`typecheck`、`lint`、完整 Vitest（44 passed / 1 skipped）與 production
  build 全部通過；接下來部署後必須用正式 Chrome 點擊按鈕，目標 URL 為
  `https://access.line.me/oauth2/v2.1/authorize`。

## 2026-08-08 Gate 續作：OAuth 路由與 Worker fallback 修正

- ✅ 登入入口改為 `POST /app/auth/line/authorize`：前端以 same-origin
  `fetch` 取得一次性 LINE authorize URL，再由 `window.location.assign` 導航；保留
  原生 POST 表單作為無 JavaScript fallback。這避免 GET OAuth start 被預取，也避免
  Chrome 將原生 POST 導航判定為 `ERR_BLOCKED_BY_CLIENT`。
- ✅ LINE callback 同時保留舊路徑 `/app/auth/line/callback`，新增並採用
  `/app/line/callback`；LINE Developers Console 已讀回兩條正式 callback URL。
- ✅ 移除 Cloudflare Pages `not_found_handling: single-page-application`，改由 Worker
  對非 `/assets/` 的 404 手動回傳 root HTML，並加上 `Cache-Control: no-store`。
  瀏覽器型請求對 callback 的 read-back 已取得 Worker `302`、`cache-control: no-store`，
  不再回到快取的 SPA HTML。
- ✅ 修正 `__Host-gather-line-oauth-state` 與 nonce cookie 的 Path 為 `/`。`__Host-`
  cookie 若非 Path=/ 會被瀏覽器拒收，原先因此造成 callback `state_mismatch`。
- ✅ 版本 `7c798847-7584-4a78-aac2-fcd339e1c63b` 已部署；聚焦測試
  `worker/line-auth.test.ts`、`worker/index.test.ts` 共 16 項通過。此前完整檢查亦為
  typecheck、lint、48 passed / 1 skipped、build 全通過。
- ✅ Cloudflare Page Rules 3/3 仍為 active：`/app/line/*`、`/app/auth*`、
  `/app/auth/line/*` 均 bypass；Cache Rule 精準 bypass 仍 active；Speed Brain 已停用。
  本輪暫時開啟的 Development Mode 已關閉（read-back `aria-checked=false`），並再次
  執行全站 purge，Cloudflare 回報「已成功收到清除快取要求」。
- ⚠️ 正式 Chrome E2E 已通過 LINE authorize、登入/同意及 callback state/nonce 驗證，
  但 callback 目前在 Worker 查詢 Supabase `public.users` 時收到 HTTP 403，Worker tail
  明確記錄 `Supabase users lookup failed: 403`（版本同上），尚未進入 session 完成頁。
  Cloudflare secret 名稱 read-back 顯示 `SUPABASE_SERVICE_ROLE_KEY` 存在；Supabase
  管理頁對目前登入帳號顯示「You do not have access to this project」，因此無法安全查證
  或替換該密鑰。此為外部權限／secret 設定阻塞，不以猜測值折衷。

## 2026-08-08：Supabase 暫停後的本地可交付切片

- 使用者要求暫停 Supabase 專案操作；本輪未讀取、替換、部署或驗證任何 Supabase secret，
  也未執行 migration、遠端 DB write 或管理 API。
- 針對不依賴外部權限的 P1-10 前端缺口，完成 `event_fields` 參加者端表單：活動頁讀取
  既有欄位，支援五種既定型別（短文字、長文字、單選、多選、boolean），並以純函式驗證
  必填欄位與 options 白名單，再將答案傳給既有 `register_for_event(p_answers)`。
- 先寫 `src/lib/event-fields.test.ts` 觀察缺少實作的 RED，再新增
  `src/lib/event-fields.ts` 取得 GREEN；測試覆蓋缺漏必填、false boolean、單選與多選無效值。
- 驗證結果：完整 Vitest `52 passed / 1 skipped`、typecheck PASS、lint PASS、build PASS、
  smoke PASS（46 audited files）。Vite 僅保留既有 chunk size warning；Node 20 執行時有專案
  要求 Node >=22 的既有 engine warning。
- 未完成：主辦端建立／編輯 `event_fields` UI 尚未施工；此切片尚未部署，亦未宣稱真實 Supabase
  資料已能建立或送出欄位。

## 2026-08-10：LINE callback 依賴失敗的 fail-closed 修正（未部署）

- 使用者仍要求暫停 Supabase 專案操作；本輪沒有讀取、修改或驗證 Supabase 專案、secret、
  migration、遠端資料或管理 API。
- 先新增 RED 測試：模擬 `/rest/v1/users` 回 HTTP 403 時，callback 必須導回
  `line_error=account_provisioning_failed`，而不是讓 Worker 拋出 1101。
- 以最小修改完成 GREEN：Supabase admin lookup／create／upsert／generate-link 失敗統一轉成
  內部 `SupabaseAdminError(operation, status)`；callback 清除 OAuth cookies 後 fail-closed
  導回登入頁。錯誤 log 只寫 operation/status，不讀取上游 body，避免帳號資訊、schema 訊息或
  provider diagnostics 進入 Worker log。
- 前端已新增對應文案：「LINE 登入暫時無法完成帳號建立，請稍後再試」。
- 驗證結果：完整 Vitest `53 passed / 1 skipped`、typecheck PASS、lint PASS、build PASS、
  smoke PASS（46 audited files）。測試以 spy 驗證 log 僅包含預期的
  `users lookup / 403` operation/status，且不包含任何密鑰或上游 response body。
- 本切片目前只在工作樹，未部署到 Cloudflare；正式 LINE 登入仍需 Supabase 專案恢復可用後，
  重新執行真實 callback → session → app page E2E。

## 2026-08-10：恢復 Gather Supabase 權限後的最小修復

- ✅ 已在 Supabase Dashboard 的 `gather-taiwan` production 專案，以 `postgres` 角色執行
  `P2-02` 三條最小 GRANT：`service_role` 僅可對 `public.users` 的
  `id`／`line_user_id` 查詢，並對 `id`／`line_user_id`／`email`／`display_name`／
  `email_verified_at` 做必要的 insert/update；未新增 `public`、`anon` 或
  `authenticated` 的 table grant，也未修改 RLS policy。
- ✅ SQL Editor 回報 `Success. No rows returned`；同一頁 read-back 取得 17 筆
  `information_schema.column_privileges`，涵蓋上述欄位與 service_role 的必要權限。
  未讀取、記錄或輸出任何 secret 值。
- ✅ Cloudflare production Worker 的 `SUPABASE_SERVICE_ROLE_KEY` 已在變數頁以目前
  `gather-taiwan` 專案新 secret key 完成輪替並按 Deploy；值只在受控瀏覽器記憶體中傳遞，
  不進 Git、log、DOM 快照或本文件。
- ⚠️ 本地 `apps/join/supabase/migrations/20260810010000_p2_02_line_service_role_grants.sql`
  已建立並有 contract test，但本輪採 Dashboard SQL 直接套用，尚未以 CLI 方式寫入
  migration ledger；不得將 ledger 視為已同步。後續須依 migration 流程補做 ledger
  read-back 或由負責人裁決收斂方式。
- ⏳ 尚待：部署含 fail-closed 修正的 Worker source，並重新完成正式網域 LINE
  authorize → callback → session → app page E2E；在此之前不宣稱登入已恢復。

## 2026-08-10：Supabase 新式 secret key header 相容性修正

- ✅ 依 Supabase 官方 API key 文件查證：`sb_secret_…` 不是 JWT，必須只放在
  `apikey` header；若把同一值再放進 `Authorization: Bearer`，API gateway 會嘗試
  以 JWT 解析而拒絕請求。原 Worker 四個 admin request 同時送兩個 header，正是
  production callback 持續 403 的原因。
- ✅ 以最小 diff 移除 users lookup、admin user creation、public.users upsert、
  generate_link 的 `Authorization` header；保留 `apikey` 與既有 fail-closed log。
- ✅ 新增 regression assertion：所有 Supabase admin calls 必須有正確 `apikey`，且
  `authorization` 必須為空，避免日後換回新式 key 時復發。
- ⚠️ 本次修正尚未部署；下一步重新 build/deploy 後，再以正式 Chrome LINE E2E
  驗證 callback 能否進入 session 完成頁。

## 2026-08-10：前端 publishable key Bearer 相容性修正（待部署）

- ✅ callback → `/app/auth/line/complete` 已成功；前端 `verifyOtp` 顯示 `Failed to fetch`。
- ✅ Supabase 官方規則同樣適用 publishable key：它只能作 `apikey`，不能被當 JWT
  放在 `Authorization: Bearer`。在 Supabase client 的 global fetch 加入最小 header
  guard：只移除等於 publishable key 的 Bearer，真正 session JWT 保留。
- ✅ 新增兩個測試，分別驗證 bootstrap request 不送 publishable Bearer，以及登入後的
  access-token Bearer 不被誤刪。
- ⏳ 尚待重新 build/deploy，再驗證 session 完成與 `/app/` authenticated DOM。

## 2026-08-10：LINE magic-link verify 明確 API 路徑（待部署）

- ✅ SDK `verifyOtp({ token_hash })` 在正式頁仍回 `Failed to fetch`，但同一 Supabase
  verify endpoint 的 CORS／public API 可用；為消除 SDK 對 header 的不透明差異，改用
  明確的 `apikey` POST `/auth/v1/verify`。
- ✅ 收到的 access/refresh session 只立即交給 `supabase.auth.setSession`，不寫入
  自訂 storage、不記錄 token；既有 `ensureUserProfile` 與 `sync_verified_email`
  流程維持不變。
- ⏳ 尚待重新 build/deploy，再驗證 `/app/` authenticated DOM。

## 2026-08-10：CSP connect-src 阻擋 Supabase verify 修正（待部署）

- ✅ 最終根因：Worker response security header 的 CSP 僅允許 `default-src 'self'`，
  瀏覽器因此封鎖對 Gather Supabase project 的跨來源 `verify` fetch，表現為
  `Failed to fetch`；CORS read-back 本身是 200 且允許 gather.wedopr.com。
- ✅ 以最小白名單補上 `connect-src 'self' https://anklbpkyesdmsubyfcna.supabase.co`，
  未放寬 script／frame／form 來源；同步更新 response-security contract test。
- ⏳ 尚待部署後完成真正 `/app/` session E2E；此項完成前不標記登入 PASS。

## 2026-08-10：LINE 完成頁預設 redirect 修正（待部署）

- ✅ session 已建立，但 E2E 最終路徑讀回 `/app/app/`；原因是 Worker cookie 的預設
  redirect 使用了 `/app/`，React Router basename 再加一次 `/app`。
- ✅ 將 Worker 兩個 fallback redirect 統一改為 router root `/`；活動頁等顯式 redirect
  仍照原值保留。
- ⏳ 尚待部署並確認最終路徑精準為 `/app/`，且導覽列出現「我的報名／登出」。

## 2026-08-10：LINE production E2E PASS

- ✅ 先後完成並 read-back：Cloudflare cache bypass／Speed Brain off／purge、LINE
  callback URL、專案 secret 輪替、Worker source 部署、Supabase service_role 權限、
  CSP connect-src 白名單。
- ✅ 正式 Chrome E2E（fresh auth page → LINE authorize → LINE account login →
  Worker callback → Supabase verify → setSession）完成；最終 URL 精準為
  `https://gather.wedopr.com/app/`，DOM 同時讀到「我的報名」與「登出」，沒有
  `Failed to fetch`、`account_provisioning_failed` 或登入錯誤文字。
- ✅ 最終 Cloudflare Worker version：`e0ba761b-a99f-4320-8d24-c3d29a18d38a`。
- ✅ 最終本地證據：Vitest `58 passed / 1 skipped`、typecheck PASS、lint PASS、build PASS、
  smoke PASS（48 audited files）、control-log validator PASS。
- ⚠️ 本輪採 Supabase Dashboard SQL 直接套用 grant；P2-02 migration 檔已在工作樹，
  但 migration ledger 尚未以 CLI 同步，後續維運需依 DEVELOPMENT.md 收斂 ledger。
- ⚠️ 尚未做完整 LINE 失敗矩陣（拒絕、無 email、incognito、過期 state/nonce、第二帳號）；
  本次只宣稱正常授權登入 PASS。

## 2026-08-10：LINE email collision 的冪等 fallback

- ✅ Production tail（以固定訊息篩選）讀回：`admin user creation`，HTTP `422`。
  這不是 header 403；是 LINE 回傳 email 已被既有 Auth user 佔用，原流程沒有碰撞分支。
- ✅ Worker 新增最小 recovery：第一次以 LINE email 建立失敗且 status=422 時，改用
  `line+<line_user_id>@users.noreply.gather.wedopr.com` 建立獨立 auth user；該地址只作
  server-side auth identity，不對參加者宣稱為其 email。既有 public profile 仍保存 LINE
  回傳的 email 與 verified 布林值，並維持原付款／年齡紅線。
- ✅ 已加 `admin user lookup` 讓既有 `line_user_id` 重新登入時以 Auth 實際 email
  產生 magic link，不依賴使用者可編輯的 profile 欄位。
- ⏳ 尚待重新測試、部署並以正式 Chrome E2E 驗證。

## 2026-08-10：public.users upsert 權限補強（待遠端套用）

- ✅ Production tail 讀回第二個明確失敗點：`public.users upsert`，HTTP `403`。
- ✅ Worker upsert 明確加入 `return=minimal`，避免不必要的 row representation 權限要求。
- ✅ P2-02 forward-only migration 補上 backend upsert 所需的非敏感 profile 欄位
  `email_normalized`／`email`／`display_name`／`email_verified_at` SELECT 權限；仍未授予
  `public`、`anon`、`authenticated`，也未開放 legal_name、birth_date、phone 等欄位。
- ⚠️ 本地 migration 已更新，但 production 目前仍是前一版 grant；必須在 Supabase
  SQL Editor 套用一條補充 GRANT 並 read-back，再重試 E2E。

## 2026-08-10：中文主辦名稱建立失敗修正

- 觸發：使用「泰山高中同學會」建立主辦身份，畫面顯示「建立主辦身份失敗」。
- 真實重現：正式 Supabase 交易內以 synthetic authenticated user 呼叫
  `create_organizer('泰山高中同學會-ab12', '泰山高中同學會')`，回傳
  `organizer_slug_format` check constraint violation；同一交易驗證 ASCII slug 可成功建立並查回名單。
- 排除：正式 `create_organizer` RPC 存在；`authenticated` 有 EXECUTE、`anon` 無 EXECUTE；P1-04 RLS verifier 9/9 PASS。未修改遠端權限或資料。
- 根因：前端 `slugify` 錯誤保留中文，但 DB slug 契約只允許 ASCII `[a-z0-9-]`。
- 變更：新增 `src/lib/slug.ts`；organizer slug 限制 63 字元、event slug 限制 95 字元；純中文名稱使用 ASCII fallback 加短隨機尾碼；新增 slug contract tests。
- 驗證：先 RED 後 GREEN；完整 Vitest `61 passed / 1 skipped`、security 14 passed、typecheck/lint/build/smoke（51 audited files）PASS。
- ⚠️ 正式網域尚未部署本次修正；部署前不得宣稱使用者實測已恢復。
- 回滾：回滾本次 `slug.ts`、`EventCreatePage.tsx`、`slug.test.ts` 及本紀錄即可，未涉及 schema、Auth 或付款資料。

## 2026-08-10：7f7968b 正式部署完成

- ✅ Git commit `7f7968b` 已推送至 `origin/codex/gather-mvp`，工作樹乾淨。
- ✅ Cloudflare Worker `gather-join` 已部署，Version ID：`a71cf662-2119-4f97-9b03-2f6b3d92d332`，route：`gather.wedopr.com/app/*`。
- ✅ 正式 read-back：`/app/`、`/app/auth` HTTP 200；新版 CSS/JS 資產 HTTP 200；CSS 含 `max-width:900px`／`menu-toggle`，JS 含 ASCII slug fallback。
- ✅ 本次沒有 migration、Supabase 權限、Auth、Cloudflare secret 或付款資料變更。
- ⚠️ 實體 iPad 觸控尚未取得錄影；需使用者重新整理正式頁面後實測漢堡選單與中文主辦身份建立。

## 2026-08-10：iPad 直式 TopNav 漢堡選單修正

- 觸發：iPad 直式瀏覽時，右上方沒有可操作的漢堡選單。
- 根因：`TopNav` 原本只有水平連結，沒有 menu toggle、開關狀態或 compact breakpoint；不是按鈕被裁切。
- 變更：`TopNav.tsx` 新增可存取的 toggle（`aria-expanded`／`aria-controls`）、展開／收合狀態與點擊連結後關閉；`styles.css` 在 `max-width: 900px` 顯示 44px 觸控按鈕及右側選單面板；新增 `TopNav.test.tsx` 契約測試。
- 驗證：導覽測試先 RED 後 GREEN；完整 Vitest `59 passed / 1 skipped`、typecheck、lint、build、smoke（49 audited files）PASS；build bundle 已包含 `max-width: 900px` 與 `menu-toggle` 規則。
- ⚠️ 實體 iPad 觸控與旋轉尚未在本輪取得裝置錄影；正式網域尚未因本輪變更重新部署。
- 回滾：回滾本次三個檔案的 commit 即可，未涉及資料庫、Auth、Cloudflare 或使用者資料。

## 2026-08-10：建立活動表單與活動分享體驗（待部署）

- ✅ 日期／時間改為獨立日期欄位與 24 小時制時／分選單；以 Asia/Taipei 組合 ISO，預設當日
  18:30–21:30，若當日活動時段已過則順延翌日，避免送出過去時間。
- ✅ 費用改為 `text`＋`inputMode=numeric`，只保留數字字元，不使用瀏覽器上下微調器；仍維持主辦人自行收款、平台不代收的邊界。
- ✅ 地點名稱改為必填；活動頁提供 Google Maps 搜尋連結、複製活動連結、原生分享與分享到 LINE。
- ✅ 報名工具導覽改為「聚場台灣／來聚一場」品牌鎖定，新增主站連結與一致的深色頁尾。
- ✅ 新增 `gather-feedback-implementation-plan.md` 與 `apps/join/docs/LINE-MESSAGING-PHASE2.md`，記錄本輪驗收與 LINE 對話管理未施工邊界。
- ✅ 本地驗證：Vitest `67 passed / 1 skipped`、typecheck PASS、lint PASS、build PASS、`git diff --check` PASS。
- ⚠️ 尚未部署；尚未完成 Messaging API webhook、LINE 推播、Rich Menu／LIFF 與對話管理 E2E。依 D-2 Pilot 仍以 email＋站內通知為準。
- 回滾：僅涉及 `apps/join/src` 前端與文件，未修改資料庫、Supabase 權限、LINE Developers 或 Cloudflare production 設定。

## 2026-08-10：eb2b630 正式部署完成

- ✅ Git commit `eb2b630` 已推送至 `origin/codex/gather-mvp`。
- ✅ Cloudflare Worker `gather-join` 已部署，Version ID：`967c1185-b4c6-48cc-8aae-602569261ab6`，route：`gather.wedopr.com/app/*`。
- ✅ 正式 read-back：`/app/` HTTP 200；新資產 `index-U3D3piE0.js`、`index-dwh2bXzo.css` HTTP 200；JS 含「分享活動／台北時間／LINE」，CSS 含 `date-time-field`、`event-share`、`site-footer`、`brand-lockup`。
- ⚠️ 正式環境尚未以實體 iPad／手機完成建立活動表單、Google Maps、原生分享與 LINE 分享的實際觸控 E2E；LINE Messaging API 對話管理仍未施工。

## 2026-08-10：4369e96 24 小時格式修正部署

- ✅ Git commit `4369e96` 已推送至 `origin/codex/gather-mvp`；Cloudflare Worker 最新 Version ID：`ecc053d0-47e3-4420-87f6-c0687819f0bc`。
- ✅ 以快取繞過 query read-back：`/app/?v=4369e96` 回傳新資產 `index-BE2VP-KJ.js`，且資產內容含 24 小時分享格式。
- ⚠️ 不帶 query 的 `/app/` 仍由 Cloudflare edge 回傳前一版 `index-U3D3piE0.js`；匿名 PURGE 回應 400，尚未取得 purge API／Dashboard 操作證據。完成 purge 前，不宣稱所有無 query 使用者已切換新資產。

## 2026-08-10：活動頁 v2／日期編碼分享／名單管理（待部署）

- ✅ 活動頁改為手機優先的 Warm Minimalism 版型：預設 HERO、活動摘要、時間、Google Maps 地點、費用、人數上限與一致的分享按鈕；分享到 LINE 使用完整活動文案，不再只傳活動網址。
- ✅ 分享文案包含活動主題、摘要、台北時間（24 小時制）、Google Maps Markdown 地點連結、地址、費用、人數上限與活動網址。
- ✅ 新建立活動的 slug 改為帶日期的可讀格式（例如 `event-20260817-xxxx`）。日期只改善辨識與分享，不作為私密活動授權；既有活動 slug 不變。
- ✅ 新增系統預設 HERO 素材 `apps/join/public/assets/gather-event-hero-default-v1.png`（1672×941，無文字／Logo／可辨識人物）；主辦人自訂 HERO 尚未施工。
- ✅ 名單管理新增總人數、已確認、未確認、邀請中、候補統計，並保留手動名單聯絡方式；線上報名不自動揭露 `users` 的手機／Email／LINE 身分，避免跨使用者隱私越權。
- ✅ 本地驗證：Vitest `69 passed / 1 skipped`、typecheck、lint、build、smoke（58 audited files）、`git diff --check` PASS；build 已輸出 HERO asset。
- ⚠️ 尚未部署；本輪未修改 Supabase migration、Storage、RLS、Auth、LINE Developers 或 Cloudflare 設定。自訂 HERO 與參加者自填聯絡欄位需另行核准資料模型／RLS 後施工。
- ⚠️ Vite dev server 在本執行環境因 `listen EPERM` 無法啟動，未取得瀏覽器／實體手機 screenshot E2E；不能以本地 build 代替行動裝置驗收。
- 回滾：回滾本輪前端、素材與文件變更即可，未涉及遠端資料庫或使用者資料。

## 2026-08-10：613a951 正式部署完成

- ✅ Git commit `613a951` 已推送至 `origin/codex/gather-mvp`。
- ✅ Cloudflare Worker `gather-join` 已部署，Version ID：`41fb93c1-3da2-4509-9743-f56ad57f1d2d`（Wrangler deployment read-back）。
- ✅ 帶 cache-busting query 的正式 HTML 回傳新資產 `index-CuHTGEct.js`／`index-BhNlHoS5.css`；`/app/assets/gather-event-hero-default-v1.png` 回傳 `image/png`、1672×941。
- ⚠️ Cloudflare edge 對不同 query 仍可能命中舊 HTML（例如 `deploy=613a951` 與 `v=613a951` 命中不同資產）；尚未取得 purge API／Dashboard 操作證據，因此不宣稱所有無 query 使用者已立即切換。
- ⚠️ 未做 Supabase migration、Storage、RLS、Auth、LINE Developers 設定變更；自訂 HERO、參加者自填手機／Email／LINE 與 LINE Messaging 對話管理仍是後續工作。

## 2026-08-10：主辦活動入口補齊（待部署）

- ✅ 根因確認：導覽列原本只有「我的報名」（參加者清單），沒有主辦活動查詢路由；建立活動後只靠當下活動網址回到管理頁。
- ✅ 新增 `/me/hosting` 主辦人工作區與 `getMyHostedEvents()`；依目前登入者所屬 organizer membership 讀取其可管理活動，保留 RLS 權限邊界。
- ✅ 登入後 TopNav 新增「我發起的活動」；每場列出公開狀態、時間、地點、人數，並提供「管理活動」與「查看活動頁」入口。
- ✅ 未登入訪問會導向登入，登入後回到 `/me/hosting`；無活動時提供「發起一場聚會」入口。
- ✅ 本地驗證：Vitest `69 passed / 1 skipped`、typecheck、lint、`git diff --check` PASS。
- ✅ Git commit `f5bc9bf` 已推送至 `origin/codex/gather-mvp`；Cloudflare Worker `gather-join` Version ID：`01dea043-b65c-4793-a1d2-c64d047a99d9`。
- ✅ 帶 cache-busting query 的正式 HTML 已讀回新版資產；本次未修改 Supabase schema、RLS、Auth 或資料內容。
- ⚠️ Cloudflare edge cache 仍可能讓無 query 的 HTML 暫時命中舊版本；若看不到新入口，請重新整理或使用無痕視窗。

## 2026-08-10：聚場台灣前台體驗重設（待部署）

- ✅ 依 Gather Taiwan 品牌設定重寫前台語氣：以「相招，聚一場。」、一張桌、早餐店鐵板聲、港邊海風、中秋炭香與熱炒碰杯聲作為首頁與聚會頁的場景基底；移除「工作區、流程、資訊密度、管理面板」等內部治理語言。
- ✅ 新增手機優先互動骨架：跳到主要內容、水平滑動內容導覽、手機底部主要操作列、sticky 建立按鈕、可展開「替朋友留名」、報名／聚會篩選 tabs。
- ✅ 活動頁、建立聚會、我發起的聚會、我參加的聚會、名單區與首頁套用同一套 Warm Minimalism 視覺規則；桌機保留高資訊密度，iPad 直式與手機改為單欄與可滑動控制。
- ✅ 加入 touch-action、focus-visible、aria-live、skip link、scroll margin、prefers-reduced-motion 與 HERO 圖尺寸宣告，對齊 Web Interface Guidelines。
- ✅ 本地驗證：Vitest `69 passed / 1 skipped`、typecheck、lint、build、smoke（59 audited files）、`git diff --check` PASS。
- ⚠️ 尚未部署；本輪未修改 Supabase、LINE、付款資料或任何使用者資料。瀏覽器／實機 screenshot E2E 仍受本環境 Vite `listen EPERM` 限制，需部署後以手機、iPad 直式與桌機橫式再驗收。

## 2026-08-10：5f455de 聚場台灣前台體驗重設部署完成

- ✅ Git commit `5f455de` 已推送至 `origin/codex/gather-mvp`。
- ✅ Cloudflare Worker `gather-join` 已部署，Version ID：`290529fc-5443-454c-9a06-cc669b2ca867`。
- ✅ 新 JS `index-keRCsIuJ.js` 與 CSS `index-BN21jZCo.css` 已由正式資產端點讀回；JS 含「相招，聚一場。」「我發起的聚會」「一起來的人」「替朋友留名」，CSS 含 `mobile-action-dock`、`section-rail`、`scroll-tabs`。
- ⚠️ Cloudflare edge 仍可能讓首頁 HTML 暫時命中前一版資產；本次未操作 purge。若看不到新版，請重新整理、使用無痕視窗，或等待 edge cache 更新。
- ⚠️ 尚未取得實體手機／iPad／桌機 screenshot E2E；本環境 Vite dev server 仍受 `listen EPERM` 限制。Supabase、LINE、付款資料與使用者資料均未修改。

## 2026-08-10：桌機橫式 RWD 修正（待部署）

- ✅ 根因：`main` 與 `.page--wide` 仍沿用 680／920px 的早期窄欄寬度，桌機橫式右側產生大面積空白；建立頁沒有利用寬螢幕做即時聚會摘要。
- ✅ 桌機 `page--wide` 放寬至 1480px；建立頁改為「填寫區＋右側固定聚會預覽」雙欄，預覽會即時呈現主題、時間、地點、席次與到場費用。
- ✅ 手機／iPad 維持單欄，預覽降至表單下方；不以桌機雙欄硬縮小，避免直式瀏覽橫向溢出。
- ✅ 本地驗證：Vitest `69 passed / 1 skipped`、typecheck、lint、build、smoke（59 audited files）、`git diff --check` PASS。
- ⚠️ 尚未部署；仍未取得實體裝置 screenshot E2E。Supabase、LINE、付款資料與使用者資料未修改。

## 2026-08-10：8a4f72b 桌機橫式 RWD 修正部署完成

- ✅ Git commit `8a4f72b` 已推送至 `origin/codex/gather-mvp`。
- ✅ Cloudflare Worker `gather-join` 已部署，Version ID：`f4732d6b-da00-4482-97b6-4f46c4389b2f`，route：`gather.wedopr.com/app/*`。
- ✅ 正式資產回讀：`index-Vxjiv3a7.js` 含 `create-form__aside`、`create-preview`、`桌邊先放一張椅子`；`index-BmR1k1jj.css` 含 `create-form`、`create-preview`、`page--wide`。
- ✅ `/app/events/new?deploy=8a4f72b` HTTP 200；回應仍含既有 CSP、`cache-control: no-store` 與 `x-content-type-options: nosniff`。
- ⚠️ Cloudflare edge 對不同 query 仍可能回傳不同 HTML／資產版本（例如 `deploy=8a4f72b` 可讀本版、其他 query 仍可能命中前版）；尚未取得 purge API／Dashboard 操作證據，因此不宣稱所有無 query 使用者已立即切換。
- ⚠️ 尚未取得實體手機／iPad／桌機 screenshot E2E；本環境 Vite dev server 仍受 `listen EPERM` 限制。Supabase、LINE、付款資料與使用者資料未修改。

## 2026-08-10：聚場地圖 × 來聚一場公開活動整合（待部署）

- ✅ 採用決策：聚場地圖顯示公開、已發布、尚未結束的活動；只顯示主題、日期／時間、地點與人數，不顯示主辦人與參加者名單。
- ✅ 新增同源 Worker endpoint `/app/api/public-events`，固定 allowlist 回傳 `slug`、`title`、`starts_at`、`ends_at`、`location_name`、`location_address`、`capacity`；不接受寫入，非 GET 回傳 405。
- ✅ 聚場地圖新增「正在相招」活動區塊，活動卡以安全文字節點渲染，點擊後進入來聚一場活動頁；查無活動或 endpoint 暫時不可用時，顯示明確狀態文案。
- ✅ 全站靜態頁的平板／手機導覽觸發點提前至 1100px，並增加 coarse pointer 1180px 防線，修正 iPad 直式可能採用 desktop viewport 時漢堡按鈕不出現的問題；同步加入「聚場地圖／發起一場聚會」入口。
- ✅ `月光開烤` 共享語彙已定義為廣義燒肉聚會，涵蓋燒肉店、串燒店、日式居酒屋與韓式烤肉；中秋與月光是氣氛，不是限制條件。語彙記錄於 `CONTEXT.md`。
- ✅ 驗證：typecheck PASS、lint PASS、Vitest `71 passed / 1 skipped`、build PASS、smoke（59 audited files）PASS；五個靜態頁 inline JS 與 nav-toggle 語法檢查 PASS。
- ⚠️ 尚未部署；本輪未修改 Supabase migration、RLS、Auth、LINE、付款資料或使用者資料。實體手機／iPad／桌機 screenshot E2E 仍需在正式網域完成。

## 2026-08-10：活動分享文案純文字化（待部署）

- ✅ `getEventShareText()` 改為 LINE／原生分享／複製內容共用的純文字格式，不再輸出 Markdown 粗體或 Google Maps 超連結。
- ✅ 分享訊息固定包含：活動主題、簡介、時間、地點名稱、地址、費用、人數上限，以及「想參加，請點此連結」的活動頁網址。
- ✅ 活動頁上的地點仍保留可點擊的 Google Maps 入口；只有分享訊息移除地圖超連結，避免 LINE 預覽出現過長 URL。
- ✅ 原生分享改為只傳一份純文字邀請，避免同時傳 `text` 與 `url` 造成部分 LINE／iPad 分享目標重複顯示活動網址。
- ✅ 測試補上純文字與無 Markdown／無 Maps URL 驗收；typecheck、lint、Vitest `71 passed / 1 skipped`、build、smoke 均 PASS。
- ⚠️ 尚未部署；實際 LINE 客戶端換行與自動辨識活動網址仍需正式環境 E2E。

## 2026-08-10：iPadOS 桌面模式漢堡導覽修正部署

- ✅ 外部只讀稽核確認根因：導覽切換只依賴 viewport／pointer media query；iPadOS 桌面模式可能回報桌面 viewport，導致 `.nav-toggle` 維持 `display:none`。
- ✅ 靜態主站五頁加入觸控能力早期標記 `data-touch-nav` 與抽屜導覽 fallback；來聚一場 React `TopNav` 同步加入 `.touch-nav` fallback。桌機仍保留完整橫向導覽。
- ✅ `0e0c7f5` 的 `max-width:1366px` 平板 fallback 保留；本次 commit `a67d38d` 已推送至 `origin/codex/gather-mvp`。
- ✅ Worker production version `45b790b8-bf59-40d5-a090-b8925d88d8f7` 已部署至 `gather.wedopr.com/app/*`。
- ✅ Cloudflare Pages production deployment `22527b61-ce76-4ca9-9225-ec8365bd43a2`（source `a67d38d`）已部署；`/`、`/gatherings/` 正式 HTML 回讀 `navigator.maxTouchPoints` 與 `html[data-touch-nav]`；`/app/` 回讀 `index-s6CRvfvH.css`。
- ✅ 驗證：typecheck、lint、Vitest `71 passed / 1 skipped`、build、static touch-nav contract、`git diff --check` PASS。
- ⚠️ 尚未取得實體 iPad screenshot E2E；請在正式網域強制重新整理一次，並分別驗證直式／橫式右上角漢堡可見、可開啟、可關閉。若仍看到舊版，先使用無痕視窗再回報當下 URL 與 Safari 是否開啟「要求桌面版網站」。

## 2026-08-15：canonical seat-engine B 與社群 metadata hardening

- ✅ 依已取得授權套用 forward-only migration
  `20260815040000_canonical_seat_engine_direct_update_revoke_b`；正式 ledger 已含
  `20260814175513`、`20260815030000` 與 B migration。
- ✅ 遠端 read-back：`events.capacity`、`invite_reserved_seats`、`invite_pool_deadline`、
  `invite_pool_released_at` 對 `anon`／`authenticated` 均無 direct UPDATE；
  `update_event_capacity_settings(uuid,text,integer,integer,timestamptz)` 僅 authenticated
  可執行，anonymous direct DML 回傳 `permission denied for table events`。
- ✅ Worker／前端 version `e0fcc0c2-c834-480b-b9d3-424783e20b19` 已部署至
  `gather.wedopr.com/app/*`；活動頁 GET HTTP 200、`X-Robots-Tag: noindex, nofollow`，
  OG／Twitter 活動事實一致。
- ✅ 活動自訂代表圖可能不是 1200×630，Worker 已移除未量測的固定 `og:image:width`／height
  宣告；新增 Worker regression test。正式活動頁 read-back 未再出現錯誤尺寸 metadata。
- ✅ Node 22 gates：typecheck、lint、Vitest `119 passed / 1 skipped`、build、smoke 全部通過；
  skip 為缺少測試 DB URL 的真實 concurrency suite，不列為 PASS。
- ✅ commit `314f6bf`（canonical hardening）與 `19b9101`（social metadata hardening）已
  推送至 `origin/codex/gather-mvp`，目前工作樹乾淨。
- ⚠️ 文化主站首頁仍由獨立 Cloudflare Pages 提供；本輪已透過 Git integration 發布 metadata
  修正並完成正式 read-back。LINE failure matrix、第二獨立帳號與 Cloudflare Access staging
  仍未完成；event_fields 依本輪裁決不納入。

## 2026-08-15：文化主站首頁社群 metadata read-back

- ✅ `index.html` 的一般 description、`og:description`、`twitter:description` 已統一。
- ✅ Git integration Pages deployment source `b3c1bf7` 已建立；正式 `https://gather.wedopr.com/`
  HTML read-back 三組 description 完全一致。

## 2026-08-15：Orion Closure Squad／Wave 0 啟動

### Goal

- 以 `聚場台灣 Orion Closure Squad`、T1 orchestrator-workers 與目標模式，建立 Wave 0–6 的可重啟控制面。
- Wave 0 先收束 manual roster P0：固定 app／DB／Worker／Git／CI 證據層級，確認既有 wrapper／RPC 契約，並為 Wave 1 Release baseline 與 Wave 2 線上報名者管理留出最小 allowlist。

### Non-goals

- 本段不施工 event_fields、不新增登入／通知／金流／名單政策、不改真實 DB、不直接改 `auth.users`，不執行 deploy、rollback、commit 或 push。
- 不把文件、local build、Worker read-back 或既有 production evidence 擴寫成 remote DB、GitHub CI、staging、device 或 Pilot PASS。

### Explicit authorization and hard-risk gate

- MING 已由本次提示詞明確授權：唯讀／測試／瀏覽器 QA；本 repo code／test／docs／migration；相容 dependency patch；隔離 worktree；明確 allowlist commit／push／PR；CI＋Fresh 通過後 merge；合格 forward-only migration；既有 Worker／Pages deploy／rollback；以上不需重問，仍須留下 evidence。
- hard-risk gate confirmation 已由本提示詞提供。六類 MING hard stop 逐字收錄於 `docs/squad/CHARTER.md`：刪覆／不可逆正式資料、破壞性 DB 操作、產品定位、法律／隱私／費用／品牌、新 secret／2FA／LINE／Cloudflare／Supabase Console owner 操作、真實資料損壞且修復影響使用者。

### Affected candidates and absolute boundaries

- 候選檔案／系統：`docs/squad/CHARTER.md`、`docs/squad/LEDGER.md`、`implementation-control-log.md`；Wave 1 候選為 `apps/join/scripts/smoke.mjs`、`smoke-staging.mjs`、CI gate 與最小 mutation test；Wave 2 候選為 manual／online registration RPC、API wrapper、主辦名單 UI 與 verifier。
- 絕不觸碰：本段以外的程式／SQL／資產、event_fields、付款模型、LINE／Cloudflare／Supabase Console owner 設定、secrets／2FA、真實資料與 `auth.users`；不得 `git add -A`。

### Wave 0 acceptance and evidence

- Acceptance：Atlas fixed point done／acceptance pending；LOCAL Git clean、local refs `50 ahead / 0 behind`、Node `24.15`、pnpm `10.33.2`；production Worker version `e0fcc0c2-c834-480b-b9d3-424783e20b19`、route `gather.wedopr.com/app/*`、assets／headers read-back PASS；GitHub `BLOCKED`、remote DB `NOT_RUN`。
- DB discovery done／acceptance pending：三個 Wave 2 RPC 缺口為主辦人對線上報名者 confirm、decline、remove；最小 allowlist 為 forward-only migration（狀態／ACL／RLS／audit／席次／通知不變量）＋API wrapper／UI／測試／rollback verifier。
- APP discovery done／acceptance pending：manual roster 為前端 Supabase wrapper，Worker 無 roster API；Wave 0 app 不改。manual `user_id is null` 沒有 recipient，不造 outbox。
- Evidence labels：`STATIC`、`LOCAL`、`CI`、`STAGING`、`PRODUCTION`、`DEVICE`、`NOT_RUN`；Fresh Reviewer 尚未驗收，pending 不得改寫成 PASS。

### Rollback and decisions

- Rollback：後續 corrective migration＋既有 Worker version 回退；本段尚未執行 rollback。
- AI decisions：Wave 0 app 不改；event_fields 排除；manual null recipient 不造 outbox；Wave 1 先修 hermetic smoke／Release baseline，再進 Wave 2 三個 online-registration RPC 缺口。
- Blockers：GitHub workflow／CI read-back `BLOCKED`；remote DB read-back `NOT_RUN`；W0-FRESH pending。Echo 已由 needs-correction 修正為 done，Forge-DB implementation in-progress。

## 2026-08-15：Wave 0 Fresh decision — REJECT

### Decision

- Fresh 結論：**needs-correction／REJECT（P0=0、P1=6）**。普通 LOCAL typecheck／lint／test／security／build／smoke 即使全綠，也只能證明一般 gate，不能抵銷 manual roster semantic REJECT。
- Wave 0 不得關閉、不得進 Wave 1；Forge-DB correction 維持 `in-progress`，完成後須由 fresh context 重驗。

### P1 findings

1. **state transition**：狀態轉移語意尚未形成可接受的 fail-closed contract。
2. **confirmed insert**：confirmed insert 路徑尚未證明受同一席次不變量保護。
3. **total＋pool capacity**：總容量與 pool 容量必須同時約束，現有證據不足。
4. **FIFO 插隊**：manual roster 不得繞過既有候補 FIFO 順序。
5. **鎖序 deadlock**：鎖取得順序仍有 deadlock 風險，需固定鎖序並補 concurrency evidence。
6. **negative verifier aborted transaction**：預期錯誤令 transaction aborted，後續斷言失效；負向 verifier 必須以 savepoint／rollback 隔離。

### P2 follow-up

- **concurrency zero-residue**：併發 verifier 結束後必須讀回 synthetic fixture 零殘留。
- **audit snapshot**：補 before／after audit snapshot，證明狀態、席次與 actor 記錄一致。

### Corrective plan and evidence boundary

- Forge-DB 依最小 allowlist 修正 migration／verifier／package wiring；先跑 focused semantic／mutation cases，再跑普通 LOCAL gates，最後交 Fresh 重驗。
- DB runtime、remote DB、production 均為 `NOT_RUN`；GitHub／CI 為 `BLOCKED`。不得用 LOCAL green、歷史 Worker production evidence 或文件 read-back 代替。
- rollback 尚未執行。本輪沒有套用 remote migration 或部署 Worker；若後續已套用 migration 才發現問題，只能新增 corrective forward-only migration，Worker 則回退至既有已驗證版本。

## 2026-08-15：Wave 0 Fresh2 decision — REJECT／correction round 3

### Decision

- Fresh2 結論：**needs-correction／REJECT（P0=0、P1=3、P2=2）**。Wave 0 維持開啟，Forge-DB correction round 3 為 `in-progress`。
- 普通 LOCAL gates 綠燈仍不能抵銷 semantic REJECT；DB runtime／remote／production 維持 `NOT_RUN`，GitHub／CI 維持 `BLOCKED`。

### P1 findings

1. **deadlock retry**：retry 契約仍未形成可接受的可重跑證據。
2. **managed `auth.users` DML**：correction／verifier 仍碰到 managed `auth.users` 直接 DML 邊界。
3. **trim／audit 不實**：trim 與 audit snapshot 未如實反映實際持久化的 before／after 值。

### P2 follow-up

- **concurrency params**：concurrency verifier 的參數與預期結果仍需完整斷言。
- **台帳未同步**：correction round、驗證狀態與台帳 evidence 尚未同步；本段與 LEDGER 已開始修正，但仍待 Fresh3 驗收。

### Correction round 3 and stop rule

- Forge-DB round 3 僅修正上述 P1×3、P2×2，完成 focused semantic／mutation evidence 與普通 LOCAL gates 後交 Fresh3。
- 若 Fresh3 再出現同類 P1，立即停止疊加 patch，回到 Orion 架構裁決；未裁決前不得以更多局部 migration／verifier patch 推進。
- rollback 尚未執行；本輪沒有 remote DB、production 或 CI 執行證據。

## 2026-08-15：Wave 0 Fresh3 decision — REJECT／Orion architecture replacement

### Decision

- Fresh3 結論：**needs-correction／REJECT（P0=0、P1=2）**。Fresh、Fresh2、Fresh3 前三輪普通 LOCAL gates 即使全綠，也不能抵銷 semantic REJECT。
- Forge-DB correction round 3 停止疊加局部 patch，改由 Orion 已裁決的 architecture replacement 推進，狀態為 `in-progress`。

### P1 findings

1. **invite pool bypass**：manual／invite 路徑仍可繞過 invite pool 的共用容量邊界。
2. **promotion audit actor／usage**：promotion audit 尚未同時保存正確 actor 與實際 capacity usage。

### Orion architecture decision

- 採 backward-compatible capacity envelope：`event_capacity_usage` 保留既有 keys，新增 `limits`、`available`、`within_limits`、`merged`，避免破壞既有 caller。
- manual／invite 保留各自狀態機，但統一使用同一 capacity envelope；token verifier 必須讀回 after-state 並驗證 rollback；promotion 改用 actor-aware core，另保留 2-arg wrapper 作為相容入口。
- 選擇理由：繼續增加局部 `if` 會讓容量規則跨路徑漂移；萬能 candidate helper 則過度抽象，帶來較高相容風險。

### Migration branch and evidence boundary

- 若 `20260815060000_manual_roster_capacity_seat_engine_fix.sql` 尚未套用，直接在原檔收斂；若 remote migration ledger 讀回顯示已套用，改新增下一支 forward-only corrective migration。Remote ledger 尚未讀回，不預先宣稱任何分支成立。
- DB runtime、remote DB、production 仍為 `NOT_RUN`；GitHub／CI 仍為 `BLOCKED`。本段未執行 DB、migration、deploy、rollback、commit 或 push。

## 2026-08-15：Migration-list false alarm 解除

### Evidence correction

- `supabase migration list --local` 的 `Local` 欄代表 filesystem migration 是否存在；只有 `Remote` 欄代表目標 DB 的 applied 狀態。`Local` 欄不得作為 remote apply 放行證據。
- 直接唯讀查詢目標 DB catalog `supabase_migrations.schema_migrations`，`20260815060000` 結果為 `MISSING`；因此該 migration 尚未套用，可繼續修改原 untracked `20260815060000_manual_roster_capacity_seat_engine_fix.sql`。
- 這只解除 migration-list false alarm，不代表 DB runtime／remote migration／production PASS。正式 remote 套用前仍必須重新取得 remote migration ledger 與目標 function definitions read-back。

### Work status

- Forge-DB architecture replacement 恢復 `in-progress`，依 Orion backward-compatible capacity envelope 裁決繼續收斂原 migration。
- GitHub／CI 仍為 `BLOCKED`；DB runtime／remote migration／production 仍為 `NOT_RUN`。本段沒有寫入敏感值，也未執行 migration、deploy、rollback、commit 或 push。

## 2026-08-15：Wave 0 Fresh4 decision — REJECT／Orion conservative identity

### Decision and P1 findings

- Fresh4 結論：**needs-correction／REJECT（P1=2）**；普通 LOCAL gates 不能抵銷 identity／cardinality semantic REJECT。

1. **manual／invite mutable `display_name` dedupe**：可變姓名不得作為 identity 或 capacity 去重鍵，rename 不得改變 usage。
2. **多重同名 cardinality**：不同人的同名資料不得被折成單一 seat；`registration` 與 `attending` invite 必須各自計席。

### Orion conservative identity decision

- MING 原計畫在 Wave 3 才建立 explicit linkage，且不得只靠 `display_name`；Wave 0 不提前引入推測性身份關聯。
- Wave 0 移除姓名去重，讓 registration 與 attending invite 各自計席，並保證 rename 不改 usage；保守高估優先於 oversell。
- Forge-DB 維持 `in-progress`，依此裁決修正原未套用 migration 與 verifier，完成後交 fresh-context 重驗。

### Pre-apply hard stop and evidence boundary

- 正式 apply 前只執行 aggregate-only preflight，不讀出或保存個人明細。若任何既有 event 在保守計量下超額，或後續修復將影響真實使用者，命中 MING hard stop，必須停止並回報裁決。
- DB runtime／remote migration／production 仍為 `NOT_RUN`；GitHub／CI 仍為 `BLOCKED`。本段未執行 DB、migration、deploy、rollback、commit 或 push。

## 2026-08-15：Wave 0 Fresh5 decision — REJECT／reader consistency

### Decision and P1 finding

- Fresh5 結論：**needs-correction／REJECT（P1 reader consistency）**。RSVP canonical total 與 private invitation reader 的 reload 容量數字不一致。
- 根因是 private invitation reader 仍沿用舊 `display_name` dedupe；舊 guest verifier 又固化舊數值，因此未能偵測 reader 與 canonical total 的漂移。

### Correction boundary

- Correction 只讓 private invitation reader 的容量 facts 讀取 capacity envelope，並將最小 guest verifier assertion 改為驗證 canonical total 與 reload reader 一致。
- 名單呈現、公開／私密政策與其他產品行為不改；不得藉 reader consistency 擴大 Wave 0 scope。
- Forge-DB 維持 `in-progress`，完成 correction 後交 fresh-context 重驗。

### Evidence boundary

- DB runtime／remote migration／CI／production 仍為 `NOT_RUN`；GitHub 仍為 `BLOCKED`。本段未執行程式／migration 修改、DB、deploy、rollback、commit 或 push。

## 2026-08-15：Wave 0 Fresh6 decision — REJECT／verifier evidence

### Decision and P1 findings

- Fresh6 結論：**needs-correction／REJECT（P1×2）**。

1. **capacity verifier actor fixture**：random UUID 被誤標為 staff，實際只證明 non-member；correction 改用 explicit member ID，並將案例正名為 non-organizer。
2. **guest verifier rollback residue**：rollback 後缺少逐表 zero-residue read-back；correction 必須逐表證明 synthetic fixture 無殘留。

### Evidence boundary

- Migration source 其餘 semantic checks 為 PASS，但只代表局部 source evidence，不等於 Fresh acceptance、Wave 0 closure、DB runtime 或 remote evidence。
- Forge-DB 維持 `in-progress`；DB runtime／remote migration／CI／production 均為 `NOT_RUN`，GitHub 仍為 `BLOCKED`。本段未執行程式／migration 修改、DB、deploy、rollback、commit 或 push。

## 2026-08-15：Wave 0 Fresh7 acceptance／isolated runtime in-progress

### Acceptance

- Fresh7 結論：**ACCEPTED（STATIC／LOCAL-code，P0=0、P1=0）**。
- Node 24 evidence：`51/51`、`173 passed / 1 skipped`、`14/14`、build PASS。Skipped case 不得視為 DB runtime 證據。
- 此 acceptance 不包含 DB runtime、CI、remote DB 或 production；各層仍為 `NOT_RUN`，GitHub 仍為 `BLOCKED`，Wave 0 尚未關閉。

### Isolated runtime plan

- Forge-DB 維持 `in-progress`。runtime 使用獨立 `project_id`、專用 port range 與 temporary root，不啟停、重設、重用或污染 existing stack。
- Synthetic identities 只透過 Admin API 建立與清理，不直接對 managed `auth.users` 執行 DML。
- Runtime gates：capacity、concurrency、guest 三個 verifiers；migration catalog read-back；function／table ACL；RLS；aggregate-only preflight；最後逐項 cleanup 與 zero-residue read-back。
- 任一 gate 未完成或 cleanup 有殘留即不得宣稱 runtime acceptance。本段只記錄方案，未執行 DB、deploy、rollback、commit 或 push。

## 2026-08-15：Isolated runtime hard stop／Atlas fallback in-progress

### Runtime attempt result

- 兩次 temporary Supabase start 均在 pull／health／timeout 階段失敗；兩次過程 Wave0 resources 始終為 `0`，因此沒有可執行的 isolated DB runtime。
- Migrations、migration catalog read-back、aggregate-only preflight，以及 capacity／concurrency／guest 三個 verifiers 全部 `NOT_RUN`。
- 不做第三次同路線 retry；此路線已 hard stop。Atlas single-DB fallback 只做唯讀調查，狀態為 `in-progress`。

### Cleanup and existing-stack evidence

- 兩個 temporary targets 均已對 exact target cleanup；cleanup 後 Wave0 resources=`0`。
- Existing baseline 的 13 IDs／ports、2 volumes、1 network 均 unchanged。Strict health snapshot mismatch 來自 existing edge-runtime 的既有 exited 狀態，非本輪建立、改動或殘留。

### Acceptance boundary

- Fresh7 `ACCEPTED（STATIC／LOCAL-code，P0=0、P1=0）` 保留，但不包含 DB runtime、CI、remote DB 或 production；Wave 0 尚未關閉。
- DB runtime／remote／CI／production 維持 `NOT_RUN`，GitHub 維持 `BLOCKED`。本段沒有 migration apply、deploy、rollback、commit 或 push。

## 2026-08-15：Fallback3 partial runtime／Fresh diagnosis in-progress

### Runtime evidence

- PASS：isolated DB 啟動；32 migrations 套至 latest `20260815060000`；migration catalog、SECURITY DEFINER／`search_path`／reader、ACL、5 項 RLS 與 aggregate-only preflight=`0` 通過。
- PASS：GoTrue health；透過允許的管理介面建立 2 個 synthetic identities，profiles read-back 通過；guest 與 capacity verifiers 通過，rollback residue=`0`。
- FAIL：concurrency verifier 回報 sanitized `database_connection`。此為 one-shot，依邊界不 retry；runtime overall 不合格、Fresh not ready，Fresh diagnosis 為 `in-progress`。

### Cleanup and evidence boundary

- Cleanup read-back：synthetic identities=`0`、Wave0 resources=`0`、temporary target 已刪除、existing stack unchanged。
- Fresh7 STATIC／LOCAL-code acceptance 保留，但 Fallback3 的局部 runtime PASS 不等於 runtime overall acceptance；remote DB、CI、production 仍為 `NOT_RUN`／`BLOCKED`，Wave 0 未關閉。
- 本段不記錄 secrets 或 IDs，未執行 retry、remote migration、deploy、rollback、commit 或 push。

## 2026-08-15：Concurrency root-cause diagnosis／safe instrumentation

### Diagnosis boundary

- Sanitized `database_connection` 不能唯一判定根因。H1 是 connection slots；H2 是 business `53300`／class `53` collision；兩者維持待 DB diagnostic 區分的競爭假說。
- 已確定的 observable bug 是 concurrency verifier 在 error rewrap 時丟失原始 `phase`／`code`，導致 infrastructure 與 business failure 無法安全分類。

### Orion decision and work status

- 先做 safe fixed-field diagnostic，只補定位所需固定 `phase`／`code`；禁止輸出 message、stack、query、params、address、port、DSN 或 IDs。
- DB diagnostic 前禁止先改 retry、pool 或 SQLSTATE 語意。Forge-DB instrumentation 後續已完成並獲 Fresh LOCAL-code acceptance；DB diagnostic 仍為 `pending`，runtime overall 不合格、Wave 0 未關閉。
- 本段未執行 DB diagnostic、retry、remote migration、deploy、rollback、commit 或 push。

## 2026-08-15：Wave 0 blocker final sync／local WIP safepoint candidate

### Acceptance and runtime evidence

- Safe diagnostic 已由 Fresh **ACCEPTED（LOCAL-code）**；此 acceptance 只涵蓋 fixed-field instrumentation，不是 DB runtime acceptance。
- Fallback3 DB runtime partial PASS：32 migrations（latest `20260815060000`）、catalog、ACL、RLS、aggregate preflight=`0`、guest 與 capacity verifier；concurrency verifier `FAIL`，runtime overall 不合格。
- 後續 phase-aware one-shot 在 bootstrap 階段失敗，所有 safe diagnostic fixed fields=`null`／`NOT_RUN`；未取得 phase，不能進行 root-cause 判定。
- Cleanup read-back：Wave0 resources=`0`、temporary target deleted、existing stack unchanged。

### External blockers and gate

- External blockers：isolated runtime 不穩定；GitHub auth invalid；remote DB credential unavailable。
- Wave 0 未關閉，Wave 1 不得開；本輪沒有 remote migration、deploy 或 push。
- 下一步僅在 Docker／db-start 穩定後執行一次 concurrency diagnostic；若取得 phase，再判 root cause，之後交 Fresh runtime 驗收。

### Safepoint boundary

- 目前本機 dirty WIP 可作 safepoint candidate，供後續在同一 fixed point 重啟；明確不是 release、DB acceptance、remote apply 或 deployment readiness。

## 2026-08-15：Local WIP safepoint established

### Commit evidence

- Local commit：`669f42d9efb4b7ccdb239bd3a561ffcbb8e9bdf0`；message：`wip(join): checkpoint wave 0 capacity hardening`。
- Exact 9-file allowlist：`apps/join/package.json`、`apps/join/scripts/migration-contract.test.ts`、`apps/join/scripts/verify-guest-invitations.mjs`、`apps/join/scripts/verify-manual-roster-capacity.mjs`、`apps/join/scripts/verify-manual-roster-concurrency.mjs`、`apps/join/supabase/migrations/20260815060000_manual_roster_capacity_seat_engine_fix.sql`、`docs/squad/CHARTER.md`、`docs/squad/LEDGER.md`、`implementation-control-log.md`。
- Post-commit read-back：working tree clean；未 push、tag 或建立 PR。此證據只成立於 commit 建立當下；本次 Echo 兩份 docs sync 是後續未提交差異，不在 `669f42d` 內。

### Boundary and restart concept

- `669f42d` 只是一個 local WIP safepoint，不是 release、DB runtime acceptance 或 Wave 0 closure；Wave 1 不得開。
- External blockers 保持：isolated runtime 不穩、GitHub auth invalid、remote DB credential unavailable；未執行 remote migration、deploy 或 push。
- 重啟時先讀回 branch／HEAD／dirty baseline；Docker／db-start 穩定後只跑一次 phase-aware concurrency diagnostic，若取得 phase 再做 root-cause 判定，之後交 Fresh runtime 驗收。

## 2026-08-17：Docker 恢復後續作／runtime gate 再驗證（未關閉）

### 已完成

- Docker daemon 已恢復；`gather-join-diag-01`（`127.0.0.1:58332`）與 `gather-join-p1` 均為 running／healthy。
- 既有 phase-aware concurrency one-shot 證據保留：`manual roster concurrency verifier: PASS confirmed=1 waitlisted=5`；本輪不以相同測試重跑結果覆寫該證據。
- 本輪 guest verifier 完整 PASS：token、RLS、aggregate count、duplicate roster、capacity contract，以及 rollback zero-residue 均通過。
- `apps/join` `pnpm build` PASS；產物讀回 client bundle `593.15 kB`，Vite `>500 kB` warning 仍存在。

### 未完成／硬停止原因

- 本輪為 capacity／guest gate 建立的一次性 member fixture 尚未刪除；cleanup 與本輪 concurrency 重跑需要本地 DB escalation，但執行環境回覆 usage limit，依規則停止，不改用繞路執行。
- 因 fixture 尚未清除，不能宣稱本輪 full isolated runtime acceptance，也不能交 Fresh runtime acceptance；catalog／ACL／RLS 的既有證據仍是前輪 read-back，未在本輪重新宣稱為新證據。
- Remote DB migration／runtime、CI、production、deploy、rollback、commit、push 均未執行；GitHub auth 仍 `BLOCKED`。

### 安全與邊界

- 測試只使用本地隔離 DB 與 synthetic identities；未回傳、落檔或重用任何 service-role key、密碼或正式 secrets，既有其他 Docker stacks 未操作。
- Wave 0 維持開啟，Wave 1 維持 blocked；待 execution escalation 恢復後，先 cleanup fixture，再做一次 phase-aware concurrency 與 catalog／ACL／RLS read-back，最後才交 Fresh runtime。

## 2026-08-18：最終 handoff 與 Git publish 邊界

- 新增 `docs/squad/HANDOFF.md` 作為短期 session 交接文件，引用 LEDGER／control log，不取代長期台帳。
- 本 session 的交付範圍：handoff、runtime 未完成項、續接 prompt、驗證命令與 evidence boundary；不宣稱 Wave 0 closure、Fresh acceptance、remote migration 或 production deploy。
- Git publish 需只 stage 明確的本次檔案；`gh auth status` 顯示目前 token invalid，因此若 Git remote push 認證失敗，必須在 push 前停止並回報，不得繞過認證。
- 實際結果：`git push -u origin codex/gather-mvp` 成功，remote branch 已讀回 `e2cdeb9e4dddcd95d30bd3e5cf34ab2d74ce438b`；此為 Git remote publish，不是 production deploy 或 Wave 0 acceptance。

## 2026-08-18：Wave 0 runtime closeout attempt（blocked，isolated local only）

### Fixed point and scope

- 實際 fixed point：branch `codex/gather-mvp`、`HEAD=7a55d9a`；`c483248` 是較早 checkpoint。working tree 初始為 clean；`git -c core.fsmonitor=false` read-back clean，原始 Git fsmonitor query 曾回報 environment error。
- 僅處理 `/private/tmp/gather-join-runtime` 的 `gather-join-diag-01` local target、DB port `58332` 與其 synthetic fixture；未做 reset、broad cleanup、remote migration、production deploy、rollback 或 push。

### Cleanup result

- 唯讀 cardinality safety check：owner `auth.users/public.users` 各 1，non-owner member fixture 各 1；未輸出或保存 member UUID、email、token 或 key。
- 透過 local Auth Admin API 的精確 cleanup 呼叫先因 raw quoted key 回 `403`，修正為正確 local env parsing 後回 `504`；自然等待後 zero-residue cardinality 仍為 owner 1、non-owner 1。未改用 managed `auth.users` direct DML，未再 retry。
- Cleanup gate：**FAIL／未完成**。synthetic member fixture 仍有 residue；不可進入 full isolated runtime acceptance。

### Fresh isolated local read-back

- Migration catalog：`applied_count=32`、`20260815060000` present、latest=`20260815060000`，**PASS（isolated local）**。
- ACL：token-only invitation RPC 的 anon/authenticated execute、manual roster authenticated execute、PUBLIC 不可 execute，**PASS（isolated local）**。
- Capacity function envelope definition，**PASS（isolated local）**；aggregate-only conservative preflight=`0`，**PASS（isolated local）**。
- RLS：8 張 Wave 0 相關表中 7 張同時 enabled＋forced；`public.event_invitation_targets` 為 enabled 但未 forced，**FAIL（isolated local read-back）**。本輪不自行修 migration。

### Gate and evidence boundary

- 因 cleanup zero-residue 未成立，本輪 phase-aware concurrency verifier **NOT_RUN**；沒有新增 concurrency PASS，也沒有 retry。Fresh runtime review **NOT_READY**。
- Wave 0 維持未關閉；Wave 1 維持 blocked。以上 local/static/isolated evidence 不轉譯為 remote DB、CI、staging 或 production evidence。
- 未處理 593 kB bundle warning；未擴大 scope。後續須先由授權 session 處理明確 fixture cleanup／zero-residue 與 RLS gate，再決定是否可跑唯一一次 concurrency verifier。

## 2026-08-18：authorized continuation／RLS correction and managed-auth blocker

### RLS correction

- 新增 repo migration：`apps/join/supabase/migrations/20260818121055_event_invitation_targets_force_rls.sql`，內容僅為 `alter table public.event_invitation_targets force row level security`。
- `supabase db push --local --yes` 受 host port `58332` timeout 阻塞；未連 remote。改由明確的 `supabase_db_gather-join-diag-01` local DB container 內執行同一 migration SQL 並記錄 version，非 production／remote 操作。
- Read-back：migration catalog `33`、`20260818121055` present、RLS `8/8` enabled＋forced、ACL PASS、capacity envelope PASS、aggregate preflight `0`；以上均為 isolated local。

### Cleanup follow-up

- 先完成唯一 non-owner fixture 的 domain reference read-back：profile=`1`，organizer／event／registration／manual-added／invitation／audit／idempotency／notification／outbox references 全為 `0`。
- 依 exact allowlist 精確刪除該 local `public.users` profile，成功；未刪其他資料。
- local Auth Admin DELETE 與 GET 對 residual auth identity 均回 `404`；DB read-back 顯示 owner auth=`1`、non-owner auth=`1`、owner profile=`1`、non-owner profile=`0`。`auth.instances=0`，non-owner `instance_id` unmatched。
- 這是 managed `auth.users` orphan fixture；本輪不自行改用 direct `auth.users` DML。Cleanup／zero-residue 仍 **FAIL**，concurrency verifier **NOT_RUN**，Fresh runtime **NOT_READY**。

### Next gate

- 需要對「唯一 local orphan auth fixture 是否可採 direct local cleanup」取得明確 action-specific authorization；在此之前不得碰 `auth.users`，也不得跑 concurrency。
- Wave 0 維持未關閉；Wave 1 維持 blocked；不處理 593 kB bundle warning，不做 remote migration／deploy／push。

## 2026-08-18：authorized orphan cleanup／concurrency one-shot complete

### Exact local cleanup

- 使用者明確授權只在 `/private/tmp/gather-join-runtime` 的 `gather-join-diag-01` isolated local DB，刪除唯一 synthetic orphan `auth.users` row；不得碰其他資料、remote／production、reset 或 broad cleanup。
- 依既有 cardinality 與 domain-reference safety check，執行一筆 direct local `auth.users` delete；未輸出或保存 UUID、email、token、key。
- Zero-residue read-back：owner auth/profile=`1/1`；non-owner auth/profile/session=`0/0/0`；domain references=`0`。

### Concurrency and final local read-back

- 只跑一次 `verify-manual-roster-concurrency.mjs`：`PASS confirmed=1 waitlisted=5`；未 retry。
- Post-verifier independent read-back：race organizers/events/audit=`0/0/0`；catalog=`33`、`20260818121055` present、RLS=`8/8`、ACL PASS、capacity envelope PASS、aggregate preflight=`0`。
- Static regression：`179 passed / 1 skipped`；Node `20.20.2` engine warning 仍存在，但測試通過。

### Fresh review boundary

- Isolated local runtime gate evidence 已備妥，可交獨立 Fresh reviewer；本 session 不自我宣稱 Fresh acceptance 或 Wave 0 closure。
- 目前工具沒有可派 fresh-context reviewer 的 subagent 能力，因此 Fresh reviewer status=`READY_TO_REVIEW`，不是 `ACCEPTED`。
- Wave 0 維持未關閉；Wave 1 維持 blocked；未做 remote migration／CI／production／deploy／rollback／push，593 kB bundle warning 未處理。

## 2026-08-18：independent Fresh runtime review

- User requested an independent external reviewer. Reviewer `Faraday` ran a fresh-context, read-only review of the repo evidence and isolated local DB; no file mutation, DB write, concurrency rerun, migration apply, DELETE, reset, broad cleanup, remote/production action, commit, or push occurred.
- Verdict：`READY_WITH_BLOCKERS`。
- `[ISOLATED LOCAL / reviewer read-only]` catalog=`33`、target migration present、RLS=`8/8` enabled＋forced、ACL=`9/9 exact match`、capacity envelope PASS、aggregate preflight=`0`。
- `[ISOLATED LOCAL / prior recorded evidence—not rerun]` concurrency=`PASS confirmed=1 waitlisted=5`；本案 one-shot boundary preserved。Zero-residue 亦為既有 isolated local evidence，非本次 fresh 行為測試。
- Fresh conclusion：isolated local runtime gate `ACCEPTED`，但 Wave 0 overall `NOT_ACCEPTED for closure`；remote DB／CI／staging／production 未驗收，migration 尚未 commit；Wave 1 維持 `BLOCKED`。
- Required follow-up：owner 另行 exact-allowlist commit 必要檔案，取得 remote／CI／staging／production read-back 後，再重新評估 Wave 0 closure。Local／isolated evidence 不得宣稱為 release-ready。
