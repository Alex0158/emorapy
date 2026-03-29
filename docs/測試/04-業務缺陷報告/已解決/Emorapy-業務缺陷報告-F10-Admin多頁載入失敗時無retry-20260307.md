# Emorapy 業務缺陷報告 - F10 Admin 多頁載入失敗時無 retry 按鈕

日期：2026-03-07  
缺陷編號：`F10-BUG-002`  
狀態：`已修復`  
嚴重度：`低`

## 1. 缺陷摘要

管理後台多個頁面（Reports、Jobs、Users、Configs、AuditLogs、Settings）當主查詢 useQuery 失敗時，僅顯示 loadFailed Alert，無 retry 按鈕。與 Admin Health（F10-BUG-001 已修復）的錯誤恢復模式不一致。

## 2. 受影響頁面

- Admin Reports：overviewQuery / funnelQuery / costQuery 任一失敗
- Admin Jobs：jobsQuery 失敗
- Admin Users：usersQuery 失敗；**Users Detail Drawer**：detailQuery 失敗（同版補齊 retry）
- Admin Configs：listQuery / runtimeQuery 任一失敗
- Admin AuditLogs：query 失敗
- Admin Settings：adminUsersQuery / configsQuery 任一失敗

## 3. 業務影響

1. 暫時性網路或服務錯誤時，管理者需刷新頁面才能重試
2. 與 Admin Health retry 模式不一致
3. 影響較小（Admin 內부使用）

## 4. 觸發條件

1. 管理員進入上述任一頁面
2. 對應 useQuery 失敗
3. 顯示 loadFailed Alert，無 retry 按鈕

## 5. 預期行為

依 F10 錯誤恢復慣例：顯示 loadFailed Alert 與「重試」按鈕，點擊後呼叫對應 query.refetch()。

## 6. 修復方案

1. 在各頁 Alert 的 `action` 區塊加入重試按鈕
2. `onClick` 呼叫對應 query.refetch()（多 query 頁面：refetch 全部失敗的 query）
3. `loading={query.isFetching}` 防止連點
4. `data-testid="admin-{page}-load-retry"` 供測試使用

## 7. 修復後驗證

- 新增測試：`應仍可點擊 retry 重新拉取（F10 錯誤恢復：失敗不阻塞重試）` 於 Jobs、Users、Configs、AuditLogs、Reports、Settings
- 新增測試：Users detailQuery 失敗時應顯示 detailLoadFailed 與 retry，點擊 retry 應重新拉取
- Admin 頁面全部測試通過（47 例）
