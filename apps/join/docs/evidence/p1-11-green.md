# P1-11 GREEN 證據

日期：2026-08-06

## 範圍

主辦人手動管理參加者名單（新增／編輯／移除），供不會自己上網報名的參加者
使用。使用者在看過 P1-10 成果後主動提出的需求，不在原始 backlog 內。

## 設計裁決

- **獨立 RPC family，不改寫既有席次引擎**：`registrations.user_id` 改為
  nullable，新增 `manual_display_name`／`manual_contact`／
  `added_by_user_id`，並用 CHECK constraint（`registration_identity_shape`）
  強制「自助報名」與「主辦手動新增」兩種形狀互斥、不可混合。手動名單走
  全新的 `organizer_add_manual_participant`／`organizer_edit_manual_
  participant`／`organizer_remove_manual_participant`，完全不碰
  `register_for_event`／`cancel_registration`——那組 RPC 已經過真實併發測試
  抓出並修好一個死結（見 P1-06/08 evidence），不值得為了這個新功能冒回歸
  風險去改寫它。
- **手動名單略過席次計算與 outbox**：主辦人對自己的名單有裁決權，手動新增
  不做 capacity 檢查；沒有帳號就沒有通知對象，不進 outbox。
- **手動編輯仍受 P1-02 既有狀態機保護**：`guard_registration_state_machine`
  這個 trigger 對所有 registrations 一視同仁，`confirmed → waitlisted`
  這類不合法轉換一樣會被擋下——這不是限制，是刻意保留的一致性保護（見下方
  「過程中確認」）。

## 已通過（`apps/join/scripts/verify-p1-11-manual-roster.sql`，
`pnpm verify:p1-11`）

4/4 正向查核 PASS：主辦人新增手動參加者（`user_id` 為 null）、合法狀態
轉換（`confirmed → cancelled`）與改名同時生效、多筆手動參加者可以共存
（NULL `user_id` 在 unique index 下互不衝突，已確認）、移除手動參加者。
另有 5 項「預期拒絕」情境全數以正確錯誤訊息失敗：staff 無法管理手動名單
（只有 owner/admin 可以）、`confirmed → waitlisted` 這個不合法的狀態轉換
被 P1-02 的狀態機 trigger 擋下（即使是主辦人手動編輯也一樣）、不能對
「自助報名」的既有列使用手動編輯／移除 RPC、直接繞過 RPC 用 superuser
insert 混合兩種身分形狀會被 CHECK constraint 擋下。

## 過程中確認（不是 bug，是驗證既有防護對新功能依然有效）

第一版測試腳本原本假設「主辦人可以隨意把 confirmed 改成 waitlisted」，
實際測試才發現這違反 P1-02 既有的 registration 狀態機（`confirmed` 只能
轉去 `cancelled` 或 `removed_by_organizer`）。修正的不是 migration，是
測試腳本本身的假設——這證明了狀態機的保護範圍正確涵蓋了這個新 RPC
family，不需要額外程式碼就自動繼承了既有的正確性保證。

## 其他

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm smoke`：
  全部 PASS。
- fixture 於交易內建立，結束前 rollback；套用後重查
  `select count(*) from users where email like '%@test.invalid'` 為 0。
- 前端新增 `RosterManager` 元件，掛在活動頁「參加者名單管理」區塊（僅
  organizer admin 可見），支援新增／編輯／狀態切換／移除。用真實雲端資料
  seed 過的活動頁重新驗證匿名可見部分無回歸；順手抓到並修正一個既有的
  React 反模式 bug（`EventCreatePage`／`MyRegistrationsPage` 在 render
  期間直接呼叫 `navigate()`，觸發 React 警告「Cannot update a component
  while rendering a different component」；改到 `useEffect` 內執行，符合
  render 純函式原則）。

## 不屬於本 Gate

- 手動名單目前沒有欄位可以填自訂報名問題（`event_fields`）的回答。
- 手動新增不檢查活動人數上限（設計如此，見範圍裁決）。
- 手動參加者之間沒有系統性防重複機制（同一人被主辦人不小心新增兩次，
  系統不會自動偵測，因為手動條目沒有帳號可以比對）。
