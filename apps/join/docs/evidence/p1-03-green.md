# P1-03 GREEN 證據

日期：2026-08-05

## 範圍

dev JWT identity harness、Cloudflare Access 等效 staging 保護、可信
client-IP/rate-limit 規則、CSP/security headers（來源：`gather-registration-master-backlog.md`
D-7、P1-03 列）。實作已存在於 `feat(join): add staging dev auth worker pipeline`
（`0eae1b8`），本輪為正式驗收與 Gate 收斂，非新增功能。

## 已通過

- `worker/dev-auth.ts`：Cloudflare Access assertion 以 `jose` 驗 RS256 簽章、
  issuer、audience；dev JWT 對 Supabase 簽 HS256、`role=authenticated`、
  600 秒短效期，subject 僅接受 UUID 格式並比對 `DEV_AUTH_SUBJECTS` allowlist。
- `worker/staging.ts`：`/__dev/session` 僅接受同源 POST，缺 Access assertion／
  非 allowlist subject／跨來源一律 403；沒有 `AUTH_RATE_LIMITER` binding 時
  fail-closed 503；核發後以 `HttpOnly; Secure; SameSite=Strict` cookie 短效存放。
- 可信 client-IP／rate-limit：限流 key 為 `access:${verified subject}`，來自
  Cloudflare Access 驗證後的 claims，不採信 `X-Forwarded-For`／`CF-Connecting-IP`；
  `worker/staging-auth.test.ts` 以偽造不同來源 IP 重放同一 verified subject，
  驗證限流 key 不變。
- `worker/response-security.ts`：CSP（`default-src 'self'`）、
  `X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy` 套用於
  production（`worker/index.ts`）與 staging（`worker/staging.ts`）兩個 worker 的
  所有回應。
- production build 無 dev auth（靜態掃描）：`pnpm build` 產出的
  `dist/gather_join/index.js` 只含 security headers 與 asset fetch，`rg` 對
  `dev-auth|__dev/session|DEV_AUTH_SUBJECTS|signSupabaseDevJwt|verifyCloudflareAccess`
  零命中；`worker/index.ts` 完全不 import `dev-auth.ts`。
- `worker/staging-auth.test.ts`：`is absent from the production worker route
  graph` 直接以 production worker 執行 `/__dev/session` 請求，確認回應為一般
  asset（無 `Set-Cookie`）。
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm smoke`：全部
  PASS；Vitest 7 files passed / 1 skipped（P1-01 DB concurrency suite，未注入
  DB URL），32 passed / 1 skipped。
- `pnpm build:staging && pnpm smoke:staging`：PASS。過程中修正
  `scripts/smoke-staging.mjs` 既有 bug——原本三個原始檔都檢查同一個字串
  `"createStagingWorker"`，但該符號只在 `worker/staging.ts` 定義，
  `dev-auth.ts`／`response-security.ts` 本就不含這個字串，導致 smoke:staging
  一律失敗。修正為逐檔核對各自實際匯出的符號
  （`createStagingWorker` / `verifyCloudflareAccess` / `withSecurityHeaders`）。
  修正後 `builtStagingWorker.fetch` 對缺 Access assertion 的 `/__dev/session`
  請求回應 403（fail-closed）。

成功輸出：

```text
Smoke passed: built index, 30 audited files, and built Worker headers.
Smoke staging passed: dist/gather_join_staging/index.js imported and route fail-closed path validated.
```

## 不屬於本 Gate

- 「多 `sub` 仍受 RLS」的資料庫端強制力屬於 P1-04（default-deny RLS、
  registration-scoped view/RPC）；P1-03 只保證 harness 對每個 allowlisted
  subject 核發獨立、短效、`role=authenticated` 的 JWT，讓 P1-04 的 RLS policy
  有正確且唯一的 `sub` 可比對。
- Cloudflare Access 尚未在真實 Cloudflare 環境接線（`ACCESS_TEAM_DOMAIN`／
  `ACCESS_AUD`／`AUTH_RATE_LIMITER` binding 皆未部署），本 Gate 僅驗證程式邏輯與
  單元/整合測試，不宣稱 staging 環境已上線。
- P1-06/P1-08 冪等 replay／席次引擎、T-01b LINE callback 仍未實作。
