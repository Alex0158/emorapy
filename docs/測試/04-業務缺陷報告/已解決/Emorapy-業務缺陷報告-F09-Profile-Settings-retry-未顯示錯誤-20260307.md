# Emorapy 業務缺陷報告 - F09 Profile Settings retry 失敗未向用戶顯示錯誤

日期：2026-03-07  
缺陷編號：`F09-BUG-001`  
狀態：`已修復`  
嚴重度：`中`

## 1. 缺陷摘要

Profile Settings 頁面在 getProfile 初次載入失敗、用戶點擊 retry 再次失敗時，未向用戶顯示該次 retry 失敗的錯誤訊息，僅維持錯誤 Alert 狀態，用戶無法得知 retry 為何失敗。

## 2. 業務影響

1. 用戶點擊 retry 後若仍失敗，無任何 toast 反饋，體驗與初次失敗不一致
2. 違反 F09 重試錯誤反饋約定：retry 失敗應與初次失敗同樣顯示對應錯誤訊息
3. 影響頁面：Profile Settings

## 3. 觸發條件

1. getProfile 初次載入失敗
2. 用戶看到 Alert + retry 按鈕，點擊 retry
3. getProfile 再次失敗（不論有無 message）

## 4. 預期行為

retry 失敗時應呼叫 `message.error(getErrorMessage(error, 'message.getProfileFail'))`，讓用戶看到該次失敗的錯誤訊息（與初次失敗一致的處理邏輯）。

## 5. 實際行為

`handleRetry` 的 `.catch` 僅執行 `setLoadError(true)`，未呼叫 `message.error`，用戶僅看到相同 Alert 且無 toast 反饋。

## 6. 根因

`handleRetry` 的 catch 區塊遺漏錯誤展示邏輯，與 useEffect 內初次失敗的處理（`message.error(getErrorMessage(...))`）不一致。

## 7. 修復方案

已完成：

- **Profile Settings** `handleRetry` `.catch`：改為 `message.error(getErrorMessage(error, 'message.getProfileFail')); setLoadError(true);`，與初次失敗一致

## 8. 修復後驗證

- `npm run test -- --run src/pages/Profile/Settings/index.test.tsx` 全數通過
- 新增測試：
  - `getProfile 失敗時 retry 再次失敗應顯示該次錯誤訊息（F09 重試錯誤反饋）`
  - `getProfile 失敗時 retry 再次失敗且 message 為空字串應使用 getProfileFail（F10 邊界）`

## 9. 備註

本缺陷由新增定向測試觸發。修復屬 F09 重試錯誤反饋與 F10 邊界一致性優化。
