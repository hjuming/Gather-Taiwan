# 聚場台灣 Wave 0 最終交接

日期：2026-08-24
來源：Codex／`codex/gather-mvp`
交接性質：Wave 0 final current-evidence closeout；source/runtime fixed point=`83a38e8`，本輪 repo HEAD baseline=`50bb2ea`。固定點 read-back 時 working tree clean；本次 handoff package allowlist 為八份文件，尚未 commit。Supabase current read-only connector 已恢復並完成 catalog／function／ACL／RLS／aggregate／zero-residue read-back；GitHub／CI／staging／production public endpoints 亦已重核。獨立 fresh-context reviewer 對完整 current evidence 明確回報 `ACCEPTED`，故 Wave 0 CLOSED（evidence-boundary closure）；Wave 1 維持 BLOCKED／未啟動。完成本交接 package push 後，current HEAD 以 Git read-back 為準。

## 2026-08-24 current closeout evidence（authoritative）

本節優先於本文件下方較早日期的 `BLOCKED`／`pending` 歷史快照；歷史內容保留供追溯，不代表目前狀態。

- `[REMOTE]` Supabase target ref=`anklbpkyesdmsubyfcna`；migration catalog=`33`，指定 `20260815060000`／`20260818121055` present；9/9 functions present、`SECURITY DEFINER`、固定 `search_path`；function ACL 9/9 exact；source-aligned RLS=`15/15` enabled＋forced；aggregate over-limit=`0`；non-null orphan references=`0`。19 筆 `audit_logs` 的 `event_id` 為 NULL，非 orphan reference。
- `[REMOTE / residual]` advisors current：security 54（INFO 4／WARN 50）、performance 21（INFO 11／WARN 10）；本輪不修改，保留為後續 technical debt。
- `[LOCAL / CI]` source/runtime fixed point=`83a38e8`；current HEAD／origin=`50bb2ea`；PR #1 open、draft、未 merge；Gather Join Gates run `32187430242` completed／success。既有 concurrency one-shot 僅引用 `confirmed=1 waitlisted=5`，本輪未重跑。
- `[STAGING]` workers.dev homepage=`200`；無 Access assertion 的 POST `/__dev/session`=`403`、`{"message":"Forbidden"}`。
- `[PRODUCTION]` `https://gather.wedopr.com/`=`200`；`/app/`=`200`；POST `/app/__dev/session`=`404`、`{"error":"not_found"}`。這不是 production semantic／device UAT。
- `[PAGES / NOT_VERIFIED]` deployment URL `https://f4febb0d.neo-rechao.pages.dev/`=`200`；Pages source／control-plane metadata 本輪未取得。Canonical `staging.join.gather.wedopr.com` DNS 未解析，維持 `UNVERIFIED`。
- `[FRESH]` 獨立 fresh-context reviewer 對完整 current evidence 明確回報 `ACCEPTED`。因此 **Wave 0：CLOSED（evidence-boundary closure）**；**Wave 1：BLOCKED／未啟動**。
- `[BOUNDARY]` 本輪未修改 source、migration、test、package、workflow；未執行 remote migration、DELETE、reset、rollback、broad cleanup；未修改 Cloudflare route／DNS／custom domain；未 merge PR、未宣稱 production semantic/device PASS。
- `[NEXT]` 下一階段提案與可量化驗收目標見 [`NEXT-PHASE-PLAN.md`](./NEXT-PHASE-PLAN.md)；可直接貼上的開發啟動提示詞見 [`NEXT-TEAM-KICKOFF.md`](./NEXT-TEAM-KICKOFF.md)。兩者均不自動解除 Wave 1 BLOCKED。

## 後續維護邊界

Wave 0 已完成本輪 evidence-boundary closure；後續若要處理 Pages source parity、canonical staging DNS、production semantic/device UAT、advisor technical debt 或 PR body provenance，必須另開明確 scope。Wave 1 目前不得開始。

## [HISTORICAL／SUPERSEDED] 目前狀態 snapshots（2026-08-18～2026-08-21）

### 已完成

- `[HISTORICAL SNAPSHOT]` Branch：`codex/gather-mvp`；source/runtime evidence base=`83a38e8`；repo HEAD=`50bb2ea`。當時固定點 read-back 確認 HEAD 與 tracking ref 相同、working tree clean；當時僅四份 allowlisted docs modified。current handoff package 改以八份文件 allowlist 為準，`50bb2ea` 與後續變更均未修改 source／runtime。
- Docker daemon 已恢復；`gather-join-diag-01`、`gather-join-p1` 曾確認 running／healthy。
- 既有 phase-aware concurrency one-shot：`PASS confirmed=1 waitlisted=5`。
- 本輪 guest invitation verifier：token、RLS、aggregate、duplicate roster、capacity、rollback zero-residue 全 PASS。
- `pnpm test`：179 passed、1 skipped；`pnpm typecheck` PASS；`pnpm lint` PASS；`pnpm build` PASS。
- Remote Supabase：本輪 current read-only read-back 為 catalog=`33`、兩支指定 migration present、function／ACL=`9/9`、source-aligned RLS=`15/15` enabled＋forced、aggregate=`0`、non-null orphan refs=`0`；advisors residual lints 保留，未修改。
- Cloudflare Pages：deployment URL `https://f4febb0d.neo-rechao.pages.dev/` current HTTP `200`；Pages source metadata 本輪 `NOT_VERIFIED`。公開 URL 200 不等於 source parity、production semantic/device UAT 或 Wave 0 closure。
- 相關長期台帳與控制紀錄：`docs/squad/LEDGER.md`、`implementation-control-log.md`。

