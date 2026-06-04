# Backend Interview Session 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend interview session access / turn context error、Web/App interview visible error、backend i18n message map
**取證代碼入口**：`backend/src/services/interview-session-access.ts`、`backend/src/services/interview-turn-context.ts`、`backend/src/services/interview-end-session-persistence.ts`、`backend/src/services/interview-processing-retry.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend/src/store/interviewStore.ts`、`frontend/src/pages/Interview/Result/index.tsx`、`mobile/app/(app)/profile/interview.tsx`、`packages/api-client/src/m2.ts`
**最後核驗 Commit**：`0a57da5`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

Interview session access / turn context 相關服務仍有 Web/App 可見的中文錯誤 message 未被 `translateBackendMessage()` 覆蓋：

- `訪談不存在或無權限`
- `訪談缺少可回覆輪次`

這些錯誤會在訪談詳情載入、回覆、結束、失敗重試等流程中經 backend response message 傳回 Web/App。當 request locale 為 `en-US` 時，未覆蓋 message 仍可能直出繁中。

## 影響範圍

- Backend：interview session ownership check、respond turn context、end session persistence、failed processing retry。
- Web：Interview chat / result / profile resume retry flow。
- App：Profile interview screen respond / skip / end / retry flow。
- Shared API client：M2 interview client 傳遞 backend message，不應端側新增中文翻譯表。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋 interview runtime config、session completed、start rate limit 等 code-based message，但尚未覆蓋 session access not-found/permission 和 internal missing last-turn fallback。這些 message 是 backend-owned canonical message，應補 exact map。

## 目標行為

1. `en-US` locale 下，interview session access / turn context fallback error 必須由 backend locale layer 輸出英文。
2. `zh-TW` locale 下，原繁中 canonical message 保持不變。
3. 不改 session ownership 判斷、turn count、turn interval、end/retry 狀態轉換或 Web/App fallback key。
4. Web/App/shared client 不新增端側中文錯誤翻譯表。

## 分析與方案

1. **業務邏輯輪**：`訪談不存在或無權限` 是 ownership/not-found 合併訊息，避免洩露 session 是否存在；英文也應保持同一語義，不拆成純 not found。
2. **i18n 資料流輪**：interview route error 經 response formatter 按 request locale 翻譯，應集中補 backend exact map。
3. **邊界輪**：`訪談缺少可回覆輪次` 是 internal consistency fallback，英文應清楚但不暴露 DB 細節。
4. **UI/UX 輪**：英文錯誤需可直接用於 toast / error state，避免誤導用戶以為可以直接修復不存在的 session。
5. **維護性輪**：新增 backend i18n regression 與 focused static coverage scan。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，25 tests。
- Focused static coverage scan：比對 interview session / turn context 中文 error 是否被 backend i18n exact map 覆蓋：通過。
- `npm --prefix backend run build`：通過。
- `npm run docs:check`：待本輪文檔回寫後執行。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 `訪談不存在或無權限` 與 `訪談缺少可回覆輪次` exact map。
2. `backend/tests/unit/utils/backend-i18n.test.ts` 已新增 interview session fallback message regression。
3. `訪談不存在或無權限` 英文仍保留 not-found / no-access 合併語義，避免洩露 session 是否存在。
4. 未改 session ownership 判斷、turn count、turn interval、end/retry 狀態轉換、Web/App fallback key 或 shared M2 client。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
