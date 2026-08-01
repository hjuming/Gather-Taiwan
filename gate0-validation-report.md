# 來聚一場報名系統：Gate 0 驗證報告

驗證日期：2026-08-02
結論：`PASS_WITH_DECLARED_FOLLOW_UPS`
界限：修正版施工契約、完整 backlog 與 T-01a Console 拓撲已完成；Phase 1
程式、callback、政策頁、secret store 與 T-01b OAuth／Messaging E2E 均未執行。

## 1. 交付物 read-back

| 交付物 | SHA-256 |
|---|---|
| `gather-registration-change-orders.md` | `b1824ae5227c7f0ced435039fde5bd596df639e67888aa02ee3415ddb89ea82e` |
| `gather-registration-master-backlog.md` | `c0acf693b885a4a7103ce068260f7144f0d087bf7c620fd63cd9b100af127264` |
| `line-t01a-settings-record.md` | `d0272c5bcf699c7573e673374718d7f57e5dace806c3bfc842e75f5658290733` |

機械檢查結果：

- 修正版共有 23 個 `T-01`～`T-23` 頂層工單。
- 修正版與 Master Backlog 的決策矩陣各有 D-1～D-13 共 13 筆。
- Master Backlog 來源矩陣共有 31 筆：原 Task 1～8 加 T-01～T-23。
- S1～S7 是互斥、可加總的單一工程師工作包：下限
  `6+8+11+7+11+5+17=65`，上限 `8+12+17+10+16+7+25=95` 人日。
- 非 Markdown 專案檔掃描沒有 `line_user_id`、`idempotency_requests`、
  `invite_pool_released_at`、dev JWT 或 service-role 實作命中；Phase 1 未偷跑。
- secret／token 值模式掃描無命中；`git -c core.fsmonitor=false diff --check`
  無格式錯誤。

## 2. Fresh Review

Fresh Review v3 結論：`PASS`，無殘餘 P0／P1 文件阻擋。

抽查通過項目：

- 付款方向正確：允許主辦公告費用與收款說明；禁止參加者交易證明欄位與平台
  付款判定。自由文字偵測只宣稱 best-effort。
- T-08 使用 actor-scoped `idempotency_requests`；相同 key／不同 payload 明確拒絕。
- T-18 採單一席次 RPC、event row lock、App role 撤銷直寫與 deferred trigger；
  三條兩池不變量完整。
- dev-only auth 使用不同測試 `sub` 的 JWT 並走 authenticated RLS；Phase 2
  必須物理刪除。
- 每張 Pilot baseline P1／P2 工單恰歸屬一個 S 工作包；P1-11／P1-12 的
  +11～16 人日為可延後增量，不重複計入 65～95。
- G0-03 已有非敏感責任角色；callback、政策頁、資料揭露與 secret store 的
  deferred 邊界清楚。

本 Fresh Review 只證明文件可施工，不證明 LINE OAuth、資料庫、部署或 production
已完成。

## 3. T-01a Console read-back

已在登入後的 LINE Developers Console／Official Account Manager 實際確認：

| 元件 | ID／狀態 |
|---|---|
| 專屬 Provider | `2005399961` |
| 聚場 OA | Basic ID `@223fvgzc`；Messaging API `使用中` |
| Messaging API channel | `2010930919` |
| Staging Login channel | `2010930923`；`Developing` |
| Production Login channel | `2010930927`；`Developing` |

Provider 頁面 read-back 顯示上述 Messaging channel 與兩個 Login channels 均在
`聚場台灣 Gather Taiwan` provider 下，未與 Care WEDO 共用。實際 Console 亦確認
現行建立程序是先建立 OA，再於 OA Manager 啟用 Messaging API 並指定 provider；
不能從 Developers Console 直接新增 Messaging API channel。

Console 的首次成功頁曾在畫面直接顯示初始 Messaging channel secret。該值未寫入
本專案、文件或驗收輸出，並已立即在 Developers Console 提交重新發行。新值不在
Gate 0 讀取；待 secret store 建立後由 Release 負責人直接寫入環境。

## 4. 未完成與進入後續階段的 Gate

- callback URL 尚未設定：等實際 staging／production route 部署後，逐字比對
  scheme、host、path、大小寫與尾斜線。
- 隱私權政策、服務條款與資料使用揭露頁尚未發布；不得在空白狀態公開登入。
- staging／production Login secrets 與 Messaging secret 尚未寫入 secret store；
  Messaging access token 未發行。
- T-01b 留在 Phase 2：真人 OAuth、state／nonce、auto-login fallback、四環境 E2E，
  以及 Login user ID 與 Messaging webhook user ID 的同 provider 比對。
- Phase 1 只能在使用者確認後開始；不得以 service role 繞過 RLS。

## 5. 依據

- LINE Developers：Messaging API channel 自 2024-09-04 起不能直接從 Developers
  Console 建立，須由 LINE Official Account Manager 啟用。
  <https://developers.line.biz/en/news/2024/09/04/no-longer-possible-to-create-messaging-api-channels-from-console/>
- LINE Developers：同一 provider 下的 LINE Login 與 Messaging API channel 才能
  對同一使用者取得相同 user ID。
  <https://developers.line.biz/en/docs/messaging-api/getting-user-ids/>
