# 來聚一場：產品與技術 SSOT

最後更新：2026-08-02

## 產品目標

來聚一場是免費的聚會報名工具。使用者以 LINE 登入、完善基本資料，可以建立
公開或非公開活動、分享專用網址，並讓參加者確認報名。首個可驗收情境為
「免費、公開、不限名額」活動。

## 不可讓步邊界

- 系統不蒐集參加者付款證明、金額、末碼、交易編號或截圖，不判定付款狀態。
- 可顯示主辦人自行收款說明與活動費用，但平台不介入對帳。
- 文案不得宣稱「已付費」、「已驗證年齡」或「平台確認」。
- 容量不變量在報名、取消、候補晉升、capacity 調降與兩池分配都必須成立。
- RLS 與所有權限預設拒絕；跨租戶、猜 URL、過期 token 都 fail-closed。

## 已定案產品決策

- LINE provider：專屬「聚場台灣 Gather Taiwan」，不與 Care WEDO 共用。
- LINE Login：首版全走標準 OAuth，不做 LIFF 分支。
- Phase 1 dev auth：只允許 non-production 的不同 `sub` dev JWT，仍走
  `authenticated` role 與 RLS；Phase 2 上線前刪除程式碼。
- 邀請席次：一般池／邀請池分池，池內先報先得，不新增 `reserved` 狀態。
- Pilot 通知：email 加站內通知。
- 活動頁：公開活動免登入可讀；報名前才要求 LINE 登入。

## Phase 2 預定技術路徑（尚未驗收）

- 2026-08-02 依 Supabase 現行官方 Custom OAuth/OIDC provider 與 LINE OIDC/PKCE
  文件，預定使用 `custom:line`，不採 service-role magic-link 舊 workaround。
- 這是 P2-02 的實作 ADR，不是 P1-01-B 驗收結果。必須以 Dashboard 顯示的
  callback URL、實際 LINE channel 與登入負向測試後，才能轉為已驗收架構。

## 環境與外部資源

| 資源 | 當前值 | 狀態 |
| --- | --- | --- |
| GitHub | `hjuming/Gather-Taiwan` | `codex/gather-mvp` 開發分支已推送 |
| 文化主站 | `https://gather.wedopr.com/` | 獨立靜態站，不可被 app build 覆寫 |
| 報名 App | `join.gather.wedopr.com` | 尚未部署 |
| Supabase org | `gather Taiwan` / `qqcraliqerxjcuyztkkf` | Free |
| Supabase project | `gather-taiwan` / `anklbpkyesdmsubyfcna` | Healthy, Tokyo |
| Supabase URL | `https://anklbpkyesdmsubyfcna.supabase.co` | 公開 project URL，非 secret |
| LINE OA | `@223fvgzc` | 專屬 provider |
| Messaging channel | `2010930919` | 已建立，Pilot 不作通知管道 |
| Staging Login | `2010930923` | Developing |
| Production Login | `2010930927` | Developing |

## 現行完成度

- P1-01-A：前端／Worker foundation 與 rich-text、external-link 安全契約完成。
- P1-01-B：Gather 雲端 migration ledger、probe RLS、全 table privilege 撤銷、
  PII-free seed、雙連線 serializable retry 已通過；Supabase Advisors 尚未讀回，
  狀態為 `PASS_WITH_DECLARED_FOLLOW_UP`，不是部署 readiness PASS。
- 未完成：profiles/events/registrations canonical schema、LINE OIDC 實際登入、主辦與
  報名 UI，staging/production 部署與雙帳號 E2E。

## 真實來源優先序

1. `gather-registration-master-backlog.md`（完整 backlog 與裁決整併的 canonical 來源）
2. `gather-registration-change-orders.md`
3. `gate0-validation-report.md`
4. 本 SSOT 的已實作環境與狀態記錄
5. `implementation-control-log.md` 的執行證據

若文件與 live read-back 衝突，不得修改驗收來迁就現狀；先停止寫入、記錄差異並修正實作或
更新裁決。
