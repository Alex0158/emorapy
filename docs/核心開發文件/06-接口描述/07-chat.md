# 接口描述：chat

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：接口詳規
**覆蓋範圍**：接口字段契約、錯誤碼、守衛與頁面對接：07-chat
**取證代碼入口**：`backend/src/app.ts`、`backend/src/routes`、`frontend/src/services/api`、`frontend-admin/src/services/api`
**最後核驗 Commit**：`7cae077`
**最後核驗日期**：`2026-04-18`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v2.6  
**最後更新**：2026-04-18  
**代碼基準**：`backend/src/routes/chat.routes.ts`、`backend/src/services/chat.service.ts`、`frontend/src/pages/Chat/Room`、`frontend/src/services/api/chat.ts`

---

## 模組定位

- 聊天域同時支持匿名 session 與登入 user。
- 高風險鏈路是 `request-judgment`：涉及房間狀態機、冪等與判決生成。
- judgment 詳情的正式消費屬登入後鏈路；chat 僅承接到 judgment ready 與 handoff。

## 接口契約（字段級）

| API | Request（核心字段） | Success（前端實際用到） | 常見錯誤碼 | 副作用/狀態轉移 | 前端入口 |
|---|---|---|---|---|---|
| `POST /api/v1/chat/rooms` | `history_visibility_mode?` | `data.room.id` `status` | `SESSION_ID_REQUIRED` `INVALID_SESSION_ID` `SESSION_EXPIRED` | 建立 room + roleA + ai 參與者 | `/chat/room` |
| `GET /api/v1/chat/rooms/:roomId` | `roomId(uuid)` | `data.room` | `FORBIDDEN` `INVALID_SESSION_ID` `SESSION_EXPIRED` | 無 | `/chat/room/:roomId` |
| `POST /api/v1/chat/rooms/:roomId/invites` | `expires_in_hours?` `history_visibility_mode?` | `data.invite.invite_code` | `FORBIDDEN` `CASE_NOT_EDITABLE` `CONFLICT` `INVALID_SESSION_ID` `SESSION_EXPIRED` | room `solo_active -> invite_pending` | 房間操作 |
| `POST /api/v1/chat/invites/:inviteCode/accept` | `inviteCode` | `data.room.status=group_active` | `UNAUTHORIZED` `FORBIDDEN` `VALIDATION_ERROR` `INVALID_CODE` `CODE_EXPIRED` `CASE_NOT_EDITABLE` `CONFLICT` | B 方登入後加入，狀態更新 | 邀請碼進房 |
| `POST /api/v1/chat/invites/:inviteCode/decline` | `inviteCode` | `data.invite.status=declined/revoked` | `UNAUTHORIZED` `FORBIDDEN` `INVALID_CODE` `CODE_EXPIRED` `CASE_NOT_EDITABLE` | 可能回退 `invite_pending -> solo_active` | 邀請碼流程 |
| `GET /api/v1/chat/rooms/:roomId/stream`（SSE） | 無 body，headers 含 auth/session | `ready/ping/message/room_status/invite` 事件 | `FORBIDDEN` `INVALID_SESSION_ID` `SESSION_EXPIRED` | 訂閱 room 事件總線 | 房間頁 |
| `GET /api/v1/streams/chat_room/:roomId`（SSE） | `after_seq?` + auth/session headers | `ready + stream.*` 事件，含 snapshot/replay/heartbeat | `FORBIDDEN` `INVALID_SESSION_ID` `SESSION_EXPIRED` | Chat AI 主鏈路 | AI stream client |
| `GET /api/v1/chat/rooms/:roomId/messages` | `cursor?` `limit?<=100` | `data.messages[]` `data.nextCursor` | `FORBIDDEN` `VALIDATION_ERROR` `INVALID_SESSION_ID` `SESSION_EXPIRED` | 無 | 房間頁 |
| `POST /api/v1/chat/rooms/:roomId/messages` | `content(1..4000)` `visibility_scope?` `reply_to_message_id?` | `data.message` | `FORBIDDEN` `CASE_NOT_EDITABLE` `RATE_LIMIT_EXCEEDED` `NOT_FOUND` `INVALID_SESSION_ID` `SESSION_EXPIRED` | 寫入 message，觸發 AI orchestrator | 房間頁 |
| `POST /api/v1/chat/rooms/:roomId/request-judgment` | `included_message_ids?[]` | `data.caseId` `judgmentId?` `status` | `FORBIDDEN` `CASE_NOT_READY` `CASE_NOT_EDITABLE` `CONFLICT` `NOT_FOUND` `INVALID_SESSION_ID` `SESSION_EXPIRED` | room -> judgment_requested/completed/failed，可能建 case/link | 房間頁 |
| `GET /api/v1/chat/rooms/:roomId/judgment-status` | 無 body | `data.roomStatus` `data.latestLink` | `FORBIDDEN` `INVALID_SESSION_ID` `SESSION_EXPIRED` | 無 | 房間頁輪詢 |
| `POST /api/v1/chat/rooms/:roomId/leave` | 無 body | `data.room` | `UNAUTHORIZED` `FORBIDDEN` `INVALID_SESSION_ID` `SESSION_EXPIRED` | B 方 `is_active=false`，room 回 `solo_active` | 房間頁 |
| `POST /api/v1/chat/rooms/:roomId/kick-b` | 無 body | `data.room` | `FORBIDDEN` `NOT_FOUND` `INVALID_SESSION_ID` `SESSION_EXPIRED` | A 方移除 B，room 回 `solo_active` | 房間頁 |

