# 聚場台灣 Wave 0 最終交接

日期：2026-08-18
來源：Codex／`codex/gather-mvp`
交接性質：本 session 的工程交棒摘要，不代表 release、production acceptance 或 Wave 0 closure。

## 下一個 session 的目標

在不擴大 Wave 0 scope 的前提下，完成本地 isolated runtime 的收尾：清除本輪 synthetic member fixture、重新取得一次 concurrency 與 catalog／ACL／RLS read-back，然後交 Fresh runtime review。只有所有證據層級分開成立後，才可評估 Wave 0 closure；Wave 1 目前不得開始。

## 目前狀態

### 已完成

- Branch：`codex/gather-mvp`；已與 `origin/codex/gather-mvp` 同步；handoff 首版 commit 為 `e2cdeb9`，後續 metadata sync 以 `git log` 為準。
- Docker daemon 已恢復；`gather-join-diag-01`、`gather-join-p1` 曾確認 running／healthy。
- 既有 phase-aware concurrency one-shot：`PASS confirmed=1 waitlisted=5`。
- 本輪 guest invitation verifier：token、RLS、aggregate、duplicate roster、capacity、rollback zero-residue 全 PASS。
- `pnpm test`：179 passed、1 skipped；`pnpm typecheck` PASS；`pnpm lint` PASS；`pnpm build` PASS。
- 相關長期台帳與控制紀錄：`docs/squad/LEDGER.md`、`implementation-control-log.md`。

### 本 session 新增 read-back（2026-08-18）

- 實際 HEAD 為 `7a55d9a`；`c483248` 是較早 checkpoint。isolated DB `127.0.0.1:58332` 可連線。
- 唯一 non-owner synthetic member fixture 的 Auth Admin cleanup 先回 `504`，後續 GET／DELETE 回 `404`；profile 已清除但 managed auth orphan 仍在，cleanup／zero-residue **FAIL／未完成**。未直接對 `auth.users` DML。
- isolated local catalog `33` migrations、target `20260818121055`、ACL、capacity envelope、aggregate preflight `0`、RLS `8/8` **PASS**；`7/8` 是修正前 evidence。
- 因 cleanup 未成立，本輪 concurrency verifier **NOT_RUN**、Fresh runtime **NOT_READY**；不得以本段 evidence 關閉 Wave 0。

### 授權續作結果（2026-08-18）

- 新增並套用 local-only forward migration `20260818121055_event_invitation_targets_force_rls.sql`；catalog=`33`、RLS=`8/8`、ACL PASS、aggregate preflight=`0`。
- 唯一 member 的 domain references 全為 `0`，其 `public.users` profile 已精確刪除；Auth Admin GET／DELETE 均回 `404`，仍留一個 managed `auth.users` orphan row，zero-residue 尚未成立。
- 不改用 direct `auth.users` DML；concurrency verifier 與 Fresh runtime 仍未執行。

### 授權續作完成結果（2026-08-18）

- 使用者已明確授權後，僅刪除唯一 synthetic orphan `auth.users` row；zero-residue read-back：owner auth/profile=`1/1`、non-owner auth/profile/session=`0/0/0`、domain references=`0`。
- 唯一一次 phase-aware concurrency verifier：`PASS confirmed=1 waitlisted=5`；race organizers/events/audit=`0/0/0`。
- Final isolated local read-back：catalog=`33`、RLS=`8/8`、ACL PASS、capacity envelope PASS、aggregate preflight=`0`。
- Fresh runtime review 已 **READY_TO_REVIEW**；本 session 不自我宣稱 Fresh acceptance，Wave 0 仍未關閉。

### 進行中／未完成

- 本輪 synthetic member fixture 已清理完成，zero-residue read-back PASS。
- 本輪 concurrency verifier 已依規則只執行一次並 PASS；不得再 retry。
- RLS forward migration 已套用並 read-back 為 `8/8`；catalog／ACL／aggregate 亦 PASS。
- Fresh runtime、remote DB、CI、production、deploy、rollback 均未驗收或未執行。
- GitHub CLI token 目前失效；是否能以 Git credential 直接 push 需在 push 前重新確認。

## 重要決策與邊界

- 不把 isolated local evidence 寫成 remote、CI、staging 或 production evidence。
- 不在本交接範圍內處理約 593 kB client bundle warning；先留作 P2，避免擴大 Wave 0 scope。
- 不改 migration timestamp、不做 canonical migration replacement、不碰正式 secrets；任何遠端 migration 或 production deploy 需另行授權與 read-back。
- 僅恢復／檢查 `gather-join-diag-01` local target；未操作 remote／production，未做 reset、broad cleanup 或 managed `auth.users` direct DML。敏感值不落檔、不回傳。

## 引用文件

