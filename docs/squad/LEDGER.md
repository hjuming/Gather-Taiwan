# 聚場台灣 Orion Closure Squad｜LEDGER

## Current fixed point

- 日期：2026-08-18
- 初始 branch：`codex/gather-mvp`
- 初始 HEAD：`22091b6`
- 目前 handoff evidence base：branch=`codex/gather-mvp`、commit=`69dab0c`；current HEAD／origin／working tree 由接手團隊重新 read-back。
- 目前 Wave：**Wave 0｜manual roster P0（Fresh re-review pending）**
- Atlas fixed point：**done／acceptance pending**；LOCAL Git clean、local refs `50 ahead / 0 behind`；Node `24.15`、pnpm `10.33.2`。
- Atlas production read-back：**PASS（PRODUCTION）**；Worker version `e0fcc0c2-c834-480b-b9d3-424783e20b19`、route `gather.wedopr.com/app/*`、production assets／headers read-back PASS。
- GitHub／CI：**PASS（PR #1／run 32150304903）**；staging deployment／public read-back：**PASS（workers.dev 200／protected route 403）**。Remote DB migration／runtime：**PASS（REMOTE read-back）**；catalog=`33`、`20260815060000`／`20260818121055` present、function=`9/9` conforming、ACL PASS、RLS=`8/8` enabled＋forced、aggregate preflight=`0`。
- Wave 0 safe diagnostic：**ACCEPTED（Fresh LOCAL-code）**。Fallback3 DB runtime 的 concurrency 已完成 phase-aware 根因修正，並已補完 phase-aware one-shot 驗證：以 `gather-join-diag-01` isolated local DB、受控環境變數中的 dedicated owner 跑 `apps/join/scripts/verify-manual-roster-concurrency.mjs`，本輪 `PASS confirmed=1 waitlisted=5`。連線字串與 owner identifier 不落台帳。Wave 0 未關閉，Wave 1 不得開。
- Local WIP safepoint 已建立：`669f42d9efb4b7ccdb239bd3a561ffcbb8e9bdf0`（`wip(join): checkpoint wave 0 capacity hardening`）；exact 9-file allowlist，commit 當下 post-commit clean，未 push／tag／PR。明確不是 release，Wave 0 未關閉。
- Git 規則：只 stage 明確檔案，禁止 `git add -A`；本狀態檔不代表已 commit、push、deploy 或 Pilot ready。
- 2026-08-17 現場狀態：Docker daemon 已回復。`gather-join-diag-01` 與 `gather-join-p1` 均為 running，且 DB 可連線（`127.0.0.1:58332` 可讀到 `select now()`）。
- 已完成剩餘風險拆解第一步：只執行一次 phase-aware concurrency diagnostic，並抓到 `manual roster concurrency verifier: PASS confirmed=1 waitlisted=5`；同一會話已做 zero-residue 查核，僅餘下可追蹤的 synthetic organizer 殘留已手動清除。
- 2026-08-17 續作：guest invitation verifier 在 `gather-join-diag-01` 回讀完整 PASS（token／RLS／aggregate／duplicate roster／capacity／rollback zero-residue）；本輪另建立一次性 member fixture 供 capacity／guest gate 使用，但因 execution escalation 額度耗盡，尚未能執行 fixture cleanup 與本輪 concurrency 重跑，故不得把本輪標為 full isolated runtime acceptance。
- 2026-08-17 build：`pnpm build` PASS（Node `20.20.2`，package engine 要求 `>=22`）；client bundle `593.15 kB` 仍觸發 Vite `>500 kB` warning，未在本輪擴大 scope 修正。
- 2026-08-18 session read-back：實際 branch `codex/gather-mvp`、`HEAD=7a55d9a`（`c483248` 為較早 checkpoint）；isolated DB `127.0.0.1:58332` 可連線。依 cardinality check 確認 owner 加唯一一個 non-owner member fixture，透過 local Auth Admin cleanup 嘗試後回 `504`，自然釋放後仍為 `owner=1 / non-owner=1`；未直接對 `auth.users` DML，未 retry cleanup。
- 2026-08-18 isolated local read-back：catalog `applied_count=32`、target `20260815060000` present、latest 同為 `20260815060000`；ACL 目標矩陣 PASS、capacity envelope definition PASS、aggregate-only preflight `0`。RLS read-back 為 `7/8`，缺口是 `public.event_invitation_targets` 未 `FORCE ROW LEVEL SECURITY`；不得把本輪標為 full runtime acceptance。
- 2026-08-18 gate：因 cleanup zero-residue 未成立，依 fail-closed 邊界未執行本輪 concurrency verifier，未交 Fresh runtime review；Wave 0 維持未關閉，Wave 1 維持 blocked。上述皆為 isolated local evidence，不代表 remote DB／CI／staging／production。
- 2026-08-18 authorized continuation：新增 forward-only migration `20260818121055_event_invitation_targets_force_rls.sql`；已套用至 `gather-join-diag-01` local DB container，catalog=`33`、RLS=`8/8`、ACL PASS、aggregate preflight=`0`。host port 58332 的 CLI mapping 仍 timeout，未做 remote apply。
- 2026-08-18 cleanup follow-up：唯一 non-owner profile 已在 domain reference 全為 `0` 後精確清除；Auth Admin GET／DELETE 均回 `404`，`auth.users` 仍有唯一 non-owner orphan row（`instance_id` 無匹配）。依 managed-auth 邊界未執行 direct `auth.users` DML；zero-residue 仍 FAIL，concurrency／Fresh 仍未開始。
- 2026-08-18 authorized local cleanup：取得 action-specific authorization 後，僅刪除上述唯一 orphan `auth.users` row；post-cleanup read-back 為 owner auth/profile=`1/1`、non-owner auth/profile/session=`0/0/0`、domain references=`0`。
- 2026-08-18 concurrency gate：只執行一次 phase-aware verifier，結果 `PASS confirmed=1 waitlisted=5`；post-verifier race organizers/events/audit=`0/0/0`。
- 2026-08-18 runtime gate：catalog=`33`、migration `20260818121055` present、RLS=`8/8`、ACL PASS、capacity envelope PASS、aggregate preflight=`0`。isolated local runtime evidence 已備妥交獨立 Fresh reviewer；Wave 0 尚未因本 session 自我審查而關閉，Wave 1 維持 blocked。
- 2026-08-18 remote／Pages closeout read-back：remote catalog=`33`、兩支指定 migration present、function=`9/9` conforming、ACL PASS、RLS=`8/8` enabled＋forced、aggregate=`0`；Cloudflare Pages `gather-taiwan` production source=`69dab0c`，deployment=`https://f4febb0d.neo-rechao.pages.dev` 與 `https://gather.wedopr.com` 均 HTTP `200`。此為 docs-only auto deployment，不等於 runtime source release 或 Fresh acceptance。
- 2026-08-18 CI／staging route read-back：PR #1 run `32150304903` 的 `verify`、`local-supabase`、Cloudflare Pages check 均 PASS；`gather-join-staging` version=`82b00639-298b-4f73-aa91-d3169c75258a` 100% traffic，workers.dev homepage=`200`、未帶 Access assertion 的 `/__dev/session`=`403`。Canonical `staging.join.gather.wedopr.com` 仍無 DNS/custom-domain/zone route，故不宣稱該 custom host 已驗收。

