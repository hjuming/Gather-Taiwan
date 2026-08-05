# P1-04 GREEN 證據

日期：2026-08-05

## 範圍

default-deny RLS、registration-scoped view/RPC、欄位白名單、API 不接受任意
userId（來源：`gather-registration-master-backlog.md` P1-04 列）。本 Gate**不**
包含 P1-05 RBAC 工作流（邀請/撤銷/角色變更）、P1-06/P1-08 seat-engine RPC、
P1-07 邀請/密碼閘門瀏覽路徑；這些資料表對應操作仍保持完全 fail-closed，等各自
Gate 補上。

## 設計裁決

- 13 張 canonical 資料表全部維持 P1-02 的 `enable + force row level security`；
  本 Gate 只新增 policy 與欄位級 grant，不放寬任何既有 REVOKE。
- 新增 5 個 `security definer` helper（`is_organizer_member`、
  `is_organizer_admin`、`event_organizer_id`、`event_is_public_readable`、
  `can_view_event`），比照 P1-02 `transfer_organizer_ownership` 的模式：owner
  是 migration 執行的 superuser，因此天生 bypass RLS，用來安全地做跨表角色
  檢查，避免 policy 互相遞迴。
- 新增 `create_organizer(slug, display_name)` RPC：單一 REST 呼叫的裸
  `INSERT INTO organizers` 一定會在該筆交易 COMMIT 時觸發 P1-02 的
  deferred「恰一位 owner」constraint trigger 失敗（該筆交易裡還沒有
  `organizer_members` owner 列）。此 RPC 在同一 function 交易內原子性寫入
  organizer + owner membership + audit log，判定屬於 P1-04「scoped RPC」範圍
  （沒有它，後續任何驗收都無法建立 fixture）。
- `events.password_hash` 從任何角色的欄位 grant 中排除，包含 organizer
  owner／admin 自己；密碼設定與驗證留給 P1-07 要新增的專屬 RPC，任何角色都不
  透過 PostgREST 直接讀到雜湊值。
- `registrations`／`registration_answers`／`idempotency_requests`／
  `outbox_events` 對 `authenticated` 沒有任何 INSERT/UPDATE grant：所有報名
  轉移只能經由 P1-06/P1-08 的單一席次引擎 RPC（security definer），符合
  Master Backlog「Canonical 架構契約 #1」。
- `event_blocklist` 只開放 organizer admin 的 SELECT；INSERT（封鎖參加者）留給
  P1-08，因為封鎖與移除共用同一組 audit／通知不變量。

## 已通過

- Migration `20260805190000_p1_04_default_deny_rls.sql` 先在一個
  `BEGIN...ROLLBACK` 交易內完整套用＋跑完下方 9 項行為驗證（零殘留），確認無
  語法或邏輯錯誤後，才用 `psql --single-transaction` 正式套用並手動登記
  `supabase_migrations.schema_migrations`（`supabase migration list/db push
  --db-url` 這兩個子指令在本機環境撞到既有、與本次改動無關的 CLI profile
  讀取 bug，見下方「環境限制」）。
- 套用後的 ledger 讀回：5 筆 version，含新版本
  `20260805190000 | p1_04_default_deny_rls`。
- `pg_policies` 讀回：11 張表共 21 條 policy；`idempotency_requests`／
  `outbox_events` 0 條（設計如此，維持全closed）。
- 全部 13 張 canonical 表 `relrowsecurity`／`relforcerowsecurity` 讀回皆為
  `true`，本 Gate 沒有調降任何既有安全設定。
- `apps/join/scripts/verify-p1-04-rls.sql`（透過 `pnpm verify:p1-04`）對正式
  套用後的雲端狀態重跑，9/9 PASS：
  1. 非成員看不到別的 organizer。
  2. 跨租戶看不到私密草稿活動。
  3. 跨租戶看得到已發佈的公開活動。
  4. 匿名使用者看不到私密草稿活動。
  5. 匿名使用者看得到已發佈的公開活動。
  6. Organizer owner 看得到自己旗下全部活動（不分狀態）。
  7. 報名者本人看得到自己的報名紀錄。
  8. 該活動的 organizer 看得到該報名紀錄。
  9. 不相關的 organizer 看不到該報名紀錄。
