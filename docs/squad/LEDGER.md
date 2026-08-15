# 聚場台灣 Orion Closure Squad｜LEDGER

## Current fixed point

- 日期：2026-08-15
- 初始 branch：`codex/gather-mvp`
- 初始 HEAD：`22091b6`
- 目前 Wave：**Wave 0｜manual roster P0**
- Atlas fixed point：**done／acceptance pending**；LOCAL Git clean、local refs `50 ahead / 0 behind`；Node `24.15`、pnpm `10.33.2`。
- Atlas production read-back：**PASS（PRODUCTION）**；Worker version `e0fcc0c2-c834-480b-b9d3-424783e20b19`、route `gather.wedopr.com/app/*`、production assets／headers read-back PASS。
- GitHub：**BLOCKED**（auth invalid）。Remote DB migration／runtime：**NOT_RUN**（credential unavailable）；唯讀 catalog 僅確認 `20260815060000` 為 `MISSING`，不等於 remote DB PASS。
- Wave 0 safe diagnostic：**ACCEPTED（Fresh LOCAL-code）**。Fallback3 DB runtime 僅 partial PASS、concurrency `FAIL`；後續 phase-aware one-shot 在 bootstrap 失敗，所有 fixed fields=`null`／`NOT_RUN`。Wave 0 未關閉，Wave 1 不得開。
- 本機 dirty WIP 可作 **safepoint candidate**；明確不是 release、DB runtime acceptance、remote migration 或 deploy readiness。
- Git 規則：只 stage 明確檔案，禁止 `git add -A`；本狀態檔不代表已 commit、push、deploy 或 Pilot ready。

## Wave 0 workboard

| 工單 | 狀態 | 產物／證據路徑摘要 | 驗收狀態 | 下一步 |
|---|---|---|---|---|
| W0-ATLAS fixed point | done | branch／HEAD、LOCAL Git、Node／pnpm、Worker route／version／assets read-back | acceptance=pending | Fresh read-back；補 GitHub／remote DB evidence |
| W0-DB discovery | done | `apps/join/supabase/migrations/`、`apps/join/scripts/verify-p1-11-manual-roster.sql`、RLS／RPC 契約 | acceptance=pending；remote DB=NOT_RUN | 三個線上報名者 RPC 缺口進 Wave 2；只依 allowlist 施工 |
| W0-APP discovery | done | `apps/join/src/components/RosterManager.tsx`、`src/lib/api.ts`、`worker/index.ts`、`scripts/smoke.mjs`、`scripts/smoke-staging.mjs`、`.github/workflows/join-gates.yml` | acceptance=pending；證據為 app discovery 回報路徑摘要 | Wave 1 Release baseline |
| W0-ECHO | needs-correction → done | `docs/squad/CHARTER.md`、`docs/squad/LEDGER.md`、本段 control log | acceptance=pending | Fresh Reviewer read-back |
| W0-Forge-DB correction round 3 | needs-correction | `20260815060000_manual_roster_capacity_seat_engine_fix.sql`、manual-roster capacity／concurrency verifiers、package gate wiring；不得擴大至 event_fields | REJECT（Fresh3） | 停止疊加局部 patch，依 Orion 架構裁決替換 |
| W0-Forge-DB architecture replacement | blocked | safe diagnostic Fresh LOCAL-code accepted；Fallback3 isolated DB runtime 部分 gates PASS | runtime overall 不合格：concurrency verifier `FAIL` | 等 isolated runtime 穩定後單次 diagnostic |
| W0-ATLAS single-DB fallback | done | Fallback3 isolated DB route 與 cleanup evidence；existing stack unchanged | acceptance=pending | 由 Fresh 診斷 runtime failure |
| W0-FRESH2 | needs-correction | REJECT：P0=0、P1=3、P2=2 | REJECT | 已由 Fresh3 重驗；見 W0-FRESH3 |
| W0-FRESH3 | needs-correction | REJECT：P0=0、P1=2 | REJECT | 已由 Fresh4 重驗；見 W0-FRESH4 |
| W0-FRESH4 | needs-correction | REJECT：P1=2 | REJECT | 已由 Fresh5 重驗；見 W0-FRESH5 |
| W0-FRESH5 | needs-correction | REJECT：P1 reader consistency | REJECT | 已由 Fresh6 重驗；見 W0-FRESH6 |
| W0-FRESH6 | needs-correction | REJECT：P1×2 | REJECT | 已由 Fresh7 重驗；見 W0-FRESH7 |
| W0-FRESH7 | done | Node 24：`51/51`、`173 passed / 1 skipped`、`14/14`、build PASS | ACCEPTED（STATIC／LOCAL-code，P0=0、P1=0） | Fallback3 partial runtime；runtime diagnosis blocked；Wave 0 尚未關閉 |
| W0-FRESH runtime diagnosis | blocked | Fallback3 partial runtime＋phase-aware bootstrap failure；不含 secrets／IDs | runtime acceptance=pending | 等 Docker／db-start 穩定；單次 diagnostic 後再 Fresh runtime |
| W0-Forge-DB instrumentation | done | safe fixed-field diagnostic；只保留定位所需 `phase`／`code` | ACCEPTED（Fresh LOCAL-code） | DB diagnostic `pending`；不得視為 DB acceptance |

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
- FAIL：concurrency verifier 回報 sanitized `database_connection`；本次為 one-shot，依邊界不 retry。故 runtime overall **不合格**、Fresh not ready，Fresh diagnosis `in-progress`。
- Cleanup：synthetic identities=`0`、Wave0 resources=`0`、temporary target 已刪除、existing stack unchanged；本段不記錄 secrets 或 IDs。
- Evidence boundary：此為 isolated DB 部分 runtime 證據，不是 remote DB、CI 或 production PASS；Wave 0 仍未關閉。

