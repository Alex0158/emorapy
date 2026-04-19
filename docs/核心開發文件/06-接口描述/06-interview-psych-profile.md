# 接口描述：interview + psych-profile

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：接口詳規
**覆蓋範圍**：接口字段契約、錯誤碼、守衛與頁面對接：06-interview-psych-profile
**取證代碼入口**：`backend/src/app.ts`、`backend/src/routes`、`frontend/src/services/api`、`frontend-admin/src/services/api`
**最後核驗 Commit**：`45d4897`
**最後核驗日期**：`2026-04-19`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v2.9  
**最後更新**：2026-04-06  
**代碼基準**：`backend/src/routes/interview.routes.ts`、`backend/src/routes/ai-stream.routes.ts`、`backend/src/services/interview.service.ts`、`frontend/src/store/interviewStore.ts`、`frontend/src/services/api/interview.ts`、`frontend/src/services/aiStream.ts`

---

## 模組定位

- 訪談會話 + 提交式 AI 回覆觸發 + 統一 AI Stream 讀鏈路 + 非同步心理畫像流水線。
- 以 consent 為入口閘門，並具回合與頻率雙重治理。

## 接口契約（字段級）

| API | Request（核心字段） | Success（前端實際用到） | 常見錯誤碼 | 副作用/狀態轉移 | 前端入口 |
|---|---|---|---|---|---|
| `POST /api/v1/interview/start` | `trigger?`（organic/pre_case/post_judgment/onboarding） | `data.session.id` `data.turns[0].ai_message` | `CONSENT_REQUIRED` `RATE_LIMIT_EXCEEDED` | 建立 session + 首輪問題 | `/profile/index` 等 |
| `POST /api/v1/interview/:id/respond` | `message(1..2000)` | `202 accepted` + `session_id` | `TURN_TOO_FAST` `MAX_TURNS_REACHED` `CONCURRENT_REQUEST` | 寫入 user turn，啟動 AI 任務 | `/interview/:sessionId` |
| `POST /api/v1/interview/:id/skip` | 空 body | `202 accepted` + `session_id` | 同 respond | 寫入 skipped turn，啟動 AI 任務 | `/interview/:sessionId` |
| `POST /api/v1/interview/:id/cancel` | 空 body | `cancelled` `session_id` | `NOT_FOUND` | 中止進行中的 AI 任務 | `/interview/:sessionId` |
| `GET /api/v1/streams/interview_session/:id`（SSE） | `after_seq?` | `ready + stream.*` snapshot/replay | `FORBIDDEN` `NOT_FOUND` | 訪談 AI 回覆唯一可見輸出入口 | AI stream client |
| `POST /api/v1/interview/:id/end` | `id(uuid)` | 成功旗標 | `SESSION_COMPLETED` `NOT_FOUND` | `in_progress -> completed/processing` | `/interview/:sessionId` |
| `GET /api/v1/interview/resume` | 無 | `has_pending` `session_id` `last_ai_message` `turn_count` `has_failed` `failed_session_id` | `UNAUTHORIZED` `CONSENT_REQUIRED` | 無 | profile / my-story |
| `GET /api/v1/interview/:id` | `id(uuid)` | `data.session` + `turns[]` | `NOT_FOUND` `CONSENT_REQUIRED` | 無 | 訪談頁恢復 |
| `POST /api/v1/interview/:id/retry` | `id(uuid)` | 成功旗標 | `VALIDATION_ERROR`（非 failed 狀態） `NOT_FOUND` `CONSENT_REQUIRED` | `processing_failed -> processing` | `/profile/my-story` |
| `GET /api/v1/psych-profile` | 無 | `data.profile` | `UNAUTHORIZED` | 無 | `/profile/my-story`、判決前置讀取 |
| `GET /api/v1/psych-profile/feedback` | 無 | `data.history[]` | `UNAUTHORIZED` `CONSENT_REQUIRED` | 無 | `/profile/my-story` |
| `POST /api/v1/psych-profile/consent` | 無 | 成功旗標 | `UNAUTHORIZED` | 設定 consent=true | Profile 入口 |
| `DELETE /api/v1/psych-profile` | 無 | 成功旗標 | `UNAUTHORIZED` `CONSENT_REQUIRED` | 清空心理資料 | `/profile/my-story` |

