# Backend Repair Plan Content 本地化缺口待辦（2026-06-05）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：repair plan content、repair step visible content、AI repair generation locale、Web/App repair plan display
**取證代碼入口**：`backend/src/services/ai.service.ts`、`backend/src/services/reconciliation.service.ts`、`backend/src/services/execution.service.ts`、`backend/src/services/repair-journey.service.ts`、`backend/src/controllers/execution.controller.ts`、`frontend/src/pages/Reconciliation/List/index.tsx`、`frontend/src/pages/Reconciliation/Detail/index.tsx`、`frontend/src/pages/Execution/CheckIn/index.tsx`、`frontend/src/pages/Execution/Replan/index.tsx`、`mobile/app/(app)/repair/index.tsx`
**最後核驗 Commit**：`7f5965e`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 狀態

- 狀態：已處理
- 發現日期：2026-06-05
- 處理日期：2026-06-05
- 類型：本地化 / backend-owned stored visible content / Web-App parity

## 原問題

`reconciliation_plan.plan_content` 與 `repair_step_progress.step_title / step_content / fallback_content / pause_rule` 會由 Web 與 App 原樣顯示；初次修復方案生成、AI 重調方案生成、mock/fallback 方案，以及 repair step title 仍以繁中文案為主，未按 request locale 生成。

## 代碼證據

- `backend/src/controllers/reconciliation.controller.ts` 已把 `req.locale` 傳入 `reconciliationService.generatePlans(...)` 與 `executionService.replanTrack(...)`。
- `backend/src/services/reconciliation.service.ts` 呼叫 `aiService.generateReconciliationPlans(...)` 並將 `safePlan` 寫入 `reconciliation_plan.plan_content`。
- `backend/src/services/execution.service.ts` 呼叫 `aiService.generateReplannedRepairPlan(...)`，將 `replanned` 寫入新 `reconciliation_plan.plan_content`，並建立 `repair_step_progress.step_content / fallback_content / pause_rule`。
- `frontend/src/pages/Reconciliation/List/index.tsx`、`frontend/src/pages/Reconciliation/Detail/index.tsx`、`frontend/src/pages/Execution/CheckIn/index.tsx`、`frontend/src/pages/Execution/Replan/index.tsx`、`frontend/src/pages/Execution/Dashboard/index.tsx` 直接顯示 plan / current step 可見內容。
- `mobile/app/(app)/repair/index.tsx` 直接顯示 `plan.first_step`、`status.current_step.content` 等 backend plan / step 內容。

## 修復

- `GenerateReconciliationPlanOptions` 新增 `locale`，`ReconciliationService.generatePlans(...)` 將 request locale 傳入初次修復方案 AI generation。
- `GenerateReplannedRepairPlanInput` 新增 `locale`，`ExecutionService.runReplanTask(...)` 將 request locale 傳入 repair replan AI generation。
- AI prompt 新增輸出語言要求：所有 user-visible JSON values 必須按 request locale 輸出，JSON field names 不變。
- AI mock 初次方案與重調方案補齊 `en-US` 可見內容，避免本機 / 測試環境固定繁中。
- `buildRepairStepTitle(...)` 統一生成 initial / replanned step title；`startPlan`、`confirmExecution`、`checkin`、`replanTrack` locale data flow 已接通。

## 邊界

- 不批量翻譯歷史已落庫方案；舊 plan 仍按原內容顯示，新增 / 重調內容才按當次 request locale 生成。
- 不在前端翻譯 `plan_content` 或 `repair_step_progress` 已儲存內容。
- 不機械翻譯使用者原文、case/judgment 摘要、notes；這些仍作輸入上下文。
- 不改 AI JSON schema 欄位名；只約束欄位值語言。

## 驗證

- `npm --prefix backend test -- tests/unit/services/ai.service.test.ts tests/unit/services/reconciliation.service.test.ts tests/unit/services/repair-journey.service.test.ts tests/unit/services/execution.service.test.ts tests/unit/controllers/execution.controller.test.ts --runInBand --forceExit`
  - 5 suites / 71 tests passed
- `npm --prefix backend run build -- --noEmit`
  - passed