### Concurrency root-cause diagnosis

- Sanitized `database_connection` 不足以唯一判因；H1 為 connection slots，H2 為 business `53300`／class `53` collision，兩者目前都只是待 DB diagnostic 區分的假說。
- 已確定的 observable bug：concurrency verifier 的 error rewrap 丟失原始 `phase`／`code`，使 infrastructure 與 business failure 無法安全區分。
- Orion 裁決：先做 safe fixed-field diagnostic，只補定位所需固定欄位；禁止輸出 message、stack、query、params、address、port、DSN 或 IDs。
- 在 diagnostic 證據回來前，禁止先改 retry、pool 或 SQLSTATE 語意。Forge-DB instrumentation 後續已完成並獲 Fresh LOCAL-code acceptance；DB diagnostic 仍 `pending`，runtime overall 不合格。

### Wave 0 blocker final sync／safepoint readiness

- Safe diagnostic 已由 Fresh **ACCEPTED（LOCAL-code）**；這只驗收固定欄位 instrumentation，不是 DB runtime acceptance。
- Fallback3 DB runtime partial PASS：32 migrations（latest `20260815060000`）、catalog、ACL、RLS、aggregate preflight=`0`、guest 與 capacity verifier；concurrency verifier `FAIL`，故 runtime overall 不合格。
- 後續 phase-aware one-shot 在 bootstrap 階段失敗，所有 safe diagnostic fixed fields=`null`／`NOT_RUN`，未取得可供 root-cause 判定的 phase。
- Cleanup read-back：Wave0 resources=`0`、temporary target deleted、existing stack unchanged。
- External blockers：isolated runtime 不穩定；GitHub auth invalid；remote DB credential unavailable。
- Gate：Wave 0 未關閉，Wave 1 不得開；未執行 remote migration、deploy 或 push。
- 下一步條件：Docker／db-start 穩定後只跑一次 concurrency diagnostic；若取得 phase，再做 root-cause 判定，之後交 Fresh runtime 驗收。
- 目前本機 dirty WIP 僅可標為 safepoint candidate；明確不是 release、DB acceptance、remote apply 或 deployment readiness。

## Wave 1–6 workboard

