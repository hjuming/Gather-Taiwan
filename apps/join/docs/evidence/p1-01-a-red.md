# P1-01-A RED evidence

日期：2026-08-02

指令：

```sh
pnpm test -- src/security/security.test.tsx
```

結果：預期失敗。Vitest 無法解析 `src/security/security.test.tsx` 對
`./security` 的 import，錯誤為 `Failed to resolve import "./security"`。
此時安全 URL allowlist、rich-text sanitizer 與 React renderer 尚未存在。

註記：第一次執行曾被 Cloudflare Vite plugin 的 sandbox port probe
`EPERM 0.0.0.0:9229` 阻擋；測試模式已排除 Worker plugin，第二次 RED 才確認為
待實作 module 缺失。

## 修正輪 RED（fresh review P1）

指令：

```sh
pnpm test
```

結果：預期失敗（5 failures／15 tests）。現行 renderer 與 DOMPurify hook 缺
`nofollow`；`sanitizeUrl()` 會 trim 而接受頭尾空白 URL；Worker 只轉送 ASSETS
response，缺 CSP、nosniff、no-referrer 與 Permissions-Policy。失敗輸出顯示
`Content-Security-Policy` received `null`，以及含空白的 HTTPS URL received 非 null。
