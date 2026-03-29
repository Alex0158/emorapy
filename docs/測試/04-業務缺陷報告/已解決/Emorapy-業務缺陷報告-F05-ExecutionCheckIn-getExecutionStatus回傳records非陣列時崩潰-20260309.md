# Emorapy 業務缺陷報告：F05 Execution CheckIn getExecutionStatus 回傳 records 非陣列時崩潰

日期：2026-03-09  
缺陷編號：`F05-BUG-007`  
狀態：`已修復`  
嚴重度：`中`（後端回傳異常時頁面崩潰）

## 1. 缺陷摘要

`execution` API 的 `getExecutionStatus` 在後端回傳 `records` 為 `null` 或非陣列時，原直接返回該值。Execution CheckIn 頁面使用 `execution.records.length` 與 `execution.records.map()`，會導致 `TypeError` 崩潰。

## 2. 關聯測試

- `execution API getExecutionStatus`：後端回傳 records 為 null 或非陣列時應返回空陣列（F05 邊界：API 回傳不完整時防禦，避免 CheckIn 崩潰）
- `Execution CheckIn`：execution.records 為 null 或非陣列時應不崩潰並顯示進度與表單（F05-BUG-007 組件層防禦）

## 3. 業務邏輯梳理與實際代碼行為

- `getExecutionStatus` 原直接返回 `result`，未對 `records` 做陣列防禦
- CheckIn 頁面 `execution.records.length`、`execution.records.map()` 在 records 為 null/undefined 時拋錯
- 與 `getPlans`、`getCaseList`、`getAllExecutionStatuses` 等 API 的 `Array.isArray` 防禦慣例不一致

## 4. 問題判定

API 回傳不完整（records 非陣列）時，API 層未做防禦，導致 CheckIn 頁面崩潰。

## 5. 修復方案

1. **API 層**：在 `getExecutionStatus` 內加入 `records: Array.isArray(result.records) ? result.records : []`，確保恆返回合法 ExecutionStatus 形狀。
2. **組件層防禦（防禦縱深）**：CheckIn 頁面對 `execution.records` 使用 `Array.isArray(execution.records) ? execution.records : []` 護欄，避免 mock 或未來其他資料路徑傳入非陣列時崩潰。

## 6. 修復後驗證

- execution API 單元測試通過
- 全前端 Vitest 無回歸
