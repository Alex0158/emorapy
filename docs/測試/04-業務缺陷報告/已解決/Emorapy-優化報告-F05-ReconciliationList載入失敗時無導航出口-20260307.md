# Emorapy 優化報告 - F05 Reconciliation List 載入失敗時無導航出口

日期：2026-03-07  
編號：`F05-OPT-001`  
狀態：`已修復`  
類型：`優化`（對齊錯誤恢復慣例）

## 1. 摘要

和好方案列表頁面（Reconciliation List）當 `getPlans` 失敗時僅有 retry 按鈕，無導航出口。與 Case Detail（retry + backList）、Judgment Detail（retry + back）、Execution Dashboard（retry + goCaseList）等頁面之「失敗不阻塞導航出口」慣例不一致。

## 2. 修復方案

在 loadError Alert 的 action 中新增「返回判決」按鈕，點擊導向 `/judgment/:judgmentId`。

## 3. 修復後驗證

- 新增測試：`getPlans 失敗時應仍可點擊返回判決導向 /judgment/:judgmentId（F05 錯誤恢復：失敗不阻塞導航出口）`
- `npm run test -- --run src/pages/Reconciliation/List/index.test.tsx` 全數通過（33 例）