## Wave 0 workboard

| 工單 | 狀態 | 產物／證據路徑摘要 | 驗收狀態 | 下一步 |
|---|---|---|---|---|
| W0-ATLAS fixed point | done | branch／HEAD、LOCAL Git、Node／pnpm、Worker／Pages route／deployment read-back | acceptance=pending | Fresh re-review |
| W0-DB discovery | done | `apps/join/supabase/migrations/`、`apps/join/scripts/verify-p1-11-manual-roster.sql`、RLS／RPC 契約 | remote DB read-back PASS；Fresh pending | 只交獨立 Fresh re-review；Wave 2 維持 blocked |
| W0-APP discovery | done | `apps/join/src/components/RosterManager.tsx`、`src/lib/api.ts`、`worker/index.ts`、`scripts/smoke.mjs`、`scripts/smoke-staging.mjs`、`.github/workflows/join-gates.yml` | CI／staging read-back PASS；Fresh pending | 只交獨立 Fresh re-review；Wave 1 維持 blocked |
| W0-ECHO | done | `docs/squad/CHARTER.md`、`docs/squad/LEDGER.md`、本段 control log | docs sync complete；Fresh pending | 只交獨立 Fresh re-review |
| W0-Forge-DB correction round 3 | historical / superseded | `20260815060000_manual_roster_capacity_seat_engine_fix.sql`、manual-roster capacity／concurrency verifiers、package gate wiring；不得擴大至 event_fields | Fresh3 historical REJECT；已由 architecture replacement supersede | No action；不得重開舊 correction round |
| W0-Forge-DB architecture replacement | done／Fresh pending | isolated local cleanup／one-shot concurrency／catalog／ACL／RLS／aggregate gates；remote read-back | isolated local＋remote PASS；Fresh overall pending | 只交獨立 Fresh re-review |
| W0-ATLAS single-DB fallback | done／historical evidence | Fallback3 isolated DB route 與 cleanup evidence；existing stack unchanged | historical partial runtime；current closeout evidence 已另列 | No action；不得重跑舊 fallback |
| W0-FRESH2 | historical / superseded | REJECT：P0=0、P1=3、P2=2 | historical REJECT | No action；已由後續 Fresh round supersede |
| W0-FRESH3 | historical / superseded | REJECT：P0=0、P1=2 | historical REJECT | No action；已由後續 Fresh round supersede |
| W0-FRESH4 | historical / superseded | REJECT：P1=2 | historical REJECT | No action；已由後續 Fresh round supersede |
| W0-FRESH5 | historical / superseded | REJECT：P1 reader consistency | historical REJECT | No action；已由後續 Fresh round supersede |
| W0-FRESH6 | historical / superseded | REJECT：P1×2 | historical REJECT | No action；已由後續 Fresh round supersede |
| W0-FRESH7 | done／historical | Node 24：`51/51`、`173 passed / 1 skipped`、`14/14`、build PASS | ACCEPTED（STATIC／LOCAL-code，P0=0、P1=0） | No action；Fresh overall pending，Wave 0 尚未關閉 |
| W0-FRESH runtime diagnosis | in-progress | isolated local＋remote＋CI＋staging＋Pages read-back completed | 前一輪 `READY_WITH_BLOCKERS`；文件 sync 後 Fresh re-review pending | 交獨立 Fresh Reviewer |
| W0-Forge-DB instrumentation | done／historical | safe fixed-field diagnostic；只保留定位所需 `phase`／`code` | ACCEPTED（Fresh LOCAL-code）；非 DB acceptance | No action；只交獨立 Fresh re-review |
| W0-GIT safepoint | done／historical | local commit `669f42d9efb4b7ccdb239bd3a561ffcbb8e9bdf0`；exact 9-file allowlist | post-commit clean；非 release／DB acceptance | No action；current HEAD／origin 以 fixed point 為準 |

