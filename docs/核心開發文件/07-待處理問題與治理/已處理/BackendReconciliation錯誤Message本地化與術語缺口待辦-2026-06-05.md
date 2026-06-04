# Backend Reconciliation 錯誤 Message 本地化與術語缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend reconciliation plan / repair journey API 錯誤訊息、Web Repair Journey error 顯示、App Repair Journey error 顯示、backend i18n message map
**取證代碼入口**：`backend/src/services/reconciliation.service.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend/src/pages/Reconciliation`、`frontend/src/pages/Execution`、`mobile/app/(app)/repair`
**最後核驗 Commit**：`f1fb8b2`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/services/reconciliation.service.ts` 的 reconciliation plan、partner invite、repair journey start / resume flow 仍有多個 backend-owned 中文錯誤 message 未被 `translateBackendMessage()` 覆蓋，例如：

- `無效的和好方案格式`
- `修復旅程不存在`
- `和好方案不存在`
- `無權限操作此方案`
- `判決不存在`
- `無權限生成和好方案`
- `此判決路由不允許生成一般共同修復方案，請改用安全支持或低壓退出方向`
- `此判決路由只允許 solo 修復，不允許邀請伴侶加入修復旅程`
- `無權限查看此判決的和好方案`
- `請先承諾此方案，再開始今天的第一步`

這些錯誤會經 `errorHandler` / `responseFormatter` 進入 API error payload；Web / App repair journey flow 會把 backend error message 顯示給使用者。當 request locale 為 `en-US` 時，目前未覆蓋的 reconciliation service fallback message 仍可能直出中文。同時，部分繁中 source message 仍沿用舊對外術語「判決」，即使 `zh-TW` locale 也會顯示不符合現行術語治理的文案。

## 影響範圍

- Backend：reconciliation plan generation / list / action、repair journey invite / start / resume API error payload。
- Web：Reconciliation / Execution / Repair Journey flow 顯示 backend error。
- App：Repair Journey screen 顯示 backend error。
- Shared/API client：沿用 backend `error.message`，不應在端側另建中文 message 翻譯表。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋部分 repair journey success message 與 context 文案，但 reconciliation service 自有 plan format、permission、repair route、commitment precondition 與 repair journey fallback error message 未全量覆蓋。繁中 canonical message 也仍有「判決不存在 / 此判決路由 / 此判決的和好方案」等舊詞。

## 目標行為

1. `zh-TW` locale 下，user-facing error 使用現行術語「梳理結果」，不再顯示「判決不存在 / 此判決路由 / 此判決的和好方案」。
2. `en-US` locale 下，reconciliation service error message 必須翻譯為英文，且使用 `Analysis` 對應梳理結果。
3. `solo` 等 repair route / mode 技術值不被本地化。
4. 修復集中在 backend i18n / canonical message 層，Web/App/shared client 不新增 ad hoc 中文 message 對照表。

## 修復結果

1. `backend/src/services/reconciliation.service.ts` 已將 reconciliation / repair journey user-facing error 的繁中 canonical message 收斂為「梳理結果」術語。
2. `backend/src/i18n/index.ts` 已補齊 reconciliation plan、repair journey、partner invite、plan start / resume fallback error 的 en-US exact map。
3. `solo` 等 repair route / mode 技術值保留，不改 repair eligibility、安全路由、partner invite 或通知流程。
4. Web/App/shared client 不新增端側中文錯誤翻譯表，仍統一消費 backend locale layer。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，20 tests。
- `npm --prefix backend run build`：通過。
- `rg -n "判決不存在|此判決路由|此判決的和好方案" backend/src/services/reconciliation.service.ts`：無殘留。
- 靜態比對 `backend/src/services/reconciliation.service.ts` 的 backend-owned 中文 message 是否已被 backend i18n map 覆蓋：通過。
- `npm run docs:check`：通過。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
