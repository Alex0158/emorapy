# Web apiError raw message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web shared apiError visible message normalization、responseHandler toast fallback 與使用者語言顯示
**取證代碼入口**：`frontend/src/utils/apiError.ts`、`frontend/src/utils/apiError.test.ts`、`frontend/src/utils/responseHandler.ts`、`frontend/src/utils/responseHandler.test.ts`
**最後核驗 Commit**：`2067747`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查第四十七輪確認 `frontend/src/utils/apiError.ts` 的 shared `getErrorMessage()` 仍把任意 top-level `message`、nested `error.message` 與 `Error.message` 作為可見文案；`frontend/src/utils/apiError.test.ts` 亦明確期待 `direct message`、`錯誤`、`後端錯誤詳情` 直接返回。

由於大量 Web stores / pages / `responseHandler` 都透過 `getErrorMessage(error, fallbackKey)` 顯示 toast 或狀態錯誤，一旦任意 backend body message、adapter diagnostic 或 runtime `Error.message` 進入 shared helper，會蓋過當前 `cj_locale` 的 catalog fallback。

## 目標改動點與方案

1. `getErrorMessage()` 不再直接返回一般 raw `message` / `Error.message` / nested `error.message`。
2. 保留既有 `Invalid ... from server` fixed diagnostic normalization，繼續顯示 `apiError.invalidResponse`。
3. 對 top-level / nested `code` 建立受控 locale catalog 映射；已知 code 顯示對應語言，未知 code 回 caller fallback 或 `common.unknownError`。
4. `responseHandler.handleApiError()` 依賴 `getErrorMessage()` 的 toast 行為同步改為不外露 raw message。

## 影響範圍與邊界

- Web：所有使用 `frontend/src/utils/apiError.ts` 的 stores、pages、hooks 與 response handler。
- 不改：`frontend/src/utils/errorHandler.ts` 與 `frontend/src/utils/errorMessages.ts`；兩者是獨立舊 helper，若後續掃描確認 raw message 缺口，另行登記。
- UX：使用者看到 catalog fallback 或 code-specific locale message；不再看到另一語言固定字串或 runtime diagnostic。
- 工程邊界：不改 backend formatter、不改全局 request interceptor、不改 stream event payload。

## 驗證方式

- `npm --prefix frontend test -- src/utils/apiError.test.ts src/utils/responseHandler.test.ts src/assets/i18n/catalogParity.test.ts`
- `npm --prefix frontend run build`
- `npm run docs:check`
- 靜態搜尋確認 `apiError` 測試不再釘住一般 raw message 外露契約。

## Owner / Status Notes

- Owner：agent
- Status：已完成本輪修復。`frontend/src/utils/errorHandler.ts` 仍屬獨立舊 helper，後續若確認 raw message 外露需另行登記。

## 2026-06-04 本輪結果

1. `frontend/src/utils/apiError.ts` 已將一般 raw `message` / `Error.message` / nested `error.message` 改為不可直接展示；raw message 只用於識別 `Invalid ... from server` fixed diagnostic。
2. 已新增受控 code / HTTP status mapping，`FORBIDDEN`、`SERVER_ERROR`、`RATE_LIMIT`、`HTTP_403` 等會顯示目前 locale 的 catalog message；未知 code 回 caller fallback 或 `common.unknownError`。
3. `frontend/src/utils/responseHandler.test.ts` 已同步 `handleApiError()` 行為：普通 runtime/raw object message 不再 toast 外露；code 仍可顯示受控本地化映射。
4. `frontend/src/utils/apiError.test.ts` 已移除「direct message / Error.message / nested error.message 應直接顯示」舊契約，並覆蓋 raw message fallback、code mapping、invalid-response normalization。
5. 已驗證：`npm --prefix frontend test -- src/utils/apiError.test.ts src/utils/responseHandler.test.ts src/assets/i18n/catalogParity.test.ts` 通過 3 files / 45 tests；`npm --prefix frontend run build` 通過；`npm run docs:check` 通過；測試契約掃描確認 focused tests 不再保留普通 raw message 外露斷言。
