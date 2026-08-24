# 聚場台灣下一階段優化計劃

日期：2026-08-24
適用 branch：`codex/gather-mvp`
source/runtime evidence fixed point：`83a38e8`
目前狀態：Wave 0 **CLOSED（evidence-boundary closure）**；Wave 1 **ACCEPTED／CLOSED（Release baseline）**；Wave 2 **BLOCKED／未啟動**

## 計劃原則

- 本文件是下一階段的提案與目標，不是 Wave 1 開工授權。
- 每一階段都要先固定 HEAD、working tree、環境與 evidence tier，再施工、驗證、交 Fresh reviewer。
- `LOCAL`、`ISOLATED LOCAL`、`CI`、`STAGING`、`PRODUCTION`、`DEVICE`、`FRESH` 不可互相替代。
- 未取得 action-specific authorization 前，不執行 migration、DELETE、reset、rollback、broad cleanup、Cloudflare route／DNS／custom domain 變更或 production data 操作。
- 不重跑既有 phase-aware concurrency one-shot；既有結果只引用 `confirmed=1 waitlisted=5`。

## 目標與階段

### Phase 1｜Release baseline（對應 Wave 1）

目標：建立可重跑、可審計的 app／CI／smoke 基線，讓後續功能工作不再依賴歷史手動判讀。

驗收目標：

- `pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm test:security`、`pnpm build`、`pnpm smoke` 形成單一 gate report。
- 補 hermetic staging／CI contract，明確標記 DB suite skip、未接 Cloudflare Access、未跑 device UAT 的狀態。
- 建立 source/runtime fixed point、PR head、CI run、deployment URL／source metadata 的 provenance read-back。
- 由獨立 Fresh reviewer 接受後，Wave 1 Release baseline 可解除 blocked；current Fresh 已接受，Wave 1 已關閉。
- 量化門檻：6 個本地 gate 均 exit `0`；非預期 skip=`0`；每個 skip 必須有原因、環境與替代證據；CI run、commit SHA、artifact URL 三者 exact match。

### Phase 2｜Organizer roster closure（對應 Wave 2）

目標：完成主辦人對線上報名者的 confirm／decline／remove 閉環，與既有 manual roster capacity／FIFO 不變量一致。

驗收目標：

- API、UI、RLS／ACL、audit、通知語意與錯誤狀態形成同一 contract。
- 受控 synthetic fixtures 完成 positive／negative／idempotency／rollback read-back。
- 不把既有 manual participant add/edit/remove RPC 當成線上報名者閉環的替代品。
- 量化門檻：confirm／decline／remove 三動作 × anonymous／member／organizer／replay 四情境至少 12 cases；每個 case 都有預期狀態、audit actor、席次結果；fixture residue=`0`。

### Phase 3｜Auth、private entry 與依賴安全（對應 Wave 3）

目標：完成 LINE／email 登入失敗矩陣、私密入口與依賴安全債的可驗收治理。

驗收目標：

- LINE reject、無 email、incognito、過期 state／nonce、第二帳號等情境有獨立證據。
- Cloudflare Access staging 與 `AUTH_RATE_LIMITER` binding 具備 owner 授權、deployment read-back 與瀏覽器證據。
- Supabase advisors 的 SECURITY DEFINER scope、leaked-password protection 等 WARN 先完成 triage，再由 owner 決定是否施工；不以消除 lint 數量代替安全驗收。
- 量化門檻：LINE failure matrix 至少 5/5 cases；Access staging 至少 anonymous／authorized 兩角色；依賴與 advisor 每一項都有 owner、severity、action、rollback 與 `NOT_RUN`／完成狀態。

### Phase 4｜通知與可恢復性（對應 Wave 4）

目標：建立 Email／站內通知、outbox retry、DLQ 與可觀測性。

驗收目標：

- delivery、retry、dedupe、dead-letter、manual replay contract 明確。
- 不把 `outbox_events` 有資料或 HTTP 200 當作實際送達證據；需有受控 provider／sandbox read-back。
- 量化門檻：delivery／retry／dedupe／DLQ／manual replay 至少 5 cases；每個 case 的 event idempotency key、attempt count、final state 與 replay residue 均可讀回。

### Phase 5｜Event fields、公開發現與隱私（對應 Wave 5）

目標：完成 `event_fields` 主辦端 UI、參加者動態驗證、公開發現政策與名單隱私邊界。

驗收目標：

- 欄位型別、必填、選項白名單與 `p_answers` contract 由同一份 SSOT 驅動。
- 公開活動摘要、私密活動與名單資料的 RLS／API／SEO 邊界分開驗證。
- 不新增付款資料欄位、不將未確認合作或活動資訊寫成正式事實。
- 量化門檻：5 種 field types 各至少 1 個 valid、required-invalid、option-invalid case；anonymous／member／organizer 三角色各有公開／私密／名單資料 read-back。

### Phase 6｜Pilot、device／role UAT 與 release readiness（對應 Wave 6）

目標：以 staging／production Pilot Gate 完成角色、裝置、瀏覽器與部署來源的最終 read-back。

驗收目標：

- canonical staging host、Pages source parity、production semantic UAT、device／role UAT 各自有證據。
- Fresh reviewer 明確接受完整 current evidence 後，才可進入 release decision。
- 任一 gate 缺失即保持 `NOT_VERIFIED`／`BLOCKED`，不以公開 HTTP 200、CI 或 deployment URL 代替。
- 量化門檻：390px mobile、desktop、iPad／touch 三種裝置類型 × anonymous／member／organizer 三角色，至少 9 組 browser／device checks；每組記錄 route、viewport、interaction、結果與 screenshot／read-back reference。

## 建議執行順序

1. Phase 1 scope／owner 已由本輪組長指示確認；Wave 1 Release baseline 已接受。下一步如要進入 Wave 2，仍須另行確認 Phase 2 scope 與 owner。
2. 新團隊建立乾淨 session，讀 `NEXT-TEAM-KICKOFF.md`、本計劃、SSOT、DEVELOPMENT、MAINTENANCE 與 control log。
3. 完成 read-only baseline 與 gate report；任何 connector／owner／secret blocker 立即記錄並停止該 slice。
4. 只對明確 allowlist 開發與測試；交 Fresh reviewer；更新 LEDGER／HANDOFF／control log。
5. 通過後才進下一 phase，不跨波次偷跑。

## 目前已知風險

- Pages source／control-plane metadata：`NOT_VERIFIED`。
- `staging.join.gather.wedopr.com`：DNS 未解析，`UNVERIFIED`。
- Production semantic／device UAT：尚未完成。
- PR #1：open、draft、未 merge；PR body 的整體 docs-only 描述需另行修正。
- Supabase security／performance advisors：54／21 lints 保留，尚未 triage 完成。
- Node package engine 要求 `>=22`；既有部分本機記錄使用 Node `20.20.2`。
- 約 593 kB bundle warning 未處理。
