# LINE 對話管理 Phase 2 設計草案

## 目前狀態

來聚一場目前已使用聚場台灣專屬 LINE provider 完成標準 LINE Login。Messaging API channel 已建立，但目前沒有 webhook、通知 outbox 或對話管理流程；因此 Pilot 仍以 email＋站內通知為準。

## 建議互動模型

- **LINE 對話視窗**：收到活動建立、報名、確認、候補、取消與活動異動通知；訊息提供「查看活動」「查看我的報名」等 URI action。
- **Rich Menu／LIFF**：進入可登入的活動清單與管理頁，讓主辦人管理自己的活動、參加者查看或取消報名。複雜表單不使用脆弱的純文字指令。
- **Web 分享**：活動頁保留複製連結、原生分享與 LINE 分享 URL；這與 OA 推播是兩條不同能力。

## 後端邊界

1. `POST /app/line/webhook`：讀取 raw body，以 Messaging API channel secret 驗證 `x-line-signature`；驗證失敗一律 401，不解析或執行事件。
2. 事件去重：以 LINE webhook event id 建立唯一鍵，重送只回 200，不重複執行副作用。
3. 通知 outbox：以事件／收件者／模板版本／冪等鍵寫入佇列；worker 送出後保存送達結果與可重試錯誤，不保存 access token。
4. LINE 身份：只接受同一聚場 provider 的 `line_user_id`；不可與 Care WEDO 的 ID 合併或猜測對應。
5. 授權：每個 LIFF action 重新以 session 與活動／主辦關係判斷，猜 URL、跨租戶與過期 token 一律拒絕。

## 需要的資料與設定（尚未施工）

- `line_webhook_events`：event id、received_at、處理狀態與錯誤摘要。
- `notification_outbox`：收件者 user id、事件類型、模板版本、狀態、重試時間；禁止存付款證明或平台付款狀態。
- `notification_preferences`：使用者對 LINE 通知的 opt-in／opt-out 與更新時間。
- LINE Developers：Messaging API webhook URL、Rich Menu、LIFF app；staging／production 分開設定。

## 驗收

- 簽章錯誤、重播事件、未知 user id、跨租戶 action、過期 session 都有可重現的 fail-closed 測試。
- 建立活動、報名、確認／候補、取消各至少有一組通知 E2E；重試不重複發送。
- 使用者關閉 LINE 通知後不再推播；封鎖 OA 或 token 過期只記錄可觀測錯誤，不影響活動／報名核心交易。
- Rich Menu／LIFF 在 LINE 內建瀏覽器與一般手機瀏覽器各完成一次主辦／參加者流程。
- 未完成上述驗收前，產品文案不得宣稱「已接通 LINE 通知」或「可在 LINE 管理活動」。
