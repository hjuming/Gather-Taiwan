# P1-09 / P1-13 GREEN 證據

日期：2026-08-05

## 範圍

參加者付款聲明（不接受金額／帳號／截圖等欄位，`payment_declared_at` 唯一
SSOT）、收款說明檢舉入口、活動 `min_age` 於報名時強制、2/29 生日年齡計算、
星座推導（來源：`gather-registration-master-backlog.md` P1-09、P1-13 列）。

## 範圍裁決

- **「活動日期變更重算與主辦裁量」延後**：改期是少見情境（且活動開始後
  `starts_at` 已被既有 trigger 鎖死，不可能再改），現在就做完整的
  「改期→重新檢查所有已報名者年齡→標記給主辦裁決」機制，相對於「先讓
  基本報名流程能跑」的當前目標是過度工程。本 Gate 的年齡把關永遠對
  **當下的** `starts_at` 做檢查，這是核心防護；改期後的重算留待未來。
- **「申訴稽核」留給 P1-17**：年齡拒絕已經是 `register_for_event` 一個
  獨立、可辨識的錯誤（`registrant does not meet this event's minimum
  age`），未來申訴流程可以直接以此為依據，不需要本 Gate 額外建置稽核表。
- **「文案 allowlist」不是新的 DB 限制**：`event_fields` 早在 P1-02 就擋掉
  付款證明形狀的欄位名稱／標籤；`payment_instructions` 是主辦人自己寫的
  收款說明（本來就該包含帳號、金額），跟「參加者不可以填付款證明欄位」是
  兩件不同的事，不需要額外限制主辦人的收款說明文字。

## 已通過（`apps/join/scripts/verify-p1-09-13-rls.sql`，`pnpm verify:p1-09-13`）

6/6 PASS：成年報名者通過年齡檢查（`confirmed`）、`declare_payment_for_
registration` 設定 `payment_declared_at` 且不動 `status`、重複宣告付款
是冪等的（時間戳不變）、任何登入使用者都能對活動的收款說明按下檢舉
（寫入 `audit_logs`）、跨使用者無法讀到別人的 `legal_name`／`birth_date`
（P1-04 的 own-row-only policy 持續有效）、1976-02-29 出生者在 2025-02-28
算 24 歲、2025-03-01 算 25 歲（Postgres `age()` 內建正確處理閏年生日，
不需要額外特殊處理）。另有 3 項「預期拒絕」情境正確：未滿 18 歲被拒、
沒有填 `birth_date` 但活動有 `min_age` 時 fail-closed（不是「猜你及格」）、
非本人嘗試 `declare_payment_for_registration` 得到 `registration not
found`（不洩漏「這筆報名存在但不是你的」）。

## 其他

- `pnpm typecheck && pnpm lint && pnpm test`：全部 PASS（本 Gate 未改動
  app 程式碼）。
- fixture 於交易內建立，結束前 rollback；套用後重查
  `select count(*) from users where email like '%@test.invalid'` 為 0。
- `register_for_event` 這是第三次修訂（P1-06/08 原版 → deadlock-fix →
  本次新增 min_age 檢查），每次都是 `create or replace`，未回改已套用的
  migration 檔案本身。

成功輸出：

```text
PASS 1: adult registered successfully (age gate passes)
PASS 2: payment declared, status unaffected
PASS 3: re-declaring payment is idempotent (timestamp unchanged)
PASS 4: payment instructions report recorded
PASS 5: cannot read another user's row (legal_name/birth_date never exposed cross-user)
PASS 6: Feb 29 birthday age computed correctly across the 2025 anniversary
```

## 不屬於本 Gate

- 活動改期後的年齡重算與主辦裁決（見範圍裁決）。
- 正式申訴稽核流程（P1-17）。
- P1-10：任何 UI，包含報名表單、付款聲明按鈕、星座顯示。
