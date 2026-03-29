# Emorapy 業務缺陷報告 - F06 Profile MyStory 載入失敗時無導航出口

日期：2026-03-07  
缺陷編號：`F06-BUG-004`  
狀態：`已修復`  
嚴重度：`低`

## 1. 缺陷摘要

心理畫像專頁（Profile MyStory）當 `fetchProfile` 失敗時，僅顯示 loadFailed Alert 與 retry 按鈕，無導航出口。若 retry 持續失敗，使用者無法離開頁面，須依賴瀏覽器返回。與 Interview Result、Profile Pairing、Profile Settings 等頁面的錯誤恢復模式（retry + 導航出口）不一致。

## 2. 業務影響

1. retry 持續失敗時使用者無法主動離開
2. 與 F06/F08 其他頁面錯誤恢復模式不一致
3. 影響較小（可依賴瀏覽器返回）

## 3. 觸發條件

1. 用戶進入 `/profile/my-story` 頁面
2. `fetchProfile()` 失敗，`storeError` 為真
3. 顯示 loadFailed Alert，僅有 retry 按鈕

## 4. 預期行為

依 F06 錯誤恢復慣例（與 Interview Result、Profile Pairing 對齊）：
- loadFailed Alert 的 action 應含「重試」與「前往個人資料」按鈕
- 用戶可點擊重試再次拉取，或前往個人資料頁離開

## 5. 實際行為（修復前）

- 僅顯示 loadFailed Alert 與 retry 按鈕
- 無導航出口按鈕

## 6. 根因

Alert 的 `action` 區塊僅有 retry 按鈕，未提供導航出口。

## 7. 修復方案

1. 在 loadFailed Alert 的 `action` 中加入「前往個人資料」按鈕
2. `onClick` 呼叫 `navigate('/profile/index')`
3. 使用既有 i18n `settings.goToProfile`（與 Profile Settings 共用）

## 8. 修復後驗證

- 新增測試：`storeError 時應仍可點擊 retry 或前往個人資料導向 /profile/index`（F06 錯誤恢復：失敗不阻塞導航出口）
- `npm run test -- --run src/pages/Profile/MyStory/index.test.tsx` 全數通過
