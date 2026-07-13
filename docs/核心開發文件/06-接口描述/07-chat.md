# 接口描述：chat

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：接口詳規
**覆蓋範圍**：接口字段契約、錯誤碼、守衛與頁面對接：07-chat
**取證代碼入口**：`backend/src/app.ts`、`backend/src/routes/chat.routes.ts`、`backend/src/routes/ai-stream.routes.ts`、`backend/src/services/chat.service.ts`、`backend/src/services/judgment.service.ts`、`packages/contracts/src/chat.ts`、`packages/api-client/src/m3.ts`、`frontend/src/services/api/chat.ts`、`frontend/src/pages/Chat/Room`、`mobile/app/(app)/chat/room.tsx`
**最後核驗 Commit**：`95fa8a9`
**最後核驗日期**：`2026-07-12`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v3.0
**最後更新**：2026-07-12
**代碼基準**：能力已進入 `main@30c21bb`；Production 狀態以 exact main SHA workflow 證據為準

---

## 模組定位

- 聊天域同時支持匿名 session 與登入 user。
- 高風險鏈路是 `request-judgment`：涉及房間狀態機、冪等與判決生成。
- judgment 詳情的正式消費屬登入後鏈路；chat 僅承接到 judgment ready 與 handoff。

## 歷史缺口與 current main 邊界

`origin/main@95fa8a9` 仍以 room-wide message/stream、`visibility_scope` 及 legacy handoff 為主；以下是 v1.5.0 修正前的歷史缺口，不用來推斷目前 Production 狀態：

1. roleA list path 跳過 visibility filter，使 roleB `owner_only` 可能被 A 讀取；`owner_only` 尚不等於 sender-private。
2. shared AI prompt 讀最近 30 則同房訊息時沒有 visibility filter，再以 `all` message 與 room-wide stream 輸出；private text 有 indirect disclosure 路徑。
3. `summary_only` 沒有 summary artifact、preview 或 owner approval；現碼投影的是原始 `content`。
4. room event / AI stream access 只驗 room，reply target 只驗同房，尚無 participant/channel audience。
5. `participant_consent.role_b_included_messages` 是 caller assertion，不是 B 本人對 exact selection/version 的持久化 approval。

