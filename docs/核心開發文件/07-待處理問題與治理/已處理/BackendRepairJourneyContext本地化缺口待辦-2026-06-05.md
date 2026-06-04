# Backend Repair Journey Context 本地化缺口待辦（2026-06-05）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：repair journey context、execution dashboard visible context、Web/App repair journey display
**取證代碼入口**：`backend/src/services/repair-journey.service.ts`、`backend/src/services/reconciliation.service.ts`、`backend/src/services/execution.service.ts`、`backend/src/controllers/reconciliation.controller.ts`、`backend/src/controllers/execution.controller.ts`、`frontend/src/pages/Execution/Dashboard/index.tsx`、`frontend/src/pages/Execution/CheckIn/index.tsx`、`frontend/src/pages/Execution/Replan/index.tsx`、`mobile/app/(app)/repair/index.tsx`
**最後核驗 Commit**：`8d760c2`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理
**Owner**：Backend / Shared / Web / App
**關聯核心文件**：`04-共用機制/00-共用機制總覽.md`、`06-接口描述/05-reconciliation-execution.md`、`20-App端/01-App導航與平台Adapter基線.md`、`50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`

---

## 1. 問題

`buildRepairJourneyContext()` 會生成 `journey_context.title`、`journey_context.body`、`primary_cta.label`、`secondary_cta.label` 等 backend-owned visible content，但原本固定使用繁中文案。`ExecutionService.getExecutionStatus()` / `getAllExecutionStatuses()` 與 Reconciliation 方案列表 / 詳情會把該 context 回傳給 Web / App，前端頁面直接顯示這些欄位：

1. Web `ExecutionDashboard` 直接渲染 `item.journey_context?.title`、`item.journey_context?.body`、`item.journey_context?.primary_cta.label`。
2. Web `ExecutionCheckIn` / `ExecutionReplan` 直接渲染 `plan_summary.title`、`current_step.content` / `fallback_content`。
3. App repair dashboard 直接渲染 `plan_summary.title` 與 `current_step.content`。

## 2. 影響

英文使用者在 repair journey / execution dashboard / check-in / replan 相關入口中，可能看到由 backend DTO 直接返回的繁中文案。端側雖有 i18n catalog，但這些欄位屬 backend-owned visible content 或 AI / plan persisted content，Web / App 不應在顯示層重建第二套翻譯表。

## 3. 修復目標

1. deterministic backend context copy（journey context title/body/CTA）支援 `zh-TW` / `en-US`。
2. `ExecutionController` 的 status / dashboard 讀取把 request locale 傳入 `ExecutionService`。
3. `ReconciliationController` 的 generate / list / detail / select / invite / pause / respond 路徑把 request locale 傳入 `ReconciliationService`。
4. Web / App 繼續只顯示 backend 已生成內容，不在端側建立 repair journey context 翻譯表。

## 4. 邊界與注意事項

1. 不翻譯使用者輸入、歷史 plan content 或已落庫的舊 repair track step content。
2. 不改 DB schema；本輪修正新請求回傳的 deterministic context copy。
3. AI / persisted plan content 仍需沿 upstream generation prompt 處理；本輪不做 response mapper 機械翻譯。

## 5. 修復紀錄

2026-06-05 已修復：

1. `buildRepairJourneyContext()` 新增 locale-aware copy catalog，覆蓋 replanning / paused / completed / invitee / active / waiting / no-track / review 等 context。
2. `ExecutionService.getExecutionStatus()` / `getAllExecutionStatuses()` 與 `buildJourneyContextForExecution()` 支援 request locale。
3. `ReconciliationService` 的 plan payload / detail / select / invite / respond / pause context 支援 request locale；notification payload 的 `journey_context` 與 `cta_label` 使用同一 locale-aware context。
4. `ExecutionController` / `ReconciliationController` 將 `req.locale` 傳入相關 service。
5. Focused tests 覆蓋 zh-TW default、en-US journey context、controller locale propagation。

修復驗證：

```bash
npm --prefix backend test -- tests/unit/services/repair-journey.service.test.ts tests/unit/services/execution.service.test.ts tests/unit/controllers/execution.controller.test.ts tests/unit/controllers/reconciliation.controller.test.ts --runInBand --forceExit
npm --prefix backend run build -- --noEmit
```
