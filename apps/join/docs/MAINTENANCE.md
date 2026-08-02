# 來聚一場：維護注意事項

## 密鑰與帳號

- LINE channel secret、Supabase DB password、service role key 都不得進 Git、DOM 快照、
  screenshot、CI log 或維運文件。
- 2026-08-02 建立 Supabase 時，初始隨機 DB password 曾出現於受控工具輸出；
  已立即輪替，現行密碼僅在被 ignore 的 `0600` 本機檔。
- Staging LINE Login secret 曾在 Console DOM read-back 出現，已要求重新發行；在
  Phase 2 實際登入前必須再確認現行 secret 只存於部署環境。
- 搬用 Care WEDO OAuth 邏輯時，只可參考 state/nonce/fallback 寫法；不可搬
  channel id、secret、callback URL 或使用者資料。

## 資料庫

- Gather project ref 固定為 `anklbpkyesdmsubyfcna`。任何寫入前先比對 project ref、
  host 與 migration ledger；不可對 Signal/Care 專案操作。
- 使用 Session pooler 做 migration 時，user 必須是 `postgres.<project-ref>`，必須
  `sslmode=require`，並設定連線逾時。
- PostgreSQL `bigint` 經 `postgres` JavaScript driver 可能是十進位字串。運算前必須
  統一 `BigInt(value)`；不可對字串直接 `+ 1n`。
- 有限容量不得在 UI 端先讀後寫。必須使用事務、鎖、唯一約束、單一席次
  引擎與 deferred constraint trigger 共同維持。

## LINE Login

- production 前在 LINE Console 逐字比對 callback URL，含 scheme、host、path、尾斜線
  與大小寫。
- Supabase custom OIDC callback 以 Dashboard 顯示的 read-only callback URL 為準，不猜測。
- RLS 身分只信任 `auth.uid()` 與 server-validated claims，不信任可自行編輯的
  `user_metadata`。
- 上線驗收必須包含：正常授權、拒絕授權、無 email、incognito、過期
  state/nonce、兩個獨立 LINE 帳號。

## 回滾

- 程式：回滾當次 Gate commit，不覆寫靜態主站或使用者的無關變更。
- DB：不修改已套用 migration；新增 forward-only corrective migration。破壞性回滾必須
  先有 backup／export、目標比對與人工核准。
- LINE：Login channel 在 E2E 前維持 Developing；若 callback 錯誤，先撤下發布並復原
  上一個已驗證 URL，不用 Care WEDO 設定代替。