### W0 DB discovery：三個 RPC 缺口與最小 allowlist

- 缺口一：主辦人 confirm 線上報名者；缺口二：主辦人 decline 線上報名者；缺口三：主辦人 remove 線上報名者。現有 `organizer_edit_manual_participant` 僅適用 `user_id is null` 的 manual row，不能替代三者。
- 最小 allowlist：一條 forward-only migration（3 個 RPC、狀態矩陣、ACL／RLS、audit／席次／通知不變量）＋`apps/join/src/lib/api.ts` wrapper＋主辦名單 UI／測試＋最小 rollback verifier；不改 event_fields、不改 Worker、不改付款模型。

### W0 Fresh decision：REJECT

- P1-1 state transition：狀態轉移語意未形成可接受的 fail-closed contract。
- P1-2 confirmed insert：confirmed insert 路徑尚未證明由同一席次不變量保護。
- P1-3 total＋pool capacity：總容量與 pool 容量必須同時約束，現有證據不足。
- P1-4 FIFO 插隊：manual roster 不得繞過既有候補 FIFO 順序。
- P1-5 鎖序 deadlock：鎖取得順序仍有 deadlock 風險，需以固定鎖序與 concurrency evidence 關閉。
- P1-6 negative verifier aborted transaction：負向案例令 transaction aborted，後續斷言不再是有效證據；需以 savepoint／rollback 隔離預期錯誤。
- P2-1 concurrency zero-residue：併發 verifier 必須讀回 synthetic fixture 零殘留。
- P2-2 audit snapshot：需補 before／after audit snapshot，證明狀態、席次與 actor 記錄一致。
- Evidence boundary：普通 LOCAL typecheck／lint／test／security／build／smoke 即使全綠，也不能抵銷上述 semantic REJECT。DB runtime／remote／production 仍為 `NOT_RUN`；GitHub／CI 仍為 `BLOCKED`。

### W0 Fresh2 decision：REJECT

