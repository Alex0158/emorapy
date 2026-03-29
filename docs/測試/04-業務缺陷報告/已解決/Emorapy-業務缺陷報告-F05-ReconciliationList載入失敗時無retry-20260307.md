# Emorapy 業務缺陷報告 - F05 Reconciliation List 載入失敗時無 retry 按鈕

日期：2026-03-07  
缺陷編號：`F05-BUG-003`  
狀態：`已修復`  
嚴重度：`中`

## 1. 缺陷摘要

和好方案列表頁面（Reconciliation List）當 `getPlans` 失敗（非 NOT_FOUND）時，僅以 `message.error` 閃示錯誤。使用者無法直接重試載入，須變更篩選或刷新頁面才能重試，與 Case List、Execution Dashboard、Chat Room 等頁面的錯誤恢復模式不一致。

## 2. 業務影響

1. 暫時性網路或服務錯誤時，使用者需手動變更篩選或刷新才能重試
2. 與其他列表頁面的 retry 模式不一致
3. 無法快速恢復，影響使用體驗

## 3. 觸發條件

1. 用戶進入 `/reconciliation/:judgmentId` 頁面
2. `getPlans()` 拋錯（非 NOT_FOUND/HTTP_404）
3. 僅顯示 `message.error`（toast），無持久錯誤提示與 retry 按鈕

## 4. 預期行為

依 F05 錯誤恢復慣例（與 Case List、Execution Dashboard 對齊）：
- 顯示載入失敗 Alert，提供「重試」按鈕
- 用戶可點擊重試再次拉取

## 5. 實際行為（修復前）

- 僅顯示 `message.error`（toast），旋即消失
- 無持久 Alert、無 retry 按鈕
- 變更篩選可觸發重新拉取，但非明顯 recovery 路徑

## 6. 根因

`fetchPlans` 失敗時（非 NOT_FOUND）僅呼叫 `message.error`，未設置 `loadError` 狀態，也未在 UI 中顯示 Alert 與 retry 按鈕。

## 7. 修復方案

1. 新增 `loadError` 狀態
2. `getPlans` 失敗時（非 NOT_FOUND/HTTP_404）`setLoadError(msg)`、`setPlans([])`
3. 當 `loadError` 時，在篩選區下方顯示 Alert（標題為錯誤訊息），`action` 包含重試按鈕
4. 重試按鈕 `loading={loading}` 防止連點、`data-testid="recon-list-load-retry"` 供測試使用

## 8. 修復後驗證

- 新增測試：`getPlans 失敗時應仍可點擊 retry 重新呼叫 getPlans，成功後應顯示方案列表`（F05 錯誤恢復：失敗不阻塞重試）
- 新增測試：`getPlans 失敗時 retry 失敗後應仍可再次點擊 retry，成功後應顯示方案列表`（F05 錯誤恢復：失敗不阻塞重試）
- `npm run test -- --run src/pages/Reconciliation/List/index.test.tsx` 全數通過（28 例）
