# P1-02 RED 證據

日期：2026-08-02

## Canonical migration 不存在

指令：

```sh
pnpm exec vitest run scripts/domain-schema-contract.test.ts
```

結果：3 tests failed；三案均因
`20260802152000_p1_02_canonical_schema.sql` 不存在而得到 `ENOENT`。

## Owner transfer 交易缺陷

第一版 canonical migration 套用後，rollback fixture 先執行
`SET CONSTRAINTS ALL IMMEDIATE`，再呼叫 owner transfer。舊 owner 降級步驟得到：

```text
SQLSTATE 23514
organizer … must have exactly one active owner
```

這證明 function 不能假設 caller 保持 constraint deferred。先新增 corrective migration
contract；在檔案不存在時得到 1 failed / 3 passed，之後才實作 forward-only 修正。

## 測試器時間序列化

首次 DST read-back 將 PostgreSQL `timestamp without time zone` 交由 JavaScript runtime
轉成 `Date`，受本機 timezone 影響而誤判。驗證器改由 SQL `to_char` 讀回 wall time；
這是測試器缺陷，不是資料庫時間模型缺陷。

## Fresh review guardrails

第一次 fresh review 判定 `BLOCK`：enum 沒有 DB transition guard，開始關閉只有 helper；
第二位 reviewer 另發現 membership 可跨 organizer 更新，以及 answer/outbox 等關聯可
跨活動拼接。先把 `20260802160000_p1_02_registration_guardrails.sql` 加入 contract；
檔案不存在時得到 1 failed / 4 passed，才實作第三張 forward-only corrective migration。
