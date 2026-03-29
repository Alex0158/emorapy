# Emorapy F01 失敗測試分析與修復報告 - Session Refresh 與 CaseSessionMap 連續性

日期：2026-03-07  
關聯功能：`F01 快速體驗、結果與升格`  
關聯流程：`P01 快速體驗閉環`

## 1. 背景

在完成 `F01-BUG-001` 後，針對 `Result` 頁的 session continuity 進一步補測，重點核對：

1. session 過期後的自動 refresh 是否真的沿用舊 session 旋轉
2. `caseSessionMap` 是否會跟隨 refresh 後的新 session 一起更新
3. 舊 quick case 回訪是否可能因前端 session 狀態漂移而失效

## 2. 發現方式

本輪不是由單一 E2E timeout 暴露，而是由下列代碼/測試聯合盤點發現：

1. `backend/src/services/session.service.ts`
   - 後端 `refreshSession(currentSessionId)` 的真實語義是「旋轉舊 session」
   - 旋轉時會同步更新 `quickSession.case_id` 與 `case.session_id`
2. `frontend/src/services/request.ts`
   - 401/400 session 錯誤時，前端先 `clearSession()` 再 `refreshSession(true)`
3. `frontend/src/services/api/session.ts`
   - `POST /sessions/refresh` 原本未顯式帶入舊 `X-Session-Id`
4. `frontend/src/store/sessionStore.ts`
   - refresh 成功後只更新全局 session，不更新 `caseSessionMap`

## 3. 問題鏈路

實際風險鏈如下：

1. quick case 結果頁或舊案件回訪請求使用舊 `X-Session-Id`
2. 後端返回 `SESSION_EXPIRED` / `INVALID_SESSION_ID`
3. 前端攔截器先清理全局 session
4. 隨後呼叫 `POST /sessions/refresh` 時，已拿不到舊 session
5. 後端只能創建新 session，而不是旋轉原 session
6. `caseSessionMap` 仍保存舊 case -> 舊 session 的映射
7. 之後再次回訪舊案件時，仍可能持續使用失效 session，形成假性「refresh 成功但案件仍不可訪問」

## 4. 最終判定

這是**真實業務缺陷**，不是測試腳本問題，原因如下：

1. 後端明確支持「旋轉舊 session 並保留 case 關聯」
2. 前端在自動 refresh 鏈路中丟失了舊 session 憑證
3. 前端又沒有同步修正 `caseSessionMap`
4. 因此會直接影響匿名案件的回訪連續性

## 5. 修復內容

已完成修復：

1. `frontend/src/services/api/session.ts`
   - `refreshSession(currentSessionId?)` 支援顯式攜帶 `X-Session-Id`
2. `frontend/src/services/request.ts`
   - 在 400/401 session 錯誤處理中，先從失敗請求提取舊 session，再做 refresh
3. `frontend/src/store/sessionStore.ts`
   - refresh 成功後，會把所有命中舊 session 的 `caseSessionMap` 映射替換為新 session
4. `frontend/src/utils/storage.ts`
   - 新增 `caseSessionMap.replaceSession(oldSid, newSid)`

## 6. 補上的測試護欄

已新增/更新：

1. `frontend/src/services/api/session.test.ts`
   - 驗證 refresh 會顯式攜帶 `X-Session-Id`
2. `frontend/src/store/sessionStore.test.ts`
   - 驗證 refresh 會帶舊 session 並同步更新 `caseSessionMap`
3. `frontend/src/services/request.test.ts`
   - 驗證攔截器會把失敗請求裡的 `X-Session-Id` 傳給 refresh
4. `frontend/src/utils/storage.test.ts`
   - 驗證 `replaceSession()` 的批量替換行為

## 7. 驗證結果

已通過：

1. `vitest run src/utils/storage.test.ts src/services/api/session.test.ts src/store/sessionStore.test.ts src/services/request.test.ts src/pages/QuickExperience/Result/index.test.tsx`
2. `npx playwright test --config=e2e/playwright.config.ts e2e/chat/quick-experience-flow.e2e.ts`

## 8. 狀態

- 狀態：`已修復`
- 分類：`高優先級`
- 對應缺陷：見 `04-業務缺陷報告/Emorapy-業務缺陷報告-F01-SessionRefresh未攜帶舊Session導致舊案件回訪失效-20260307.md`