## 操作級規則（深水區）

- `start` 的限額採「實質 session」統計（至少 3 turns）以降低誤封鎖。
- `start` 目前有兩層限流，且都統一返回 `RATE_LIMIT_EXCEEDED`：路由層 `interviewStartLimiter` 是每小時 DDoS 安全網；服務層則按「實質 session（>=3 turns）」做每日/每小時配額治理。前端仍保留 `START_RATE_LIMIT` 舊別名映射，但當前後端在此鏈路不再實際返回該 code。
- `respond` 在後端以 lock 保護並發；前端提交與可見輸出已解耦，提交端只負責啟動任務，可見輸出統一來自 `AI Stream`。
- 訪談頁送出後立即顯示 AI thinking bubble；不再等首 token 才渲染氣泡。
- 前端 `interviewStore` 顯式維護 `streamingStatus=thinking/streaming/persisting`，與聊天室、判決 phase 流的 UI 狀態語義保持一致。
- `respond/skip` 仍採提交式觸發，但 `TURN_TOO_FAST`、`MAX_TURNS_REACHED`、`SESSION_COMPLETED`、`NOT_FOUND` 這些前置錯誤現在會在提交當下同步返回，不再先回 `202` 再讓背景任務靜默失敗。
- 只有在通過前置校驗後，`respond/skip` 才會返回 `202 accepted`；後端接著把 `stream.started/delta/completed/persisted/cancelled` 發到 `interview_session` scope，前端草稿回覆與最終交接都只跟隨 `AI Stream`。
- 訪談頁的 `AI Stream` 訂閱生命週期已收斂到共享 `useAIStreamSubscription`，不再在頁面內手寫 `after_seq/retry/cleanup`。
- 當客戶端在 `respond/skip` 任務執行中中止或調用 `cancel` 時，後端會以標準 `stream.cancelled` 收口，而不是只在前端本地靜默 abort。
- `Interview/Chat` 頁面主動訂閱 `GET /api/v1/streams/interview_session/:id`，用 `after_seq` 做快照回填與重連補償；當頁面重掛或主請求已返回但 AI 任務仍在進行時，頁面會顯示 recovering 狀態而非退回空白。
- `stream.cancelled` 的 snapshot / replay 仍會參與狀態收口與重連對齊，但 `Interview` 頁面不再渲染 cancelled draft 氣泡；使用者主動停止後以提示文案收口，避免誤解為一條新的 AI 回覆。
- `stream.persisted` 到達後，前端會再靜默拉一次 `GET /api/v1/interview/:id`，用 canonical session/turns 覆蓋本地臨時拼裝結果。
- 若 `AI Stream` 訂閱在建立或恢復階段收到 terminal error（尤其是 4xx/5xx），`Interview` 頁面必須立即退出 thinking 狀態並顯示可恢復錯誤，不允許無限停留在「我正在整理你的分享......」；其中 5xx 需映射為 `CONNECTION_LOST` 統一提示。
- `AI Stream` 的訪談持久化必須正確寫入 `ai_stream_sessions / ai_stream_events`，否則會出現 canonical `interview_turns` 已生成、但前端因缺少 `stream.persisted` / replay 而停在舊 draft 的假完成狀態。2026-04-06 已以真實訪談回覆驗證此鏈路恢復落庫。
- `end` 依內容充分度決定是否進 pipeline，非所有結束都會產生畫像更新。
- 安全協議（safety flag）會透過 metadata/safety_alert 事件回傳前端。
- `POST/GET /api/v1/interview/*`（除 `psych-profile` GET/consent 外）全部要求 `authenticate + requireConsent`；`resume` 既回報 `has_pending/session_id`，也會同時回報 `has_failed/failed_session_id`，供 `/profile/my-story` 決定 resume 或 retry 入口。
- `GET /api/v1/psych-profile` 當前只回傳最新 `narratives/insights/richness_score` 與 consent 狀態，不再以 `PROCESSING_NOT_DONE/PROCESSING_FAILED` 表達畫像流水線狀態；pending/failed 入口應以 `resume` 或通知旅程判斷。
- `/profile/my-story` 的豐富度標籤以 `richness_score + narratives` 聯合判斷：當 `richness_score < 0.05` 但已存在 `is_latest && completeness>0` 的 domain narrative 時，前端顯示「早期探索」而非「尚未開始」。

