# 來聚一場：2026-08-10 實測回饋施工計畫

## 目標

把建立活動與活動分享流程調整成適合手機／iPad 的現代表單，並讓報名頁在視覺與導覽上屬於「聚場台灣」同一個網站。平台仍不代收款；主辦人的費用與收款說明只作公告。

## 本輪施工範圍（可立即驗收）

- 日期與時間拆成日期欄位、24 小時制時／分選擇；台北時區預設當日 18:30–21:30。
- 費用改為可直接輸入的純文字數字欄位，移除瀏覽器上下微調器。
- 地點名稱為必填；活動頁提供 Google 地圖搜尋連結。
- 活動頁提供分享活動、複製連結、分享到 LINE；分享文字包含活動名稱、時間、地點與活動網址。
- 報名工具補上聚場台灣品牌導覽與頁尾，保留活動工具操作入口。

## 後續施工範圍（LINE 對話管理）

目前 LINE Login 已完成正常授權登入，但 Messaging API 對話管理尚未接通。本需求需獨立設計與驗收：

1. Messaging API webhook：簽章驗證、重播防護、事件去重、錯誤重試與可觀測性。
2. 通知 outbox：建立活動、報名、候補／確認、取消、活動異動等模板；以 email＋站內通知為 Pilot 預設，LINE 通知需使用者明確同意。
3. 使用同一專屬 LINE provider 的 `line_user_id` 綁定；不與 Care WEDO 使用者互通。
4. LINE Rich Menu 導向 LIFF 活動清單／活動管理；對話回覆只承擔通知與簡單快捷操作，不把複雜資料編輯塞進純文字指令。
5. 主辦人與參加者權限、撤銷、退訂、通知偏好、封鎖／解除綁定與失敗重送。

## 驗收標準

- 建立表單不再出現 `datetime-local` 原生 12 小時選擇器；時間顯示與送出皆為 `HH:mm`。
- 進入表單時預設日期為台北當日、開始 18:30、結束 21:30；若結束早於開始，前端阻擋送出。
- 費用欄位可輸入空白後重新輸入，不顯示上下箭頭；非數字字元不會進入送出 payload。
- 活動頁的時間、地點、Google 地圖、分享入口在桌機與窄螢幕均可操作。
- `pnpm test`、`typecheck`、`lint`、`build`、`smoke` 全部通過；部署後 read-back 實際新資產與路由。
- LINE 對話管理在獨立 backlog 完成前，不宣稱已提供 LINE 通知或聊天管理。

## 風險與邊界

- 原生日期／時間控制項的外觀受 OS 影響；因此時間改用自有 24 小時選單，避免 iPad 顯示上午／下午微調器。
- 同日預設若使用者在台北時間 21:30 後開啟表單，會自動順延至翌日，避免預設值落在過去。
- LINE Messaging API 需要 Cloudflare、LINE Developers 與資料庫／權限變更；本輪不直接改動這些 production 設定。

## 2026-08-10 活動頁 v2 補充

- 活動頁改為手機優先的 editorial layout，包含預設 HERO、活動基本資料、完整分享內容與主辦人名單工作區。
- 分享 slug 新活動改為 `event-YYYYMMDD-xxxx`，日期只是可讀識別，不取代 private event 的 token／權限檢查。
- 預設 HERO 已放入 `apps/join/public/assets/gather-event-hero-default-v1.png`。主辦人自訂圖片要正式落地，仍需 Supabase Storage bucket、`hero_image_url` 欄位、RLS／檔案大小與 MIME 驗證；依目前「暫停 Supabase 專案操作」指示，本輪不套用遠端 migration。
- 參加者聯絡資訊只顯示報名流程中明確提供或主辦人手動填入的 `manual_contact`；資料庫目前不授權 organizer 直接讀取其他使用者的手機、Email 或 LINE identity。
