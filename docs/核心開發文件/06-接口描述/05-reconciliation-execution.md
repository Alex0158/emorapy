# 接口描述：reconciliation + execution / repair journey

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：接口詳規
**覆蓋範圍**：接口字段契約、錯誤碼、守衛與頁面對接：05-reconciliation-execution
**取證代碼入口**：`backend/src/app.ts`、`backend/src/routes`、`frontend/src/services/api`、`frontend-admin/src/services/api`
**最後核驗 Commit**：`45d4897`
**最後核驗日期**：`2026-04-19`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v2.7  
**最後更新**：2026-04-19  
**代碼基準**：`backend/src/routes/reconciliation.routes.ts`、`backend/src/routes/execution.routes.ts`、`backend/src/routes/ai-stream.routes.ts`、`backend/src/services/reconciliation.service.ts`、`backend/src/services/execution.service.ts`

---

## 模組定位

- 判決後不再直接進入「生成方案 -> 選方案 -> 打卡」。
- 現行主鏈路為：`選方向(intent) -> journey entry -> 主推薦 / 備選 -> 承諾 / respond / invite -> 開始今天的一小步(confirm) -> 每日脈搏 checkin -> dashboard / replanning / resume`。
- `replan` 已升級為 **AI 異步任務**：提交後回 `202 Accepted`，前端主讀鏈路為 `GET /api/v1/streams/repair_track/:id`。
- `execution` 兼容保留舊路由，但語義已升級為 repair journey。

## 核心資料語義

- `reconciliation_plans.intent`
  - `repair`
  - `cool_down`
  - `graceful_exit`
  - `safety_support`
- `repair_tracks`
  - 一個方案對應一條修復旅程
  - 保存 `status / status_reason / recommended_mode / current_step_index / needs_replan / last pulse / last_replan_at`
- `repair_participant_states`
  - 保存雙方承諾狀態
  - `not_viewed / viewed / deferred / committed / declined / paused`
- `repair_track_events`
  - 保存邀請、查看、承諾、暫停、重調、恢復等審計事件
- `repair_step_progresses`
  - 保存當前旅程各步驟的進度
- `repair_checkins`
  - 保存每日一步回報
  - `result / closeness / stress / needs_help / notes / photos`
- `reconciliation_plans.version_group_id / superseded_at / superseded_by_plan_id`
  - 方案重生成與 replan 不再刪舊版本，只做 supersede

## 接口契約（字段級）