- P1-1 deadlock retry：deadlock retry 契約仍未形成可接受的可重跑證據。
- P1-2 managed `auth.users` DML：correction／verifier 仍碰到 managed `auth.users` 直接 DML 邊界。
- P1-3 trim／audit 不實：trim 與 audit snapshot 未如實反映實際持久化的 before／after 值。
- P2-1 concurrency params：concurrency verifier 的參數與預期結果仍需完整斷言。
- P2-2 台帳未同步：correction round、驗證狀態與台帳 evidence 尚未同步。
- 熔斷規則：若 Fresh3 再出現同類 P1，停止疊加 patch，回到 Orion 架構裁決後才可續作；Fresh3 已觸發此規則。
- Evidence boundary：DB runtime／remote／production 維持 `NOT_RUN`；GitHub／CI 維持 `BLOCKED`。

### W0 Fresh3 decision：REJECT／Orion architecture decision

- P1-1 invite pool bypass：manual／invite 路徑仍可繞過 invite pool 的共用容量邊界。
- P1-2 promotion audit actor／usage：promotion audit 尚未同時保存正確 actor 與實際 capacity usage。
- Evidence boundary：Fresh、Fresh2、Fresh3 前三輪的普通 LOCAL gates 即使全綠，也不能抵銷 semantic REJECT；DB runtime／remote／production 維持 `NOT_RUN`，GitHub／CI 維持 `BLOCKED`。
- Orion 採 backward-compatible capacity envelope：`event_capacity_usage` 保留舊 keys，新增 `limits`、`available`、`within_limits`、`merged`。
- manual／invite 保留各自狀態機，但共用同一 capacity envelope；token rollback verifier 必須驗證 after-state；promotion 採 actor-aware core，另保留 2-arg wrapper 相容入口。
- 裁決理由：繼續補局部 `if` 會讓規則漂移；萬能 candidate helper 則過度抽象且有高相容風險。
- Migration 分流：唯讀 catalog 查詢 `supabase_migrations.schema_migrations` 顯示 `20260815060000` 為 `MISSING`，確認尚未套用，可繼續收斂原 untracked migration。

### Migration-list false alarm：解除

- `supabase migration list --local` 的 `Local` 欄代表 filesystem migration；只有 `Remote` 欄代表目標 DB applied 狀態，不得以 `Local` 欄放行。
- 直接唯讀 catalog 查詢 `supabase_migrations.schema_migrations` 對 `20260815060000` 回報 `MISSING`，故原 untracked migration 可繼續修改；Forge-DB architecture replacement 恢復 `in-progress`。
- 正式 remote 套用前仍須重新取得 remote migration ledger 與 function definition read-back；目前不宣稱 DB runtime／remote migration／production PASS，GitHub／CI 仍為 `BLOCKED`。

### W0 Fresh4 decision：REJECT／Orion conservative identity

- P1-1 mutable `display_name` dedupe：manual／invite 的可變姓名不得用於去重，rename 不得改變 capacity usage。
- P1-2 多重同名 cardinality：不同人的相同姓名不得被折成單一 seat；`registration` 與 `attending` invite 各自計席。
- MING 原計畫在 Wave 3 才建立 explicit linkage，且 linkage 不得只靠 `display_name`；Wave 0 不提前發明身份關聯。
- Orion 裁決：移除姓名去重，採保守計席；保守高估優先於 oversell。
- 正式 apply 前只跑 aggregate-only preflight；若任何既有 event 在保守計量下超額，或修正將影響真實使用者，命中 MING hard stop，必須停下裁決。
- Evidence boundary：Forge-DB 維持 `in-progress`；DB runtime／remote migration／production 仍為 `NOT_RUN`，GitHub／CI 仍為 `BLOCKED`。

### W0 Fresh5 decision：REJECT／reader consistency

- P1 reader consistency：RSVP canonical total 已使用新計席語意，但 private invitation reader 仍沿用舊 `display_name` dedupe，造成 reload 前後／跨 reader 顯示的容量數字不一致。
- 舊 guest verifier 固化舊數值，不能作為新 envelope 的正確性證據；須改驗證 canonical total 與 reader reload 一致。
- Correction allowlist：只讓 private invitation reader 的容量 facts 讀取 capacity envelope，並同步最小 verifier assertion；名單呈現與公開／私密政策不改。
- Evidence boundary：Forge-DB 維持 `in-progress`；DB runtime／remote migration／CI／production 仍為 `NOT_RUN`，GitHub 仍為 `BLOCKED`。