### 本 session 新增 read-back（2026-08-18）

- 歷史 fixed point 實際 HEAD 為 `7a55d9a`；`c483248` 是較早 checkpoint。current final tracked HEAD 為 `a21ce2b`。
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
- Fresh runtime review 已完成一輪，verdict=`READY_WITH_BLOCKERS`；需在 CI／staging evidence 補齊後重新交獨立 Fresh review。本 session 不自我宣稱 Fresh acceptance，Wave 0 仍未關閉。

### [HISTORICAL SNAPSHOT] 進行中／未完成（2026-08-18～2026-08-19）

- 本輪 synthetic member fixture 已清理完成，zero-residue read-back PASS。
- 本輪 concurrency verifier 已依規則只執行一次並 PASS；不得再 retry。
- RLS forward migration 已套用並 read-back 為 `8/8`；catalog／ACL／aggregate 亦 PASS。
- CI read-back PASS：Draft PR #1／current HEAD `50bb2ea` 的 run `32187430242` conclusion=`success`。
- staging deployment／smoke／public URL read-back PASS：target=`gather-join-staging`、version=`82b00639-298b-4f73-aa91-d3169c75258a`、workers.dev homepage=`200`；依 POST contract 的未帶 Access assertion `/__dev/session`=`403`。GET 直接探測為 method mismatch `405`，不列為 route failure。canonical custom host 尚無 DNS/custom-domain/zone route，維持 `UNVERIFIED`。
- Pages production read-back 已完成；不等於 Fresh acceptance。
- remote migration／data 操作、rollback 均未在本次 docs sync 中執行；本次只做文件 sync、commit、push 與 read-back。

### 本 session read-back（2026-08-19）

- 已明確以乾淨 `83a38e8` 作為 fixed point；未 reset、未 broad cleanup、未修改 source／migration／test／package／workflow。
- Supabase app permission 已設為 `ask_before_writes`，只允許讀取而保留寫入確認；但 connector 仍拒絕 `list_migrations` 與唯讀 SQL。未繞過 MCP、未使用 secrets／token／DB 密碼，remote catalog／function／ACL／RLS／aggregate 本輪維持未重驗證。
- Current CI／staging／Pages read-back 已補齊；只有 independent Fresh reviewer 明確 `ACCEPTED` 才能關閉 Wave 0。Wave 1 維持 `BLOCKED`、未啟動。

### [HISTORICAL] Fresh review Maxwell（2026-08-19）

- Verdict=`NOT_ACCEPTED`。Reviewer 確認三檔 allowlist、hard-stop、Wave 1 gate 與 evidence boundary 通過；未修改檔案、未操作 DB、未重跑 concurrency、未 deploy／push。
- 兩個 blocker 已列入 current 文件：Supabase MCP 唯讀 connector 仍拒絕；以及 docs-only handoff HEAD=`22a9de9` 必須和 source/runtime evidence base=`83a38e8` 分開標示。修正後仍需再交 Fresh reviewer，Wave 0 不關閉。

## 重要決策與邊界

- 不把 isolated local evidence 寫成 remote、CI、staging 或 production evidence。
- 不在本交接範圍內處理約 593 kB client bundle warning；先留作 P2，避免擴大 Wave 0 scope。
- 不改 migration timestamp、不做 canonical migration replacement、不碰正式 secrets；任何遠端 migration 或 production deploy 需另行授權與 read-back。
- 僅恢復／檢查 `gather-join-diag-01` local target；未操作 remote／production，未做 reset、broad cleanup 或 managed `auth.users` direct DML。敏感值不落檔、不回傳。

## 引用文件

- [LEDGER](./LEDGER.md)：Wave 0 長期台帳、驗收邊界、下一步。
- [implementation-control-log](../../implementation-control-log.md)：決策、硬停止、runtime 與安全證據。
- 變更預覽：`git diff origin/codex/gather-mvp...HEAD` 與目前 working-tree diff。
- 下一工程團隊啟動包：[`NEXT-TEAM-KICKOFF.md`](./NEXT-TEAM-KICKOFF.md)。

