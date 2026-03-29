# Emorapy 業務缺陷報告：F05 Reconciliation List getPlans 回傳 undefined 時崩潰

日期：2026-03-07  
缺陷編號：`F05-BUG-004`  
狀態：`已修復`  
嚴重度：`中`

## 1. 缺陷摘要

Reconciliation List 頁面在 `getPlans` API 回傳 `undefined` 時會崩潰，錯誤為 `Cannot read properties of undefined (reading 'length')`。

## 2. 關聯失敗測試

- `getPlans 回傳 undefined 時應不崩潰並顯示空狀態（F05 邊界：API 回傳不完整時不崩潰）`

## 3. 業務邏輯梳理與實際代碼行為

- `fetchPlans` 成功時呼叫 `setPlans(plansData)`
- 若 `getPlans` 因 API 設計異常或網路/序列化問題回傳 `undefined`，`plans` 會被設為 `undefined`
- 渲染時 `plans.length === 0` 會拋錯，因 `undefined` 無 `length` 屬性

## 4. 問題判定

API 回傳不完整（`undefined` 或非陣列）時，前端未做防禦性處理，導致頁面崩潰。

## 5. 修復方案

在 `setPlans` 前加入防禦：`setPlans(Array.isArray(plansData) ? plansData : [])`，確保 `plans` 恆為陣列。

## 6. 修復後驗證

- 上述測試通過
- 全前端 Vitest 無回歸
