# 來聚一場：免費報名系統 MVP

## Goal

讓註冊主辦人免費建立並分享聚會網址；參加者從 LINE 完成資料填寫與名額登記，主辦人自行收款、確認名額與管理候補，平台不處理任何金流交易。

## Product boundary

- 保留 `gather.wedopr.com` 為文化內容站；報名 App 獨立部署於 `join.gather.wedopr.com`。
- 所有註冊主辦人都能建立免費或自行收款的聚會；平台不代收、不轉付、不串接主辦人的金流帳號，也不判定參加者是否付款。
- 活動可顯示費用與主辦人提供的付款說明，但必須標示「費用由主辦人自行收取；聚場不經手、不驗證、不處理退款」。平台不收付款證明、帳號末碼或交易編號。
- `instant` 模式送出即確認；`organizer_confirmed` 模式送出後等待主辦人確認名額。主辦台的動作名稱是「確認名額」，不得顯示為「確認已付款」。
- 參加者免建立平台帳號；以 email magic link 管理報名。Token 使用高熵亂數、資料庫只存雜湊，可撤銷／重發，有效至活動結束後 30 天，查詢與重發皆 rate limit。
- `public` 可索引；`unlisted` 使用高熵網址且 `noindex`，但知道網址即可開啟；`private` 必須通過可撤銷邀請 token／密碼，未授權者與 OG 預覽不得取得敏感資訊。

## Construction contract

- 最小資料表：`organizers`、`organizer_members`、`events`、`event_fields`、`registrations`、`registration_answers`、`invites`、`notifications`、`outbox_events`、`audit_logs`；不建立 `orders`、`payments`、`refunds` 或 `merchant_connections`。
- 主辦 API 全部要求登入、RBAC 與租戶條件；公開 API 只能讀已發布且符合 visibility 的欄位。報名、管理連結與邀請分別做 input validation、rate limit 與 fail-closed；CSV 僅主辦管理者可匯出，採最小欄位並記錄稽核。
- `capacity = NULL` 表示不限人數。有限額時，`offered`、`pending_organizer_confirmation` 與 `confirmed` 占席，任一時點總和必須原子維持 `≤ capacity`；`waitlisted`、`offer_expired`、`expired`、`declined`、`cancelled` 不占席。
- `event.confirmation_mode = instant` 時，送出即建立 `confirmed`；`organizer_confirmed` 時建立 `pending_organizer_confirmation`，再轉 `confirmed | expired | declined | cancelled`；`confirmed` 仍可轉 `cancelled`。額滿先進 `waitlisted`，有空位時以同一 transaction 將最前順位改為占席的 `offered`；接受後依活動模式轉 `confirmed` 或 `pending_organizer_confirmation`，未接受則轉 `offer_expired | declined | cancelled` 並遞補下一位。
- 送出、確認、拒絕、逾時、取消與候補遞補都在鎖定 event／registration 的 DB transaction 中線性化；每次釋位與 `waitlisted → offered` 在同一交易完成，提交後只寫一次具唯一鍵的 outbox event，避免新報名與候補同時取得同一席。
- 主辦自行收款模式可設定名額確認期限；到期仍未確認就進 `expired` 並釋位。平台只提醒主辦人處理，不推斷未確認原因，也不介入遲繳、退款或收款爭議。
- 整場取消走 `published → cancellation_pending → cancelled | cancellation_exception`：立即關閉新報名，將有效報名取消並逐筆通知；外部退款完全由主辦人處理，平台只顯示責任聲明，不保存退款狀態。
- 個資依欄位記錄蒐集目的與保存期；活動結束後 30 天自動刪除／匿名化非必要答案，飲食與備註不得預設轉作行銷。備份目標 RPO 15 分鐘、RTO 4 小時；通知失敗、逾時 job 停擺與容量不變量異常需告警。

## Tasks

- [ ] 1. 簽核免費服務政策、平台／主辦責任、禁止蒐集的付款資料、取消與外部退款文案 → Verify: 建場、報名、確認與取消頁都不宣稱平台收款或驗證付款。
- [ ] 2. 建立獨立 `join.gather.wedopr.com` App、staging／production 與 CI；主站只新增導流 → Verify: 兩環境可獨立部署、回滾，App 不套用主站 HTML 快取。
- [ ] 3. 建立主辦人登入、多租戶 RBAC、預設拒絕的 RLS、匿名管理 token 與邀請權限 → Verify: 跨租戶、猜 URL、過期／撤銷 token、列舉與暴力重發 E2E 全部被拒絕。
- [ ] 4. 完成建場精靈：圖文、日期時間、地點、三種 visibility、限額、截止時間、費用顯示、主辦收款說明、確認模式、表單與預覽 → Verify: EiMBA 40 席／每席 1,200 元範例能在 3 分鐘內建立，且所有頁面責任文案正確。
- [ ] 5. 實作報名狀態機、原子占席、不限額分支與候補 offer → Verify: 41 人同時搶 40 席時 `offered + pending + confirmed ≤ 40`；新報名、取消與候補接受同時競爭最後一席時只有一人取得；offer 接受／逾時／拒絕最多產生一次轉移與一次通知。
- [ ] 6. 完成參加者管理頁與主辦台：email 驗證、剩餘席次、確認／拒絕、取消、候補、遮罩 CSV 與 LINE 分享文案 → Verify: 手機可在 60 秒內登記；管理連結可安全重發／撤銷；主辦能清楚看出待確認與已確認名單。
- [ ] 7. 完成通知、整場取消、資料保存／刪除、稽核、告警與備份復原 → Verify: 重複任務不重複通知，取消能完整關閉報名並通知，資料到期處理與 RPO／RTO 演練有證據。
- [ ] 8. 以 EiMBA 40 席做 iOS／Android LINE 內建瀏覽器、併發、隱私、主辦確認與營運 UAT → Verify: 所有 P0 測試通過後才開放 Pilot，測試過程不發生任何真實付款或金流資料交換。

## Future WEDO-only payments

- 只有伺服器端 allowlist 認定為 WEDO 自辦／收款主體的活動可啟用，不能由一般主辦人在前台切換。
- 屆時另立金流 decision record，再新增 WEDO 專用 `orders`、`payment_events`、`refunds`、hosted checkout、webhook、對帳與退款模組。
- WEDO 是活動主辦人、實際收款人與退款責任人；一般使用者建立的聚會永遠不會共用 WEDO 金流。
- 金流模組未完成 PSP 合約、PCI／安全、退款、憑證與正式 UAT Gate 前，不得出現在公開產品流程。

## Done when

- [ ] 主辦人能免費建立、分享、管理及取消聚會，並自行處理所有收款與退款。
- [ ] 參加者能從 LINE 網址完成一席登記、取得安全管理連結並收到確認結果。
- [ ] 限額、候補、逾時與取消不超賣、不跨租戶，平台不保存任何交易資料或付款證明。
- [ ] 主辦台只呈現「待確認／已確認」，不把主辦人的人工決定表述成平台驗證的付款結果。

## Deferred

WEDO 自辦活動金流、公開活動探索、多票種／多人同行、折扣碼、QR 報到、原生 App、LIFF／LINE OA 群組通知、座位圖、多幣別與跨境稅務。
