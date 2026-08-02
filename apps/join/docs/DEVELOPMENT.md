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

`pnpm test` 沒有 `GATHER_JOIN_TEST_DATABASE_URL` 時會 skip 真 DB suite。不可將 skip 宣稱為
migration 或 concurrency PASS。

## Migration 規則

1. 每個 schema 變更只能新增 `supabase/migrations/<UTC timestamp>_<name>.sql`。
2. migration 內不用 `IF NOT EXISTS` 吞掉部分套用；非明確冪等需求必須 fail-fast。
3. public table 當次 migration 就要啟用 RLS，並明確 grant/revoke。
4. 入庫前先跑 contract tests，遠端套用後再做 SQL read-back 與 Advisors。
5. 容量與報名狀態只能經單一席次引擎 RPC 改動，App role 不可直寫。

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

## Git 切片

- 開發分支：`codex/gather-mvp`
- 每個可獨立驗收的 Gate 完成後，只 stage allowlist，提交後立即 push。
- 不 stage `.vscode/`、`.wrangler/`、`asset-risk-archive/` 或與 app Gate 無關的網站圖片。
- build PASS 不等於 CI／staging／production PASS；要分層記錄。