| API                                               | Request（核心字段）                                                                                                        | Success（前端實際用到）                                                                                                                                                                                                                                                                                                                                                                    | 副作用 / 狀態轉移                                                          | 前端入口                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| `POST /api/v1/judgments/:id/reconciliation-plans` | `intent?` `preferences?{difficulty,duration,types[],pressure_level,pace,style[],invite_partner}` `force_regenerate?` | `data.plans[]` `data.recommended_plan_id` `data.intent` `data.applied_preferences` `data.journey_entry` `data.version_summary`                                                                                                                                                                                                                                                     | 生成或重生成同方向方案集合；force regenerate 改為 supersede 舊版本                     | `/reconciliation/:judgmentId?intent=`*                   |
| `GET /api/v1/judgments/:id/reconciliation-plans`  | `id(uuid)` + optional `difficulty/type/intent`                                                                       | 同上 bundle                                                                                                                                                                                                                                                                                                                                                                          | 無                                                                   | `/reconciliation/:judgmentId`                            |
| `GET /api/v1/reconciliation-plans/:id`            | `id(uuid)`                                                                                                           | `data.plan`（含 `content`、`fit_reason`、`commitment`、`judgment.case_id`、`viewer_role`、`invite_context`、`cta_state`、`track_history_summary`、`journey_context`）                                                                                                                                                                                                                         | 無                                                                   | `/reconciliation/:judgmentId/:id`                        |
| `POST /api/v1/reconciliation-plans/:id/select`    | `id(uuid)`                                                                                                           | `data.plan.commitment`                                                                                                                                                                                                                                                                                                                                                             | 當前用戶承諾此方案；必要時初始化 `repair_track`                                     | `/reconciliation/:judgmentId/:id`                        |
| `POST /api/v1/reconciliation-plans/:id/respond`   | `action(viewed/committed/deferred/declined/paused)` `reason?` `remind_in_hours?`                                     | `data.plan`                                                                                                                                                                                                                                                                                                                                                                        | invitee 查看 / 接受 / 延後回應 / 婉拒 / 暫停回應閉環                                | `/reconciliation/:judgmentId/:id`                        |
| `GET /api/v1/reconciliation-plans/:id/commitment` | `id(uuid)`                                                                                                           | `data.commitment`                                                                                                                                                                                                                                                                                                                                                                  | 無                                                                   | 詳情頁 / 後續擴展                                               |
| `POST /api/v1/reconciliation-plans/:id/invite`    | `id(uuid)`                                                                                                           | `data.invitation`                                                                                                                                                                                                                                                                                                                                                                  | 記錄邀請與通知 deep link；若 track 處於 `draft/partner_invited` 會進 `partner_invited`，若已在運行態（如 `solo_active/co_active/paused/replanning`）則保留當前運行態 | `/reconciliation/:judgmentId/:id`                        |
| `POST /api/v1/reconciliation-plans/:id/pause`     | `id(uuid)`                                                                                                           | `data.commitment`                                                                                                                                                                                                                                                                                                                                                                  | 將當前用戶 / track 標記為 `paused`                                          | `/reconciliation/:judgmentId/:id`                        |
| `POST /api/v1/execution/confirm`                  | `plan_id(uuid)`                                                                                                      | `data.execution`                                                                                                                                                                                                                                                                                                                                                                   | 啟動 repair journey；兼容保留 execution confirm 記錄                         | `/reconciliation/:judgmentId/:id`                        |
| `POST /api/v1/execution/checkin`                  | `plan_id(uuid)` `step_result?` `closeness?` `stress?` `needs_help?` `notes?` `photos?<=3`                            | `data.execution`                                                                                                                                                                                                                                                                                                                                                                   | 寫入 `repair_checkins`、更新當前步驟 / 旅程狀態 / legacy execution record        | `/execution/:planId/checkin`                             |
| `POST /api/v1/repair-tracks/:id/replan`           | `id(track uuid)` + `mode(lower_pressure/slower_pace/solo_first)` `reason(needs_help/farther/high_stress/manual)`                        | `data.track{track_id,status,accepted,stream_scope,scope_id,stream_id,request_id}`                                                                                                                                                                                                                                                                                                  | 提交 AI 重調任務，track 轉為 `replanning`；若同 track 已有進行中/可恢復快照，直接返回既有 `stream_id/request_id`；舊版本保留                              | `/execution/:planId/replan`                              |
| `POST /api/v1/repair-tracks/:id/resume`           | `id(uuid)`                                                                                                           | `data.track{track_id,plan_id,status}`                                                                                                                                                                                                                                                                                                                                              | 恢復 paused 旅程，按 committed 人數回到 `solo_active/co_active`               | `/reconciliation/:judgmentId/:id`、`/execution/dashboard` |
| `GET /api/v1/execution/status`                    | query `plan_id(uuid)`                                                                                                | `data.track_id` `data.plan_id` `data.judgment_id` `data.status` `data.journey_status` `data.relationship_mode` `data.progress` `data.plan_summary` `data.current_step` `data.commitment` `data.pulse_summary` `data.primary_cta` `data.secondary_cta` `data.status_reason` `data.replan_recommendation` `data.presentation_bucket` `data.journey_context` `data.replan_state` `data.active_replan_stream_id` `data.latest_plan_version` `data.superseded_plan_id` `data.records[]` `data.recent_checkins[]` | 無                                                                   | `/execution/:planId/checkin`、`/execution/:planId/replan` |
| `GET /api/v1/execution/dashboard`                 | 無                                                                                                                    | `data.executions[]`（journey 聚合，含 `presentation_bucket + journey_context + CTA hints`）                                                                                                                                                                                                                                                                                              | 無                                                                   | `/execution/dashboard`                                   |
| `GET /api/v1/streams/repair_track/:id`            | optional query `after_seq`                                                                                           | SSE `ready` + `stream.*` events                                                                                                                                                                                                                                                                                                                                                    | repair track AI 重調 phase/replay/recovering 主鏈路                      | `/execution/:planId/replan`                              |


