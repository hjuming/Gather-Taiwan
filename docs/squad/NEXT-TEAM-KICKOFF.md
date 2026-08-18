# 下一工程團隊啟動提示詞

用途：把這段完整貼給下一個工程團隊或乾淨 session，作為本專案目前 Wave 0 收尾的唯一開工入口。

```text
你接手的是 /Users/hjuming/網站專案/聚場台灣 的 Wave 0 manual roster 收尾。

## 先讀與固定點

先讀：
1. docs/squad/NEXT-TEAM-KICKOFF.md
2. docs/squad/LEDGER.md
3. implementation-control-log.md
4. docs/squad/HANDOFF.md
5. README.md、apps/join/README.md、apps/join/docs/DEVELOPMENT.md、apps/join/docs/SSOT.md
6. apps/join/docs/MAINTENANCE.md
7. git status -sb、git log -5、git diff origin/codex/gather-mvp...HEAD

目前固定點：
- branch：codex/gather-mvp
- handoff evidence base commit：69dab0c；若目前 HEAD 已更新，先以 git read-back 為準，不做 reset。
- Wave 0：尚未關閉；Wave 1：BLOCKED，禁止開始。
- 只做本 repo 內、可追溯、最小 scope 的工作；保留其他使用者修改。

## 已有成果（按 evidence tier 解讀）

- ISOLATED LOCAL：synthetic fixture cleanup zero-residue；phase-aware concurrency verifier 已依規則只跑一次，PASS confirmed=1 waitlisted=5；既有 179 tests passed / 1 skipped、typecheck、lint、build PASS。
- REMOTE READ-BACK：Supabase project anklbpkyesdmsubyfcna 的 catalog=33；20260815060000_manual_roster_capacity_seat_engine_fix.sql 與 20260818121055_event_invitation_targets_force_rls.sql present；function 9/9 conforming；ACL PASS；RLS 8/8 enabled+forced；aggregate preflight=0。
- CI：Draft PR #1 的最新已知 run 32150304903，verify、local-supabase、Cloudflare Pages check PASS。
- STAGING：gather-join-staging version 82b00639-298b-4f73-aa91-d3169c75258a，100% traffic；https://gather-join-staging.hjuming.workers.dev/ HTTP 200；無 Access assertion 的 /__dev/session 回 403。
- PRODUCTION READ-BACK：Pages source 69dab0c；https://f4febb0d.neo-rechao.pages.dev 與 https://gather.wedopr.com HTTP 200；這是 docs-only auto deployment，不代表 runtime source release、Fresh acceptance 或 Wave 0 closure。
- CANONICAL STAGING HOST：staging.join.gather.wedopr.com 尚無 DNS／custom domain／zone route，只能標 UNVERIFIED，不得誤寫成 PASS。

## 本輪唯一下一步

1. 先 read-back 最新 HEAD、文件、PR／CI、staging workers.dev、Pages metadata／公開 URL。
2. 指派獨立 fresh-context reviewer，只讀驗收 Wave 0；不要由施工者自行宣布 acceptance。
3. Reviewer 必須逐項回報：fixed point、isolated local、remote、CI、staging、Pages、Fresh、Wave 1 boundary，以及 canonical staging host 是否阻擋。
4. 只有 reviewer 明確回報 ACCEPTED，才可在 LEDGER、HANDOFF、control log 把 Wave 0 更新為 CLOSED；Wave 1 仍維持 BLOCKED。
5. 若 reviewer 不是 ACCEPTED，保留 Wave 0 open，記錄最小 blocker，不自行擴大修正。

## 明確禁止

- 不重跑 concurrency verifier；若未來真的需要新一輪，先取得新的 action-specific authorization。
- 不新增資料庫；不套用其他 migration；不 DELETE、reset、rollback 或 broad cleanup。
- 不修改 source、test、package、workflow 或 593 kB bundle warning，除非取得新的明確 scope。
- 不修改 Cloudflare route／DNS／custom domain；canonical staging host 只做唯讀診斷，除非取得新的明確授權。
- 不 merge Draft PR #1；不把 push、Pages deploy、CI 或公開 URL 讀回宣稱為 Wave 0 acceptance。
- 不輸出或保存 DB password、service-role key、token、個資；敏感值一律 [REDACTED]。

## 驗證與交付

- 文件 read-back 必須核對最新 HEAD／CI run／Pages source／deployment／staging version 是否一致。
- 只 stage 明確文件 allowlist，禁止 git add -A。
- 最終回報固定包含：已完成、未完成／未處理、自行追加、驗證結果與證據、剩餘風險；明確保留 Wave 0／Wave 1 gate。
```

## 文件地圖

- `README.md`：專案與公開站總覽、目前工程狀態入口。
- `apps/join/README.md`：Join app 架構、執行指令與 current handoff。
- `apps/join/docs/SSOT.md`：產品／技術契約與環境邊界。
- `apps/join/docs/DEVELOPMENT.md`：本機驗證、migration 規則與工程流程。
- `apps/join/docs/MAINTENANCE.md`：secrets、Supabase、LINE、回滾與維運 hard stops。
- `docs/squad/CHARTER.md`：角色、授權、hard stops 與 Wave gate。
- `docs/squad/LEDGER.md`：長期證據台帳與波次狀態。
- `docs/squad/HANDOFF.md`：本次 session 的交接摘要；舊 prompt 已標為歷史版本。
- `implementation-control-log.md`：逐次決策、證據標籤、scope 與風險控制。

## 不要混用的證據層級

`STATIC`、`LOCAL`、`ISOLATED LOCAL`、`CI`、`STAGING`、`PRODUCTION`、`DEVICE`、`NOT_RUN`
不可互相替代。尤其：local PASS 不等於 remote PASS；Worker／Pages deployment 不等於
Fresh acceptance；workers.dev staging URL PASS 不等於 canonical staging host／同源 UAT PASS。
