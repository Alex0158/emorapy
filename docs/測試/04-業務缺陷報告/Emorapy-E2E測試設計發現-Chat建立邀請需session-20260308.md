# Emorapy E2E 測試設計發現 - Chat 建立邀請需 session 與 room.session_id 匹配

日期：2026-03-08  
類型：`測試設計發現`（非業務缺陷）  
狀態：`已處理`（E2E 已修正；規則已回寫核心 SSOT）

## 1. 發現摘要

Chat Room 頁面「建立邀請」按鈕的啟用條件為 `isOwner`，而 `isOwner` 需滿足：
- 登入用戶：`room.owner_user_id === currentUserId`
- 匿名用戶：`room.session_id === canonical session_id`（session 需匹配）

E2E 測試直接導航至 `/chat/room/:roomId` 時，若未預設 `localStorage.cj_session_id` 且 mock room 未含 `session_id`，則 `isOwner` 為 false，「建立邀請」按鈕會持續 disabled。

此規則現已同步進：

- `docs/核心開發文件/功能特性清單.md`
- `docs/核心開發文件/接口-功能-頁面-Mapping.md`
- `docs/核心開發文件/業務流程整合.md`

## 2. 受影響測試

- `chat-failure-matrix`：409 建立邀請衝突
- `chat-flow`：A 建房 -> 發話 -> 建邀請 -> 發起判決

## 3. 處理方案

1. 新增 `setChatSession(page, sessionId, baseURL)`：先 `goto(baseURL)` 載入同源頁面，再透過現有 session 持久化鍵寫入 `canonical session_id`（目前為 `localStorage.setItem('cj_session_id', sessionId)`）。
2. Mock room 回應中加上 `session_id` 欄位，與上述 session 一致。
3. 在需要「建立邀請」可點擊的測試中，於 `page.goto` 前呼叫 `setChatSession`。

## 4. 修正後驗證

- 409 測試已通過
- chat-flow A 的建立邀請步驟已通過（發起判決步驟偶發依賴 toast 顯示時序，必要時可放寬斷言）
