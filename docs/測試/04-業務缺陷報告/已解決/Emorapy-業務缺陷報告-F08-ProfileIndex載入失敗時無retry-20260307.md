# Emorapy 業務缺陷報告 - F08 Profile Index 載入失敗時無 retry 按鈕

日期：2026-03-07  
缺陷編號：`F08-BUG-002`  
狀態：`已修復`  
嚴重度：`低`

## 1. 缺陷摘要

個人設定首頁（Profile Index）當 `getProfile` 失敗時，僅顯示 `message.error`（toast），無 retry 按鈕。與其他載入頁面（Case List、Chat Room、Profile Settings、Reconciliation List 等）的錯誤恢復模式不一致。

## 2. 業務影響

1. 暫時性網路或服務錯誤時，使用者需刷新頁面才能重試載入個人資料
2. 與其他頁面 retry 模式不一致
3. 雖已有「失敗後仍可填寫表單並提交」與「若有 psychProfile 仍可導航」等恢復路徑，但缺少 explicit 的 retry 載入入口

## 3. 觸發條件

1. 使用者進入個人設定頁面 `/profile`
2. `getProfile` 失敗
3. 僅顯示 toast 錯誤，無 retry 按鈕

## 4. 預期行為

依 F08 錯誤恢復慣例：顯示 Alert 與「重試」按鈕，點擊後重新呼叫 `getProfile`。

## 5. 實際行為（修復前）

- 僅顯示 `message.error` toast
- 無 retry 按鈕

## 6. 根因

`fetchProfile` 失敗時未維護 `loadError` 狀態，未渲染 Alert 與 retry 按鈕。

## 7. 修復方案

1. 新增 `loadError` 狀態
2. `getProfile` 失敗時 `setLoadError(msg)`，同時保留 `message.error` 作為即時回饋
3. 當 `loadError` 時在表單上方顯示 Alert，`action` 區塊加入重試按鈕
4. 重試按鈕 `onClick` 呼叫 `fetchProfile()`
5. `data-testid="profile-index-load-retry"` 供測試使用

## 8. 修復後驗證

- 新增測試：`getProfile 失敗時應仍可點擊 retry 重新呼叫`、`retry 失敗後應仍可再次點擊 retry`（F08 錯誤恢復：失敗不阻塞重試）
- `npm run test -- --run src/pages/Profile/Index/index.test.tsx` 全數通過（20 例）
