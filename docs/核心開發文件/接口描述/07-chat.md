# 接口描述：chat

**文檔版本**：v2.1  
**最後更新**：2026-03-05  
**代碼基準**：`backend/src/routes/chat.routes.ts`、`backend/src/services/chat.service.ts`、`frontend/src/pages/Chat/Room`、`frontend/src/services/api/chat.ts`

---

## 模組定位

- 聊天域同時支持匿名 session 與登入 user。
- 高風險鏈路是 `request-judgment`：涉及房間狀態機、冪等與判決生成。

## 接口契約（字段級）

| API | Request（核心字段） | Success（前端實際用到） | 常見錯誤碼 | 副作用/狀態轉移 | 前端入口 |
|---|---|---|---|---|---|
| `POST /api/v1/chat/rooms` | `history_visibility_mode?` | `data.room.id` `status` | `SESSION_ID_REQUIRED` | 建立 room + roleA + ai 參與者 | `/chat/room` |
| `GET /api/v1/chat/rooms/:roomId` | `roomId(uuid)` | `data.room` | `FORBIDDEN` `NOT_FOUND` | 無 | `/chat/room/:roomId` |
| `POST /api/v1/chat/rooms/:roomId/invites` | `expires_in_hours?` `history_visibility_mode?` | `data.invite.invite_code` | `CASE_NOT_EDITABLE` `CONFLICT` | room `solo_active -> invite_pending` | 房間操作 |
| `POST /api/v1/chat/invites/:inviteCode/accept` | `inviteCode` | `data.room.status=group_active` | `INVALID_CODE` `CODE_EXPIRED` | B 方加入，狀態更新 | 邀請碼進房 |
| `POST /api/v1/chat/invites/:inviteCode/decline` | `inviteCode` | `data.invite.status=declined/revoked` | `FORBIDDEN` `INVALID_CODE` | 可能回退 `invite_pending -> solo_active` | 邀請碼流程 |
| `GET /api/v1/chat/rooms/:roomId/stream`（SSE） | 無 body，headers 含 auth/session | `ready/ping/message/room_status/invite` 事件 | `FORBIDDEN` | 訂閱 room 事件總線 | 房間頁 |
| `GET /api/v1/chat/rooms/:roomId/messages` | `cursor?` `limit?<=100` | `data.messages[]` `data.nextCursor` | `VALIDATION_ERROR` | 無 | 房間頁 |
| `POST /api/v1/chat/rooms/:roomId/messages` | `content(1..4000)` `visibility_scope?` `reply_to_message_id?` | `data.message` | `RATE_LIMIT_EXCEEDED` `NOT_FOUND` | 寫入 message，觸發 AI orchestrator | 房間頁 |
| `POST /api/v1/chat/rooms/:roomId/request-judgment` | `included_message_ids?[]` | `data.caseId` `judgmentId?` `status` | `FORBIDDEN` `CASE_NOT_READY` `CONFLICT` | room -> judgment_requested/completed/failed，可能建 case/link | 房間頁 |
| `GET /api/v1/chat/rooms/:roomId/judgment-status` | 無 body | `data.roomStatus` `data.latestLink` | `FORBIDDEN` | 無 | 房間頁輪詢 |
| `POST /api/v1/chat/rooms/:roomId/leave` | 無 body | `data.room` | `FORBIDDEN` | B 方 `is_active=false`，room 回 `solo_active` | 房間頁 |
| `POST /api/v1/chat/rooms/:roomId/kick-b` | 無 body | `data.room` | `FORBIDDEN` `NOT_FOUND` | A 方移除 B，room 回 `solo_active` | 房間頁 |

## 操作級規則（深水區）

- `request-judgment` 去重機制：記憶體 in-flight map + 分布式 lock + 既有 link 冪等復用。
- 訊息發送限速：同房 30 秒最多 6 條，且最小間隔 5 秒；違規回 `RATE_LIMIT_EXCEEDED`。
- `history_visibility_mode` 直接決定轉判決可納入訊息的時間窗與可見性。
- SSE 事件是 UI 狀態主來源，非 SSE 退化路徑僅作補償。

## 回歸測試最小集

1. 建房 -> 發邀請 -> 接受邀請 -> 群聊成功。  
2. 超頻發送訊息觸發限流且 UI 不丟狀態。  
3. request-judgment 連點只建一筆 case/link。  
4. leave/kick-b 後 room 狀態回 `solo_active`。  
5. stream 斷線後重連能接續接收事件。  

## 錯誤碼覆蓋矩陣（API -> code -> UI 行為）

| API | error.code | HTTP | UI 行為 | 重試策略 |
|---|---|---:|---|---|
| `POST /api/v1/chat/rooms` | `SESSION_ID_REQUIRED` | 400 | 觸發 quick session 補建 | 補建後重建房間 |
| `GET /api/v1/chat/rooms/:roomId` | `FORBIDDEN` | 403 | 顯示無權訪問房間 | 返回房間列表 |
| `GET /api/v1/chat/rooms/:roomId` | `NOT_FOUND` | 404 | 顯示房間不存在/已失效 | 可重建新房 |
| `POST /api/v1/chat/rooms/:roomId/invites` | `CONFLICT` | 409 | 提示當前狀態不可邀請 | 先刷新房間狀態 |
| `POST /api/v1/chat/invites/:inviteCode/accept` | `INVALID_CODE` | 400 | 提示邀請碼錯誤 | 重新輸入 |
| `POST /api/v1/chat/invites/:inviteCode/accept` | `CODE_EXPIRED` | 400 | 提示邀請碼過期 | 請 A 重新發邀請 |
| `GET /api/v1/chat/rooms/:roomId/stream` | `FORBIDDEN` | 403 | 關閉 SSE 並提示無權限 | 不自動重連 |
| `POST /api/v1/chat/rooms/:roomId/messages` | `RATE_LIMIT_EXCEEDED` | 429 | 保留輸入並顯示限流提示 | 冷卻後重送 |
| `POST /api/v1/chat/rooms/:roomId/messages` | `NOT_FOUND` | 404 | 提示房間不存在 | 返回上游頁 |
| `POST /api/v1/chat/rooms/:roomId/request-judgment` | `CASE_NOT_READY` | 422 | 提示聊天內容不足以轉判決 | 補訊息後重試 |
| `POST /api/v1/chat/rooms/:roomId/request-judgment` | `CONFLICT` | 409 | 提示已在處理或已有結果 | 改查 judgment-status |
| `POST /api/v1/chat/rooms/:roomId/request-judgment` | `FORBIDDEN` | 403 | 顯示僅 A 方可發起 | 不重試 |
| `GET /api/v1/chat/rooms/:roomId/judgment-status` | `FORBIDDEN` | 403 | 關閉輪詢並提示無權限 | 不重試 |
| `POST /api/v1/chat/rooms/:roomId/leave` | `FORBIDDEN` | 403 | 提示僅 B 可離開 | 不重試 |
| `POST /api/v1/chat/rooms/:roomId/kick-b` | `NOT_FOUND` | 404 | 提示 B 不在房內 | 刷新房間狀態 |

## 狀態標記

- 本模組接口狀態：全部 `已使用`。
