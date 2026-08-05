# Gather Join App

`apps/join` 是 `join.gather.wedopr.com` 的獨立 Cloudflare Worker deploy root，使用
React/Vite、`@cloudflare/vite-plugin` 與 Worker static assets；它不共用既有
`gather.wedopr.com` 靜態主站的部署輸出或 Functions。

## 當前狀態（2026-08-05）

- P1-01-A 已建立前端 foundation 與共用 rich-text／external-link 安全元件。
- P1-01-B 已在 Gather 專屬 Supabase 完成 migration ledger、冪等 seed、可注入時鐘
  與真實雙連線 serializable concurrency gate。
- P1-02 已建立活動／報名 canonical schema、狀態 enum、owner 唯一與交易式轉移、
  合法 registration 狀態機、開始後新報名拒絕、跨活動 composite FK、IANA
  timezone／DST 儲存契約、開始後安全編輯規則及付款資料邊界。
- 所有 domain tables 已 `ENABLE/FORCE RLS` 且撤銷 App roles 權限；P1-04 policies
  尚未建立，因此目前預期行為是完整 fail-closed，不是可用的 domain RLS API。
- 尚不含報名流程、席次引擎 RPC、LINE callback 或 Worker 部署。
- production source 與 build output 不得含 dev-auth 或 service-role 字詞；`pnpm smoke`
  會檢查。
- `apps/join/public/favicon_io/*` 與 `apps/join/public/site.webmanifest` 已補齊，
  `apps/join/index.html` 已掛載 icon 連結；站內資產與 LINE 圖示已做雜湊對照。
- 已完成 `jose` 安裝，並以 `vite.config.ts` 將測試環境設定為 `node`，避免
  `jsdom` + `dompurify` 衝突；`src/security/security.test.tsx` 使用 `@vitest-environment
  jsdom`。

## 當前可接手入口

- 本輪交接建議先讀：`../implementation-control-log.md`、
  `./docs/SSOT.md`、`./docs/DEVELOPMENT.md`、`./docs/MAINTENANCE.md`、
  `../line-t01a-settings-record.md`
- 本地驗證已建立：

```sh
pnpm test
pnpm test:security
pnpm typecheck
pnpm lint
pnpm build
pnpm smoke
```

若缺 `GATHER_JOIN_TEST_DATABASE_URL`，`pnpm test` 只會 skip 本機 DB suite；
這不能代替 migration / concurrency pass。

## 已確認完成（本輪）

- P1-01-A
  - 安全 URL 允許名單、rich text sanitizer、外部連結防護、標準 security header。
  - security suite、typecheck、lint、build、smoke 已全部綠。
- P1-01-B
  - Migration probe、PII-free seed、ledger、RLS/權限、雙連線 serializable retry，
    已在 Gather 專屬雲端完成 read-back。
- P1-02
  - canonical domain schema、owner transfer 正規化、跨活動/時間/狀態 guardrails 已完成
    read-back。
- LINE T-01a
  - 專屬 provider / OA / Messaging API / staging/login / production/login 建立完成。
  - 代表圖（icon）上傳驗證完成，URL 維持 `https://gather.wedopr.com/`。
- P1-03
  - dev JWT identity harness、Cloudflare Access 驗證、可信 rate-limit key、
    CSP/security headers 已完成正式驗收；production build 靜態掃描確認零
    dev-auth 殘留。證據：`docs/evidence/p1-03-green.md`。
  - 尚未接線真實 Cloudflare Access／`AUTH_RATE_LIMITER`，未部署至任何環境。

## 未完成 / 下一階（可接手）

- P1-04：domain RLS policies（目前仍 fail-closed）
- P1-06 / P1-08：冪等請求與單一席次引擎
- T-01b：LINE callback、state/nonce 驗證與真人 E2E
- 部署：staging/production Worker、Cloudflare Access（staging）
- 通知：Phase-2 前續（隱私權條款、callback、secret 寫入後）

## Local verification

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:security
pnpm build
pnpm smoke
```

P1-02 真 PostgreSQL 行為驗證另外執行：

```sh
GATHER_JOIN_TEST_DATABASE_URL='postgresql://…' pnpm verify:p1-02
```

驗證器只建立 synthetic fixture，整段包在 transaction 並於結束 `ROLLBACK`；不得使用
真實 LINE ID、email 或活動資料。

真 PostgreSQL gate 需要 `GATHER_JOIN_TEST_DATABASE_URL`。一般 `pnpm test` 在沒有
DB URL 時會明確 skip 併發整合測試，不代表 migration／併發已通過。
專屬雲端 Gate 的現行操作方式與回滾見 `docs/DEVELOPMENT.md` 與
`docs/MAINTENANCE.md`。

部署由後續環境 Gate 建立 staging／production Worker 後才處理；本目錄目前沒有
deploy script。完整產品狀態以 `docs/SSOT.md` 為準。
