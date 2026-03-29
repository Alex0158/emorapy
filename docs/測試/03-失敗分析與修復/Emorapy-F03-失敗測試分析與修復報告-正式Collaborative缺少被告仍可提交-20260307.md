# Emorapy F03 失敗測試分析與修復報告：正式 Collaborative 缺少被告仍可提交

日期：2026-03-07  
對應功能：`F03 正式案件管理`  
對應範圍：`POST /api/v1/cases`

## 1. 背景

本輪切入 F03 時，優先檢查正式案件建案的狀態轉移是否與頁面規則一致，尤其是：

1. `remote` 是否正確區分 `draft/submitted`
2. `collaborative` 是否會錯誤提前提交

## 2. 發現方式

在對照 `Case Create` 前端規則、`createCaseSchema` 與 `case.service.createCase()` 時，發現：

1. 前端 `collaborative` 模式要求雙方陳述都合法才可提交
2. 但後端 service 只要收到 `mode=collaborative`，就會把案件視為可直接 `submitted`
3. 即使 `defendant_statement` 為空也不阻止

## 3. 根因定位

確認根因有兩層：

1. `backend/src/utils/validation.ts`
   - `createCaseSchema` 對 `mode=collaborative` 沒有額外要求 `defendant_statement`
2. `backend/src/services/case.service.ts`
   - `isReadyForSubmission` 對 `collaborative` 直接為真
   - 缺少「雙方陳述必須齊備」的業務防線

## 4. 風險結果

修復前可能造成：

1. 直接建立缺少被告陳述的正式 collaborative 案件
2. 案件狀態錯誤進入 `submitted`
3. 提前觸發後續 review / judgment 流程
4. 讓 API 行為與前端頁面規則產生分裂

## 5. 修復內容

已完成：

1. `createCaseSchema`
   - `mode=collaborative` 時 `defendant_statement` 改為必填
2. `case.service.createCase()`
   - `collaborative` 缺少被告陳述時拋 `VALIDATION_ERROR`
3. 補測試：
   - `backend/tests/unit/services/case.service.test.ts`
   - `backend/tests/unit/utils/validation-schemas.test.ts`
   - `frontend/src/pages/Case/Detail/index.test.tsx`

## 6. 驗證結果

已通過：

1. `jest tests/unit/services/case.service.test.ts tests/unit/utils/validation-schemas.test.ts --runInBand`
2. `vitest run src/pages/Case/Detail/index.test.tsx`

## 7. 結論

本條為**真實業務缺陷**，本質是後端對正式 collaborative 建案的提交判斷過寬，允許不完整案件提前進入正式審理鏈。現已修復並補上 schema + service 雙護欄。

## 8. 狀態

- 狀態：`已修復`
- 缺陷編號：`F03-BUG-001`
