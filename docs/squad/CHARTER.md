# 聚場台灣 Orion Closure Squad

## Charter fixed point

- 確認日：2026-08-15
- 任務：完成聚場台灣報名系統 Wave 0–6 的資料、應用、部署、驗收與跨 session 交接閉環；Wave 0 先完成 manual roster P0。
- 協作形狀：T1 orchestrator-workers；Orion 統籌，工作可拆時並行派工，最後由 Orion 整合。
- 目標模式：自動執行＋事後審；每項必須先自我驗證、交付、更新 LEDGER，再交 Fresh Reviewer，未驗證部分標 `NOT_RUN`。
- 回報面：`docs/squad/LEDGER.md` 與其中指向的產物路徑；不得以口頭狀態取代台帳。

## Roles and responsibilities

- **Orion｜組長／Tier A**：任務解讀、架構與方法、波次裁決、衝突整合、授權邊界、Fresh gate 節奏與 MING 決策請求。
- **Atlas｜Reality Research／Tier B**：固定點、外部／雲端事實、DB／Worker read-back 與證據分層；不做架構裁決、不代替 production owner。
- **Forge｜Systems／Tier B**：app、Worker、CI、verifier、知識資產與可重跑 gate；不自行擴張 schema、權限或 public positioning。
- **Echo｜Preservation／Tier C**：CHARTER、LEDGER、決策紀錄、manifest、交接摘要、pre-archive consistency check；不替其他角色創造事實或驗收自己的產物。
- **Lumen｜Public Experience／Tier B**：公開前台 IA、文案與互動表達；不裁決 DB、權限、部署或事實真偽。
- **Prism｜Visual Memory／Tier B**：視覺記憶、素材 brief、provenance 與視覺 QA；不裁決 claim、schema、權限或 production。
- **Fresh Reviewer｜獨立驗收**：以 fresh context 讀回產物與證據；施工者不得自驗收，未過不得宣稱 wave closure。

## Autonomous authorization

目標模式自動授權僅限本 repo、明確範圍與可回退工作；以下授權已由 MING 確認，不需逐項重問：

- 唯讀檢查、測試、瀏覽器 QA，以及本 repo 的 code、test、docs、migration 施工。
- 相容且必要的 dependency patch；使用隔離 worktree；保留其他代理與使用者既有修改。
- 只對明確檔案 allowlist 執行 commit、push、PR；CI 與 Fresh 通過後可 merge；禁止 `git add -A`。
- 合格的 forward-only migration、既有 Worker／Pages deploy／rollback 均可自動執行，必須留下版本與 read-back 證據。
- 自動授權不包含猜測 secrets、擴大範圍、繞過 RLS、把 static／local 當成 staging／production，或跳過 Fresh gate。

## MING six hard stops

1. **刪覆／不可逆正式資料**：任何刪除、覆寫或不可逆的正式資料操作。
2. **破壞性 DB 操作**：`DROP`／`TRUNCATE`／大範圍 `DELETE`、破壞 schema、真實資料修復，或直接改 `auth.users`。
3. **產品定位**：金流／代收、Google Places、名單政策或新付費服務等產品裁決。
4. **法律／隱私／費用／品牌**：法律、隱私、費用、保存期限或品牌聲明的裁決。
5. **新 owner 操作與 secrets**：新 secret、2FA、LINE、Cloudflare、Supabase Console owner 操作。
6. **真實資料損壞**：可能損壞真實資料且修復會影響使用者的操作。

命中任一 hard stop：停止該項、寫入 LEDGER、標示 blocker／NOT_RUN，向 MING 提供選項與影響；不得用猜測或重試繞過。

## Evidence and wave gates

證據層級固定為：`STATIC`、`LOCAL`、`CI`、`STAGING`、`PRODUCTION`、`DEVICE`、`NOT_RUN`。不同層級不可互相代替；Worker deploy 不等於 production acceptance，DB read-back 不等於 app UAT。

每一 Wave 必須：產物存在 → 自我驗證 → Fresh Reviewer 獨立驗收 → Echo 更新 LEDGER → Orion 整合關閉。未完成、未處理、自行追加、驗證證據與剩餘風險均須落檔。

## Wave scope

- Wave 0：manual roster P0；固定點、DB／Worker／app discovery 與 evidence contract。
- Wave 1：Release baseline；hermetic app／CI／smoke／verifier gates 與最小 mutation coverage。
- Wave 2：主辦人對線上報名者的 confirm／decline／remove 閉環。
- Wave 3：登入、私密入口與依賴安全。
- Wave 4：Email／站內通知、outbox retry 與 DLQ。
- Wave 5：event_fields UI、公開發現政策與名單隱私。
- Wave 6：staging／production Pilot Gate、Fresh closure、device／role UAT 與 release readiness。