| Wave | 狀態 | Closure gate |
|---|---|---|
| Wave 1｜Release baseline | blocked（Wave 0 未關閉） | hermetic smoke、CI 分工、verifier、mutation evidence、Fresh |
| Wave 2｜線上報名者 confirm／decline／remove | pending | RPC／RLS／席次／audit／通知 contract、app E2E、Fresh |
| Wave 3｜登入／私密入口／依賴安全 | pending | auth failure matrix、private capability、dependency／security gate、explicit linkage（不得只靠 `display_name`） |
| Wave 4｜通知與 outbox | pending | Email／站內通知、retry、DLQ、recipient boundary、Fresh |
| Wave 5｜event_fields／發現／名單隱私 | pending | event_fields UI、公開發現政策、roster privacy、role UAT |
| Wave 6｜Pilot Gate | pending | staging／production、rollback、device／role UAT、Fresh release readiness |

## Decision record

- 採 T1 orchestrator-workers 與目標模式；自動授權、六類 MING hard stop、Evidence tier 以 `CHARTER.md` 為準。
- Wave 0 app 不改：manual roster 既有前端 wrapper／RPC 契約可供 DB discovery 對照；`event_fields` 明確排除本 Wave。
- manual row `user_id is null` 沒有可通知 recipient；不造 outbox、不新增假通知收件人。
- `dist/gather_join_staging` 污染 smoke 的根因候選與 Wave 1 最小 allowlist 已定位，尚未施工或宣稱通過。
- Wave 0 Fresh7 已 `ACCEPTED（STATIC／LOCAL-code，P0=0、P1=0）`；Node 24 gates 為 `51/51`、`173 passed / 1 skipped`、`14/14`、build PASS。
- 此 acceptance 不含 DB runtime、CI、remote DB 或 production；Fallback3 雖取得部分 isolated DB runtime PASS，但 concurrency verifier `FAIL`，後續 bootstrap 亦失敗，runtime diagnosis `blocked`。
- Concurrency 的 sanitized `database_connection` 不足以判定 H1 connection slots 或 H2 business `53300`／class `53` collision；先以固定 `phase`／`code` diagnostic 修補 observable rewrap 缺口，不先改 retry／pool／SQLSTATE。
- Safe diagnostic 已獲 Fresh LOCAL-code acceptance；phase-aware one-shot bootstrap failure 令所有 fixed fields 為 `null`／`NOT_RUN`，因此 DB root cause 與 runtime acceptance 仍 pending。
- 本機 dirty WIP 只形成 safepoint candidate，不是 release／DB acceptance；isolated runtime、GitHub auth 與 remote DB credential blockers 解除前，Wave 1 不開，也不做 remote migration／deploy／push。
- Explicit linkage 依 MING 原計畫留到 Wave 3，且不得只靠 `display_name`；Wave 0 以保守高估優先避免 oversell。
- Migration-list false alarm 已解除：`Local` 是 filesystem、`Remote` 才是 applied；catalog `MISSING` 證明 `20260815060000` 未套用，但正式 remote apply 前仍須 ledger＋function definitions read-back。
- Worker／Pages 既有 deploy／rollback、合格 forward-only migration、allowlist commit／push／PR，以及 CI＋Fresh 後 merge 已獲授權，不需重問；仍須留下 evidence。

## Restart guide

1. 先讀本檔、`docs/squad/CHARTER.md` 與本段 control log；重新確認 branch、HEAD、dirty baseline、Worker／DB live state，不假設舊 status 仍為真。
2. 保留 Fallback3 partial runtime 與 cleanup 證據；safe diagnostic 已 Fresh LOCAL-code accepted，但 phase-aware one-shot bootstrap failed、fixed fields=`null`／`NOT_RUN`。等待 Docker／db-start 穩定後單次 concurrency diagnostic；取得 phase 才判 root cause，再交 Fresh runtime。Wave 0 未關閉，Wave 1 不開。
3. Wave 0 關閉前不得開始 Wave 1；解除後仍只依 app discovery allowlist 施工，並將 STATIC／LOCAL／CI／STAGING／PRODUCTION／DEVICE／NOT_RUN 分開記錄。
4. Wave 2 只處理三個線上報名者 RPC 缺口；命中 CHARTER 六類 hard stop 即停，rollback 以後續 corrective migration 或既有 Worker version 回退處理，未執行不得寫 PASS。
