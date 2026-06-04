# Backend AI Stream ScopeType 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend AI stream route validation fallback error、Web/App AI streaming visible error、backend i18n message map
**取證代碼入口**：`backend/src/routes/ai-stream.routes.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/locale.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend/src`、`mobile/app`、`packages/api-client/src`
**最後核驗 Commit**：`84f00f7`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/routes/ai-stream.routes.ts` 的 SSE route 對不支援的 `scopeType` 仍有 backend-owned 中文錯誤 message 未被 `translateBackendMessage()` 覆蓋：

- `未知的 AI stream scopeType`

當 Web/App 或 shared API client 連接 AI stream 時，如果 route param 帶入不支援的 scope type，該 AppError 會經 backend error response 回到端側。當 request locale 為 `en-US` 時，未覆蓋 message 仍可能直出繁中。

## 影響範圍

- Backend：AI stream SSE route validation。
- Web：訪談、聊天室、梳理結果、修復旅程等 AI streaming UI 的錯誤呈現。
- App：AI streaming adapter / API client 的錯誤呈現。
- Shared/API client：只傳遞 backend message，不應端側新增中文錯誤對照。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋 `AI Stream 不存在`、AI service timeout / unavailable 等 message，但 route-level invalid `scopeType` fallback 尚未覆蓋。

## 目標行為

1. `en-US` locale 下，不支援的 AI stream `scopeType` validation error 必須由 backend locale layer 輸出英文。
2. `zh-TW` locale 下，原繁中 canonical message 保持不變。
3. 不改 AI stream scope type 白名單、access control、SSE replay/heartbeat、Web/App streaming flow 或 shared API client。
4. Web/App/shared client 不新增端側中文錯誤翻譯表。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`
- Focused static coverage scan：比對 `backend/src/routes/ai-stream.routes.ts` 中文 route fallback error 是否被 backend i18n exact map 覆蓋。
- `npm --prefix backend run build`
- `npm run docs:check`

## 分析與方案

1. **業務邏輯輪**：`未知的 AI stream scopeType` 只在 SSE route param 不屬於既有 AI stream scope type 白名單時出現；修復不應更改 `interview_session`、`chat_room`、`case_judgment`、`judgment_detail`、`repair_track`、`generic_ai_task` 的白名單或 access control。
2. **i18n 資料流輪**：request 先經 `localeMiddleware` 讀 `X-Locale` / `Accept-Language`，AppError 經 `errorHandler` 的 `translateErrorByCode()` fallback 進入 `translateBackendMessage()`，因此應集中補 backend exact map。
3. **Web/App 邊界輪**：Web/App/shared API client 只接收 backend message，不應各自新增中文錯誤對照或自行猜測 invalid scope type 文案。
4. **UI/UX 輪**：英文錯誤需短句，可直接用於 toast、stream connection failure 或 API error fallback，不暴露內部 stream registry 細節。
5. **維護性輪**：新增 backend i18n regression 與 focused route message coverage scan，避免後續新增 AI stream route fallback message 時漏翻。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 `未知的 AI stream scopeType` exact map。
2. `backend/tests/unit/utils/backend-i18n.test.ts` 已新增 AI Stream route fallback message regression。
3. 未改 AI stream scope type 白名單、SSE replay/heartbeat、scope access control、Web/App streaming flow 或 shared API client。
4. `zh-TW` canonical message 保持原文；`en-US` 由 backend locale layer 輸出 `Unknown AI stream scopeType`。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