## 歷史快照（2026-08-17 以前）：W0 Fresh decisions 與 isolated runtime attempts

> 本節以下內容是早期 Fresh6／Fresh7 與 isolated runtime 嘗試的歷史紀錄；其中的 `NOT_RUN`、`BLOCKED`、`pending`、舊 runtime 順序與 hard-stop 描述不得覆寫本檔 current fixed point，也不得誘導接手者重跑已完成的 one-shot gate。現行 evidence 以本檔頂部 current fixed point、2026-08-18 closeout read-back 與最新獨立 Fresh review 為準。

### W0 Fresh6 decision：REJECT／verifier evidence

- P1-1 capacity actor fixture：capacity verifier 以 random UUID 誤標為 staff，實際只證明 non-member；須改用 explicit member ID，並將案例正名為 non-organizer。
- P1-2 guest rollback residue：guest verifier rollback 後缺少逐表 zero-residue read-back；須逐表證明 synthetic fixture 無殘留。
- Migration source 其餘 semantic checks 為 PASS，但只屬局部 source evidence，不等於 Fresh acceptance 或 Wave 0 closure。
- Evidence boundary：Forge-DB 維持 `in-progress`；DB runtime／remote migration／CI／production 均為 `NOT_RUN`，GitHub 仍為 `BLOCKED`。

### W0 Fresh7 acceptance／isolated runtime

- Fresh7：**ACCEPTED（STATIC／LOCAL-code，P0=0、P1=0）**。Node 24 證據為 `51/51`、`173 passed / 1 skipped`、`14/14` 與 build PASS；skip 不轉譯為 runtime PASS。
- Evidence boundary：以上不是 DB runtime、CI、remote DB 或 production evidence；這些層級仍為 `NOT_RUN`，GitHub 仍為 `BLOCKED`。
- Isolated runtime 使用獨立 `project_id`、專用 port range 與 temporary root；不得啟停、重設、重用或污染 existing stack。
- Synthetic identities 只透過 Admin API 建立／清理，禁止直接對 managed `auth.users` DML。
- Runtime gate：依序跑 capacity、concurrency、guest 三個 verifiers，並檢查 migration catalog、function／table ACL、RLS、aggregate-only preflight 與逐項 cleanup／zero-residue。
- Isolated runtime route 已 hard stop；Fresh7 code acceptance 保留，但 Wave 0 不關閉。

### Isolated runtime hard stop

- 兩次 temporary Supabase start 均在 pull／health／timeout 階段失敗；兩次過程 Wave0 resources 始終為 `0`，未進入可執行 DB gate 的狀態。
- Migrations、catalog read-back、aggregate-only preflight、capacity／concurrency／guest 三個 verifiers 均為 `NOT_RUN`。
- 兩個 temporary targets 均已 exact cleanup；cleanup 後 Wave0 resources=`0`。Existing baseline 的 13 IDs／ports、2 volumes、1 network 皆 unchanged。
- Strict health snapshot mismatch 來自 existing edge-runtime 的既有 exited 狀態，非本輪建立或改動；不得歸因為 Wave0 residue。
- 不做第三次同路線 retry。Atlas single-DB fallback 僅唯讀 `in-progress`；未有替代 runtime evidence 前，DB runtime／remote／CI／production 仍為 `NOT_RUN`。

### Fallback3 partial runtime

- PASS：isolated DB 啟動；32 migrations 套至 latest `20260815060000`；migration catalog、SECURITY DEFINER／`search_path`／reader、ACL、5 項 RLS 與 aggregate-only preflight=`0` 均通過。
- PASS：GoTrue health；透過允許的管理介面建立 2 個 synthetic identities，profiles read-back 通過；guest 與 capacity verifiers 通過，rollback residue=`0`。
- 當次紀錄：concurrency verifier 曾回報 sanitized `database_connection`；該輪為 one-shot，依邊界未 retry，故 runtime overall 當時 **不合格**、Fresh not ready。後續 phase-aware one-shot 修正證據已補齊（見下）。
- Cleanup：synthetic identities=`0`、Wave0 resources=`0`、temporary target 已刪除、existing stack unchanged；本段不記錄 secrets 或 IDs。
- Evidence boundary：此為 isolated DB 部分 runtime 證據，不是 remote DB、CI 或 production PASS；Wave 0 仍未關閉。

### Concurrency root-cause diagnosis

