# Backend Execution 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend execution / repair track API 錯誤訊息、Web Execution/Replan error 顯示、App Repair Journey error 顯示、backend i18n message map
**取證代碼入口**：`backend/src/services/execution.service.ts`、`backend/src/controllers/execution.controller.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend/src/pages/Execution`、`mobile/app/(app)/repair`、`packages/api-client/src/m4.ts`
**最後核驗 Commit**：`54b36ed`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/services/execution.service.ts` 的 execution confirm / check-in / repair track status / replan flow 仍有 backend-owned 中文錯誤 message 未被 `translateBackendMessage()` 覆蓋：

- `無權限執行此方案`
- `無權限查看此修復旅程`
- `請先在和好方案中選擇此方案再確認執行`
- `請先選擇並確認此方案後再記錄進展`
- `無權限調整此修復旅程`
- `目前這一輪狀態無法重新調整`

其中 `請先在和好方案中選擇此方案再確認執行` 與 `請先選擇並確認此方案後再記錄進展` 是透過 `assertPlanSelected(..., errorMsg)` 間接丟給 `Errors.FORBIDDEN()`，不會被只掃 `Errors.*('...')` 的簡單 regex 捕捉。Web `frontend/src/pages/Execution/*` 會透過 `getErrorMessage()` 顯示 backend `error.message`；App `mobile/app/(app)/repair/index.tsx` 會直接顯示 `normalizeM4Error(...).message`。當 request locale 為 `en-US` 時，這些 execution fallback error 仍可能直出繁中。

## 影響範圍

- Backend：confirm execution、legacy check-in、execution status、repair track access、repair replan API error payload。
- Web：Execution Dashboard / CheckIn / Replan toast 與 stream terminal fallback error。
- App：Repair Journey dashboard / generate / select / confirm / check-in / replan visible error。
- Shared/API client：M4 client 傳遞 backend error message，不應在 shared 或端側新增 ad hoc 中文 message 翻譯表。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋 `和好方案不存在`、`修復旅程不存在` 與 reconciliation service 的 repair journey 錯誤，但 execution service 自有 permission、selection precondition 與 replan state validation message 尚未補齊 exact en-US map。這會造成同一 repair journey 流程中，一部分錯誤可按 `X-Locale` 翻譯，另一部分仍直出繁中。

## 目標行為

1. `en-US` locale 下，execution service 自有錯誤 message 必須經 backend locale layer 輸出英文。
2. `zh-TW` locale 下，原繁中 canonical message 保持不變，不改 execution / repair track 業務語義。
3. `plan_id`、`track_id`、`solo_active`、`co_active`、`replanning` 等 API 欄位和值不被本地化。
4. Web/App/shared client 不新增端側中文錯誤翻譯表，仍統一消費 backend locale layer。

## 分析與方案

1. **業務邏輯輪**：`confirmExecution()` 與 `checkin()` 都先驗證使用者是方案當事人、方案已被選擇，再啟動或記錄修復旅程；`assertTrackAccess()` / `replanTrack()` 驗證 track 存在、當事人權限與當前狀態。修復只補 message map，不改權限、狀態機、AI replan、通知或 repair journey context。
2. **i18n 資料流輪**：Web/App request 已帶 locale；backend `localeMiddleware` 將 locale 傳給 `errorHandler` / `responseFormatter`；`translateBackendMessage()` 是 API visible message 的統一翻譯層。本輪新增 exact map 與 regression test 即可閉環。
3. **邊界輪**：`和好方案不存在`、`修復旅程不存在` 已由前一輪覆蓋，不重複新增；`assertPlanSelected` 的動態參數其實是固定中文字串，必須納入測試，避免掃描盲區。
4. **UI/UX 輪**：英文錯誤需短句、可操作、與 App/Web repair journey 語境一致；不引入過長文案造成 toast / alert 溢出。
5. **維護性輪**：集中在 `backend/src/i18n/index.ts` exact map 和 `backend-i18n.test.ts`，不新增端側 workaround；後續若新增 execution-owned backend message，需同步測試與治理基線。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，21 tests。
- 靜態比對 `backend/src/services/execution.service.ts` 的 backend-owned 中文 message 是否已被 backend i18n map 覆蓋，包含 `assertPlanSelected(..., errorMsg)` 傳入字串：通過。
- `npm --prefix backend run build`：通過。
- `npm run docs:check`：通過。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 execution permission、plan selection precondition 與 replan state validation 的 en-US exact map。
2. `backend/tests/unit/utils/backend-i18n.test.ts` 已新增 execution service regression，覆蓋直接 throw 與 `assertPlanSelected` 間接 message。
3. Web/App/shared client 不新增端側中文錯誤翻譯表，仍統一消費 backend locale layer。
4. 未改 execution / repair track state machine、AI replan、通知、repair journey context 或 API 欄位和值。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
