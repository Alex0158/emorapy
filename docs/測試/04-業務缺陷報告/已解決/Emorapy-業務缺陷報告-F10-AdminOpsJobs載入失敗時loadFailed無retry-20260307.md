# Emorapy 業務缺陷報告 - F10 Admin OpsJobs 載入失敗時 loadFailed Alert 無 retry 按鈕

日期：2026-03-07  
缺陷編號：`F10-BUG-003`  
狀態：`已修復`  
嚴重度：`低`

## 1. 缺陷摘要

管理後台 Cron 任務統計看板（Admin OpsJobs）當 stats 載入失敗時，僅顯示 `admin.ops.loadFailed` Alert，Alert 內無 retry 按鈕。雖然頁面其他地方（filter 區）有 retry 按鈕可觸發 refetch，但與 Admin Health、Admin Reports、Case List 等頁面的錯誤恢復模式（loadFailed Alert 內含 retry）不一致，使用者可能不易發現重試入口。

## 2. 業務影響

1. 暫時性網路或 stats API 錯誤時，管理者可能不知如何重試
2. 與 F10 其他頁面 retry 模式不一致
3. 影響較小（Admin 內部使用）

## 3. 觸發條件

1. 管理員進入 OpsJobs 統計看板
2. `useAdminJobStats`（statsQuery）失敗
3. `showLoadFailed` 為 true，顯示 loadFailed Alert，Alert 內無 retry 按鈕

## 4. 預期行為

依 F10 錯誤恢復慣例（與 Admin Health、F10-BUG-001 對齊）：loadFailed Alert 應含 retry 按鈕，點擊後呼叫 `statsQuery.refetch()`。

## 5. 實際行為（修復前）

- 顯示 loadFailed Alert
- Alert 無 action 區塊，無 retry 按鈕
- retry 按鈕僅在 filter Card 區（與錯誤 Alert 分離，不易關聯）

## 6. 根因

`dataViewState.showLoadFailed` 時的 Alert 未提供 `action` 區塊。

## 7. 修復方案

1. 在 loadFailed Alert 的 `action` 區塊加入 retry 按鈕
2. `onClick` 呼叫 `handleRetryStats`（即 `statsQuery.refetch()`）
3. `loading={statsQuery.isFetching}` 防止連點
4. `data-testid="admin-ops-load-retry"` 供測試使用

## 8. 修復後驗證

- 新增測試：`stats 載入失敗時 loadFailed Alert 內應有 retry 按鈕，點擊應觸發 refetch`（F10 錯誤恢復：失敗不阻塞重試）
- `npm run test -- --run src/pages/Admin/OpsJobs/index.test.tsx` 全數通過
