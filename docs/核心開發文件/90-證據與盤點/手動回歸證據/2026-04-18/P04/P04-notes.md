# P04 補充說明

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據文檔
**來源時間**：2026-04-18
**上下文**：按日期/P 批次留存的手動回歸結果與摘要
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`bd66c2d`
**最後核驗日期**：`2026-04-18`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 初始失敗取證

### 舊失敗房間

- owner session: `guest_1776510918031_c7344ebdfee9486d`
- room id: `172bc5af-2605-48dd-8fa1-759b2ad9d65b`
- invite code: `P9WXBG`
- B 方帳號: `girlfriend@test.com`
- A 方訊息 id: `68ea5cfb-ad03-4e9f-bc55-3be2e43131b4`
- B 方訊息 id: `01908332-a83f-4f99-aa12-1f01c28d6e5c`

### 初始阻斷點

1. 匿名 owner 以合法 `cj_session_id` 進入房間頁時，前台卡在 loading。
2. `POST /api/v1/chat/rooms/:roomId/request-judgment` 最終返回 `503 AI_SERVICE_ERROR`，未生成 `judgment_id`。

### 失敗證據

- 截圖：`P04-desktop-fail-loading-room.png`
- 舊失敗鏈路：
  - `GET /api/v1/chat/rooms/:roomId` -> `200`
  - `GET /api/v1/chat/rooms/:roomId/messages` -> `200`
  - `GET /api/v1/chat/rooms/:roomId/stream` -> `200`
  - 前台仍停在 loading

## 修復內容

### 修復 1：聊天室初始化不再被載入更多歷史訊息重拉

- 代碼：`frontend/src/pages/Chat/Room/index.tsx`
- 回歸測試：`frontend/src/pages/Chat/Room/index.test.tsx`
- 結果：匿名 owner 進房後，聊天室內容可正常渲染，不再只剩 header/footer。

### 修復 2：轉判決只提交 `user_text` 訊息

- 代碼：`frontend/src/pages/Chat/Room/components/ChatJudgmentPanel.tsx`
- 回歸測試：`frontend/src/pages/Chat/Room/index.test.tsx`
- 原因：前台曾把 AI 調解訊息一併帶入 `included_message_ids`，後端依 `message_type='user_text'` 驗證時返回 404。
- 結果：轉判決確認框現在只納入 A/B 雙方的 `user_text` 訊息。

### 修復 3：前台判決請求 timeout 與後端生成預算對齊

- 代碼：
  - `frontend/src/config/api.ts`
  - `frontend/src/services/api/chat.ts`
  - `frontend/src/services/api/chat.test.ts`
- 原因：前台沿用全局 `axios` `30s` timeout，導致瀏覽器先報假性網絡錯誤，但後端仍在生成判決。
- 結果：`requestChatJudgment` 現在顯式使用 `180000ms` timeout，不再在 30 秒處中途 `ERR_ABORTED`。

### 後端生成預算修復

- 代碼：
  - `backend/src/utils/constants.ts`
  - `backend/src/services/ai.service.ts`
  - `backend/src/config/openai.ts`
- 結果：AI 請求 timeout、判決生成 timeout、鎖 TTL 已與真實耗時對齊，不再在 ~45s/60s 處過早失敗。

## 修復後重驗

### 本次重驗房間

- owner session: `guest_1776513762484_5042b640f0044111`
- room id: `cb7461ef-dd47-4ceb-92a0-4106ffe1aa40`
- invite code: `ZZQ7DC`
- B 方帳號: `girlfriend@test.com`
- A 方訊息 id: `714c353f-c733-427f-953e-2486b4d04037`
- B 方訊息 id: `b45eaad7-3cb0-4038-b0cd-57c523522a79`
- case id: `333dc4d2-e1a7-4ac5-a355-f62d7eff8fa3`
- judgment id: `e2ba8293-7cbd-42e5-9a1a-0349223fd64a`

### 實際結果

1. 匿名 owner 進入 `http://127.0.0.1:4173/chat/room/cb7461ef-dd47-4ceb-92a0-4106ffe1aa40` 後，房間內容正常渲染。
2. `轉判決前確認` 視窗只顯示兩條 `user_text` 訊息，AI 調解訊息未被納入。
3. 瀏覽器 network 顯示：
   - `POST /api/v1/chat/rooms/cb7461ef-dd47-4ceb-92a0-4106ffe1aa40/request-judgment => 200 OK`
4. 超過原來的 30 秒臨界點後，頁面沒有再出現 `網絡連接失敗，請檢查網絡連接`。
5. 匿名態在判決完成後自動 handoff 到 `/auth/login`。
6. 使用 `girlfriend@test.com / Test1234` 登錄後，自動跳轉到 `/judgment/e2ba8293-7cbd-42e5-9a1a-0349223fd64a`。
7. 判決詳情頁實際渲染出 `關係分析結果`、`判決書` 與後續方向卡片，閉環完成。

### 修復後證據

- 失敗截圖：`P04-desktop-fail-loading-room.png`
- 通過截圖：`p04-timeout-fixed-login-handoff-2026-04-18.png`
- 真機觀察：
  - 30 秒後頁面仍維持 `判決請求中`，但沒有假性網絡錯誤。
  - 判決完成後自然導向 `/auth/login`。
  - 登錄後可進入對應 `judgment detail`。

## 對 P04 的最終裁決

- `P04` 目前應視為 `PASS`。
- 舊失敗證據保留，用於追溯本輪修復前的真實阻斷點。
