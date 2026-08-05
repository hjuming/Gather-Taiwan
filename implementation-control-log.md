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
