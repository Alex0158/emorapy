# Emorapy 業務缺陷報告：F05 Execution Dashboard getAllExecutionStatuses 回傳 undefined 或非陣列時崩潰

日期：2026-03-09  
缺陷編號：`F05-BUG-005`  
狀態：`已修復`  
嚴重度：`中`

## 1. 缺陷摘要

Execution Dashboard 頁面在 `getAllExecutionStatuses` API 回傳 `undefined` 或非陣列（如物件）時會崩潰，錯誤為 `Cannot read properties of undefined (reading 'filter')` 或類似型別錯誤。

## 2. 關聯失敗測試

- `getAllExecutionStatuses 回傳 undefined 時應不崩潰並顯示空狀態（F05 邊界：API 回傳不完整時不崩潰）`
- `getAllExecutionStatuses 回傳非陣列時應不崩潰並顯示空狀態（F05 邊界：API 回傳不完整時不崩潰）`

## 3. 業務邏輯梳理與實際代碼行為

- `fetchExecutions` 成功時呼叫 `setExecutions(data)`
- 若 `getAllExecutionStatuses` 因 API 設計異常、中介層變更或序列化問題回傳 `undefined` 或非陣列，`executions` 會被設為該值
- 渲染時 `executions.filter(...)` 會拋錯，因 `undefined` 或非陣列無 `filter` 方法

## 4. 問題判定

API 回傳不完整（`undefined` 或非陣列）時，前端未做防禦性處理，導致頁面崩潰。與 F05-BUG-004（Reconciliation List getPlans undefined）同類模式。

## 5. 修復方案

在 `setExecutions` 前加入防禦：`setExecutions(Array.isArray(data) ? data : [])`，確保 `executions` 恆為陣列。

## 6. 修復後驗證

- 上述測試通過
- 全前端 Vitest 無回歸
