# Web request reject fallback 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web 前台 Axios response interceptor、HTTP fallback error payload、頁面/store error propagation
**取證代碼入口**：`frontend/src/services/request.ts`、`frontend/src/services/request.test.ts`、`frontend/src/utils/apiError.ts`
**最後核驗 Commit**：`d8412fb`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查下一輪確認，`frontend/src/services/request.ts` 的全局 response interceptor 在 toast 分支已使用 `t(...)` 本地化 fallback，但 reject 給頁面 / store 的 error object 仍在部分路徑保留 Axios / runtime 原始 `error.message`：

- HTTP response 有 status，但後端沒有提供 `error.message` 時，reject payload 使用 `error.message`，可能是 `Request failed with status code 500` 這類英文診斷。
- unknown error 分支 toast 顯示 `common.unknownError`，但 reject payload message 仍是 `error.message`，上層 `getErrorMessage()` 會優先顯示該 message。

這會造成頁面/store catch 後以 `getErrorMessage(error, fallbackKey)` 顯示時，仍可能不按使用者所選語言顯示。

## 影響範圍

- Web 前台所有使用 `frontend/src/services/request.ts` 的舊 Axios service / store。
- `frontend/src/utils/apiError.ts` 的上層消費者，因其會保留非空 `error.message`。
- Backend 已提供且已按 `X-Locale` 本地化的 message 不屬於本輪缺口。
- Admin request 使用 `frontend-admin/src/services/request.ts`，已有獨立 fallback tests；本輪不改 Admin。

## 目標行為與方案

1. 新增集中 helper，將 HTTP status / code / upload request 轉成目前 locale 的 fallback message。
2. response error reject payload 在 `errorData.message` 不存在時，使用同一套 localized fallback，而不是 Axios `error.message`。
3. unknown error 分支 reject payload 使用 `common.unknownError`，避免 raw runtime message 進入 UI。
4. 保留後端已提供 message 的優先級，因 Web request 已帶 `X-Locale`，後端 responseFormatter / errorHandler 會按 locale 翻譯。
5. 不改 toast 行為、不改 API response contract、不新增 page-level fallback map。

## 邊界與注意事項

- HTTP 429 仍需保留 upload request 的 `common.fileRateLimit` 差異。
- 400/401 的 session recovery side effect 不改；只處理 reject payload fallback。
- 非空後端 message 不能被覆蓋，避免丟失 domain-specific error。

## 驗證方式

- `npm --prefix frontend test -- src/services/request.test.ts src/utils/apiError.test.ts src/assets/i18n/catalogParity.test.ts`
- `npm --prefix frontend run build`
- `npm run docs:check`
- 靜態復查確認 `frontend/src/services/request.ts` reject fallback 不再使用 raw `error.message` 作可見 fallback。

## Owner / Status Notes

- Owner：agent
- Status：已完成本輪修復與驗證，待 commit/push。

## 2026-06-04 本輪結果

1. `frontend/src/services/request.ts` 已新增 `getHttpErrorFallbackMessage(status, code, config)`，集中把 HTTP status / session code / upload request 轉成本地化 fallback。
2. HTTP response error reject payload 已從 `errorData?.message || error.message` 改為 `errorData?.message || fallbackMessage`，避免無後端 message 時把 Axios 英文診斷傳給頁面/store。
3. unknown error 分支 reject payload 已從 raw `error.message` 改為 `common.unknownError`，toast 與頁面/store fallback 保持一致。
4. 保留後端非空 `errorData.message` 優先級；Web request 仍透過 `X-Locale` 讓後端回傳目前語言。
5. `frontend/src/services/request.test.ts` 已補 500、503、裸 500、unknown error 的 reject message 斷言，固定不再回傳 raw `server` / `unavailable` / `boom`。
6. 已驗證：`npm --prefix frontend test -- src/services/request.test.ts src/utils/apiError.test.ts src/assets/i18n/catalogParity.test.ts`、`npm --prefix frontend run build`、`npm run docs:check` 均通過。
7. 靜態復查確認 production `frontend/src/services/request.ts` 不再以 raw `error.message` 作 reject fallback；剩餘 `"boom"` 僅在測試 fixture 中作反例。
