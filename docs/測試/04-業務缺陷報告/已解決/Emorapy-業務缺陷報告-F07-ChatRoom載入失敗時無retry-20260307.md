# Emorapy 業務缺陷報告 - F07 Chat Room 載入失敗時無 retry 按鈕

日期：2026-03-07  
缺陷編號：`F07-BUG-001`  
狀態：`已修復`  
嚴重度：`中`

## 1. 缺陷摘要

聊天室頁面（Chat Room）當 `getChatRoom` 失敗時，僅顯示載入失敗 Alert 與「返回聊天室入口」按鈕。使用者無法直接重試載入，須返回後重新進入房間，與 Profile Pairing、Case Detail、Execution CheckIn 等頁面的錯誤恢復模式不一致。

## 2. 業務影響

1. 暫時性網路或服務錯誤時，使用者需手動返回再進入才能重試
2. 與其他頁面（Profile Pairing、Case Detail 等）的 retry 模式不一致
3. 無法快速恢復，影響使用體驗

## 3. 觸發條件

1. 用戶進入 `/chat/room/:roomId` 頁面
2. `getChatRoom()` 或 `listChatMessages()` 拋錯（loadRoomInitial 失敗）
3. 顯示「載入聊天室失敗」Alert，僅有「返回聊天室入口」按鈕

## 4. 預期行為

依 F07 錯誤恢復慣例（與 Profile Pairing、Case Detail、Execution CheckIn 對齊）：
- 顯示載入失敗 Alert，提供「重試」按鈕
- 用戶可點擊重試再次拉取，無需返回再進入

## 5. 實際行為（修復前）

- 顯示 errorText Alert
- 僅有「返回聊天室入口」導航出口
- 無 retry 按鈕

## 6. 根因

`loadRoomInitial` 失敗時未提供 retry 入口，僅有 `navigate('/chat/room')` 導航出口。

## 7. 修復方案

1. 新增 `loadRetryLockRef` 防止快速連點重複請求
2. 新增 `handleRetryLoad` callback，重新呼叫 `loadRoomInitial(routeRoomId)`
3. 當 `!room && routeRoomId && errorText` 時，在 Alert 的 `action` 區塊顯示「重試」按鈕
4. 新增 `data-testid="chat-room-load-retry"` 供測試使用

## 8. 修復後驗證

- 新增測試：`getChatRoom 失敗時應仍可點擊 retry 重新呼叫 getChatRoom，成功後應顯示聊天室`（F07 錯誤恢復：失敗不阻塞重試）
- 新增測試：`getChatRoom 失敗時 retry 失敗後應仍可再次點擊 retry，成功後應顯示聊天室`（F07 錯誤恢復：失敗不阻塞重試）
- 新增測試：`getChatRoom 失敗時 retry 快速連點只會送出一次 getChatRoom 請求`（F07 重試節流）
- `npm run test -- --run src/pages/Chat/Room/index.test.tsx` 全數通過（56 例）
