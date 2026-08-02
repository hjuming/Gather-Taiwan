# P1-02 GREEN 證據

日期：2026-08-02

## 已通過

- Schema contract：5/5 PASS。
- Remote migration：`20260802152000` canonical schema 與 `20260802154000`
  owner-transfer、`20260802160000` registration/cross-event guardrails corrective migration
  均由 `supabase db push --db-url` 成功套用。
- Remote rollback fixture：migration ledger、13 張 canonical tables、enum、RLS/FORCE RLS、
  anon/authenticated/PUBLIC ACL、零 policy、付款資料邊界、必要 unique/index 全部讀回。
- 行為：唯一 owner、immediate-constraint owner transfer、owner audit、active registration
  unique、membership identity、合法 transition／terminal 不可復活、開始後 INSERT 拒絕、
  answer/idempotency/notification/outbox/audit 跨活動 mismatch、2/29、DST、開始後安全欄位
  不可改、無效時區與付款證明型欄位拒絕全部 PASS。
- Fixture transaction 最後 `ROLLBACK`，未留下 synthetic auth user、organizer、event 或
  registration。
- `supabase db lint --schema public --level warning`：`No schema errors found`。
- `supabase migration list --db-url`：四筆 local/remote version 對齊；最後
  `supabase db push --dry-run`：`Remote database is up to date`。
- Local：typecheck、lint、build、built Worker smoke PASS；Vitest 26 passed / 1 skipped，
  security 14/14。Skipped 案是未注入 DB URL 的舊 P1-01 concurrency suite，P1-02 真 DB
  行為已由上述專屬雲端 rollback verifier 執行。

成功輸出：

```text
P1-02 ledger, fail-closed ACL/RLS, calendar, owner, state-machine, and cross-event constraints verified.
```

## 不屬於本 Gate

- P1-03 dev JWT、P1-04 RLS policies、P1-06/P1-08 冪等 replay／席次引擎仍未實作。
- Supabase Security/Performance Advisors 重試仍回覆沒有 project 權限，記為 `NOT_RUN`；
  GitHub Actions 在本 Gate 尚未讀回時同樣不得用 direct SQL 或 local PASS 取代。
- 本機 Node 20.20.2 低於 package 宣告的 Node 22；指令均 PASS 但保留 engine warning，
  GitHub workflow 仍以 Node 22 為 canonical 執行環境。
