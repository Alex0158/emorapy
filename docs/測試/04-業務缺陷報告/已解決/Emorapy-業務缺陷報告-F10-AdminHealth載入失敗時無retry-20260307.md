# Emorapy 業務缺陷報告 - F10 Admin Health 載入失敗時無 retry 按鈕

日期：2026-03-07  
缺陷編號：`F10-BUG-001`  
狀態：`已修復`  
嚴重度：`低`

## 1. 缺陷摘要

管理後台健康檢查頁面（Admin Health）當 `getHealthDetailed` 失敗時，僅顯示 loadFailed Alert，無 retry 按鈕。與其他載入頁面（Case List、Chat Room、Execution Dashboard 等）的錯誤恢復模式不一致。

## 2. 業務影響

1. 暫時性網路或服務錯誤時，管理者需刷新頁面才能重試
2. 與其他頁面 retry 模式不一致
3. 影響較小（Admin 內부使用）

## 3. 觸發條件

1. 管理員進入健康檢查頁面
2. `getHealthDetailed`（useQuery）失敗
3. 顯示 loadFailed Alert，無 retry 按鈕

## 4. 預期行為

依 F10 錯誤恢復慣例：顯示 loadFailed Alert 與「重試」按鈕，點擊後呼叫 `healthQuery.refetch()`。

## 5. 實際行為（修復前）

- 僅顯示 loadFailed Alert
- 無 retry 按鈕

## 6. 根因

Alert 未提供 action 區塊與 retry 按鈕。

## 7. 修復方案

1. 在 Alert 的 `action` 區塊加入重試按鈕
2. `onClick` 呼叫 `healthQuery.refetch()`
3. `loading={healthQuery.isFetching}` 防止連點
4. `data-testid="admin-health-load-retry"` 供測試使用

## 8. 修復後驗證

- 新增測試：`useQuery 回傳 error 時應仍可點擊 retry 重新拉取`（F10 錯誤恢復：失敗不阻塞重試）
- `npm run test -- --run src/pages/Admin/Health/index.test.tsx` 全數通過（3 例）
