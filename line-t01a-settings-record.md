# T-01a：聚場台灣 LINE 拓撲與設定紀錄

更新日期：2026-08-02
狀態：`COMPLETE_WITH_PHASE_2_FOLLOW_UP`（拓撲已建立；callback、政策頁與 secret store 留待對應工單）
範圍：僅建立帳號拓撲與留下非機密紀錄；OAuth／Messaging E2E 屬 T-01b，留待 Phase 2。

## 1. 不可變邊界

- 聚場台灣使用全新專屬 provider，不與 Care WEDO 共用 provider、channel、callback、secret 或使用者資料。
- LINE user ID 以 provider 為作用域；聚場同一 provider 下的 LINE Login 與 Messaging API 才能對同一人取得相同 user ID。
- staging 與 production 使用不同 LINE Login channels 及不同 secret；secret 只存於各環境的 secret store，本檔只記錄 `SET／UNSET`，不得記錄值。
- Messaging API channel 必須依現行程序由 LINE Official Account Manager 建立：先建立 OA，再啟用 Messaging API 並指定本 provider；不得嘗試在 LINE Developers Console 直接新增 Messaging API channel。
- production Login channel 在 T-01b 完成真實 OAuth、callback 精確比對與上線 Gate 前維持 `Developing`。

## 2. 預定命名與拓撲

| 元件 | 預定名稱 | 所屬 | T-01a 狀態 |
|---|---|---|---|
| Provider | `聚場台灣 Gather Taiwan` | 獨立於 Care WEDO | `CREATED` |
| LINE Official Account | `聚場台灣 Gather Taiwan` | 聚場專屬 OA | `CREATED` |
| Messaging API channel | 由上述 OA 啟用後建立 | `聚場台灣 Gather Taiwan` provider | `CREATED` |
| Staging LINE Login channel | `聚場台灣 Staging` | 同一 provider | `CREATED／Developing` |
| Production LINE Login channel | `聚場台灣 Gather Taiwan` | 同一 provider | `CREATED／Developing` |

## 3. Console 實際紀錄

建立完成後逐列回填；ID 可記錄，secret 不得記錄。

| 項目 | 實際值／狀態 |
|---|---|
| 執行帳號 | `[REDACTED]`（不記錄 Business ID／email） |
| Provider 名稱 | `聚場台灣 Gather Taiwan` |
| Provider ID | `2005399961` |
| OA 名稱／Basic ID | `聚場台灣 Gather Taiwan`／`@223fvgzc` |
| Messaging channel ID | `2010930919` |
| Staging Login channel ID | `2010930923` |
| Production Login channel ID | `2010930927` |
| Staging channel secret | `REISSUE_REQUESTED／NOT_STORED`（2026-08-02 品牌設定 read-back 後；本檔永不記值） |
| Production channel secret | `ISSUED／NOT_STORED`（本檔永不記值） |
| Messaging channel secret | `REISSUE_REQUESTED／NOT_STORED`（本檔永不記值） |
| Messaging access token | `NOT_ISSUED` |
| Production channel status | `Developing`（已由 Console read-back） |
| Staging channel status | `Developing`（已由 Console read-back） |
| OA 產業分類 | `活動／活動(其他)` |
| OA Messaging API 狀態 | `使用中` |
| OA 官網 | `https://gather.wedopr.com/`（已於 OA 商業簡介儲存並 read-back） |
| OA／Messaging 代表圖 | `favicon_io/android-chrome-512x512.png`（已發布） |
| Staging Login channel icon | 同上（已更新並 read-back） |
| Production Login channel icon | 同上（已更新並 read-back） |

代表圖檔案契約：512×512 PNG、538,001 bytes，SHA-256
`20e30440968d8831f3250ff3203e06c1bf9c1ca2be23d8cf98e67a66265b8521`。
`apps/join/public/favicon_io/android-chrome-512x512.png` 已同步複本，供 join 站內 read-back 與
部署資產一致性比對使用。

### 交接責任角色（不記個人登入資料）

| 責任範圍 | 責任角色 | Gate 0 狀態 |
|---|---|---|
| Provider／OA／channel 管理與權限盤點 | 聚場台灣產品負責人指定的 LINE Business Manager 管理員 | `ASSIGNED_BY_ROLE` |
| staging／production callback 定案與逐字比對 | P2-01/T-01b 的 Auth 工程負責人 | `PENDING_PHASE_2` |
| 隱私權政策、服務條款與資料使用揭露 | P1-16 的隱私／法遵負責人，產品負責人核准 | `PENDING_PHASE_1` |
| staging／production secret store 寫入與輪替 | P2-06 的 Release 負責人；不得經文件或 issue 轉交 secret | `PENDING_SECRET_STORE` |

