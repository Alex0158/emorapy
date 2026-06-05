# AI Stream Cleanup Dry-run 測試 Gate 待補待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：AI stream persistence cleanup dry-run branch、資料治理驗收與 RTM 證據口徑
**取證代碼入口**：`backend/src/services/ai-stream.service.ts`、`backend/src/jobs/cleanup.job.ts`、`backend/tests/unit/services/ai-stream.service.governance.test.ts`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 現狀

`backend/src/services/ai-stream.service.ts` 的 `AIStreamService.cleanupPersistence()` 已有 `dryRun` option。該分支會計算過期 event / session candidates，回傳 `candidateEvents`、`candidateSessions`、retention days、archive config 與 `deletedEvents=0` / `deletedSessions=0`。

但目前 `backend/tests/unit/services/ai-stream.service.governance.test.ts` 只覆蓋 archive-enabled cleanup 會先歸檔再刪除 events / sessions，以及 live/archive listing。尚未有專門測試或 inspection gate 釘住 dry-run 分支「只計數、不歸檔、不刪除」的契約；`backend/src/jobs/cleanup.job.ts` 的排程也只調用實際 cleanup，不提供 dry-run job。

## 代碼依據

- `backend/src/services/ai-stream.service.ts`：`AIStreamCleanupOptions` 含 `dryRun?: boolean`，`cleanupPersistence()` 在 `dryRun === true` 時只執行 count 並回傳 zero deleted / archived counters。
- `backend/tests/unit/services/ai-stream.service.governance.test.ts`：現有測試覆蓋 archive/delete 與 list persistence sessions，未覆蓋 `dryRun: true`。
- `backend/src/jobs/cleanup.job.ts`：`cleanup_ai_stream_persistence` job 調用實際 cleanup，未暴露 dry-run trigger。

## 文件偏差

`04-共用機制/04-資料治理與隱私風險基線.md` 與 `08-測試規範與驗收/04-需求驗證矩陣.md` 曾把 `AI stream cleanup dry-run` 放在資料治理測試/驗收語境中。現碼只能證明 dry-run branch 存在，不能證明它已有可依賴測試或 gate。

因此正式文件應維持「dry-run gate 待補」口徑；補齊前不得把 cleanup dry-run 當成 CJ-NFR-013 已覆蓋證據。

## 目標狀態

1. 為 `AIStreamService.cleanupPersistence({ dryRun: true })` 補專門 unit test，證明會回傳 candidate counters 且不調用 archive/delete。
2. 若需要人工或 Admin inspection，另明確入口；若不需要，RTM 只引用 unit gate。
3. `04-共用機制/04-資料治理與隱私風險基線.md`、`08-測試規範與驗收/04-需求驗證矩陣.md` 與文件收斂台賬同步從 pending 改為已覆蓋。

## 需要修改的文件

- `backend/tests/unit/services/ai-stream.service.governance.test.ts`
- `docs/核心開發文件/04-共用機制/04-資料治理與隱私風險基線.md`
- `docs/核心開發文件/08-測試規範與驗收/04-需求驗證矩陣.md`
- `docs/核心開發文件/文件收斂/03-CJ-核心開發文件逐文件代碼校驗總台賬-2026-04-18.md`

## 驗證命令

```bash
npm --prefix backend test -- --runTestsByPath tests/unit/services/ai-stream.service.governance.test.ts
npm run docs:check
git diff --check
```

## Owner / Status

- Owner：Backend / Data governance
- Status：待處理
- Notes：這不是 AI stream cleanup runtime 缺失；runtime dry-run branch 已存在。缺口是驗收 gate 未釘住，正式文件不能把 branch 存在誤寫成可依賴證據。
