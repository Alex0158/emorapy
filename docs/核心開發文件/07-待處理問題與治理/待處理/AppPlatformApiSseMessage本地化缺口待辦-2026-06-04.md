# App platform API/SSE message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App platform API client error normalization、App SSE open error normalization、M1-M5 App feature API/SSE shared entry
**取證代碼入口**：`mobile/src/platform/api/client.ts`、`mobile/src/platform/sse/client.ts`、`mobile/src/platform/api/errorMessages.ts`、`mobile/src/features`
**最後核驗 Commit**：`40654eb`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查下一輪確認，App platform 共用 API / SSE 入口仍會在 response body 有 `message` 時直接把它轉成可見 `RequestErrorLike.message`：

- `mobile/src/platform/api/client.ts` 的 Axios error normalization 使用 `bodyError.message ?? getLocalizedStatusMessage(...)`。
- `mobile/src/platform/sse/client.ts` 的 SSE open error normalization 使用 `bodyError.message ?? getLocalizedStatusMessage(...)`。
- M1 / M2 / M3 / M4 / M5 feature API 均透過 `appApiClient.normalizeError()` 或 `connectAppSSE()` 承接這些 message。

這會讓 App 在切換語言後，仍可能因後端固定繁中 message、shared adapter message 或 raw diagnostic 覆蓋 App locale fallback，導致錯誤狀態不按所選語言顯示。

## 影響範圍

- App M1 quick result / judgment API 與 SSE open failure。
- App M2 profile / interview API。
- App M3 chat API 與 SSE open failure。
- App M4 repair API。
- App M5 notification / telemetry 等使用 `appApiClient` 的 API。
- 不影響 AI stream event payload；backend stream payload 已由對應 helper 治理。

## 目標行為與方案

1. App Axios response error normalization 不再默認使用 response body `message` 作可見 message；改用 status fallback 或 network fallback。
2. App SSE open error normalization 不再默認使用 response body `message`；改用 status fallback。
3. 保留 `code` / `details`，讓 feature screen 仍可做業務分支。
4. shared client fixed invalid-response diagnostic 仍保留既有 normalization，避免顯示 `Invalid ... from server`。
5. 若未來要顯示後端受控 message，必須建立顯式白名單；本輪不把所有 body message 視為可信 UI 文案。

## 邊界與注意事項

- 不改 backend formatter、App `X-Locale` header 或 feature API shape。
- 不處理 runtime `Error.message` 分支（例如 `APP_ERROR` 或 hook 內 `Error.message`），該類應後續單獨登記。
- 不改 stream event reducer；本輪只處理 HTTP/SSE open response body message。

## 驗證方式

- `npm --prefix mobile run test -- src/platform/api/client.test.js src/platform/sse/client.test.js --runInBand`：通過 2 suites / 10 tests。
- `npm --prefix mobile run typecheck`：通過。
- `npm run docs:check`：通過。
- 靜態復查已確認 `mobile/src/platform/api/client.ts` 與 `mobile/src/platform/sse/client.ts` 不再用 `bodyError.message` 作可見 fallback。

## 修復結果

1. `mobile/src/platform/api/client.ts` 的 Axios response error normalization 已改用 status / network locale fallback 作可見 `message`，不再直接承接 response body `message`。
2. `mobile/src/platform/sse/client.ts` 的 SSE open error normalization 已改用 status locale fallback，保留 `code` / `details`。
3. `mobile/src/platform/api/client.test.js` 已覆蓋 Axios envelope error 保留 code/details 但使用本地化 fallback，以及 en-US 下固定繁中 `服務器錯誤` 不外露。
4. `mobile/src/platform/sse/client.test.js` 已覆蓋 SSE open failure 保留 code 但使用本地化 fallback，以及 en-US 下固定繁中 `服務器錯誤` 不外露。

## Owner / Status Notes

- Owner：agent
- Status：已修復，已提交。
