# 來聚一場：開發手冊

## 工作區

- 開發根目錄：`apps/join`
- Node：22 以上
- pnpm：10.33.2
- 前端：React 19 + Vite
- Runtime：Cloudflare Worker + static assets
- 資料庫：Supabase PostgreSQL，raw SQL migrations

## 本機檢查

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:security
pnpm build
pnpm smoke
```

有真 PostgreSQL URL 時執行 P1-02 schema 行為 gate：

```sh
GATHER_JOIN_TEST_DATABASE_URL='postgresql://…' pnpm verify:p1-02
```

此 gate 讀回 migration ledger、enum、RLS／ACL／policy、payment boundary 與 indexes，
再於 rollback transaction 內驗證 owner transfer、membership identity、active unique、
合法／非法狀態轉移、開始後 INSERT 拒絕、跨活動 FK、2/29、DST、時區拒絕及付款
證明型欄位拒絕。

`pnpm test` 沒有 `GATHER_JOIN_TEST_DATABASE_URL` 時會 skip 真 DB suite。不可將 skip 宣稱為
migration 或 concurrency PASS。

## 2026-08-05 已更新項目

- `apps/join/vite.config.ts`
  - `test.environment` 維持 `node`，避免 `jsdom` 在 `dompurify` 與 `vitest` worker plugin
    併發下偶發失敗。
  - 保留 `cloudflare` plugin 的 staging / production 雙 config。
- `apps/join/src/security/security.test.tsx`
  - 補 `@vitest-environment jsdom`，讓 `renderToStaticMarkup`、`SafeExternalLink`
    在本機一致性穩定通過。
- `apps/join/index.html`
  - 加入 favicon 及 manifest 對應連結。
- `apps/join/public/`
  - 新增 `favicon_io/*` 與 `site.webmanifest`，並補上 `favicon.ico`。
- `apps/join/pnpm-lock.yaml`
  - 記錄 `jose` 升版到 `6.2.8`，為後續 dev-auth JWT/會話工單作基礎。

本輪驗證證據請沿用 evidence：

- `docs/evidence/p1-01-a-green.md`
- `docs/evidence/p1-01-b-green.md`
- `docs/evidence/p1-02-green.md`
- `apps/join/src/security/security.test.tsx`（本地 test suite）

## 後續作業建議順序

`P1-03`（dev-only auth harness）已完成正式驗收，證據見
`docs/evidence/p1-03-green.md`；尚未接線真實 Cloudflare Access，未部署。

`P1-04` domain policies 已完成正式雲端 9/9 驗證；LINE 正常授權 production
E2E 亦已 PASS。後續不得再把這兩項列為待施工。

1) canonical hardening A 已套用並完成遠端 ledger/read-back；容量 `SUM(seats)`、attending
   邀請者計入容量、strict FIFO 與 pool release-before-promote 已覆蓋。8 搶 3、41 搶 40
   真實並發與 token／RLS rollback verifier 均 PASS。
2) 多席 strict-FIFO、兩池 deadline merge 與 capacity RPC 冪等的 rollback-only verifier 已 PASS。
   B migration 已套用並完成 direct UPDATE revoke、容量 RPC ACL 與正式 Worker／前端 read-back；
   `authenticated` 及前端已不能直接更新 `capacity`、`invite_reserved_seats`、`invite_pool_deadline`、
   `invite_pool_released_at`。P1-06/P1-08 仍以既有核心席次／併發證據作 conditional closure，
   不把未完成的完整 failure matrix 或 event_fields UI 放大為已完成。
3) 完成 LINE 拒絕授權、無 email、incognito、過期 `state`/`nonce` 與第二個獨立帳號 E2E
4) 補齊真實 Cloudflare Access 接線與獨立 staging 驗收

## 2026-08-10 Supabase 恢復後的 LINE callback 交接

Supabase 操作已恢復並完成 LINE callback 所需的最小 production read-back。本輪也完成
`event_fields` 參加者端動態表單：

- `src/lib/event-fields.ts` 集中處理必填、選項白名單與 boolean 回答驗證。
- `EventPage` 讀取既有欄位並渲染五種既定 `field_type`，通過驗證後傳入既有
  `register_for_event(p_answers)`。
- `src/lib/event-fields.test.ts` 覆蓋缺漏必填、false boolean、單選白名單與複選白名單。

主辦端欄位建立／編輯 UI 尚未施工。LINE 正常授權 E2E 已 PASS，但拒絕、無 email、
incognito、過期 state/nonce、第二帳號等失敗矩陣仍是待辦。

本輪 P2-02 grant 以 Dashboard SQL 直接套用並完成 privilege read-back；本地
`20260810010000_p2_02_line_service_role_grants.sql` 仍須依 migration 流程補 ledger
同步，未同步前不得宣稱 migration ledger PASS。

## Migration 規則

1. 每個 schema 變更只能新增 `supabase/migrations/<UTC timestamp>_<name>.sql`。
2. migration 內不用 `IF NOT EXISTS` 吞掉部分套用；非明確冪等需求必須 fail-fast。
3. public table 當次 migration 就要啟用 RLS，並明確 grant/revoke。
4. 入庫前先跑 contract tests，遠端套用後再做 SQL read-back 與 Advisors。
5. 容量與報名狀態只能經單一席次引擎 RPC 改動，App role 不可直寫。
6. 已套用 migration 永不回改；修正必須新增 forward-only migration。P1-02 的 owner
   transfer 修正即保留為獨立 ledger 版本，避免本地檔與雲端 checksum 漂移。
7. P1-04 已對 domain tables 建立最小 policy／欄位 grant 與 scoped RPC；base-table
   direct DML 與尚未開放的流程仍維持 fail-closed。不得為了 UI 開發額外放寬。
8. LINE callback 的 server-only 存取另以 `20260810010000_p2_02_line_service_role_grants.sql`
   維持最小欄位 grant；不得把這些權限複製給 `anon`／`authenticated`，也不得把
   `service_role` key 放進前端。若以 Dashboard SQL 緊急套用，必須在控制紀錄標註
   「已套用但 ledger 尚待同步」，不可把直接執行當成 migration ledger PASS。

## Gather 雲端 DB Gate

`apps/join/.env.supabase.local` 是 `0600` 且被 Git ignore 的本機檔，只存放
project ref 與資料庫密碼。不得顯示、複製到文件、CI log 或 issue。

當前 Supabase CLI profile 屬於另一帳號，`supabase link` 會被 Gather org 拒絕。禁止用
當前 CLI token 選擇或猜測專案。P1-01-B bootstrap 使用官方 PostgreSQL
`psql`、Session pooler、SSL 與 `--single-transaction`；其 ledger 已由 `supabase migration list
--db-url` 與 `supabase db push --dry-run --db-url` 證明與 CLI 相容。後續 migration 優先
使用 CLI `--db-url` 模式管理 ledger，URL 只能由本機環境變數組合，不得印出。

每次遠端 Gate 必須留下：

- migration transaction 輸出
- `supabase_migrations.schema_migrations` 讀回
- RLS／privilege 負向測試
- 需要不變量時的雙連線併發測試
- Supabase Security/Performance Advisors 讀回（staging/production readiness 必須；未取得時
  以 `NOT_RUN` 記錄，不得宣稱部署 readiness PASS）

P1-02 行為 fixture 必須在 transaction 內建立且 rollback；不得把 synthetic auth user、
organizer 或 event 留在雲端。正式「免費、公開、不限額」預設活動須等待受支援身分
流程建立 owner，不能手寫 production `auth.users`。

## Git 切片

- 開發分支：`codex/gather-mvp`
- 每個可獨立驗收的 Gate 完成後，只 stage allowlist，提交後立即 push。
- 不 stage `.vscode/`、`.wrangler/`、`asset-risk-archive/` 或與 app Gate 無關的網站圖片。
- build PASS 不等於 CI／staging／production PASS；要分層記錄。