## 建議 Skills

- `handoff`：維持 session 交棒格式與 evidence boundary。
- `supabase:supabase`：執行本地 DB cleanup／read-back 時遵守 RLS、zero-residue、fail-closed。
- `wedo-review`：Fresh runtime handoff 前做獨立 review，不由施工者自我宣稱接受。
- `github:yeet`：需要完整 GitHub publish／draft PR 時使用；先修復 `gh auth`。

## 續接 prompt（歷史版本；目前請優先使用 `NEXT-TEAM-KICKOFF.md`）

> **HISTORICAL／DO NOT EXECUTE**：以下 prompt 僅供追溯，內含已被 current fixed point supersede 的重跑條件與舊 blocker。不得直接複製執行；目前唯一下一步是交獨立 Fresh reviewer，且不得重跑 one-shot concurrency verifier。

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
- [HISTORICAL／DO NOT EXECUTE] cleanup zero-residue 成立後，才可只跑一次 concurrency verifier；此條件已被 current kickoff supersede，不得重跑；若失敗，保留 phase/pg_code/pg_class 的安全診斷，不 retry。
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

## [HISTORICAL／SUPERSEDED] 2026-08-18：remote／Pages closeout read-back sync

- Fixed point：branch=`codex/gather-mvp`、HEAD=`a21ce2b`、origin 同步、working tree clean。
- `[REMOTE / read-only]` Supabase catalog=`33`；`20260815060000`／`20260818121055` present；expected functions=`9/9` conforming；ACL PASS；RLS=`8/8` enabled＋forced；aggregate preflight=`0`。
- `[REMOTE / prior authorized operation]` 唯一 over-limit test event 及明確 domain child rows 已清除；zero-residue read-back PASS；未碰 auth.users、public.users、其他 events。
- `[PRODUCTION / read-only]` Cloudflare Pages project=`gather-taiwan`，source=`a21ce2b`，deployment=`https://1ba56fa0.neo-rechao.pages.dev`；canonical=`https://gather.wedopr.com`；兩者 HTTP `200`。
- `[CI／STAGING / read-only]` PR #1／run `32146604033` 的 `verify` 與 `local-supabase` PASS；`gather-join-staging` version=`82b00639-298b-4f73-aa91-d3169c75258a`、workers.dev homepage=`200`、protected route=`403`。Canonical custom host 仍無 DNS/custom-domain/zone route。
- 歷史段落中的「尚未套用 migration／尚未 deploy」是當時狀態；本段為 current read-back，不得混用 evidence tier。

## [HISTORICAL／SUPERSEDED] Current closeout gate（2026-08-21 snapshot）

- Wave 0：**未關閉／overall acceptance blocked**。獨立 Fresh `Hooke` 僅接受 docs-only 文件審查；Current Supabase remote evidence 仍 blocked，不能升格為 Wave 0 acceptance。
- Wave 1：**blocked，未啟動**。
- 下一步：恢復合法 Supabase 唯讀 connector，補 current remote read-back；docs-only Fresh 已 `ACCEPTED`，不能再把 docs review 當作完整 Wave 0 acceptance。

## [HISTORICAL／SUPERSEDED] 2026-08-18：Fresh closeout re-review preparation

- Current handoff evidence base：branch=`codex/gather-mvp`、commit=`69dab0c`；接手時重新 read-back HEAD／origin／working tree。本次仍只允許更新文件，未修改 source／migration／test／package／workflow。
- `[CI / read-only]` Draft PR #1／run `32150304903` 的 `verify`、`local-supabase` 與 Cloudflare Pages check 均 PASS。
- `[STAGING / read-only]` `gather-join-staging` version=`82b00639-298b-4f73-aa91-d3169c75258a` 100% traffic；workers.dev homepage=`200`、未帶 Access assertion 的 `/__dev/session`=`403`。Canonical `staging.join.gather.wedopr.com` 仍無 DNS answer／custom domain／zone route；只將 canonical custom-host 子 gate 標為 `UNVERIFIED`，不把它誤寫成 staging deployment public-URL gate 失敗。
- `[PRODUCTION / read-only]` Pages project=`gather-taiwan` source=`69dab0c`；deployment=`https://f4febb0d.neo-rechao.pages.dev` 與 canonical=`https://gather.wedopr.com` 均 HTTP `200`；docs-only auto deployment，不代表 runtime source release。
- 獨立 Fresh Reviewer `Russell` 的只讀 verdict=`READY_WITH_BLOCKERS`。最小 blocker 不是 source、DB、CI、staging 或 Pages failure，而是先前文件仍有舊 HEAD／CI／Pages 證據；本次同步後需再交 Fresh 複核，取得明確 `ACCEPTED` 才能關閉 Wave 0。
- Wave 0：**仍未關閉／Fresh re-review pending**。Wave 1：**blocked，未啟動**。
