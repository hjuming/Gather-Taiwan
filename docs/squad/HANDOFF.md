# 聚場台灣 Wave 0 最終交接

日期：2026-08-18
來源：Codex／`codex/gather-mvp`
交接性質：本 session 的工程交棒摘要，不代表 release、production acceptance 或 Wave 0 closure。

## 下一個 session 的目標

在不擴大 Wave 0 scope 的前提下，完成本地 isolated runtime 的收尾：清除本輪 synthetic member fixture、重新取得一次 concurrency 與 catalog／ACL／RLS read-back，然後交 Fresh runtime review。只有所有證據層級分開成立後，才可評估 Wave 0 closure；Wave 1 目前不得開始。

## 目前狀態

### 已完成

- Branch：`codex/gather-mvp`；目前 HEAD：`e2cdeb9`；已與 `origin/codex/gather-mvp` 同步。
- Docker daemon 已恢復；`gather-join-diag-01`、`gather-join-p1` 曾確認 running／healthy。
- 既有 phase-aware concurrency one-shot：`PASS confirmed=1 waitlisted=5`。
- 本輪 guest invitation verifier：token、RLS、aggregate、duplicate roster、capacity、rollback zero-residue 全 PASS。
- `pnpm test`：179 passed、1 skipped；`pnpm typecheck` PASS；`pnpm lint` PASS；`pnpm build` PASS。
- 相關長期台帳與控制紀錄：`docs/squad/LEDGER.md`、`implementation-control-log.md`。

### 進行中／未完成

- 本輪為 capacity／guest gate 建立的 synthetic member fixture 尚未清理。
- 本輪 concurrency 重跑與 catalog／ACL／RLS fresh read-back 尚未完成。
- 因 execution escalation usage limit，暫停以任何繞路方式連線或刪除本地 DB fixture；恢復權限後只做一次 cleanup，再做一次必要 runtime read-back。
- Fresh runtime、remote DB、CI、production、deploy、rollback 均未驗收或未執行。
- GitHub CLI token 目前失效；是否能以 Git credential 直接 push 需在 push 前重新確認。

## 重要決策與邊界

- 不把 isolated local evidence 寫成 remote、CI、staging 或 production evidence。
- 不在本交接範圍內處理約 593 kB client bundle warning；先留作 P2，避免擴大 Wave 0 scope。
- 不改 migration timestamp、不做 canonical migration replacement、不碰正式 secrets；任何遠端 migration 或 production deploy 需另行授權與 read-back。
- Existing Docker stacks 未操作；測試使用 synthetic identities，敏感值不落檔、不回傳。

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

目前固定點：branch codex/gather-mvp，HEAD c483248；Wave 0 未關閉，Wave 1 不得開。
既有證據：phase-aware concurrency one-shot PASS（confirmed=1 waitlisted=5）、guest verifier PASS、179 tests passed + 1 skipped、typecheck/lint/build PASS。

先處理未完成：
- execution escalation 恢復後，刪除本輪 synthetic member fixture；只操作明確 fixture，不做 reset 或 broad cleanup。
- 只跑一次 concurrency verifier；若失敗，保留 phase/pg_code/pg_class 的安全診斷，不 retry。
- 補一次 migration catalog／ACL／RLS read-back與 aggregate preflight；所有結果標註 isolated local。
- 完成 cleanup zero-residue read-back後，才交 Fresh runtime review。

不得做：
- 不做 remote migration、production deploy、rollback、push 以外的外部變更。
- 不把 local／static PASS 宣稱成 remote／CI／production PASS。
- 不輸出或保存 DB 密碼、service-role key、token、個資；敏感值一律 [REDACTED]。
- 不擴大處理 593 kB bundle warning；除非取得新的明確 scope。

完成前回報五項：已完成、未完成／未處理、自行追加、驗證結果與證據、剩餘風險；並保留 Wave 0／Wave 1 gate。
```

## Push 邊界

本 handoff 文件與本 session 的 runtime／ledger／control-log 變更可納入同一 Git change set；push 只代表寫入 Git remote，不代表 production deploy 或 Wave 0 acceptance。若 GitHub 認證失效，停止在 push 前並回報，不以非授權方式繞過。
