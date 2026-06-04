# Web request global toast message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web 前台全局 request interceptor HTTP error toast、session refresh toast、request reject payload
**取證代碼入口**：`frontend/src/services/request.ts`、`frontend/src/services/request.test.ts`、`frontend/src/services/requestPolicy.ts`、`frontend/src/assets/i18n`
**最後核驗 Commit**：`0e487cd`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查下一輪確認，`frontend/src/services/request.ts` 的 response error interceptor 雖已帶 `X-Locale` 並有 `getHttpErrorFallbackMessage()`，但 HTTP toast 仍大量優先使用 `errorData?.message`：

- 400 / 401 session refresh toast 使用 `errorData?.message || t(...)`。
- 401 / 403 / 404 / 409 / 422 / 413 / 429 / 503 / 500 全局 toast 仍使用 `errorData?.message || t(...)`。
- reject payload `message` 仍是 `errorData?.message || fallbackMessage`，頁面或 store 若再讀該 message，仍可能顯示後端固定中文或 raw diagnostic。

這會讓 Web 前台在 en-US 或其他非 zh-TW 語系下，因後端歷史固定繁中 message、shared adapter message 或 runtime diagnostic 覆蓋 locale catalog fallback，導致全局 toast 不按目前 Web 所選語言顯示。

## 影響範圍

- Web 前台所有使用 `frontend/src/services/request.ts` 的 API 呼叫。
- 直接影響全局 HTTP error toast，以及 catch 分支收到的 reject payload `message`。
- 不影響 Admin Web request service；Admin unknown branch 已在前輪治理。
- 不影響 Chat SSE / AI stream event payload；stream payload 已由對應 stream helper 治理。

## 目標行為與方案

1. HTTP response 分支的全局 toast 不再直接使用一般 `errorData.message`；改用 status / code / request context 對應的 locale catalog fallback。
2. session refresh / expired 類 toast 保留現有刷新與 suppress 邏輯，但可見文案使用 `common.sessionExpiredRefreshed` / `error.session.expiredHint` catalog。
3. reject payload `message` 預設使用 locale fallback，避免頁面或 store 再次外露 raw backend/runtime message。
4. 若存在明確需要顯示後端受控 message 的 code，必須顯式白名單化；本輪不把所有 backend message 當作可信 UI 文案。
5. 測試需覆蓋 en-US 下後端回固定繁中 message 時，toast 與 reject payload 均回到 locale fallback。

## 邊界與注意事項

- 不改 backend response formatter 與 `X-Locale` 傳遞；本輪只治理 Web global request 可見 fallback。
- 不吞掉 `code` / `details`；頁面仍可用 code 做業務分支。
- 不全局修改 `getErrorMessage()`；本輪只收斂全局 request interceptor。
- 對 validation details 的逐欄位錯誤呈現不在本輪範圍；若後續發現頁面直接顯示 details/message，另行登記。

## 驗證方式

- `npm --prefix frontend test -- src/services/request.test.ts src/assets/i18n/catalogParity.test.ts`：2026-06-05 復核通過 2 files / 64 tests。
- `npm --prefix frontend run build`：通過。
- `npm run docs:check`：通過。
- 靜態復查已確認 `frontend/src/services/request.ts` HTTP toast 與 reject payload 一般分支不再直接使用 `errorData?.message` 作可見 fallback。

## 修復結果

1. `frontend/src/services/request.ts` 的 `success=false` reject payload 已改為 `common.requestFail` catalog fallback，不再把 response body `error.message` 作使用者可見 fallback。
2. 400 / 401 / 403 / 404 / 409 / 422 / 413 / 429 / 503 / 500 HTTP error toast 已改用 `getHttpErrorFallbackMessage()` 的 status / code / request context fallback；session refresh / expired 類仍保留 refresh 與 suppress 邏輯，但可見文案固定使用 `common.sessionExpiredRefreshed` / `error.session.expiredHint`。
3. HTTP reject payload `message` 已改為 locale fallback，保留 `code` / `details` 給頁面或 store 做業務分支。
4. `frontend/src/services/request.test.ts` 已補 raw backend message 不外露覆蓋：`success=false`、400 validation、400 session refresh、401 unauthorized、500 server error 均不再外露固定繁中 / raw message。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