- 歷史上 `sanitized database_connection` 無法唯一判因；現已確認原 blocker 與 phase-aware 失敗為 fixture setup/cleanup 競態（`23514`）與順序，修正後已再跑過 one-shot PASS，未再出現該類失敗。
- 已確認可追蹤 bug：concurrency verifier 的 error rewrap 丟失原始 `phase`／`code`，使 infrastructure 與 business failure 無法安全區分。此欄位保留已完成並固化於 verifier，後續 remote/分環境可直接對照。
- Orion 裁決：保留 fixed-field diagnostic 作為定位線索；禁止輸出 message、stack、query、params、address、port、DSN 或 IDs。
- 在修正後，DB diagnostic 還未走到 remote/full run。`DB diagnostic 仍 pending`，runtime overall 不合格，直到 full runtime acceptance 完成為止。

### 歷史快照（2026-08-17）：Wave 0 blocker final sync／safepoint readiness

> 本節是 2026-08-17 當時的歷史狀態，不是目前 restart 指令或現況判定。現行 evidence 以本檔 `Current fixed point`、2026-08-18 closeout read-back 與最新獨立 Fresh review 為準。

- Safe diagnostic 已由 Fresh **ACCEPTED（LOCAL-code）**；這只驗收固定欄位 instrumentation，不是 DB runtime acceptance。
- Fallback3 DB runtime partial PASS：32 migrations（latest `20260815060000`）、catalog、ACL、RLS、aggregate preflight=`0`、guest 與 capacity verifier；concurrency verifier 在 fixture 與 cleanup 修正後已於 `gather-join-diag-01` 跑出 one-shot PASS（`confirmed=1 waitlisted=5`）。
- 本次 one-shot synthetic fixture 已核對 zero-residue；先前 `manual-race-org-*` 殘留已補清，現況無剩餘。
- Cleanup read-back：Wave0 resources=`0`、temporary target deleted、existing stack unchanged。
- External blockers：isolated runtime 已可運行；GitHub auth invalid；remote DB credential unavailable；尚未完成 remote migration read-back。
- Gate：Wave 0 未關閉，Wave 1 不得開；未執行 remote migration、deploy 或 push。
- 下一步條件：完成 full isolated runtime acceptance（capacity/guest/concurrency + catalog/ACL/RLS）後再做 Fresh runtime handoff；remote/CI 仍 pending。
- 目前本機 dirty WIP 僅可標為 safepoint candidate；明確不是 release、DB acceptance、remote apply 或 deployment readiness。

### 歷史快照：Local WIP safepoint established

> 本節記錄 `669f42d` 建立時的歷史 safepoint；不代表目前 HEAD、目前工作樹或目前 external blocker。接手時必須重新 read-back current branch／HEAD／origin／working tree。

- Commit：`669f42d9efb4b7ccdb239bd3a561ffcbb8e9bdf0`；message：`wip(join): checkpoint wave 0 capacity hardening`。
- Exact 9-file allowlist：`apps/join/package.json`、`apps/join/scripts/migration-contract.test.ts`、`apps/join/scripts/verify-guest-invitations.mjs`、`apps/join/scripts/verify-manual-roster-capacity.mjs`、`apps/join/scripts/verify-manual-roster-concurrency.mjs`、`apps/join/supabase/migrations/20260815060000_manual_roster_capacity_seat_engine_fix.sql`、`docs/squad/CHARTER.md`、`docs/squad/LEDGER.md`、`implementation-control-log.md`。
- Post-commit read-back：working tree clean；未 push、tag 或建立 PR。此 commit 只是一個 local WIP safepoint，不是 release、DB runtime acceptance 或 Wave 0 closure。
- Restart concept：先確認 branch／HEAD 與 blockers；Docker／db-start 穩定後只執行一次 phase-aware concurrency diagnostic，取得 phase 後再判 root cause，最後交 Fresh runtime。GitHub auth 與 remote DB credential 仍 `BLOCKED`。
- 本段兩份 Echo docs sync 發生在 commit 之後，未包含於 `669f42d`；不得用 commit 當下 clean 宣稱目前工作樹 clean。

## Wave 1–6 workboard