## 操作級規則（深水區）

- `request-judgment` 去重機制：記憶體 in-flight map + 分布式 lock + 既有 link 冪等復用。
- 訊息發送限速：同房 30 秒最多 6 條，且最小間隔 5 秒；違規回 `RATE_LIMIT_EXCEEDED`。
- `history_visibility_mode` 直接決定轉判決可納入訊息的時間窗與可見性。
- 房間 SSE 是房間級 domain event 主來源；AI 回覆狀態則以 `AI Stream` 為主來源。
- `GET /chat/rooms/:roomId` 在現碼不區分「房間不存在」與「無權訪問」，統一返回 `FORBIDDEN`。
- 匿名 A 房主建立 invite 的前提是 `room.session_id === canonical session_id`。
- `accept invite` 已收斂為 `User only`；B 方需先取得登入身份。
- `leave` 同樣為 `User only`；匿名 session 不可離房。
- `canonical session_id` 指前端統一 session 管理層持有的有效匿名會話 ID，不以任意 storage 臨時值作為權限判定依據。
- `stream.created/started/delta/completed/persisted` 需以 `streamId` 關聯為同一條 AI 回覆；`stream.completed` 不代表可清除暫存氣泡，只有 `stream.persisted` 與正式 `message` 落庫後才算 handoff 完成。
- 前端 draft 狀態轉換已收斂到共享 `aiStreamState.ts`，避免聊天室與其他 AI 頁面產生不同狀態機。
- 聊天室頁的 `AI Stream` 訂閱生命週期已收斂到共享 `useAIStreamSubscription`，不再在頁面內各自維護 `after_seq/retry/cleanup`。
- 房間頁面層內部只使用 `aiDraft: AIStreamDraft | null` 表示暫存 AI 回覆，不再保留 `streamingAi*` 歷史命名。

## UX 優化（2026-03）

- **思考中反饋**：發送訊息且 `visibility_scope === 'all'` 時，發送成功後立即顯示 thinking bubble；收到首個 `stream.*` 事件前即可顯示 placeholder；15 秒內未收到任何 AI 事件則超時清除。
- **建立後樂觀渲染**：建立聊天室成功後 `navigate` 帶 `state.room`，進入房間時若 `state.room.id === routeRoomId` 則走快速路徑（僅 `listChatMessages`，不呼叫 `getChatRoom`）；無 state 或 listChatMessages 失敗時 fallback 至完整 `loadRoomInitial`。
- **AI 流式回應**：後端透過 `GET /api/v1/streams/chat_room/:roomId` 推送 `stream.*` 事件；前端以 draft 狀態 `thinking -> streaming -> persisting` 運行，直到 `stream.persisted` 觸發正式消息交接。

## 回歸測試最小集

