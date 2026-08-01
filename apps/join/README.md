# Gather Join App

`apps/join` 是 `join.gather.wedopr.com` 的獨立 Cloudflare Worker deploy root，使用
React/Vite、`@cloudflare/vite-plugin` 與 Worker static assets；它不共用既有
`gather.wedopr.com` 靜態主站的部署輸出或 Functions。

## Phase 1 邊界

- 本 P1-01-A 切片僅提供前端 foundation 與共用 rich-text／external-link 安全元件。
- 不含報名流程、資料庫、RLS、auth、LINE callback、secrets 或任何部署設定。
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

部署由後續環境 Gate 建立 staging／production Worker 後才處理；本目錄沒有 deploy script。