- 另外兩個「預期失敗」的直接驗證，錯誤原因與訊息正確：
  - `SELECT password_hash FROM events`（以 organizer owner 身分）→
    `permission denied for table events`（欄位未授權，非其他原因）。
  - `INSERT INTO registrations`（以一般 authenticated 身分）→
    `permission denied for table registrations`（尚無寫入 grant，符合
    「只能透過席次引擎 RPC」的設計）。
  - staff（非 admin）對事件的 `UPDATE` 影響 0 筆（RLS 靜默過濾，非錯誤，
    符合 Postgres 對已授權但被 policy 擋下的列的標準行為）。
- 全部驗證 fixture（synthetic auth user／users／organizers／events／
  registrations）都在交易內建立、交易結束前 `ROLLBACK`；套用後另外重跑一次
  `select count(*) from users/organizers where ... like '%@test.invalid'`
  確認零殘留。
- `pnpm typecheck && pnpm lint && pnpm test`：全部 PASS（本 Gate 未改動任何
  app 程式碼，只新增 SQL migration 與驗證腳本，屬預期不變）。

成功輸出：

```text
=== fixtures ready: org_alpha=... org_beta=... ===
PASS 1: outsider cannot see organizer row
PASS 2: cross-tenant cannot see private draft event
PASS 3: cross-tenant CAN see published public event
PASS 4: anon cannot see private draft event
PASS 5: anon CAN see published public event
PASS 6: Alpha owner sees both own events
ERROR:  permission denied for table events
ERROR:  permission denied for table registrations
PASS 7: registrant sees own registration
PASS 8: event organizer sees the registration
PASS 9: unrelated organizer cannot see the registration
=== end of script ===
```

## 環境限制（NOT_RUN）

- `supabase migration list --db-url` 與 `supabase db push --db-url
  --dry-run` 在本機撞到 `failed to read profile: Config File "config" Not
  Found in "[]"`——經 `--debug` 確認這是 CLI 讀取 `~/.supabase/profile` 這個
  全域設定檔的既有問題（該檔為 0 bytes，且刪除/修復它需要在 repo 範圍外操作，
  屬於 auto-mode 分類器擋下的動作，未經使用者同意不執行），與本次改動無關。
  改用官方 `psql --single-transaction` 套用、手動登記 ledger，讀回方式與
  P1-01-B 完全一致。
- `supabase db lint --db-url` 同樣撞到上述 CLI profile bug，記為 `NOT_RUN`；
  之後 CLI 環境修好後應補跑一次。
- Supabase Security/Performance Advisors 沿用 P1-02 的 `NOT_RUN` 狀態，本 Gate
  未改變其可用性。

## 不屬於本 Gate

- P1-05：owner/admin/staff 邀請、撤銷、角色變更 RPC；`organizer_members` 目前
  仍只有 SELECT policy，寫入只能靠這裡新增的 `create_organizer`（僅建立
  首位 owner）。
- P1-06/P1-08：seat-engine RPC、idempotency replay、報名/取消/候補轉移。
  `registrations`、`registration_answers`、`idempotency_requests`、
  `outbox_events` 對 App role 完全無寫入權限，維持設計如此的 fail-closed。
- P1-07：`event_invitees` 的 claim 流程、`events.password_hash` 的
  設定/驗證 RPC、private 活動的邀請制瀏覽路徑。
- P1-09/P1-13：收款說明文案 allowlist、legal name／birth date／18+ 聲明的
  UI 與 API 邊界；欄位已存在於 schema，本 Gate 只決定「誰看得到欄位」，不
  決定「欄位怎麼填」。
