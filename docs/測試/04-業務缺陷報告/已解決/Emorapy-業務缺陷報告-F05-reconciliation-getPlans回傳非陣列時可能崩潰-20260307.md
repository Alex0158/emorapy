# Emorapy 業務缺陷報告：F05 reconciliation API getPlans 回傳非陣列時可能崩潰

日期：2026-03-07  
缺陷編號：`F05-BUG-006`  
狀態：`已修復`  
嚴重度：`低`（預防性修復）

## 1. 缺陷摘要

`reconciliation` API 的 `getPlans` 在後端回傳 `plans` 為非陣列（如字串、物件）時，原直接返回該值。Reconciliation List 雖有 `Array.isArray` 組件層防禦，但 API 層未與 `getCaseList`、`uploadEvidence` 等對齊，契約不一致，且若其他調用方未防禦會崩潰。

## 2. 關聯測試

- `reconciliation API getPlans`：後端回傳 plans 為非陣列時應返回空陣列（F05 邊界：API 回傳不完整時防禦）

## 3. 業務邏輯梳理與實際代碼行為

- `getPlans` 原回傳 `data?.plans ?? []`，僅處理 `undefined`/`null`
- 當後端因異常回傳 `plans: "invalid"` 或 `plans: {}` 時，會直接返回非陣列
- Reconciliation List 有 `Array.isArray(plansData) ? plansData : []` 防禦，故不崩潰
- 但 API 契約應與 case/content/execution 等對齊，統一在 API 層防禦

## 4. 問題判定

API 回傳不完整（plans 非陣列）時，API 層未做防禦，與專案其他 API 慣例不一致。

## 5. 修復方案

在 `getPlans` 內加入 `Array.isArray(plans) ? plans : []`，確保恆返回陣列。

## 6. 修復後驗證

- reconciliation API 單元測試通過
- 全前端 Vitest 無回歸
