# Emorapy F02 失敗測試分析與修復報告：匿名協作 Result 授權

日期：2026-03-07  
對應功能：`F02 協作聽證`  
對應範圍：`collaborative -> result` 承接鏈

## 1. 背景

本輪原本要補的是 F02 導向 `Result` 後的錯誤矩陣回歸，重點確認：

1. 匿名 collaborative case 能否用 session 讀回案件
2. 判決輪詢是否仍可用同一 session 查詢
3. result 頁上的證據補傳是否維持同一授權口徑

## 2. 發現方式

在對照 `docs/核心開發文件/功能特性清單.md`、`頁面清單.md` 與後端實作時，發現文檔明確定義：

1. `/quick-experience/collaborative` 無需登入
2. 成功後跳轉 `/quick-experience/result/:id`
3. 判決查詢責任在 F01 `Result` 頁

但後端代碼中，`collaborative` 並沒有被納入匿名 session 授權分支。

## 3. 根因定位

確認的真實根因：

1. `backend/src/services/case.service.ts`
   - `getCaseById()` 只把 `CASE_MODE.QUICK` 視為 session 模式
2. `backend/src/services/judgment.service.ts`
   - `getJudgmentByCaseId()` 同樣只把 `quick` 視為匿名 session 案件
3. `backend/src/controllers/evidence.controller.ts`
   - 上傳/刪除證據也只允許 `quick` 走 session 驗證

結果是：

1. F02 建出的 `collaborative` case 成功導到 result 後
2. 前端雖然帶著正確 session
3. 後端卻把它當成完整登入案件處理
4. 於是真實環境下可能返回 `UNAUTHORIZED` 或 `FORBIDDEN`

## 4. 影響範圍

受影響的並不是單一 API，而是整條匿名協作 result 鏈：

1. `GET /api/v1/cases/:id`
2. `GET /api/v1/cases/:id/judgment`
3. `POST /api/v1/cases/:id/evidence`
4. `DELETE /api/v1/cases/:id/evidence/:evidenceId`

## 5. 修復內容

已完成：

1. `backend/src/services/case.service.ts`
   - `collaborative` 與 `quick` 一樣走 session 驗證
2. `backend/src/services/judgment.service.ts`
   - `collaborative` 判決查詢改為 session 驗證
3. `backend/src/controllers/evidence.controller.ts`
   - `collaborative` 證據上下傳改為 session 驗證
4. 新增/補強測試：
   - `backend/tests/unit/services/case.service.test.ts`
   - `backend/tests/unit/services/judgment.service.test.ts`
   - `backend/tests/unit/controllers/evidence.controller.test.ts`
   - `frontend/src/pages/QuickExperience/Result/index.test.tsx`

## 6. 驗證結果

已通過：

1. `jest tests/unit/services/case.service.test.ts tests/unit/services/judgment.service.test.ts tests/unit/controllers/evidence.controller.test.ts --runInBand`
2. `vitest run src/pages/QuickExperience/Result/index.test.tsx`
3. `vitest run src/pages/QuickExperience/Collaborative/index.test.tsx`

注意：

1. `jest tests/integration/quick-experience.flow.test.ts --runInBand` 在當前環境被整體 skip
2. skip 原因是 `SKIP_DB_INIT!=false`
3. 因此真 DB 流程仍待後續環境驗證

## 7. 結論

本條為**真實業務缺陷**，不是測試假陽性，也不是文檔歧義；其本質是 F02 成功導頁後，後端沒有沿用匿名 session 的授權語義，導致 result 承接鏈在真環境下存在中斷風險。

## 8. 狀態

- 狀態：`已修復`
- 缺陷編號：`F02-BUG-001`
