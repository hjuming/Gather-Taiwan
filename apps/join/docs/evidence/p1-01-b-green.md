# P1-01-B GREEN evidence

日期：2026-08-02

狀態：`PASS_WITH_DECLARED_FOLLOW_UP`；Supabase Advisors 為 `NOT_RUN`

## 雲端目標讀回

- Supabase org：`gather Taiwan` / `qqcraliqerxjcuyztkkf`
- Supabase project：`gather-taiwan` / `anklbpkyesdmsubyfcna`
- project URL：`https://anklbpkyesdmsubyfcna.supabase.co`
- region：Northeast Asia (Tokyo), `ap-northeast-1`
- project status：Healthy
- 建立時安全選項：Data API 開啟、Automatically expose new tables 關閉、
  automatic RLS 開啟。

## Migration transaction

由於現行 Supabase CLI profile 屬於不同帳號，`supabase link` 被 management API
正確拒絕；本 Gate 改用官方 PostgreSQL `psql 16`、Session pooler、SSL 與
`--single-transaction` 定址 Gather project。

事務輸出：

```text
CREATE SCHEMA
CREATE TABLE
CREATE TABLE
ALTER TABLE
REVOKE
INSERT 0 1
INSERT 0 1
```

同一 transaction 建立 `supabase_migrations.schema_migrations`，套用
`20260802010000_p1_framework_probe.sql`，記錄 ledger，再套用 PII-free 冪等 seed。

## 遠端驗證

`scripts/verify-probe.mjs` 以獨立連線讀回：

- ledger 恰有一筆 `20260802010000`
- seed 恰有一筆 `p1-01`
- `counter=0`、`version=0`
- RLS enabled
- `anon` / `authenticated` 的 SELECT、INSERT、UPDATE、DELETE、TRUNCATE、
  REFERENCES、TRIGGER 共 14 個 privilege 均為 false
- relation ACL 不存在 `PUBLIC` 授權

輸出：

```text
Migration ledger, PII-free seed, and default-deny privileges verified.
```

## 真併發 Gate

`scripts/concurrency-harness.test.ts` 建立兩條獨立 PostgreSQL session，以 5 秒 barrier
強制第一次事務互相競爭；驗收要求至少一條連線觀察到 `40001` 並 retry。

```text
✓ P1-01 PostgreSQL concurrency harness
1 passed
probe_key | counter | version
p1-01     | 2       | 2
```

讀回 2/2 後已將專用 probe row 恢復為 0/0，並再次通過 verify。

## Supabase CLI ledger 相容性

bootstrap transaction 後，以相同 Gather Session pooler URL 執行官方 CLI：

```text
supabase migration list --db-url [REDACTED]
Local          | Remote
20260802010000 | 20260802010000

supabase db push --db-url [REDACTED] --dry-run --yes
Remote database is up to date.
```

兩個命令皆 exit 0；證明 version/name/statements ledger 可被 Supabase CLI 2.106.0
正常讀取與比對。命令中的密碼只由本機 ignore 環境檔組合，未輸出。

## Live 缺陷修正

首次雲端測試顯示 `postgres` JavaScript driver 將 PostgreSQL `bigint` 回傳為
十進位字串；原實作把 `"1" + 1n` 變成 `"11"`。新增 RED 後，在資料邊界
以 `normalizeProbeVersion` 轉為 `BigInt`，unit 3/3、typecheck 與雲端 concurrency 全數
轉綠。

## 結論

P1-01-B 已從原本 local Docker 的 `BLOCKED_NOT_GREEN` 提升為 Gather 專屬雲端
`PASS_WITH_DECLARED_FOLLOW_UP`。已通過的部分只覆蓋 migration framework/probe，
不代表 domain schema、LINE auth、staging 或 production 已完成。

Supabase connector 不屬於 Gather 帳號，呼叫 Security/Performance Advisors 均回覆
permission denied；本次內建瀏覽器也沒有 Supabase 登入狀態。因此 migration 後
Advisors 讀回為 `NOT_RUN`，不沿用 migration 前的 overview 「no issues」訊號，也不將
此 Gate 扩大為部署 readiness PASS。