| Wave | 狀態 | Closure gate |
|---|---|---|
| Wave 1｜Release baseline | blocked（Wave 0 未關閉） | hermetic smoke、CI 分工、verifier、mutation evidence、Fresh |
| Wave 2｜線上報名者 confirm／decline／remove | pending | RPC／RLS／席次／audit／通知 contract、app E2E、Fresh |
| Wave 3｜登入／私密入口／依賴安全 | pending | auth failure matrix、private capability、dependency／security gate、explicit linkage（不得只靠 `display_name`） |
| Wave 4｜通知與 outbox | pending | Email／站內通知、retry、DLQ、recipient boundary、Fresh |
| Wave 5｜event_fields／發現／名單隱私 | pending | event_fields UI、公開發現政策、roster privacy、role UAT |
| Wave 6｜Pilot Gate | pending | staging／production、rollback、device／role UAT、Fresh release readiness |

## Historical decision record

> 以下為歷史決策摘錄，保留作為追溯資料；其中的 `blocked`、`pending`、舊 safepoint 與舊 restart 條件不得覆寫本檔最上方的 current fixed point。現行狀態以 current fixed point 與最新 closeout sections 為準。

- 採 T1 orchestrator-workers 與目標模式；自動授權、六類 MING hard stop、Evidence tier 以 `CHARTER.md` 為準。
- Wave 0 app 不改：manual roster 既有前端 wrapper／RPC 契約可供 DB discovery 對照；`event_fields` 明確排除本 Wave。
- manual row `user_id is null` 沒有可通知 recipient；不造 outbox、不新增假通知收件人。
- `dist/gather_join_staging` 污染 smoke 的根因候選與 Wave 1 最小 allowlist 已定位，尚未施工或宣稱通過。
- Wave 0 Fresh7 已 `ACCEPTED（STATIC／LOCAL-code，P0=0、P1=0）`；Node 24 gates 為 `51/51`、`173 passed / 1 skipped`、`14/14`、build PASS。
- 此 acceptance 不含 DB runtime、CI、remote DB 或 production；Fallback3 雖為 partial runtime，現在 concurrency 已補完並在 `gather-join-diag-01` one-shot PASS，DB runtime acceptance 尚待 full isolated pass。
- Concurrency 的 sanitized `database_connection` 已由 fixture/setup 修正證實不再阻塞；fixed-field `phase`／`code` 仍保留供 remote/其它環境對照。
- Safe diagnostic 已獲 Fresh LOCAL-code acceptance；one-shot concurrency fixed fields 已有 phase 可追溯，DB root cause 與 runtime acceptance 仍 pending。
- Local WIP safepoint `669f42d9efb4b7ccdb239bd3a561ffcbb8e9bdf0` 已建立且 commit 當下 post-commit clean；它不是 release／DB acceptance。Isolated runtime、GitHub auth 與 remote DB credential blockers 解除前，Wave 1 不開，也不做 remote migration／deploy／push。
- Explicit linkage 依 MING 原計畫留到 Wave 3，且不得只靠 `display_name`；Wave 0 以保守高估優先避免 oversell。
- Migration-list false alarm 已解除：`Local` 是 filesystem、`Remote` 才是 applied；catalog `MISSING` 證明 `20260815060000` 未套用，但正式 remote apply 前仍須 ledger＋function definitions read-back。
- Worker／Pages 既有 deploy／rollback、合格 forward-only migration、allowlist commit／push／PR，以及 CI＋Fresh 後 merge 已獲授權，不需重問；仍須留下 evidence。

## Historical restart guide（不得直接照做）

> 本段是舊 runtime 阻塞期的操作指南，僅供追溯，不是本輪的下一步。不得依本段重新執行已完成的 one-shot concurrency gate、cleanup 或 full isolated runtime；目前只等待／執行交接文件指定的獨立 Fresh re-review。

1. 先讀本檔、`docs/squad/CHARTER.md` 與本段 control log；確認 branch=`codex/gather-mvp`、local safepoint HEAD=`669f42d9efb4b7ccdb239bd3a561ffcbb8e9bdf0`、目前 dirty baseline、Worker／DB live state，不假設 commit 當下 clean 仍為真。
2. 保留 Fallback3 partial runtime 與 cleanup 證據；safe diagnostic 已 Fresh LOCAL-code accepted。已補一次 phase-aware concurrency one-shot 並 PASS，並清除剩餘 synthetic 殘留。接著需完成 full isolated runtime acceptance（capacity/guest/concurrency + catalog/ACL/RLS）後再交 Fresh runtime。Wave 0 未關閉，Wave 1 不開。
3. Wave 0 關閉前不得開始 Wave 1；解除後仍只依 app discovery allowlist 施工，並將 STATIC／LOCAL／CI／STAGING／PRODUCTION／DEVICE／NOT_RUN 分開記錄。
4. Wave 2 只處理三個線上報名者 RPC 缺口；命中 CHARTER 六類 hard stop 即停，rollback 以後續 corrective migration 或既有 Worker version 回退處理，未執行不得寫 PASS。

