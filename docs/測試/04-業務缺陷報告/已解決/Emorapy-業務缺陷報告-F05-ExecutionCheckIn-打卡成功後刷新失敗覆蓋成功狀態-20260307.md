# Emorapy 業務缺陷報告 - F05 Execution CheckIn 打卡成功後刷新失敗覆蓋成功狀態

日期：2026-03-07  
缺陷編號：`F05-BUG-002`  
狀態：`已修復`  
嚴重度：`中`

## 1. 缺陷摘要

執行打卡頁面（Execution CheckIn）在打卡成功後會於 2 秒後呼叫 `fetchExecution` 刷新執行紀錄。若此時 `getExecutionStatus` 失敗，原邏輯會 `setExecution(null)`，導致頁面從成功狀態切換為 notFound Alert，覆蓋成功體驗。

## 2. 業務影響

1. 使用者成功打卡後，若網路瞬斷或 API 暫時不可用，會錯誤看到「取得失敗」與 notFound 畫面
2. 成功狀態被錯誤覆蓋，使用者困惑為何剛成功又顯示失敗
3. 與 F05 錯誤恢復慣例不一致：刷新失敗應保留既有資料，不應清空

## 3. 觸發條件

1. 用戶在 Execution CheckIn 頁面完成打卡（checkin 成功）
2. 2 秒後 `fetchExecution()` 被呼叫以刷新 records
3. `getExecutionStatus` 失敗（網路錯誤、伺服器暫時不可用等）

## 4. 預期行為

- 打卡成功後，即使 refresh 失敗，應保留既有 execution 資料與表單
- 刷新失敗可顯示較低侵入性的提示（如「歷史紀錄更新失敗」），或靜默失敗，不應清空 execution

## 5. 實際行為（修復前）

- `fetchExecution` 失敗時一律 `setExecution(null)`
- 頁面切換為 `!execution` 區塊，顯示 notFound Alert
- 成功訊息已顯示，但畫面被錯誤取代

## 6. 根因

`fetchExecution` 未區分「初次載入」與「刷新」情境。初次載入失敗應顯示 notFound；刷新失敗（已有 execution）不應清空。

## 7. 修復方案

在 `fetchExecution` 中加入 `isRefresh` 參數：
- `isRefresh: false`（預設）：初次載入，失敗時 `setExecution(null)`
- `isRefresh: true`：刷新情境，失敗時不呼叫 `setExecution(null)`，可顯示較輕量提示或靜默

打卡成功後的 `fetchExecution()` 改為 `fetchExecution({ isRefresh: true })`。

## 8. 修復後驗證

- 新增測試：`打卡成功後 refresh 失敗應保留 execution 並顯示輕量提示，不顯示 notFound`
- `npm run test -- --run src/pages/Execution/CheckIn/index.test.tsx` 全數通過
