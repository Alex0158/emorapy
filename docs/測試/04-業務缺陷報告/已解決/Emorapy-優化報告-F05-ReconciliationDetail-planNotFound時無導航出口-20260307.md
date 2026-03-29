# Emorapy 優化報告 - F05 Reconciliation Detail planNotFound 時無導航出口

日期：2026-03-07  
編號：`F05-OPT-002`  
狀態：`已修復`  
類型：`優化`（對齊 F05-OPT-001 導航慣例）

## 1. 摘要

和好方案詳情頁（Reconciliation Detail）當 `getPlanById` 與 `getPlans` 皆失敗、plan 為空時，僅有 retry 與「返回」按鈕。與 Reconciliation List（F05-OPT-001）補齊「返回判決」導航出口的慣例不一致；當用戶從書籤或新分頁直接進入詳情時，`navigate(-1)` 可能無效。

## 2. 修復方案

在 planNotFound Alert 的 action 中，當 `judgmentId` 存在時新增「返回判決」按鈕，點擊導向 `/judgment/:judgmentId`。與 List 對齊，提供穩定導航出口。

## 3. 修復後驗證

- 新增測試：`getPlanById 與 getPlans 皆失敗時應仍可點擊返回判決導向 /judgment/:judgmentId（F05-OPT-002 錯誤恢復：失敗不阻塞導航出口）`
- `npm run test -- --run src/pages/Reconciliation/Detail/index.test.tsx` 全數通過（34 例）