## 返回字段補充說明

### `data.plans[]`

- 保留原字段：`id / plan_type / difficulty_level / estimated_duration / user1_selected / user2_selected / plan_content`
- 新增或顯式返回：
  - `intent`
  - `content`
  - `fit_reason`
  - `first_step`
  - `fallback_step`
  - `pause_rule`
  - `do_not_use_when`
  - `risk_note`
  - `commitment`
  - `is_recommended`

### `data.journey_entry`

- `status`
- `track_id`
- `active_plan_id`
- `recommended_action`
- `last_pulse`
- `has_superseded_versions`
- `journey_context`

### `data.version_summary`

- `version_group_id`
- `has_superseded_versions`
- `superseded_versions_count`

### `data.commitment`

- `track_id`
- `track_status`
- `recommended_mode`
- `invited_partner_at`
- `is_dual_committed`
- `current_user`
- `partner`

### `data.journey_context`

- `viewer_role`
- `journey_task`
- `partner_state`
- `title`
- `body`
- `primary_cta`
- `secondary_cta`
- `urgency`
- `banner_tone`
- `reason_code`
- `entry_path`
- `resume_path`
- `presentation_bucket`

### `GET /execution/status`

- `track_id`
- `plan_id`
- `judgment_id`
- `status`
- `journey_status`
- `relationship_mode`
- `progress`
- `current_step`
  - `step_index`
  - `title`
  - `content`
  - `fallback_content`
  - `pause_rule`
- `pulse_summary`
  - `closeness`
  - `stress`
  - `needs_replan`
  - `needs_help`
- `presentation_bucket`
- `journey_context`
- `primary_cta`
- `secondary_cta`
- `status_reason`
- `replan_recommendation`
- `replan_state`
- `active_replan_stream_id`
- `latest_plan_version`
- `superseded_plan_id`

## Replan 流式與 CTA 冪等語義（代碼實作）

- `POST /repair-tracks/:id/replan` 為 `202 Accepted` 非阻塞提交；返回 `stream_scope=repair_track + stream_id + request_id`。
- 若同一 `track_id` 最新快照狀態仍在 `created/queued/started/streaming/completed`，後端直接回傳既有 `stream_id/request_id`（避免重複開新流）。
- `GET /execution/status` 的 `replan_state` 來自最新 `repair_track` 快照狀態；`active_replan_stream_id` 僅在快照狀態不屬於 `persisted/failed/cancelled` 時返回。
- SSE 入口固定為 `GET /api/v1/streams/repair_track/:id`，初始 `ready` 事件內帶 `snapshots`，前端可據此做 reload/revisit 恢復。
- `replan / resume` 的實際執行服務在 `executionService`（路由由 `reconciliationController` 暴露），以此保持「方案協調入口 + 旅程執行能力」的分層。
- CTA 主映射（`execution.service.ts::buildJourneyActions`）：
  - `draft -> commit_plan`
  - `partner_invited -> view_invitation_status`
  - `solo_active/co_active -> continue_today_step`
  - `replanning -> replan_track`
  - `paused -> resume_track`
  - `completed -> review_completed_journey`
  - `closed -> review_history`
- CTA 次映射（`execution.service.ts::buildJourneyActions`）：
  - `draft -> review_direction`
  - `partner_invited -> continue_solo`
  - `solo_active/co_active/replanning -> pause_track`
  - `paused -> review_direction`
  - `completed/closed -> restart_new_round`

## 狀態轉移規則

1. `select`
  - 僅代表「我願意先開始」，不再代表全局唯一選定。
