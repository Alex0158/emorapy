# Emorapy 業務缺陷報告 - F05 Reconciliation Detail 失敗時無導航出口

日期：2026-03-07  
缺陷編號：`F05-BUG-001`  
狀態：`已修復`  
嚴重度：`中`

## 1. 缺陷摘要

和好方案詳情頁面（Reconciliation Detail）當 `getPlanById` 與 `getPlans` 皆失敗時，僅顯示錯誤 Alert，未提供「返回」或「重試」按鈕，使用者無法離開或嘗試恢復。

## 2. 業務影響

1. 使用者進入方案詳情頁後若 API 全失敗，會被卡在錯誤畫面
2. 無法透過返回鍵返回上一頁或透過重試再次拉取
3. 與 Case Detail、Judgment Detail、Execution Dashboard 等頁面錯誤恢復模式不一致

## 3. 觸發條件

1. 用戶進入 `/reconciliation/:judgmentId/:id` 頁面
2. `getPlanById(id)` 失敗
3. Fallback 的 `getPlans(judgmentId)` 亦失敗
4. 外層 catch 觸發，`plan` 保持 `null`

## 4. 預期行為

依 F05 錯誤恢復慣例（與 Case Detail、Execution Dashboard 對齊）：
- 顯示錯誤 Alert 時應提供「返回」與「重試」按鈕
- 用戶可點擊返回離開或點擊重試再次嘗試

## 5. 實際行為（修復前）

- 僅顯示 `<Alert title={t('message.planNotFound')} type="error" />`
- 無 `action` 區塊，無返回或重試按鈕
- 使用者需依賴瀏覽器返回或重新整理才能離開

## 6. 根因

`!plan` 錯誤區塊未加入 `action` 屬性，與其他頁面錯誤恢復 UI 設計不一致。

## 7. 修復方案

在 `!plan` 的 Alert 中新增 `action`：
- 返回按鈕：`onClick={() => navigate(-1)}`
- 重試按鈕：`onClick={() => judgmentId && id && fetchPlan()}`

## 8. 修復後驗證

- `npm run test -- --run src/pages/Reconciliation/Detail/index.test.tsx` 全數通過
- 新增測試：`getPlanById 與 getPlans 皆失敗時應仍可點擊返回或 retry`（F05 錯誤恢復：失敗不阻塞導航出口）
