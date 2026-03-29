# Emorapy 業務缺陷報告 - F08 Profile Pairing 載入失敗時無導航出口

日期：2026-03-07  
缺陷編號：`F08-BUG-001`  
狀態：`已修復`  
嚴重度：`中`

## 1. 缺陷摘要

配對管理頁面（Profile Pairing）當 `getPairingStatus` 失敗時，僅以 `message.error` 閃示錯誤，並將 `pairing` 設為 `null` 顯示 create/join UI。使用者無法區分「載入失敗」與「真的沒有配對」，且無重試按鈕與導航出口。

## 2. 業務影響

1. 使用者無法明確得知載入失敗
2. 失敗時無 retry 選項，僅能刷新頁面
3. 與 Profile Settings、Execution Dashboard、Reconciliation Detail 等頁面的錯誤恢復模式不一致

## 3. 觸發條件

1. 用戶進入 `/profile/pairing` 頁面
2. `getPairingStatus()` 拋錯（網路失敗、伺服器錯誤等）
3. `pairing` 設為 `null`，頁面渲染 create/join 區塊

## 4. 預期行為

依 F08/F09 錯誤恢復慣例（與 Profile Settings、Execution Dashboard 對齊）：
- 顯示載入失敗 Alert，提供「重試」與「前往個人設定」按鈕
- 用戶可點擊重試再次拉取，或前往個人設定頁離開

## 5. 實際行為（修復前）

- 僅顯示 `message.error`（短暫 toast），旋即消失
- 渲染 create/join UI，無法區分為載入失敗
- 無 retry、無導航出口

## 6. 根因

`fetchPairingStatus` 失敗時未設置 `loadError` 狀態，也未在 UI 中顯示 Alert 與 action 按鈕。

## 7. 修復方案

1. 新增 `loadError` 狀態
2. `getPairingStatus` 失敗時 `setLoadError(true)`
3. 當 `loadError` 時，顯示 Alert（標題 `message.getPairingFail`），`action` 包含：
   - 重試按鈕：`onClick={() => setLoadError(false); fetchPairingStatus()}`
   - 前往個人設定按鈕：`navigate('/profile/settings')`
4. 新增 i18n `pairing.goToSettings`

## 8. 修復後驗證

- 新增測試：`getPairingStatus 失敗時應仍可點擊 retry 或前往個人設定導向 /profile/settings`（F08 錯誤恢復：失敗不阻塞導航出口）
- `npm run test -- --run src/pages/Profile/Pairing/index.test.tsx` 全數通過
