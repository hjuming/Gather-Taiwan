# P1-05 GREEN 證據

日期：2026-08-05

## 範圍

owner/admin/staff RBAC、協辦邀請、撤銷、audit log（來源：
`gather-registration-master-backlog.md` P1-05 列）。owner transfer 已在
P1-02 由 `transfer_organizer_ownership` 完成，本 Gate 不重做。

## 範圍裁決：直接指派取代 token 邀請

Backlog 原文包含「協辦邀請 token」，但本 Gate 採**直接指派**：owner/admin
指名一個已存在的 `public.users` 列並指定角色，立即生效並寫 audit log，不做
email／token claim 流程。理由：

- token/email claim 是否可信，取決於 P1-14 的 email 驗證基礎；在那之前做一半
  的 token 流程（可產生 token，但無法驗證誰能合法 claim）比明確的直接指派
  更不安全，也更難稽核。
- P1-05 的驗收標準（staff 敏感 API 403、撤銷後下次 API 403、唯一 owner 與
  轉移稽核）都不要求 token claim 機制本身，直接指派＋audit 已可滿足。
- 之後若要補 token 邀請（例如協辦人未註冊帳號、需要 email 邀請連結），
  屬於獨立、可疊加的後續 Gate，不影響本 Gate 的 RPC 介面。

## 已通過

- Migration `20260805200000_p1_05_organizer_rbac.sql`：新增
  `add_organizer_member(organizer_id, user_id, role)` 與
  `revoke_organizer_member(organizer_id, user_id)` 兩個 security-definer RPC。
- 先在 `BEGIN...ROLLBACK` 交易內套用＋跑完 5 項正向查核 + 3 項預期拒絕全部
  正確，才用 `psql --single-transaction` 正式套用並登記 ledger（`5` →
  `20260805200000 | p1_05_organizer_rbac`）。
- `apps/join/scripts/verify-p1-05-rls.sql`（`pnpm verify:p1-05`）對套用後的
  雲端狀態重跑，5/5 PASS：
  1. owner 指派 staff 成功、立即生效。
  2. owner 撤銷 staff 成功（`revoked_at` 寫入）。
  3. 被撤銷者立刻失去該 organizer 的所有可見性（沿用 P1-04 的
     `is_organizer_member`／`is_organizer_admin`，兩者都檢查
     `revoked_at is null`，等同「撤銷後下次 API 403」——不需要額外快取失效
     機制，因為每次請求都重新檢查）。
  4. 被撤銷者重新指派為 admin 後正確復活（role 更新、`revoked_at` 清空）。
  5. audit_logs 正確記錄 `organizer_member.added`／`role_changed`／
     `revoked` 三種 action。
- 另外 3 個「預期拒絕」錯誤原因正確：
  - staff（非 admin）呼叫 `add_organizer_member` → `only an owner or admin
    may add organizer members`。
  - 非成員呼叫 `add_organizer_member` → 同上錯誤（沒有特殊管道繞過）。
  - 嘗試以 `add_organizer_member(..., 'owner')` 指派 owner →
    `use transfer_organizer_ownership to change the owner`（唯一 owner
    invariant 由 P1-02 的 deferred trigger 保護，這裡只是提前擋在 RPC
    入口給更清楚的錯誤訊息）。
  - 嘗試 `revoke_organizer_member` 撤銷 owner →
    `transfer ownership before revoking the owner`。
- 全部 fixture 交易內建立、結束前 rollback；套用後重查
  `select count(*) from users where email like '%@test.invalid'` 為 0，
  確認無殘留。
- `pnpm typecheck && pnpm lint && pnpm test`：全部 PASS（本 Gate 未改動 app
  程式碼）。

成功輸出：

```text
PASS 1: owner added B as staff
PASS 2: staff B revoked
PASS 3: revoked staff B loses organizer visibility (403-equivalent)
PASS 4: revoked B reactivated as admin
PASS 5: audit log recorded add/revoke/role_change actions
```

## 不屬於本 Gate

- Email／token 協辦邀請流程（見上方範圍裁決）。
- `organizer_members` 對 staff 角色本身沒有額外欄位限制（例如 staff 是否能
  看到彼此的 email）——P1-04 的 column grant 已包含完整成員清單給所有active
  member，若未來要限縮屬於獨立裁決，非本 Gate 範圍。