1. 建房 -> 發邀請 -> B 登入後接受邀請 -> 群聊成功。  
2. 超頻發送訊息觸發限流且 UI 不丟狀態。  
3. request-judgment 連點只建一筆 case/link。  
4. leave/kick-b 後 room 狀態回 `solo_active`。  
5. stream 斷線後重連能接續接收事件。  

## 錯誤碼覆蓋矩陣（API -> code -> UI 行為）

| API | error.code | HTTP | UI 行為 | 重試策略 |
|---|---|---:|---|---|
| `POST /api/v1/chat/rooms` | `SESSION_ID_REQUIRED` | 400 | 觸發 quick session 補建 | 補建後重建房間 |
| `GET /api/v1/chat/rooms/:roomId` | `FORBIDDEN` | 403 | 顯示無權訪問房間 | 返回房間列表 |
| `POST /api/v1/chat/rooms` | `INVALID_SESSION_ID` | 400 | 提示 session 衝突或格式錯誤 | 清理衝突來源後重試 |
| `POST /api/v1/chat/rooms` | `SESSION_EXPIRED` | 401 | 提示匿名會話已失效 | 先刷新 session 再重試 |
| `POST /api/v1/chat/rooms/:roomId/invites` | `CONFLICT` | 409 | 提示當前狀態不可邀請 | 先刷新房間狀態 |
| `POST /api/v1/chat/rooms/:roomId/invites` | `FORBIDDEN` | 403 | 提示僅 A 方可發邀請 | 不重試 |
| `POST /api/v1/chat/invites/:inviteCode/accept` | `INVALID_CODE` | 400 | 提示邀請碼錯誤 | 重新輸入 |
| `POST /api/v1/chat/invites/:inviteCode/accept` | `CODE_EXPIRED` | 400 | 提示邀請碼過期 | 請 A 重新發邀請 |
| `POST /api/v1/chat/invites/:inviteCode/accept` | `UNAUTHORIZED` | 401 | 提示需先登入再接受邀請 | 登入後重試 |
| `GET /api/v1/chat/rooms/:roomId/stream` | `FORBIDDEN` | 403 | 關閉 SSE 並提示無權限 | 不自動重連 |
| `POST /api/v1/chat/rooms/:roomId/messages` | `RATE_LIMIT_EXCEEDED` | 429 | 保留輸入並顯示限流提示 | 冷卻後重送 |
| `POST /api/v1/chat/rooms/:roomId/messages` | `NOT_FOUND` | 404 | 提示房間不存在 | 返回上游頁 |
| `POST /api/v1/chat/rooms/:roomId/messages` | `CASE_NOT_EDITABLE` | 422 | 提示當前房間狀態不可發送 | 待房間狀態恢復後重試 |
| `POST /api/v1/chat/rooms/:roomId/request-judgment` | `CASE_NOT_READY` | 422 | 提示聊天內容不足以轉判決 | 補訊息後重試 |
| `POST /api/v1/chat/rooms/:roomId/request-judgment` | `CASE_NOT_EDITABLE` | 422 | 提示封存房間不可轉判決 | 返回房間頁 |
| `POST /api/v1/chat/rooms/:roomId/request-judgment` | `CONFLICT` | 409 | 提示已在處理或已有結果 | 改查 judgment-status |
| `POST /api/v1/chat/rooms/:roomId/request-judgment` | `FORBIDDEN` | 403 | 顯示僅 A 方可發起 | 不重試 |
| `GET /api/v1/chat/rooms/:roomId/judgment-status` | `FORBIDDEN` | 403 | 關閉輪詢並提示無權限 | 不重試 |
| `POST /api/v1/chat/rooms/:roomId/leave` | `UNAUTHORIZED` | 401 | 提示需登入後才能離房 | 登入後重試 |
| `POST /api/v1/chat/rooms/:roomId/leave` | `FORBIDDEN` | 403 | 提示僅 B 可離開 | 不重試 |
| `POST /api/v1/chat/rooms/:roomId/kick-b` | `NOT_FOUND` | 404 | 提示 B 不在房內 | 刷新房間狀態 |

## 狀態標記

- 本模組接口狀態：全部 `已使用`。
