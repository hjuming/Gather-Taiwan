# P1-07 GREEN 證據

日期：2026-08-05

## 範圍

雙邀請制（verified-email 自動資格 + one-time token 領取）、event password
view 驗證（dummy-hash 統計容差）、private 活動對受邀者的可見性（來源：
`gather-registration-master-backlog.md` P1-07 列）。

## 範圍裁決

- **「password view cookie」本身不在這個 Gate**：把驗證成功的密碼轉成
  匿名訪客也能讀到 RLS 資料的 HTTP cookie，需要一個 Worker/API 簽發短效
  scoped token（跟 P1-03 dev-auth worker 同樣的模式），但目前沒有對外的
  活動頁 Worker——那是 P1-10 的範圍。本 Gate 只做 DB 端的
  `set_event_password`／`verify_event_password` 原語，供之後的 Worker 呼叫。
- **URL token 的 referrer/log 防漏與即時清 URL 完全是前端範圍**，DB
  migration 無從置喙，留給 P1-10。
- 協辦人邀請（P1-05 `add_organizer_member`）與活動邀請（本 Gate
  `event_invitees`）是兩件不同的事，互不影響。

## 已通過（`apps/join/scripts/verify-p1-07-rls.sql`，`pnpm verify:p1-07`）

9/9 PASS：非受邀者看不到 private 活動、verified-email 受邀者不需要額外
「領取」動作就能看到活動且能報名（P1-06 的 `invite_only` 檢查與這裡共用
`is_event_invitee`）、token 受邀者在領取前看不到活動、領取後立刻看得到、
密碼設定後驗證正確密碼回 true、錯誤密碼回 false、不存在的活動同樣回
false（行為與「密碼錯」不可區分，避免枚舉）、撤銷邀請後立刻失去可見性。
另有 5 項「預期拒絕」情境全數以正確錯誤訊息失敗：未驗證 email 儘管有
matching invite 仍被拒絕報名、假 token 被拒絕、同一 token 被別人搶先領取
後第二個人被拒絕、staff 呼叫 `create_event_invite` 被拒絕（只有
owner/admin 可以）、`password_hash` 欄位在設密碼後依然無法直接 SELECT
（`permission denied for table events`，P1-04 的欄位白名單持續有效）。

## 重大發現：events RLS 原本沒接上 invitee 可見性

第一次跑測試時，check 2／5 失敗——verified-email 受邀者能成功報名
（`register_for_event` 直接呼叫 `is_event_invitee`），但**看不到活動本身**。
根因：P1-04 的 `events` 表只有兩條 SELECT policy（organizer members、
公開已發佈），`can_view_event()` 這個 helper 雖然把 invitee 考慮進去，
但從未被 `events` 表自己的 policy 引用——RLS policy 不會因為某處定義了
一個「看起來相關」的 helper 函式就自動套用，一定要有 policy 明確呼叫它。
修正：新增第三條 permissive policy `events_select_invitee`
（`using (is_event_invitee(id))`），與既有兩條 OR 在一起，不影響既有
行為。修正後 9/9 全過。

## 其他

- `pnpm typecheck && pnpm lint && pnpm test`：全部 PASS（本 Gate 未改動
  app 程式碼）。
- fixture 於交易內建立，結束前 rollback；套用後重查
  `select count(*) from users where email like '%@test.invalid'` 為 0。

成功輸出：

```text
PASS 1: non-invited outsider cannot view private event
PASS 2: verified-email invitee can view private event (no claim step needed)
PASS 3: verified-email invitee can register for invite_only event
PASS 4: token holder cannot view before claiming
PASS 5: token claim grants view access
PASS 6: correct password verifies true
PASS 7: wrong password verifies false
PASS 8: nonexistent event verifies false (no distinguishable behavior)
PASS 9: revoked invite loses view access
```

## 不屬於本 Gate

- password view cookie／匿名訪客的 scoped token 簽發（見上方範圍裁決）。
- URL token 的 referrer/log 防漏、即時清 URL（前端，P1-10）。
- P1-09/P1-13：收款說明、法遵欄位驗證。
- P1-10：任何 UI，包含邀請管理介面、密碼輸入頁。
