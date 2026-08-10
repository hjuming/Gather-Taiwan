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
