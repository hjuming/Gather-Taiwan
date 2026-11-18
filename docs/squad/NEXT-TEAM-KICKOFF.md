# 下一工程團隊啟動提示詞

用途：把下列提示詞完整貼給下一個工程團隊或乾淨 session。它是 Wave 1 Release baseline 完成後的接棒入口，不是 Wave 2 自動開工授權。

## 可直接複製的啟動提示詞

```text
你接手的是 /Users/hjuming/網站專案/聚場台灣 的下一階段工程移交。

## 先讀與固定點

先讀：
1. docs/squad/NEXT-TEAM-KICKOFF.md
2. docs/squad/NEXT-PHASE-PLAN.md
3. docs/squad/LEDGER.md
4. docs/squad/HANDOFF.md
5. implementation-control-log.md
6. README.md、apps/join/README.md
7. apps/join/docs/SSOT.md、apps/join/docs/DEVELOPMENT.md、apps/join/docs/MAINTENANCE.md
8. git status -sb、git log -5、git diff origin/codex/gather-mvp...HEAD

目前固定點：
- branch：codex/gather-mvp
- source/runtime evidence fixed point：83a38e8
- current repo／origin HEAD：先以 git read-back 為準；不要 reset，也不要覆蓋其他使用者的 working-tree 修改。
- Wave 0：CLOSED（evidence-boundary closure）
- Wave 1：ACCEPTED／CLOSED（Release baseline）；Wave 2 仍 BLOCKED／未啟動，需另取得 Phase 2 scope 與 owner 決策，禁止自行跨波次開工。

## 已完成成果與證據邊界

- REMOTE：Supabase catalog=33；指定 migrations present；functions／ACL=9/9；source-aligned RLS=15/15 enabled＋forced；aggregate=0；non-null orphan refs=0。
- LOCAL／ISOLATED LOCAL：既有 gate evidence 保留；phase-aware concurrency 只引用既有 confirmed=1 waitlisted=5，本次禁止重跑。
- CI：PR #1 仍 open、draft、未 merge；current HEAD／Gather Join Gates run／artifact exact-match 以 `implementation-control-log.md` 最末 current section 的 read-back 為準。
- STAGING：workers.dev homepage=200；無 Access assertion 的 POST /__dev/session=403。
- PRODUCTION：/ 與 /app/ 為 200；POST /app/__dev/session=404。這不是 production semantic／device UAT。
- PAGES：deployment URL 可回 200，但 source／control-plane metadata=NOT_VERIFIED。
- FRESH：獨立 reviewer 已對完整 current evidence 回報 ACCEPTED；這只關閉 Wave 0 evidence gate，不等於 merge、deploy 或 production feature PASS。

## 下一階段建議順序

1. Phase 1／Wave 1：已完成 hermetic app／CI／smoke／verifier baseline 與 provenance report，Fresh 已接受。
2. Phase 2／Wave 2：先做 read-only code discovery，再完成 organizer 對線上報名者的 confirm／decline／remove API、UI、RLS、ACL、audit 與 idempotency 閉環。第一個 discovery slice 的 exact read-only allowlist 為：`apps/join/src/lib/api.ts`、`apps/join/src/components/RosterManager.tsx`、`apps/join/src/components/EventPage.tsx`、`apps/join/supabase/migrations/20260805210000_p1_06_08_seat_engine.sql`。已知 app 缺口是 wrappers、操作 UI 與 focused frontend tests；施工 allowlist 必須在 discovery 後由 owner 凍結，migration／Cloudflare／production data 不預先授權。
3. Phase 3／Wave 3：完成 LINE failure matrix、private entry、Cloudflare Access staging／AUTH_RATE_LIMITER 與依賴安全 triage。
4. Phase 4–6：依 `docs/squad/NEXT-PHASE-PLAN.md` 依序處理通知/outbox、event_fields／隱私、Pilot／device／role UAT。

## 開工規則

- 先提交 read-only baseline，列出 fixed point、working tree、目標環境、evidence tier 與 rollback path。
- 施工前要有明確的 slice allowlist；只修改必要 source／test／docs，禁止 broad refactor。
- Wave 2 的第一個 slice 只能是 read-only discovery／contract map；完成後由 owner 確認 exact source／test／docs allowlist，才可施工。
- 每個 slice 都要有 focused verification、read-back 與獨立 Fresh reviewer；施工者不得自我宣稱 acceptance。
- 若 connector、owner、secret、DNS、Cloudflare Access 或 production data 操作受阻，標示 BLOCKED／NOT_VERIFIED，停止該 slice，不猜 credential、不繞路。

## 明確禁止

- 未有 action-specific authorization，不執行 migration、DELETE、reset、rollback、broad cleanup 或 direct auth.users DML。
- 不修改 Cloudflare route／DNS／custom domain；不因 canonical staging 未驗證而自行補 route。
- 不重跑既有 phase-aware concurrency verifier；不使用其結果製造新的 current runtime claim。
- 不把 local／CI／deployment URL／HTTP 200 寫成 production semantic acceptance。
- 不 merge PR #1；不輸出或保存 DB password、service-role key、token、個資；敏感值一律 [REDACTED]。

## 安全本地驗證（僅在新 slice scope 明確後）

```sh
cd /Users/hjuming/網站專案/聚場台灣/apps/join
pnpm typecheck
pnpm lint
pnpm test
pnpm test:security
pnpm build
pnpm smoke
```

`pnpm verify:*concurrency`、`pnpm reset`、`pnpm test:p1-01` 均不是預設啟動指令；需要另行 action-specific authorization 與清楚的 synthetic fixture／rollback contract。

## 交付格式

最終回報固定包含：已完成、未完成／未處理、自行追加、驗證結果與證據、剩餘風險；明確標示 Wave 0、Wave 1 狀態。只 stage 明確檔案，禁止 `git add -A`。
```

## 文件地圖

- `README.md`：新人入口與目前專案狀態。
- `apps/join/README.md`：Join app 架構、指令與產品邊界。
- `docs/squad/NEXT-PHASE-PLAN.md`：下一階段目標、順序、驗收與風險。
- `apps/join/docs/SSOT.md`：產品／技術 contract 與環境邊界。
- `docs/squad/CHARTER.md`：角色、授權、hard stops 與 Wave scope。
- `docs/squad/LEDGER.md`：長期證據台帳與波次狀態。
- `docs/squad/HANDOFF.md`：本輪 current closeout 與歷史快照。
- `implementation-control-log.md`：決策、證據、scope、驗證與 rollback。

## 證據層級提醒

`STATIC`、`LOCAL`、`ISOLATED LOCAL`、`CI`、`STAGING`、`PRODUCTION`、`DEVICE`、`FRESH`、`NOT_VERIFIED` 不可互相替代。Wave 1 CLOSED 不會自動解鎖 Wave 2；任何新 slice 都要重新建立 current evidence。
