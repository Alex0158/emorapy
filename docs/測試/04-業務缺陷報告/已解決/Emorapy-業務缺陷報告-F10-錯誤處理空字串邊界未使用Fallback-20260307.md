# Emorapy 業務缺陷報告 - F10 錯誤處理空字串邊界未使用 Fallback

日期：2026-03-07  
缺陷編號：`F10-BUG-001`  
狀態：`已修復`  
嚴重度：`中`

## 1. 缺陷摘要

部分頁面與共用工具在 API 錯誤的 `message` 為空字串或純空白時，未依 F10 約定使用 fallback 文案，可能對使用者顯示空白錯誤訊息。

## 2. 業務影響

1. 使用者看到空白 toast，無法理解失敗原因
2. 錯誤處理不一致，違反 F10「有 message 且非空顯示之；無或空則用 fallback」的約定
3. 影響頁面：Case Detail submitCase、errorHandler、responseHandler

## 3. 觸發條件

1. API 回傳 `{ code: 'X', message: '' }` 或 `{ message: '   ' }`
2. 使用 `err?.message || fallback` 或類似模式時，空字串會觸發 fallback，但純空白不會
3. `handleApiError` / `handleApiError`（responseHandler）直接使用 `error.message` 不檢查 trim

## 4. 預期行為

依 F10 約定：`message` 為空字串或 trim 後為空，應使用對應 fallback 文案，不顯示空白。

## 5. 實際行為

- Case Detail：`errorMessage = err?.message || t(...)` 在 message 為 `'   '` 時會顯示空白
- errorHandler：`if (typeof error.message === 'string') errorMessage = error.message` 未 trim
- responseHandler：`err?.message ?? err?.error?.message` 在 message 為 `''` 時會顯示空白（`??` 不處理 `''`）

## 6. 根因

錯誤處理未統一使用 `getErrorMessage`，或 `getErrorMessage` 未涵蓋巢狀 `error.message` 結構。

## 7. 修復方案

已完成：

1. **Case Detail** `handleSubmit`：改為 `getErrorMessage(error, 'message.submitCaseFail')`，簡化分支邏輯
2. **errorHandler** `handleApiError`：僅在 `rawMsg.trim().length > 0` 時使用 `error.message`
3. **responseHandler** `handleApiError`：改為 `getErrorMessage(error, 'common.unknownError')`
4. **apiError** `getErrorMessage`：新增對 `error.error?.message` 的支援，以涵蓋巢狀錯誤結構

## 8. 修復後驗證

- `npm run test -- --run src/pages src/utils/errorHandler src/utils/responseHandler src/utils/apiError` 全數通過
- 新增 Case Detail 測試：`submitCase 失敗且 message 為空字串時應使用 submitCaseFail（F10 邊界）`

## 9. 備註

本缺陷為程式審查發現，非由單一失敗測試觸發。修復屬 F10 錯誤處理一致性優化，有助於整體專案錯誤展示品質。
