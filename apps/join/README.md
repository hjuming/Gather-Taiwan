# Gather Join App

`apps/join` 是 `join.gather.wedopr.com` 的獨立 Cloudflare Worker deploy root，使用
React/Vite、`@cloudflare/vite-plugin` 與 Worker static assets；它不共用既有
`gather.wedopr.com` 靜態主站的部署輸出或 Functions。

## 當前狀態

- P1-01-A 已建立前端 foundation 與共用 rich-text／external-link 安全元件。
- P1-01-B 已在 Gather 專屬 Supabase 完成 migration ledger、冪等 seed、可注入時鐘
  與真實雙連線 serializable concurrency gate；仍不含活動／報名 canonical schema。
- probe table 為 default-deny；此處的 RLS 與權限撤銷只保護 framework probe，
  不是 P1-02 的 domain RLS 實作。
- 尚不含報名流程、domain RLS、LINE callback 或 Worker 部署。
- production source 與 build output 不得含 dev-auth 或 service-role 字詞；`pnpm smoke` 會檢查。

## Local verification

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm test:security
pnpm build
pnpm smoke
```

真 PostgreSQL gate 需要 `GATHER_JOIN_TEST_DATABASE_URL`。一般 `pnpm test` 在沒有
DB URL 時會明確 skip 併發整合測試，不代表 migration／併發已通過。
專屬雲端 Gate 的現行操作方式與回滾見 `docs/DEVELOPMENT.md` 與
`docs/MAINTENANCE.md`。

部署由後續環境 Gate 建立 staging／production Worker 後才處理；本目錄目前沒有
deploy script。完整產品狀態以 `docs/SSOT.md` 為準。