`main@30c21bb` 已新增 shared/private `ChatChannel`、owner preference、Context Capsule、purpose-scoped authorization、channel-scoped event / AI stream、versioned Analysis request / participant approval 與 `analysis_request_id` handoff；caller boolean 已從 request schema 移除。Backend / Web / App 全量測試、乾淨 docs gate、exact-image build，以及 fresh PostgreSQL / Redis migration、backfill dry-run / apply 與 legacy privacy audit 已通過。Production migration/runtime evidence、release gate 與 canary 由 [Chat 私密上下文待辦](../07-待處理問題與治理/待處理/Chat私密上下文與共同調解隔離重構待辦-2026-07-12.md) 統一裁決，避免把 source / CI evidence 錯寫為「已發布」。

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
| `GET /api/v1/chat/rooms/:roomId/channels` | 無 body | `data.channels[]`；只含 actor 可讀 shared / own private channel | `FORBIDDEN` `INVALID_SESSION_ID` `SESSION_EXPIRED` | 無 | Web / App lane selector |
| `GET /api/v1/chat/rooms/:roomId/context-preference` | 無 body | `data.preference{participant_id,mode}` | `FORBIDDEN` `INVALID_SESSION_ID` `SESSION_EXPIRED` | 無 | Privacy boundary panel |
| `PUT /api/v1/chat/rooms/:roomId/context-preference` | `mode=private_only|shared_process_controls` | `data.preference` | `FORBIDDEN` `VALIDATION_ERROR` | 只更新 actor 本人 preference | Web / App boundary panel |
| `GET /api/v1/chat/channels/:channelId/messages` | `cursor?` `limit?<=100` | `data.messages[]` `data.nextCursor` | `FORBIDDEN` `VALIDATION_ERROR` | 按 channel audience 投影 | Web / App conversation lane |
| `POST /api/v1/chat/channels/:channelId/messages` | `content(1..4000)` `reply_to_message_id?` | `data.message` | `FORBIDDEN` `CASE_NOT_EDITABLE` `RATE_LIMIT_EXCEEDED` `NOT_FOUND` | 寫入 channel；shared / private 分流 AI 與 event | Web / App composer |
| `GET /api/v1/chat/channels/:channelId/stream`（SSE） | 無 body | `ready/ping/message`，帶 `channelId/channelKind` | `FORBIDDEN` `INVALID_SESSION_ID` `SESSION_EXPIRED` | channel-scoped domain events | Web / App conversation lane |
| `GET /api/v1/streams/chat_channel/:channelId`（SSE） | `after_seq?` + auth/session headers | `ready + stream.*` snapshot/replay | `FORBIDDEN` `INVALID_SESSION_ID` `SESSION_EXPIRED` | owner/shared channel AI stream | AI stream client |
| `GET /api/v1/chat/rooms/:roomId/context-capsules` | 無 body | `data.capsules[]` + actor-owned `authorizations[]` | `FORBIDDEN` `CONFLICT` | 只列 actor 本人 capsule | Web / App capsule UI |
| `POST /api/v1/chat/rooms/:roomId/context-capsules` | `source_channel_id` `source_message_ids[]` `summary` `expires_at?` | `data.capsule` | `FORBIDDEN` `VALIDATION_ERROR` `CONFLICT` | 建 immutable draft/version 1 | Capsule composer |
| `POST /api/v1/chat/rooms/:roomId/context-capsules/:capsuleId/revisions` | 同 create + exact capsule path | `data.capsule` | `FORBIDDEN` `CONFLICT` | 撤銷舊 authorization/request，建立下一版 | Capsule editor |
| `POST /api/v1/chat/rooms/:roomId/context-capsules/:capsuleId/authorizations` | `capsule_content_hash` `purpose` `audience` `target_type` `target_id` `policy_version` `expires_at?` | `data.authorization` | `FORBIDDEN` `VALIDATION_ERROR` `CONFLICT` | purpose/audience/target exact grant | Capsule approval |
| `POST /api/v1/chat/rooms/:roomId/context-authorizations/:authorizationId/revoke` | `reason_code=user_revoked` | `data.authorization` | `FORBIDDEN` `CONFLICT` | 停止後續使用；必要時取消未執行 request | Capsule settings |
| `GET /api/v1/chat/rooms/:roomId/analysis-requests` | 無 body | required participant 可見的 `analysis_requests[]`、approvals、sanitized `source_previews` | `FORBIDDEN` `CONFLICT` | 無 | Web / App exact review |
| `POST /api/v1/chat/rooms/:roomId/analysis-requests` | `selected_message_ids[]` `selected_capsule_ids[]` | `data.analysis_request` | `FORBIDDEN` `VALIDATION_ERROR` `CONFLICT` | server 建 canonical snapshot/hash/required participants | Analysis request dialog |
| `POST /api/v1/chat/rooms/:roomId/analysis-requests/:requestId/decision` | `selection_hash` `decision=approved|declined` `policy_version` | `data.approval` | `FORBIDDEN` `CONFLICT` | actor 只可替本人批准/拒絕 exact selection | Consent panel |
| `POST /api/v1/chat/rooms/:roomId/analysis-requests/:requestId/approval/revoke` | `selection_hash` `policy_version` | `data.approval` | `FORBIDDEN` `CONFLICT` | actor 撤回本人未使用 approval | Consent panel |
| `POST /api/v1/chat/rooms/:roomId/analysis-requests/:requestId/submit` | 無 body | `data.analysis_request.status=submitted` | `FORBIDDEN` `CONFLICT` | 發起者在全員 exact approval 後提交 | Consent panel |
| `POST /api/v1/chat/rooms/:roomId/request-judgment` | `included_message_ids?[]` 或 `analysis_request_id?`，兩者互斥 | `data.caseId` `judgmentId?` `linkId?` `status` | `FORBIDDEN` `CASE_NOT_READY` `CASE_NOT_EDITABLE` `CONFLICT` `NOT_FOUND` `INVALID_SESSION_ID` `SESSION_EXPIRED` `AI_SERVICE_ERROR` | room -> judgment_requested/completed/failed；B material 必須經 submitted exact request | 房間頁 |
| `GET /api/v1/chat/rooms/:roomId/judgment-status` | 無 body | `data.roomStatus` `data.latestLink` | `FORBIDDEN` `INVALID_SESSION_ID` `SESSION_EXPIRED` | 無 | 房間頁輪詢 |
| `POST /api/v1/chat/rooms/:roomId/leave` | 無 body | `data.room` | `UNAUTHORIZED` `FORBIDDEN` `INVALID_SESSION_ID` `SESSION_EXPIRED` | B 方 `is_active=false`，room 回 `solo_active` | 房間頁 |
| `POST /api/v1/chat/rooms/:roomId/kick-b` | 無 body | `data.room` | `FORBIDDEN` `NOT_FOUND` `INVALID_SESSION_ID` `SESSION_EXPIRED` | A 方移除 B，room 回 `solo_active` | 房間頁 |