2. `respond`
  - `viewed`：invitee 已查看，不強制承諾
  - `committed`：invitee / initiator 都可進一步承諾
  - `deferred`：invitee 先保留空間，後端可記錄 `reason + remind_in_hours`
  - `declined`：僅改變邀請回應，不直接刪除旅程
  - `paused`：可由任一方暫停
3. `invite`
  - 在 `draft/partner_invited` 階段會維持或進入 `partner_invited`。
  - 若已進入運行態（`solo_active/co_active/paused/replanning/completed/closed`），邀請只更新邀請時間與通知，不覆蓋運行態。
4. `confirm`
  - 單人承諾時啟動 `solo_active`
  - 雙方都承諾時啟動 `co_active`
5. `checkin`
  - `step_result=done`：推進到下一步；若已最後一步則進入 `completed`
  - `needs_help=true` 或 `closeness=farther` 或 `stress=high`：標記 `needs_replan=true`，`journey_status=replanning`
6. `replan`
  - 提交後先回 `202 Accepted`，並產生 `repair_track` scope 的 AI stream
  - 若已有同 track 的進行中快照（`created/queued/started/streaming/completed`），回傳既有 stream，避免重複起任務
  - 不刪除舊版本，不重置歷史 checkin
  - 同一 `repair_track` 內將舊 active/pending step 標記為 `adapted`
  - AI 任務成功後生成新 plan version 並把 `track.plan_id` 指向新版本
  - AI 任務失敗時恢復原可執行狀態，舊版本仍可繼續
7. `pause`
  - 旅程轉為 `paused`，但保留所有歷史脈搏與步驟進度
8. `resume`
  - 由 `paused` 恢復回 `solo_active/co_active`

## 前端行為約束

- 判決頁：先選方向，再進方案旅程頁。
- 方案旅程頁：先展示主推薦，再展示最多兩個備選；若已有 `journey_entry.active_plan_id`，需優先給回到當前旅程的 CTA。
- 方案旅程頁必須容忍 legacy 陣列形狀或空 bundle，不得因 `plans` 缺失而崩潰。
- 方案詳情頁：主體是承諾工作台，不是純只讀文檔頁；invitee 打開頁面後需補 `viewed` 閉環。
- 方案詳情頁與修復看板需優先消費 `journey_context`，不得各頁自己重寫一套 `status -> CTA` 判斷。
- 每日一步頁：先問 `done/partial/skipped + closeness + stress + needs_help`，長文本反思退居次要。
- `journey_status=replanning` 時，前端需提供 `/execution/:planId/replan` 正式調整頁，而不是把重調塞回 checkin 表單。
- `replan` 頁必須處理 3 種狀態：提交前表單、AI 等待 phase、失敗後回退原版本。
- `replan` 頁 reload / revisit 時，需依 `execution.status.active_replan_stream_id` 與 `GET /streams/repair_track/:id` 的 snapshot 回恢復等待態。
- 每日一步頁必須在 `recent_checkins/records` 缺失時自動回退為空陣列，不得因舊 shape 失敗。
- dashboard：以 `journey_status + relationship_mode + pulse_summary + CTA hints` 為主，不再只看打卡次數。
- dashboard 對未知 `journey_status` 應忽略並回退空狀態，不得渲染空白頁。

## 回歸測試最小集

1. 判決後不同 `intent` 可生成不同方向的方案 bundle。
2. `select/respond` 後雙方承諾狀態、invitee 查看與婉拒都能正確回寫。
3. `confirm` 啟動旅程後，`GET /execution/status` 能返回 `current_step + pulse_summary + CTA hints`。
4. `checkin` 上報高壓或距離惡化時，`journey_status` 轉為 `replanning`，且 `/repair-tracks/:id/replan` 可產生新 version。
5. `resume` 能把 `paused` 旅程恢復到 `solo_active/co_active`。
6. `dashboard` 與單 plan 狀態口徑一致。

## 狀態標記

- 本模組接口狀態：`已更新至 Repair Journey 2.4`。
