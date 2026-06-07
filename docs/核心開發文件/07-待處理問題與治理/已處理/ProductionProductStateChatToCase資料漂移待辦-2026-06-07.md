# Production Product-state Chat-to-case 資料漂移待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：發布版 `ops:product-state:audit` 發現的 chat-to-case link / case / judgment production data drift
**取證代碼入口**：`backend/scripts/audit-product-state-consistency.ts`、`scripts/ops-release-gate.sh`、`backend/prisma/schema.prisma`
**最後核驗 Commit**：`739ed23`
**最後核驗日期**：`2026-06-07`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 現狀

2026-06-07 的 `Production Deploy and Verify` verify-only run 在 `ops:product-state:audit` 失敗。已確認主站、Admin、Backend version endpoint 均指向 `739ed23`，backend health、DB migration state、release DB parity、AI pricing catalog、smoke account hygiene 與 release smoke 均已先通過；失敗點集中於 production DB 內 5 筆舊 `chat_to_case_links`：

1. `chat_to_case_links.judgment_id IS NULL`
2. linked `cases.status = completed`
3. linked `judgments` 無對應 row
4. linked `chat_rooms.status = judgment_completed`

這些 row 屬於舊 guest quick chat-to-case data。由於 linked case 沒有唯一 judgment，不能按 audit 建議直接補 `judgment_id`，也不能補造 judgment row。

2026-06-07 已完成修復：

1. `ops:product-state:audit:persist` 已 upsert 5 筆 `product_state_recovery_tasks`。
2. 已按有條件 transaction 將 5 個 linked case 與 5 個 linked chat room 改為 `judgment_failed`，保留「無 judgment row」的失敗語義。
3. 已將 5 筆 recovery task 標記為 `resolved`，並寫入 5 條 `audit_logs`。
4. 修復後 production `ops:product-state:audit` 返回 `ok=true`。
5. GitHub Actions `Production Deploy and Verify` run `27085983186` 已通過 verify-only release gate。

## 目標狀態

1. 先以 `ops:product-state:audit:persist` 把 audit recovery candidates upsert 到 `product_state_recovery_tasks`，保留人工恢復紀錄。
2. 對每筆確認無 judgment row 的舊資料，將 case / room 狀態調整為可重試或失敗語義，不把不存在的梳理結果寫成完成。
3. 修復後 `ops:product-state:audit` 返回 `ok=true`。
4. 再次執行 GitHub Actions `Production Deploy and Verify` release gate，確認發布版閉環。

## 驗證命令

```bash
DATABASE_URL=<production-db-url> npm --prefix backend run ops:product-state:audit:persist
DATABASE_URL=<production-db-url> npm --prefix backend run ops:product-state:audit
gh workflow run production-deploy-and-verify.yml --ref main -f deploy_web=false -f deploy_backend=false -f run_release_gate=true
gh run watch <run-id> --exit-status
```

## Owner / Status

- Owner：Release / Ops / Backend data governance
- Status：已處理
- Notes：此項是 production data hygiene 修復，不涉及 schema 變更；不得在文檔、commit message 或 chat 中記錄 production DB 連線字串。
