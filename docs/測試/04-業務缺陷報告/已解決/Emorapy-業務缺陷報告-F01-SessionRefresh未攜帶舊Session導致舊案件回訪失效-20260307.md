# Emorapy 業務缺陷報告 - F01 Session Refresh 未攜帶舊 Session 導致舊案件回訪失效

日期：2026-03-07  
缺陷編號：`F01-BUG-002`  
狀態：`已修復`  
嚴重度：`高`

## 1. 缺陷摘要

F01 匿名 quick case 在 session 過期後，前端自動 refresh 鏈路未保留失敗請求中的舊 `sessionId`，導致後端無法旋轉舊 session，只能新建 session。若同時 `caseSessionMap` 仍保留舊案件映射，使用者回訪既有案件時可能持續命中失效 session，造成 quick case 無法穩定回訪。

## 2. 業務影響

1. 匿名使用者以為 session 已自動續期，但舊案件實際仍可能不可訪問
2. `Result` 頁、舊案件回訪、補證據等後續行為會出現不一致
3. 這會直接破壞 F01 最重要的匿名入口連續性

## 3. 觸發條件

1. quick case 已建立，且前端保存了 `caseSessionMap`
2. 之後該 session 過期或失效
3. 某次案件/判決請求返回 `SESSION_EXPIRED`、`SESSION_ID_REQUIRED` 或 `INVALID_SESSION_ID`
4. 前端進入自動 refresh

## 4. 預期行為

1. refresh 請求應攜帶舊 session，讓後端旋轉原 session
2. refresh 成功後，前端應同步更新對應 `caseSessionMap`
3. 使用者回訪原案件時應持續可用

## 5. 實際行為

1. 前端錯誤攔截器先清除全局 session
2. refresh 請求因此拿不到舊 `sessionId`
3. 後端只能新建 session，無法旋轉原 session 關聯
4. `caseSessionMap` 仍指向舊 session，舊案件回訪存在失效風險

## 6. 根因

根因由兩段前端行為共同構成：

1. `request.ts` 在 session 錯誤處理中先 `clearSession()` 再 `refreshSession(true)`
2. `sessionStore.ts` refresh 後只更新全局 session，不更新 `caseSessionMap`

## 7. 修復方案

已完成：

1. `services/api/session.ts`
   - refresh 支援顯式傳入舊 `X-Session-Id`
2. `services/request.ts`
   - 從失敗請求提取舊 session 後再執行 refresh
3. `store/sessionStore.ts`
   - refresh 成功後同步替換 `caseSessionMap` 中的舊 session
4. `utils/storage.ts`
   - 新增 `caseSessionMap.replaceSession()`

## 8. 修復後驗證

已通過：

1. `vitest run src/utils/storage.test.ts src/services/api/session.test.ts src/store/sessionStore.test.ts src/services/request.test.ts src/pages/QuickExperience/Result/index.test.tsx`
2. `npx playwright test --config=e2e/playwright.config.ts e2e/chat/quick-experience-flow.e2e.ts`

## 9. 備註

本缺陷與 `F01-BUG-001` 不同：

1. `F01-BUG-001` 是提交成功後不導航
2. `F01-BUG-002` 是 session 續期後舊案件連續性失效

兩者都屬於 F01 匿名入口的核心穩定性問題，但影響環節不同。
