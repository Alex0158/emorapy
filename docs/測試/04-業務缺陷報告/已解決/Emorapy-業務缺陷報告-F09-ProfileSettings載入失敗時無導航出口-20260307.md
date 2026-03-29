# Emorapy 業務缺陷報告 - F09 Profile Settings 載入失敗時無導航出口

日期：2026-03-07  
缺陷編號：`F09-BUG-002`（註：F09-BUG-001 為 retry 再次失敗未顯示錯誤，已修復）  
狀態：`已修復`  
嚴重度：`中`

## 1. 缺陷摘要

設置頁面（Profile Settings）當 `getProfile` 失敗時，顯示 loadError Alert 僅有「重試」按鈕。若重試持續失敗，使用者無法離開錯誤狀態，無導航出口可返回個人資料或其他頁面。

## 2. 業務影響

1. 使用者載入設定失敗且重試無效時，無法主動離開
2. 與 Profile Pairing、Execution Dashboard、Reconciliation Detail 等頁面的錯誤恢復模式（retry + 導航出口）不一致

## 3. 觸發條件

1. 用戶進入 `/profile/settings` 頁面
2. `getProfile()` 拋錯（網路失敗、伺服器錯誤等）
3. 進入 loadError 狀態，僅顯示 retry 按鈕

## 4. 預期行為

依 F09 錯誤恢復慣例（與 Profile Pairing 對齊）：
- 顯示載入失敗 Alert，提供「重試」與「前往個人資料」按鈕
- 用戶可點擊重試再次拉取，或前往個人資料頁離開

## 5. 實際行為（修復前）

- 顯示 loadError Alert，僅有 retry 按鈕
- 無導航出口按鈕

## 6. 根因

`loadError` 狀態的 Alert `action` 僅包含 retry 按鈕，未提供導航出口。

## 7. 修復方案

在 loadError Alert 的 action 中加入「前往個人資料」按鈕，`onClick={() => navigate('/profile/index')}`，使用 i18n `settings.goToProfile`。

## 8. 修復後驗證

- 新增測試：`getProfile 失敗時應仍可點擊 retry 或前往個人資料導向 /profile/index`（F09 錯誤恢復：失敗不阻塞導航出口）
- `npm run test -- --run src/pages/Profile/Settings/index.test.tsx` 全數通過
