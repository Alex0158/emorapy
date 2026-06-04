# Backend Interview AI 空回覆錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend interview AI empty response fallback error、Web/App interview stream visible error、backend i18n message map
**取證代碼入口**：`backend/src/services/interview-ai-response-consumer.ts`、`backend/src/services/interview-stream-payload-utils.ts`、`backend/src/services/interview.service.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/locale.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend/src/pages/Interview/Chat/index.tsx`、`mobile/app/(app)/profile/interview.tsx`、`packages/api-client/src/m2.ts`
**最後核驗 Commit**：`0093b86`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/services/interview-ai-response-consumer.ts` 的 interview AI stream empty content guard 仍有 backend-owned 中文錯誤 message 未被 `translateBackendMessage()` exact map 覆蓋：

- `AI 返回空內容`

`backend/src/i18n/index.ts` 已覆蓋無空格版 `AI返回空內容`，但現碼實際拋出的是含空格版。當該 message 作為 fallback 診斷進入 stream failure payload 或 API response translation path 時，`en-US` locale 仍可能漏翻。

## 影響範圍

- Backend：interview AI response stream consumer、interview stream failure payload。
- Web：Interview chat AI stream failure display。
- App：Interview screen / shared API client stream failure display。
- Shared/API client：只傳遞 backend message，不應端側新增中文錯誤對照。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋 AI service fallback、`AI返回空內容`、interview stream failed payload 的 locale-aware helper，但未覆蓋現碼實際使用的 `AI 返回空內容` exact message。

## 目標行為

1. `en-US` locale 下，interview AI empty content fallback message 必須由 backend locale layer 輸出英文。
2. `zh-TW` locale 下，原繁中 canonical message 保持不變。
3. 不改 OpenAI stream request、AI ledger、parse state、stream delta、failure payload generic fallback 或 Web/App interview retry UX。
4. Web/App/shared client 不新增端側中文錯誤翻譯表。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`
- Focused static coverage scan：比對 `backend/src/services/interview-ai-response-consumer.ts` 中文 empty response error 是否被 backend i18n exact map 覆蓋。
- `npm --prefix backend run build`
- `npm run docs:check`

## 分析與方案

1. **業務邏輯輪**：`AI 返回空內容` 表示 OpenAI streaming 完成後 `fullContent` 為空；修復不應改變空回覆判定、stream delta、parse state 或 retry 行為。
2. **i18n 資料流輪**：interview stream failure payload 會按 locale 嘗試翻譯 code / message；現有無空格版 `AI返回空內容` 已覆蓋，但現碼含空格版未覆蓋，因此補 exact map。
3. **Web/App 邊界輪**：Web/App interview UI 應只消費 backend stream failure payload，不應端側新增中文錯誤對照。
4. **UI/UX 輪**：英文文案維持與 AI service fallback 一致，避免在訪談流程中出現不同語氣或暴露 provider 診斷。
5. **維護性輪**：同時保留含空格與無空格兩個現存變體的 regression，避免未來 source message 微差再次漏翻。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 `AI 返回空內容` exact map，與既有 `AI返回空內容` 輸出同一英文。
2. `backend/tests/unit/utils/backend-i18n.test.ts` 已新增含空格變體 regression。
3. 未改 OpenAI stream request、AI ledger、parse state、stream delta、failure payload generic fallback 或 Web/App interview retry UX。
4. `zh-TW` canonical message 保持原文；`en-US` 由 backend locale layer 輸出 `AI returned empty content`。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