## 2026-08-18：independent Fresh runtime review

- Reviewer：獨立 Fresh reviewer `Faraday`，只讀審查；未修改檔案、未寫入 DB、未重跑 concurrency verifier、未做 migration apply／DELETE／reset／cleanup／remote／production／commit／push。
- Verdict：`READY_WITH_BLOCKERS`。
- Isolated local runtime gate：`ACCEPTED`。Read-only read-back：catalog=`33`、target migration present、RLS=`8/8` enabled＋forced、ACL=`9/9 exact match`、capacity envelope PASS、aggregate preflight=`0`。
- Concurrency 僅採用既有 evidence（`PASS confirmed=1 waitlisted=5`），未重跑；zero-residue 亦維持既有 isolated local evidence，不升格為本次 fresh 行為測試。
- Overall：Wave 0 `NOT_ACCEPTED for closure`；remote DB／CI／staging／production 未驗收，migration 尚未 commit；Wave 1 維持 `BLOCKED`。
- Fresh follow-up：owner 需另行 exact-allowlist commit 必要檔案，並取得 remote／CI／staging／production read-back 後，才可重新評估 Wave 0 closure。

## 2026-08-18：authorized remote test-event cleanup

- Remote aggregate preflight 先確認唯一 over-limit event=`1`；只讀 foreign-key／cardinality read-back：registrations=`7`、event_invitation_targets=`9`、audit_logs=`82`，其他明確 domain child rows=`0`；auth.users=`4`、public.users=`3`。
- 依使用者 exact authorization，僅刪除該唯一測試 event、其 registrations、event_invitation_targets 與明確關聯 domain child rows；未碰 auth.users、public.users、其他 events、reset、rollback 或 broad cleanup。
- Delete result：events=`1`、registrations=`7`、event_invitation_targets=`9`、audit_logs=`82`；其餘 allowlisted child rows=`0`。
- Independent zero-residue read-back：over-limit event=`0`、orphan registrations／answers／invitation targets／fields／invitees／blocklist／password grants／audit logs／notifications／outbox／idempotency 全為 `0`；auth.users=`4`、public.users=`3` unchanged。
- 目前尚未套用缺少的 `20260815060000_manual_roster_capacity_seat_engine_fix.sql`，也尚未 deploy；下一 gate 是取得該 migration 的明確授權後，重新完成 remote catalog／function／ACL／RLS／aggregate read-back。

## 2026-08-18：Fresh closeout re-review preparation

- Current handoff evidence base：branch=`codex/gather-mvp`、commit=`69dab0c`；接手時重新 read-back current HEAD／origin／working tree。
- `[CI / read-only]` Draft PR #1／run `32150304903`：`verify`、`local-supabase` 與 Cloudflare Pages check 均 PASS；Node 20 deprecation annotations 不影響結果。
- `[STAGING / read-only]` `gather-join-staging` version=`82b00639-298b-4f73-aa91-d3169c75258a`、100% traffic；workers.dev homepage=`200`、未帶 Access assertion 的 `/__dev/session`=`403`。Canonical `staging.join.gather.wedopr.com` 仍無 DNS answer／custom domain／zone route，僅保留為 custom-host 子 gate 的 `UNVERIFIED`，不阻擋 workers.dev deployment gate。
- `[PRODUCTION / read-only]` Pages project=`gather-taiwan` source=`69dab0c`；deployment=`https://f4febb0d.neo-rechao.pages.dev` 與 canonical=`https://gather.wedopr.com` 均 HTTP `200`；docs-only auto deployment，不代表 runtime source release、Fresh acceptance 或 Wave 0 closure。
- 獨立 Fresh Reviewer `Russell` 已完成只讀複核，verdict=`READY_WITH_BLOCKERS`；最小 blocker 是三份 closeout 文件尚需同步至上述 current evidence，完成後再交 Fresh 複核。
- Wave 0 維持未關閉；Wave 1 維持 `BLOCKED`、未啟動。593 kB bundle warning 與 Node engine warning 不在本輪 scope。
