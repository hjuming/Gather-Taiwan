# P1-01-B RED evidence

日期：2026-08-02

指令：

```sh
pnpm test -- src/lib/clock.test.ts scripts/concurrency-harness.test.ts
```

結果：預期失敗。Vitest 無法解析 `src/lib/clock.test.ts` 的 `./clock` 與
`scripts/concurrency-harness.test.ts` 的 `./concurrency-harness`；固定時鐘與真
PostgreSQL 兩連線 harness 在此時均不存在。

## Fresh Review 修正輪 RED

Fresh Review 發現 framework probe 尚未 default-deny，且 PostgreSQL `bigint` 與
transaction mode 的 JavaScript 契約錯誤。先新增 migration 與 concurrency primitive
契約測試，再執行：

```sh
pnpm exec vitest run scripts/migration-contract.test.ts scripts/concurrency-harness.unit.test.ts
```

結果：3/3 預期失敗，分別證明 migration 尚未 `ENABLE ROW LEVEL SECURITY`、
`nextProbeState` 尚未處理 bigint，以及 transaction mode 尚未使用
`isolation level serializable`。

首次修正後 production build 又正確攔下 postgres.js parameter type 不接受原生
`bigint`；harness 隨後改為參數化十進位字串並由 PostgreSQL 明確 cast 為 `bigint`，
避免 number 精度流失與型別混用。

## 雲端 PostgreSQL bigint RED

首次真實雲端執行時，verify 把字串 `"0"` 誤判為非零；concurrency 則讀回
`counter=2`、`version="11"`，證明運算前沒有正規化 driver 的 bigint 字串。

新增行為測試後的 RED：

```text
× normalizes PostgreSQL bigint strings before arithmetic
TypeError: normalizeProbeVersion is not a function
1 failed, 2 passed
```

後續實作僅在 DB 讀取邊界增加十進位整數驗證與 `BigInt(value)`，未降低
serializable retry 或最終 2/2 驗收標準。