## 4. Callback 與發布狀態

T-01a 不臆測尚未部署的 callback URL。T-01b 開始前，須先以實際 staging／production 路由決定下列精確值，再逐字比對 LINE Console；大小寫、scheme、host、path 與尾斜線均視為契約的一部分。

| 環境 | Callback URL | T-01a 處置 |
|---|---|---|
| staging | `TBD — 由已部署路由決定` | 不發布；維持 Developing |
| production | `TBD — 由已部署路由決定` | 不發布；維持 Developing |

隱私權政策與服務條款 URL 亦未臆造：目前專案沒有已發布的政策頁，因此 OA／Login channel 的選填欄位維持空白。政策頁、資料使用揭露與 email scope 申請列為 Phase 1/2 上線前阻擋項，不得以空白設定進入公開登入。

## 5. Secret store 契約（只記名稱與狀態）

最終環境變數名稱由 App scaffold 工單定案；在此之前不得建立含實值的 `.env` 或把 secret 貼進 issue、commit、截圖與驗收輸出。

| 用途 | 建議變數名稱 | staging | production |
|---|---|---|---|
| LINE Login channel ID | `GATHER_LINE_LOGIN_CHANNEL_ID` | `UNSET` | `UNSET` |
| LINE Login channel secret | `GATHER_LINE_LOGIN_CHANNEL_SECRET` | `UNSET` | `UNSET` |
| Messaging channel ID | `GATHER_LINE_MESSAGING_CHANNEL_ID` | `UNSET` | `UNSET` |
| Messaging channel secret | `GATHER_LINE_MESSAGING_CHANNEL_SECRET` | `UNSET` | `UNSET` |

### Secret 安全處置

- OA Manager 在首次啟用成功頁會直接顯示 channel secret。該首次值未寫入任何檔案，且已立即由 Developers Console 提交重新發行；舊值不得使用。
- 2026-08-02 更新 Staging Login channel icon 時，Basic settings 畫面 read-back
  再次讓既有 Staging secret 出現在工具輸出；該值未寫入專案或驗收文件，並已立即
  提交重新發行。新值確認前不得啟用 Staging LINE Login。
- 新 secret 不在 Gate 0 讀取或落地。待 App secret store 建立後，再由權限持有人直接寫入各環境，驗收只回報 `SET／UNSET`。

## 6. T-01a 驗收證據

- [x] LINE Developers Console 顯示專屬 provider，且該 provider 不含 Care WEDO channel。
- [x] LINE Official Account Manager 顯示聚場專屬 OA 已啟用 Messaging API。
- [x] Messaging API channel 與兩個 LINE Login channels 均位於同一 provider。
- [x] staging／production Login channel 為不同 channel。
- [x] production channel 未提前發布。
- [x] 本紀錄未包含 channel secret、access token、Business ID、email 或其他登入資料。
- [x] 實際 Console 畫面已確認「先建 OA → 啟用 Messaging API → 指定 provider」程序；Developers Console 亦明示不得直接建立 Messaging API channel。
- [x] OA／Messaging 與 staging／production Login channels 已套用同一枚聚場代表圖；
  provider 頁面完成視覺 read-back，兩個 Login channels 仍為 `Developing`。
- [x] OA 商業簡介已儲存官網 `https://gather.wedopr.com/` 並於設定頁 read-back。
- [ ] Phase 2 前發布隱私權政策／服務條款／資料使用揭露並回填 URL。
- [ ] Phase 2 由已部署路由定案兩個 callback，逐字比對後才設定與 E2E。

## 7. T-01b（Phase 2，明確不在本工單）

- 精確 callback URL 設定與錯誤 URL（大小寫／尾斜線）負向測試。
- state／nonce／ID token 驗證、auto-login fallback 與重新授權一次。
- staging／production 真人 LINE OAuth E2E。
- 加好友後由簽名驗證的 Messaging webhook 取得 user ID，與 Login user ID 比對。
- OA push、通知偏好與 opt-out；Pilot 仍以已驗證 email＋站內通知為主。