## 操作級規則（深水區）

- `request-judgment` 去重機制：記憶體 in-flight map + 分布式 lock + 既有 link 冪等復用。
- `request-judgment` 超時契約：前端 `requestChatJudgment` 以 `180000ms`（`frontend/src/config/api.ts` 的 `API_CONFIG.chat.judgmentRequestTimeout`）作請求上限；後端對應 `AI_TIMEOUT.JUDGMENT_GENERATION=180000`，且單次 OpenAI 請求 `AI_TIMEOUT.OPENAI_REQUEST=90000`（`backend/src/utils/constants.ts`）。前端超時時不直接判定失敗，需回查 `judgment-status`。
- `request-judgment` 成功載荷中的 `linkId` 是 chat->case 轉換鏈路主鍵；前端與運維排障需以 `roomId + linkId + caseId` 關聯查詢。
- `ChatToCaseLink` 是識別 `chat_to_case` 產品流的最高優先級來源；後續 case list、notification、analytics、repair reminder 不得只用 `mode=collaborative` 或 `mode=quick` 推斷聊天室轉判決。
- `request-judgment` 的安全 gate 必須使用 `backend/src/utils/product-safety-policy.ts` 的 `getChatJudgmentRequestPolicy`。`crisis_support` 會寫入 `safety_notice` 並拒絕轉判決；`safety_support` 可轉安全路由判決，但必須寫入 safety notice，且 `ChatToCaseLink.conversion_snapshot.safety_gate` 需保存 `can_request_chat_judgment / should_create_safety_notice / reasons` 供排障。路由結果同時會 best-effort 寫入 `SafetyAssessmentService.recordRouteAssessment` 的 room-level assessment；`safety_support / crisis_support` 刷新 active `RelationshipRiskState`，`standard` 只記 audit、不覆蓋既有高風險 active state；安全狀態寫入失敗只記 warn，不阻塞原本轉判決或危機攔截流程。
- `request-judgment` 已不接受 caller `participant_consent` boolean。若材料包含任何 roleB message/capsule，發起者必須提交已由所有 required participants 批准並 `submitted` 的 `analysis_request_id`；backend 會重驗 selection hash、policy、參與者、message hash、capsule authorization、approval expiry/revoke。只有 roleA shared message 的 legacy `included_message_ids` 仍可走單方視角，且不得與 `analysis_request_id` 同時提交。
- 訊息發送限速：同房 30 秒最多 6 條，且最小間隔 5 秒；違規回 `RATE_LIMIT_EXCEEDED`。
- 邀請反濫用：同房任一邀請建立後 60 秒內不可再發；若 B 方已拒絕邀請，A 方 24 小時內不可對同房再次發邀請；違規回 `RATE_LIMIT_EXCEEDED`。房主主動撤回公開邀請不觸發 24 小時拒絕冷卻。
- `history_visibility_mode` 仍決定 legacy shared history 與 legacy `included_message_ids` 時間窗；新 channel writes 以 `ChatChannel` 為 audience 邊界。
- `request-judgment` 的 `included_message_ids` 必須是「可納入判決消息集合」子集：僅允許 `message_type=user_text` 且 `visibility_scope=all`，且在 `share_from_join_time/share_summary_only` 下需同時滿足 `created_at >= roleB.joined_at`；若提交越界 ID，後端返回 `NOT_FOUND`。
- Web 與 App 先以 exact-selection consent UI 顯示 shared `user_text` / approved capsule 的 server source previews；AI、safety、private 及不同 channel 訊息不得進入清單。客戶端先建立 `ChatAnalysisRequest`、完成所有 required participant 對同一 selection hash 的批准與 submit，再只用 `analysis_request_id` 發起梳理；Web 與 App 不再呈現 legacy `ChatJudgmentPanel + included_message_ids` 交互。
- room SSE 只承接 room-wide 狀態與 shared message；private message/event 使用 channel SSE。AI 回覆狀態以 `chat_room` 或 `chat_channel` AI Stream 為主來源，private replay 必須先通過 channel audience gate。
- `GET /chat/rooms/:roomId` 在現碼不區分「房間不存在」與「無權訪問」，統一返回 `FORBIDDEN`。
- 匿名 A 房主建立 invite 的前提是 `room.session_id === canonical session_id`。
- `accept invite` 已收斂為 `User only`；B 方需先取得登入身份。
- `leave` 同樣為 `User only`；匿名 session 不可離房。
- `canonical session_id` 指前端統一 session 管理層持有的有效匿名會話 ID，不以任意 storage 臨時值作為權限判定依據。
- `stream.created/started/delta/completed/persisted` 需以 `streamId` 關聯為同一條 AI 回覆；`stream.completed` 不代表可清除暫存氣泡，只有 `stream.persisted` 與正式 `message` 落庫後才算 handoff 完成。
- 前端 draft 狀態轉換已收斂到共享 `aiStreamState.ts`，避免聊天室與其他 AI 頁面產生不同狀態機。
- 聊天室頁的 `AI Stream` 訂閱生命週期已收斂到共享 `useAIStreamSubscription`，不再在頁面內各自維護 `after_seq/retry/cleanup`。
- 房間頁面層內部只使用 `aiDraft: AIStreamDraft | null` 表示暫存 AI 回覆，不再保留 `streamingAi*` 歷史命名。