## 回歸測試最小集

1. consent=false 時 `start` 必須拒絕。  
2. `respond` 連續快速提交觸發 `TURN_TOO_FAST`。  
3. `AI Stream` 斷線後前端能進入可恢復態（resume/replay）。  
4. `cancel` 後前端應立即清除 draft 氣泡，並以提示文案收口，不得殘留 cancelled 假回覆。  
5. `processing_failed` 可經 `retry` 回到處理中；`abandoned` 需由清理任務與恢復入口共同收口。  
6. delete psych-profile 後 profile 與 feedback 均清空。  

## 錯誤碼覆蓋矩陣（API -> code -> UI 行為）

| API | error.code | HTTP | UI 行為 | 重試策略 |
|---|---|---:|---|---|
| `POST /api/v1/interview/start` | `CONSENT_REQUIRED` | 403 | 顯示 consent 引導彈窗 | 完成 consent 後重試 |
| `POST /api/v1/interview/start` | `RATE_LIMIT_EXCEEDED` | 429 | 顯示啟動過頻提示；可能來自路由層 DDoS limiter 或服務層日/小時配額 | 冷卻後重試 |
| `POST /api/v1/interview/:id/respond` | `TURN_TOO_FAST` | 429 | 顯示節流倒數，保留輸入內容 | 倒數後重送 |
| `POST /api/v1/interview/:id/respond` | `MAX_TURNS_REACHED` | 422 | 顯示達上限並引導結束訪談 | 改走 end 流程 |
| `POST /api/v1/interview/:id/respond` | `CONCURRENT_REQUEST` | 409 | 提示已有進行中請求 | 等待當前 stream 結束後重送 |
| `POST /api/v1/interview/:id/cancel` | `NOT_FOUND` | 404 | 顯示訪談不存在 | 返回 profile 入口 |
| `POST /api/v1/interview/:id/end` | `SESSION_COMPLETED` | 409 | 顯示已結束並導向結果頁 | 不重試 end |
| `GET /api/v1/interview/resume` | `CONSENT_REQUIRED` | 403 | 顯示 consent 引導並回 profile 入口 | 完成 consent 後重拉 |
| `GET /api/v1/interview/:id` | `NOT_FOUND` | 404 | 顯示訪談不存在 | 返回 profile 入口 |
| `POST /api/v1/interview/:id/retry` | `VALIDATION_ERROR` | 400 | 提示目前狀態不可 retry | 先確認 session 狀態 |
| `GET /api/v1/psych-profile` | `UNAUTHORIZED` | 401 | 導向登入或降級為空資料 | 登入後重拉 |
| `GET /api/v1/psych-profile/feedback` | `CONSENT_REQUIRED` | 403 | 顯示需授權提示 | 完成 consent 後重拉 |
| `DELETE /api/v1/psych-profile` | `CONSENT_REQUIRED` | 403 | 提示未授權刪除 | 完成 consent 後重試 |

## 狀態標記

- 本模組接口狀態：全部 `已使用`。
