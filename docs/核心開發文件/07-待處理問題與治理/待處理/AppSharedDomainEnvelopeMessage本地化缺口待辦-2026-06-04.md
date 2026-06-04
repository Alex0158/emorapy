# App Shared Domain Envelope Message 本地化缺口待辦（2026-06-04）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App M1-M5 shared domain client `success:false` envelope normalization、RequestErrorLike visible message、App API code fallback
**取證代碼入口**：`packages/api-client/src/m1.ts`、`packages/api-client/src/m2.ts`、`packages/api-client/src/m3.ts`、`packages/api-client/src/m4.ts`、`packages/api-client/src/m5.ts`、`mobile/src/platform/api/client.ts`、`mobile/src/platform/api/errorMessages.ts`、`mobile/src/features`
**最後核驗 Commit**：`e5df67f`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查第五十五輪確認，shared `@cj/api-client` 的 M1-M5 domain client 對 HTTP 200 但 body `success:false` 的 envelope 仍會把 response body message 放入 `RequestErrorLike.message`：

- `packages/api-client/src/apiResponse.ts` 的 `readApiResponseError()` 會讀取 `body.error.message || body.message`。
- `packages/api-client/src/m1.ts`、`m2.ts`、`m3.ts`、`m4.ts`、`m5.ts` 的 `unwrapResponse()` 在 `success:false` 時使用 `bodyError.message ?? fallbackMessage`。
- App M1-M5 screen 會經 `normalizeM*Error(error).message` 顯示錯誤；`appApiClient.normalizeError()` 目前對非 invalid-response 的 `RequestErrorLike` 直接返回原 message。

因此只要 backend、mock-backed service、proxy 或 adapter 以 `success:false` body 回傳固定繁中、英文 diagnostic 或 provider message，App 仍可能在使用者選擇另一語言時直出該 body message。

## 影響範圍

- App：受影響。M1 quick/auth、M2 profile/interview、M3 chat、M4 case/repair、M5 notifications/upload 的 shared domain client path 都會經過 `RequestErrorLike`。
- Shared：只作來源追蹤，不直接要求改 shared package；shared package 本身沒有 locale context。
- Web：主站 request interceptor 已在 `success:false` response 層改用 `t('common.requestFail')` / code fallback，本輪不直接改 Web。
- Admin：Admin request interceptor 已在 `success:false` response 層改用 Admin locale fallback，本輪不直接改 Admin。
- Backend：不直接改；backend response message 是否本地化另由 backend-owned 待辦追蹤。

## 目前語言處理缺口

1. App platform 對 `RequestErrorLike` 過度信任 `.message`。
2. shared domain client 的 `success:false` path 可繞過 App axios HTTP error interceptor 的 status fallback。
3. App 已有 `appApi.error.*` status catalog，但缺 code-level mapping 給 `AUTH_REQUIRED`、`VALIDATION_ERROR`、`*_NOT_FOUND`、`RATE_LIMIT_EXCEEDED`、`SERVER_ERROR` 等 domain code。

## 目標行為

1. App 可見 error message 不再直接採用 shared domain client 或 response body 的 raw `.message`。
2. App platform 對 `RequestErrorLike.code` 建立集中 code-to-catalog fallback，並保留 `code` / `details`。
3. 已知 code 類別使用合適 App catalog：auth、forbidden、not found、validation、rate limit、conflict、server、invalid response。
4. 未知 `RequestErrorLike.code` 使用 App locale unknown fallback，不外露 raw message。
5. 不改 shared package 的 platform-agnostic parsing，不破壞 Web/Admin 現有 interceptor。

## 深入分析與方案

### 目標改動點

- `mobile/src/platform/api/errorMessages.ts`：新增 request code 到 App catalog 的集中映射 helper。
- `mobile/src/platform/api/client.ts`：`isRequestErrorLike(error)` 分支除 shared invalid-response diagnostic 外，改用 code mapping / unknown fallback，不直接返回原 `message`。
- `mobile/src/platform/api/client.test.js`：補 `VALIDATION_ERROR` / domain `*_NOT_FOUND` / unknown code 的 raw body message 不外露測試，覆蓋 zh-TW / en-US。

### 替代方案

- 修改 `packages/api-client` 丟棄 `bodyError.message`：暫不採用。shared package 沒有 locale context，改成英文 fallback 會讓 Web/Admin/App 都要另行補 platform mapping，且影響範圍較大。
- 在每個 `normalizeM*Error()` 逐一 mapping：不採用。M1-M5 會重複同一 code mapping，後續新增 domain 仍容易漏。
- 信任 backend message 已按 `X-Locale`：不採用作唯一方案。`success:false` 可由 mock/proxy/adapter 產生，且全局語言治理要求 UI 不能依賴 raw body message。

### 邊界與注意事項

- 保留 `RequestErrorLike.code` 與 `details`，方便 UI 分支、telemetry 或 logger 使用。
- 不翻譯 AI 正常生成內容。
- 不改 HTTP status fallback、network fallback、invalid response fixed diagnostic、stream disconnected fixed diagnostic。
- 若未來需要 domain-specific 精準文案，應新增 App catalog key 與 code mapping，不回退到 body message。

## 驗證方式

1. `npm --prefix mobile test -- src/platform/api/client.test.js src/i18n/index.test.js`
2. `npm --prefix mobile test -- __tests__/m1-screens.test.js __tests__/m2-screens.test.js __tests__/m3-screens.test.js __tests__/m4-screens.test.js __tests__/m5-notifications.test.js`
3. `npm --prefix mobile run typecheck`
4. 靜態搜尋確認 App platform `RequestErrorLike` 分支不再直接返回原 `.message`。
5. `npm run docs:check`

## Owner / Status Notes

- Owner：agent
- Status：待修復。本待辦已完成登記，下一步進入 App platform code fallback 修復。
