# Emorapy 業務缺陷報告：F03 正式 Collaborative 缺少被告仍可提交

日期：2026-03-07  
缺陷編號：`F03-BUG-001`  
狀態：`已修復`  
嚴重度：`高`

## 1. 缺陷摘要

正式案件接口 `POST /api/v1/cases` 在 `mode=collaborative` 下，修復前允許只提供原告陳述就直接建立 `submitted` 案件，缺少被告陳述仍可進入後續審理流程。

## 2. 業務影響

此問題直接影響：

1. 正式 collaborative 案件的完整性
2. `draft -> submitted` 的狀態可信度
3. review / judgment 後續鏈路的前置條件
4. 前端與後端規則一致性

換句話說，系統會把「尚未收集完雙方信息」的案件誤當成「可開始審理」。

## 3. 復現條件

1. 已登入且 pairing 為 active
2. 呼叫 `POST /api/v1/cases`
3. body 帶：
   - `pairing_id`
   - `plaintiff_statement`
   - `mode=collaborative`
4. 不帶 `defendant_statement`

## 4. 預期行為

對正式 collaborative 建案：

1. 必須同時提供雙方陳述
2. 否則應拒絕請求，不能建立 `submitted` 案件

## 5. 實際行為

修復前：

1. `createCaseSchema` 允許缺少 `defendant_statement`
2. `case.service.createCase()` 把 `mode=collaborative` 直接視為 ready for submission
3. 案件被建立為 `submitted`

## 6. 根因

根因是前後端規則沒有在後端再次落實：

1. 頁面有雙方陳述護欄
2. 後端 schema 與 service 沒有把同一規則封死
3. 直接打 API 可繞過前端限制

## 7. 修復方案

已完成：

1. `backend/src/utils/validation.ts`
   - `mode=collaborative` 時強制 `defendant_statement` 必填
2. `backend/src/services/case.service.ts`
   - 缺少被告陳述時拋 `VALIDATION_ERROR`
3. 新增對應單測與頁面護欄測試

## 8. 修復後驗證

已通過：

1. `jest tests/unit/services/case.service.test.ts tests/unit/utils/validation-schemas.test.ts --runInBand`
2. `vitest run src/pages/Case/Detail/index.test.tsx`

## 9. 關聯文檔

1. `docs/測試/02-專項測試設計/Emorapy-F03-正式案件管理測試設計與開發拆解-20260307.md`
2. `docs/測試/03-失敗分析與修復/Emorapy-F03-失敗測試分析與修復報告-正式Collaborative缺少被告仍可提交-20260307.md`
3. `docs/測試/05-修復方案與風險專題/Emorapy-F03-正式案件提交邊界風險專題-20260307.md`
