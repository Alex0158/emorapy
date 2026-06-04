# Web errorHandler raw message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web legacy errorHandler API error toast normalization
**取證代碼入口**：`frontend/src/utils/errorHandler.ts`、`frontend/src/utils/errorHandler.test.ts`
**最後核驗 Commit**：`3d72635`
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
- Status：已登記，待實作 / verification / commit / push。

## 2026-06-04 本輪結果

待回填。
