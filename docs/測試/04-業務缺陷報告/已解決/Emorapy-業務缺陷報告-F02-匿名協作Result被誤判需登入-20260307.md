# Emorapy 業務缺陷報告：F02 匿名協作 Result 被誤判需登入

日期：2026-03-07  
缺陷編號：`F02-BUG-001`  
狀態：`已修復`  
嚴重度：`高`

## 1. 缺陷摘要

F02 協作聽證在匿名訪客完成 A/B 雙方提交後，雖然前端會正確導向 `Result` 頁，但後端把 `collaborative` 案件誤判成「完整登入案件」，導致匿名 session 無法正常讀取 case / judgment，證據補傳也可能被擋。

## 2. 業務影響

此問題直接影響：

1. F02 訪客主鏈路是否真的閉環
2. `collaborative -> result` 的判決展示
3. result 頁後續補傳證據
4. F02 與 F01 Result 的跨功能承接可信度

也就是說，表面上 F02 可以「提交成功並跳頁」，但實際上結果頁核心能力仍可能失效。

## 3. 復現條件

滿足以下條件即可觸發：

1. 訪客進入 `/quick-experience/collaborative`
2. A 方提交合法陳述，建立 `mode=collaborative`、`status=draft` 案件
3. B 方提交合法陳述，案件轉為 `submitted`
4. 前端導向 `/quick-experience/result/:id`
5. result 頁帶著 session 查詢 case / judgment 或操作 evidence

## 4. 預期行為

對於 `collaborative` case：

1. 應與 `quick` 一樣，使用 session 作為匿名授權依據
2. `GET /cases/:id`
3. `GET /cases/:id/judgment`
4. `POST/DELETE evidence`

都應以 `case.session_id === sessionId` 為前提完成授權，而不是要求登入身份。

## 5. 實際行為

修復前實際代碼表現為：

1. `case.service.getCaseById()` 只允許 `quick` 走 session 驗證
2. `judgment.service.getJudgmentByCaseId()` 只允許 `quick` 走 session 驗證
3. `evidence.controller` 只允許 `quick` 走 session 驗證
4. `collaborative` 一律落入完整登入案件分支

因此匿名 F02 result 在真環境下可能收到：

1. `UNAUTHORIZED`
2. `FORBIDDEN`

## 6. 根因

根因不是前端 session 沒帶，而是後端授權口徑不一致：

1. F02 建案是匿名 session 模式
2. F02 成功後又借用 F01 的 `Result` 頁
3. 但後端 result 相關查詢/補證據邏輯只把 `quick` 視為匿名案件
4. `collaborative` 沒有被納入同一授權語義

## 7. 修復方案

已完成：

1. `backend/src/services/case.service.ts`
   - `collaborative` 走 session 驗證
2. `backend/src/services/judgment.service.ts`
   - `collaborative` 走 session 驗證
3. `backend/src/controllers/evidence.controller.ts`
   - `collaborative` 證據上傳/刪除走 session 驗證
4. 新增定向測試護欄，防止後續回歸打破

## 8. 修復後驗證

已通過：

1. `jest tests/unit/services/case.service.test.ts tests/unit/services/judgment.service.test.ts tests/unit/controllers/evidence.controller.test.ts --runInBand`
2. `vitest run src/pages/QuickExperience/Result/index.test.tsx`
3. `vitest run src/pages/QuickExperience/Collaborative/index.test.tsx`

尚待：

1. 在可用 DB 環境下重跑 `tests/integration/quick-experience.flow.test.ts`
2. 真實驗證 `collaborative -> result` 的 case/judgment/evidence 全鏈路

## 9. 關聯文檔

1. `docs/測試/02-專項測試設計/Emorapy-F02-協作聽證測試設計與開發拆解-20260307.md`
2. `docs/測試/03-失敗分析與修復/Emorapy-F02-失敗測試分析與修復報告-匿名協作Result授權-20260307.md`
3. `docs/測試/05-修復方案與風險專題/Emorapy-F02-匿名協作Result授權風險專題-20260307.md`
