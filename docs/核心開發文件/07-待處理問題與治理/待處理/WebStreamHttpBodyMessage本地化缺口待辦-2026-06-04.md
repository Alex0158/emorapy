# Web stream HTTP body message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web AI stream / SSE request / Chat stream HTTP open error normalization
**取證代碼入口**：`frontend/src/services/aiStream.ts`、`frontend/src/services/sseRequest.ts`、`frontend/src/services/api/chatApiUtils.ts`、`frontend/src/services/aiStream.test.ts`、`frontend/src/services/sseRequest.test.ts`、`frontend/src/services/api/chatApiUtils.test.ts`
**最後核驗 Commit**：`4f79a2f`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查第四十六輪確認 Web stream HTTP open error 仍有三條 helper 會把 response body 的 `error.message` 直接作為可見錯誤：

1. `frontend/src/services/aiStream.ts` 的 non-OK `fetch` response 先取 `getStreamHttpFallbackMessage(status)`，但若 body 有 `error.message` 會覆蓋 fallback。
2. `frontend/src/services/sseRequest.ts` 的 non-OK response 會用 `err?.error?.message || getStreamHttpFallbackMessage(status)` 建立 `SSEError`。
3. `frontend/src/services/api/chatApiUtils.ts` 的 `readChatStreamHttpError()` 同樣會用 body `error.message` 覆蓋 HTTP status fallback。

若後端、adapter 或 proxy 回傳固定繁中 message / raw diagnostic，Web 會在 `en-US` 或其他使用者選定語言下直出該 body message，蓋過已存在的 `stream.error.httpStatus` locale fallback。

## 目標改動點與方案

1. 三條 Web stream HTTP open error helper 的可見 `message` 統一使用 `getStreamHttpFallbackMessage(response.status)`。
2. response body 的 `error.code` 仍保留，供上層做業務分支與診斷；`status` 仍保留。
3. response body 的 `error.message` 不再作 UI fallback；未來若有可展示的 backend-owned message，必須另建顯式白名單或 catalog key 映射。
4. 不改 SSE event payload 的 `event.error.message`、stream event schema、retry/abort/read loop、Chat room action helper 或全局 `getErrorMessage()`。

## 影響範圍與邊界

- Web：QuickExperience result stream、Chat stream、通用 `sseRequest()` consumer 的 HTTP open failure message。
- Backend / App / Admin：本輪不改；App platform API/SSE body message 已在前序輪次治理。
- 業務邏輯：HTTP status fallback 保持原來 status number；後端 code 不被吞掉。
- UX：使用者看到的是當前 `cj_locale` 對應語言的通用串流請求失敗文案，不再混入另一語言或診斷字串。

## 驗證方式

- `npm --prefix frontend test -- src/services/aiStream.test.ts src/services/sseRequest.test.ts src/services/api/chatApiUtils.test.ts src/assets/i18n/catalogParity.test.ts`
- `npm --prefix frontend run build`
- `npm run docs:check`
- 靜態搜尋確認 production helper 不再用 `body?.error?.message` / `err?.error?.message` 覆蓋可見 fallback。

## Owner / Status Notes

- Owner：agent
- Status：已登記並完成本輪修復，待 verification / commit / push。

## 2026-06-04 本輪結果

待回填。
