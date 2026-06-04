# Backend AI Service 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend AI service provider/fallback error、Judgment / Reconciliation / Chat AI visible error、Web/App API 與 stream error display、backend i18n message map
**取證代碼入口**：`backend/src/services/ai.service.ts`、`backend/src/services/judgment.service.ts`、`backend/src/services/reconciliation.service.ts`、`backend/src/services/execution.service.ts`、`backend/src/routes/chat.routes.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend/src/pages/Case`、`frontend/src/pages/Reconciliation`、`frontend/src/pages/Chat`、`mobile/app/(app)/case`、`mobile/app/(app)/repair`
**最後核驗 Commit**：`e2b968c`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/services/ai.service.ts` 的 AI provider 呼叫、stream 呼叫、每日配額與 AI JSON parse fallback 仍有 backend-owned 中文錯誤 message 未被 `translateBackendMessage()` 覆蓋：

- `AI返回空內容`
- `AI服務認證失敗`
- `AI服務暫時不可用`
- `今日AI服務調用已達上限`
- `無法解析AI響應`
- `AI響應格式無效（非陣列）`
- `無法解析 AI 重調結果`

這些錯誤可能經 judgment generation、reconciliation plan generation、repair replan、chat AI 或 stream failure 邊界進入 API error payload / stream error payload。Web `getErrorMessage()` 與 App `normalizeM4Error(...).message` 會顯示 backend message；當 request locale 為 `en-US` 時，未覆蓋 source message 仍可能直出繁中。

## 影響範圍

- Backend：AI text / stream provider fallback、AI daily quota、reconciliation plan parse、repair replan parse。
- Web：Case review / quick result / reconciliation list / execution replan / chat room visible error。
- App：Case analysis generation、repair plan generation / replan visible error。
- Shared/API client：只傳遞 backend message，不應新增端側中文 message 對照表。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已有 `AI服務暫時不可用，請稍後重試` 等相近文案，但 `ai.service.ts` 實際丟出的短文案未全部覆蓋。這會造成部分 AI failure path 按 locale 翻譯，部分 path 在 en-US 下保留繁中。

## 目標行為

1. `en-US` locale 下，AI service 自有錯誤 message 必須經 backend locale layer 輸出英文。
2. `zh-TW` locale 下，原繁中 canonical message 保持不變，不改 AI retry、quota、ledger、stream 或 fallback 生成邏輯。
3. `AI`、model、provider、JSON 欄位與 enum 值不被本地化。
4. Web/App/shared client 不新增端側中文錯誤翻譯表，仍統一消費 backend locale layer。

## 分析與方案

1. **業務邏輯輪**：`generateText()` / `generateTextStream()` 負責 provider call、retry、ledger complete/fail、quota rollback；`reserveDailyQuota()` 控制 daily quota；reconciliation / repair replan parse 錯誤反映 AI output contract failure。本輪只補 message map，不改 retry、quota、ledger 或 parse 行為。
2. **i18n 資料流輪**：AI service 丟出的 `Errors.AI_SERVICE_ERROR()` 會被 backend `errorHandler` / `responseFormatter` 依 request locale 翻譯；stream failure payload 已有 locale-aware helper，但 direct service error 仍依 exact message map。
3. **邊界輪**：`AI服務請求過於頻繁，請稍後再試` 與 `AI服務暫時不可用，請稍後重試` 屬相近但不同 source message，不能假設已覆蓋；本輪只補 `ai.service.ts` 實際 source message。
4. **UI/UX 輪**：英文錯誤需短句、明確、適合 toast / alert / stream error，不暴露 provider 內部細節或 OpenAI 原始錯誤。
5. **維護性輪**：集中在 `backend/src/i18n/index.ts` exact map 與 `backend-i18n.test.ts` regression；另外用靜態比對掃 `ai.service.ts` 的中文 `Errors.AI_SERVICE_ERROR()`，避免後續新增 AI error message 漏 map。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，22 tests。
- 靜態比對 `backend/src/services/ai.service.ts` 的 backend-owned 中文 AI service error message 是否已被 backend i18n map 覆蓋：通過。
- `npm --prefix backend run build`：通過。
- `npm run docs:check`：通過。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 AI empty response、auth failure、temporary unavailable、daily quota、AI response parse 與 repair replan parse failure 的 en-US exact map。
2. `backend/tests/unit/utils/backend-i18n.test.ts` 已新增 AI service fallback regression，固定 en-US 翻譯與 zh-TW 原文保持。
3. 未改 AI retry、quota、ledger、stream、provider call、JSON parse 或 fallback content generation 行為。
4. Web/App/shared client 不新增端側中文錯誤翻譯表，仍統一消費 backend locale layer。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
