# Web errorHandler raw message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web legacy errorHandler API error toast normalization
**取證代碼入口**：`frontend/src/utils/errorHandler.ts`、`frontend/src/utils/errorHandler.test.ts`
**最後核驗 Commit**：`8ffb343`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查第四十八輪確認 `frontend/src/utils/errorHandler.ts` 的 legacy `handleApiError()` 仍優先顯示 top-level `message` / `Error.message`；`frontend/src/utils/errorHandler.test.ts` 明確期待 `new Error('自定義錯誤')` 與 `{ message: 'API錯誤' }` 直接 toast。

目前掃描未發現 production code import 這個 helper，但它仍位於 `frontend/src/utils` 並保留舊契約；若後續頁面重新使用，會把 runtime diagnostic 或固定非當前語言 message 直接顯示給使用者。

## 目標改動點與方案

1. `handleApiError()` 不再優先顯示 raw `message`。
2. 保留既有 code-to-catalog mapping；有已知 `code` 時顯示本地化 catalog message。
3. 無已知 code 時顯示 `common.unknownError`。
4. 不改 `handleValidationError()`，因表單欄位驗證錯誤可能是 field-level 文案，需另輪確認資料來源後再定義策略。

## 影響範圍與邊界

- Web：legacy `frontend/src/utils/errorHandler.ts` 與其 tests。
- 不改：剛完成的 `apiError.getErrorMessage()`、`responseHandler.handleApiError()`、legacy `errorMessages.ts` 與表單 validation array 顯示。
- UX：避免 future consumer 直出 raw runtime/backend message；已知 code 仍有具體本地化提示。

## 驗證方式

- `npm --prefix frontend test -- src/utils/errorHandler.test.ts src/assets/i18n/catalogParity.test.ts`
- `npm --prefix frontend run build`
- `npm run docs:check`

## Owner / Status Notes

- Owner：agent
- Status：已完成本輪修復。`handleValidationError()` 未改，後續若確認 field-level validation array 來源未本地化，需另行登記。

## 2026-06-04 本輪結果

1. `frontend/src/utils/errorHandler.ts` 的 `handleApiError()` 已不再讀取 raw top-level `message` / `Error.message` 作 toast 文案。
2. 已知 `code` 仍沿用既有 code-to-catalog mapping，未知 code / 無 code 顯示 `common.unknownError`。
3. `frontend/src/utils/errorHandler.test.ts` 已把 `new Error('自定義錯誤')`、`{ message: 'API錯誤' }` 的舊直出契約改為本地化 fallback；code mapping 測試保留。
4. 已驗證：`npm --prefix frontend test -- src/utils/errorHandler.test.ts src/assets/i18n/catalogParity.test.ts` 通過 2 files / 15 tests；`npm --prefix frontend run build` 通過；`npm run docs:check` 通過；focused 掃描只剩測試 fixture 輸入值，無 raw message 期望。
