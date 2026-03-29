# Emorapy 業務缺陷報告 - F06 Interview Result getSession 失敗時誤顯完成且無 retry

日期：2026-03-07  
缺陷編號：`F06-BUG-003`  
狀態：`已修復`  
嚴重度：`中`

## 1. 缺陷摘要

心理訪談結果頁（Interview Result）當 `getSession` 失敗且 `currentSession` 為 null 時，原先顯示「完成」畫面（doneTitle）與返回個人資料按鈕，無法區分「API 載入失敗」與「確實無 session 或已完成」。且無 retry 按鈕，使用者無法在頁面內重新載入。

## 2. 業務影響

1. 網路或 API 暫時失敗時，使用者被誤導為流程已完成
2. 無法在頁面內 retry，只能刷新整頁或離開
3. 與其他頁面（如 Interview Chat、Profile Index）的錯誤恢復模式不一致

## 3. 修復方案

1. 使用 store 的 `error` 作為 getSession 失敗的依據
2. 當 `!currentSession && storeError && sessionId` 時，顯示錯誤 Result（status="error"），標題為 `interview.loadFail`，副標題為 storeError
3. 提供「重試」（common.retry）按鈕，點擊後呼叫 `getSession(sessionId)`
4. 提供「返回個人資料」按鈕，維持導航出口
5. 當 `!currentSession && !storeError` 時保持原有行為（顯示 doneTitle、返回個人資料）

## 4. 修復後驗證

- 既有測試調整：`getSession 失敗且 currentSession 為 null 且無 storeError 時應顯示完成結果與返回個人資料按鈕`
- 新增測試：`getSession 失敗且 currentSession 為 null 且有 storeError 時應顯示錯誤與 retry、返回個人資料按鈕（F06 錯誤恢復：失敗不阻塞重試）`
- `npm run test -- --run src/pages/Interview/Result/index.test.tsx` 全數通過（19 例）