- [LEDGER](./LEDGER.md)：Wave 0 長期台帳、驗收邊界、下一步。
- [implementation-control-log](../../implementation-control-log.md)：決策、硬停止、runtime 與安全證據。
- 變更預覽：`git diff origin/codex/gather-mvp...HEAD` 與目前 working-tree diff。

## 建議 Skills

- `handoff`：維持 session 交棒格式與 evidence boundary。
- `supabase:supabase`：執行本地 DB cleanup／read-back 時遵守 RLS、zero-residue、fail-closed。
- `wedo-review`：Fresh runtime handoff 前做獨立 review，不由施工者自我宣稱接受。
- `github:yeet`：需要完整 GitHub publish／draft PR 時使用；先修復 `gh auth`。

## 續接 prompt（可直接貼給下一個 session）

```text
你接手的是 /Users/hjuming/網站專案/聚場台灣 的 Wave 0 manual roster 收尾。

先讀：
1. docs/squad/LEDGER.md
2. implementation-control-log.md
3. docs/squad/HANDOFF.md
4. git status -sb、git log -5、git diff origin/codex/gather-mvp...HEAD

目前固定點：branch codex/gather-mvp，實際 HEAD 7a55d9a（c483248 為較早 checkpoint）；Wave 0 未關閉，Wave 1 不得開。
既有證據：phase-aware concurrency one-shot PASS（confirmed=1 waitlisted=5）、guest verifier PASS、179 tests passed + 1 skipped、typecheck/lint/build PASS。

先處理未完成：
- synthetic fixture cleanup、zero-residue、concurrency 與 local catalog／ACL／RLS／aggregate gates 已完成。
- 下一步只交獨立 Fresh reviewer；未取得 Fresh acceptance 前不關閉 Wave 0，不開 Wave 1。
- cleanup zero-residue 成立後，才可只跑一次 concurrency verifier；若失敗，保留 phase/pg_code/pg_class 的安全診斷，不 retry。
- catalog／ACL／aggregate／RLS 與 concurrency evidence 已有 isolated local read-back；Fresh reviewer 尚待獨立 context 執行，不得將本 session 結果自我宣稱為 Fresh acceptance。

不得做：
- 不做 remote migration、production deploy、rollback、push 以外的外部變更。
- 不把 local／static PASS 宣稱成 remote／CI／production PASS。
- 不輸出或保存 DB 密碼、service-role key、token、個資；敏感值一律 [REDACTED]。
- 不擴大處理 593 kB bundle warning；除非取得新的明確 scope。

完成前回報五項：已完成、未完成／未處理、自行追加、驗證結果與證據、剩餘風險；並保留 Wave 0／Wave 1 gate。
```

## Push 邊界

本 handoff 文件與本 session 的 runtime／ledger／control-log 變更可納入同一 Git change set；push 只代表寫入 Git remote，不代表 production deploy 或 Wave 0 acceptance。若 GitHub 認證失效，停止在 push 前並回報，不以非授權方式繞過。

### 獨立 Fresh runtime review 結果（2026-08-18）

- 已指派獨立 reviewer `Faraday` 執行只讀 Fresh review；未修改檔案、未寫入 DB、未重跑 concurrency verifier，也未進行任何 remote／production 操作。
- Verdict：`READY_WITH_BLOCKERS`。
- Isolated local gate：`ACCEPTED`；catalog=`33`、RLS=`8/8`、ACL=`9/9 exact match`、capacity envelope PASS、aggregate preflight=`0`。
- Concurrency 僅引用既有 one-shot PASS（`confirmed=1 waitlisted=5`）；zero-residue 僅引用既有 isolated local read-back，沒有升格為 fresh 行為測試。
- Wave 0 overall：`NOT_ACCEPTED for closure`。Wave 1：維持 `BLOCKED`。
- Fresh follow-up：exact-allowlist commit 與 remote／CI／staging／production read-back 尚未完成；Node engine mismatch 與約 593 kB bundle warning 仍為剩餘風險。

### Remote test-event cleanup 結果（2026-08-18）

- 唯讀 preflight 確認唯一 over-limit event=`1`；關聯 registrations=`7`、event_invitation_targets=`9`、audit_logs=`82`，其餘明確 child rows=`0`；auth.users=`4`、public.users=`3`。
- 依 exact authorization 完成單一提交 transaction：刪除該 event 與明確 domain child rows；未刪 auth.users、public.users、其他 events，未做 reset／rollback／broad cleanup。
- zero-residue read-back：over-limit=`0`、所有授權範圍 orphan child counts=`0`；protected auth／public user counts 維持 `4／3`。
- 20260815060000 尚未套用，Cloudflare deploy 尚未執行；下一步需先取得該 migration 的明確授權並重新做 remote read-back。