## UX 行為基線

- **思考中反饋**：shared / private channel 發送成功後可在該 lane 顯示 thinking bubble；draft 與 stream scope 必須綁定 active channel，不能跨 lane 搬運或 replay。
- **建立後樂觀渲染**：建立聊天室成功後，Web 可用 route state 走快速路徑；App 以 screen state / query refresh 承接同一「先可見、再補 canonical」原則。無有效本地狀態或消息列表拉取失敗時，必須 fallback 至完整 room initial load。
- **AI 流式回應**：後端透過 `GET /api/v1/streams/chat_room/:roomId` 推送 `stream.*` 事件；Web / App 以 draft 狀態 `thinking -> streaming -> persisting` 運行，直到 `stream.persisted` 觸發正式消息交接。

## 回歸測試最小集

1. 建房 -> 發邀請 -> B 登入後接受邀請 -> 群聊成功。
2. 超頻發送訊息觸發限流且 UI 不丟狀態。
3. request-judgment 連點只建一筆 case/link。
4. leave/kick-b 後 room 狀態回 `solo_active`。
5. stream 斷線後重連能接續接收事件。
6. A/B 無法 list、reply、subscribe 或 replay 對方 private channel；shared prompt/output 不含 private canary。
7. capsule edit/revoke/expiry 令舊 grant 失效；Analysis request 修改、拒絕、撤回、離房或過期不能沿用舊 approval。
8. Web / App 都能檢視 exact source previews，以各自身份決定；只有 requester 可 submit 並以 `analysis_request_id` handoff。
9. 同一 room 並發建立 Analysis request 時，DB 只允許一個 `pending_approval / approved / submitted / processing` active request；建立前在同一 transaction 將已到期、未 processing 的 request 轉為 `expired`，其餘衝突回 `CONFLICT`，不產生分叉 consent 狀態。

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
| `POST /api/v1/chat/rooms/:roomId/request-judgment` | `AI_SERVICE_ERROR` | 503 | 顯示判決生成暫時失敗 | 稍後重試並先查 judgment-status |
| `GET /api/v1/chat/rooms/:roomId/judgment-status` | `FORBIDDEN` | 403 | 關閉輪詢並提示無權限 | 不重試 |
| `POST /api/v1/chat/rooms/:roomId/leave` | `UNAUTHORIZED` | 401 | 提示需登入後才能離房 | 登入後重試 |
| `POST /api/v1/chat/rooms/:roomId/leave` | `FORBIDDEN` | 403 | 提示僅 B 可離開 | 不重試 |
| `POST /api/v1/chat/rooms/:roomId/kick-b` | `NOT_FOUND` | 404 | 提示 B 不在房內 | 刷新房間狀態 |

## 狀態標記

- 相關接口已由 Backend、shared contracts、Web 與 App 接線並進入 `main@30c21bb`，亦通過全量測試及本地 fresh DB migration/backfill/audit；只有 exact main SHA 的 Production workflow、runtime DB artifact、release gate 與線上 canary 均成功後，才可標記為 Production 已使用。
