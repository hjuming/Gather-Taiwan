# P1-06 / P1-08 GREEN 證據

日期：2026-08-05

## 範圍

單一席次引擎 RPC family（register / cancel / accept / decline offer /
organizer confirm / decline / remove / block）、idempotency replay、
deadlock/serialization retry、兩池→合併、capacity/reserved 編輯守護、
lazy+job expiry、`declined` 與 `removed_by_organizer` 語意分離、remove/
blocklist 與 audit（來源：`gather-registration-master-backlog.md` P1-06、
P1-08 列）。

## 範圍裁決

- **seats 固定為 1**：`register_for_event` 不接受 seats 參數，永遠寫入 1。
  多人攜伴（seats>1）留給 P3-04（D-10 已裁決 Pilot 後才做）。
- **offer 視窗固定 24 小時**：不做逐活動可調設定；之後要做屬於獨立增量。
- **主辦端通知不在本 Gate**：outbox 只為報名者本人寫一筆；「有新報名待確認」
  這類主辦通知留給 P1-15 的通知 fan-out。
- **`invite_only` 永久生效**：不論 pool 是否已因期限合併，`invite_only=true`
  的活動一律要求受邀才能報名；pool release 只改變「怎麼算席次」，不改變
  「誰能報名」。
- **協辦邀請 co-organizer 與活動邀請 event invite 是兩件事**：本 Gate 沿用
  P1-05 的 `event_invitees`／`is_event_invitee`，不重複定義。

## 已通過

### 循序行為（`apps/join/scripts/verify-p1-06-08-rls.sql`，`pnpm verify:p1-06-08`）

11/11 PASS：註冊即 confirmed、idempotent replay 回傳同一 registration id
且不產生重複列、capacity 打滿後下一位進 waitlisted（無超賣）、取消後自動
promote 下一位候補為 offered、accept offer 後轉 confirmed、staff 嘗試
remove 遭拒（只有 owner/admin 可以）、owner remove 成功、封鎖後被封鎖者
既無法報名、也讀不到封鎖原因（`event_blocklist` SELECT 僅 admin，P1-04
既有 policy）、outbox 依 `(registration_id, transition_version,
notification_kind)` 不重複。另有 5 項「預期拒絕」情境全數以正確錯誤訊息
失敗：同 idempotency key 換 payload（`23505`）、重複主動報名（unique
index／`23505`）、staff 呼叫 remove（`42501`）、被封鎖者報名
（`42501`／`registration is not available`）、capacity 調降低於目前持有
席次（`23514`，`guard_event_capacity_decrease` 觸發）。

### 真實併發（`apps/join/scripts/verify-p1-06-08-concurrency.mjs`，
`pnpm verify:p1-06-08:concurrency`）

用 8 條真正平行的資料庫連線（非序列模擬）對同一 capacity=3 活動同時呼叫
`register_for_event`，連續 3 次執行皆為 `fulfilled=8 rejected=0`、
`confirmed=3, waitlisted=5`——**零超賣**。另外以 backlog 原文的
`RACE_N=41 RACE_CAPACITY=40` 重跑一次「41 搶 40」情境：
`confirmed=40, waitlisted=1`，同樣零超賣、零錯誤。

### 死結修正（重大發現）

第一次跑真實併發測試時，8 個平行請求裡有 5～6 個穩定回報
`deadlock detected`——而且每次重跑都發生，不是偶發時序問題，換句話說
**這是結構性 bug，不是「等重試就會過」的雜訊**。根因：
`register_for_event`／`cancel_registration` 在鎖定 `events` 那一列
（`SELECT ... FOR UPDATE`）**之前**就先 `INSERT INTO idempotency_requests`，
而該表對 `events` 有外鍵；Postgres 對外鍵參照列會隱含取
`FOR KEY SHARE`。兩個併發交易各自先拿到 `FOR KEY SHARE`，然後都想升級成
`FOR UPDATE`——這是教科書等級的 lock-upgrade deadlock。

修正：把 `events` 的 `FOR UPDATE` 鎖提前到 `idempotency_requests` INSERT
之前。依專案「已套用 migration 永不回改」規則，沒有回頭改
`20260805210000_p1_06_08_seat_engine.sql`（該版本已對雲端套用），而是新增
forward-only 修正 migration
`20260805220000_p1_06_08_deadlock_fix.sql`（`CREATE OR REPLACE FUNCTION`
兩個函式），比照 P1-02 `owner_transfer_fix.sql` 的既有慣例。修正後三次
併發測試皆 0 死結、0 拒絕。

### 其他

- `pnpm typecheck && pnpm lint && pnpm test`：全部 PASS（本 Gate 未改動
  app 程式碼）。
- 所有 fixture（含併發測試自建的 throwaway organizer/event/users）皆於
  測試結束後清除；序列測試用交易 rollback，併發測試用明確 DELETE（因
  多連線各自獨立交易，無法共用單一 rollback）。套用後重查
  `select count(*) from users where email like '%@test.invalid' or
  email like '%@concurrency-test.invalid'` 為 0。

成功輸出：

```text
event=... racing 41 users for 40 seats...
fulfilled=41 rejected=0
status breakdown: confirmed=40, waitlisted=1
PASS: no oversell -- exactly 40 confirmed, 1 waitlisted, out of 41 concurrent racers
```

## 不屬於本 Gate

- P1-07：`event_invitees` 的 claim RPC、`events.password_hash` 設定/驗證
  RPC、private 活動的邀請制瀏覽路徑——`register_for_event` 目前只檢查
  `invite_only` 與既有 claimed invitee，尚未有「產生／發送邀請」的 RPC。
- P1-09/P1-13：收款說明文案 allowlist、legal name／birth date／18+
  聲明的表單驗證——本 Gate 的 `p_answers` 只做「必填欄位有沒有填」的檢查，
  不做欄位內容的法遵驗證。
- P1-10：沒有任何 UI；`register_for_event` 等 RPC 目前只能用 `psql`／
  Supabase client 直接呼叫測試。
- P1-15：主辦端通知、群發、rate-limit。
- 目前只驗證了「單一活動內」的併發正確性；跨活動、跨 organizer 的併發
  互動未特別測試（資料模型上彼此獨立，理論上不互相鎖，但未做壓力驗證）。
