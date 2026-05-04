# 接口描述：admin

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：接口詳規
**覆蓋範圍**：接口字段契約、錯誤碼、守衛與頁面對接：09-admin
**取證代碼入口**：`backend/src/app.ts`、`backend/src/routes`、`backend/src/controllers/admin.controller.ts`、`backend/src/services/cost-monitoring.service.ts`、`backend/src/services/notification.service.ts`、`backend/src/services/product-state-recovery-task.service.ts`、`backend/src/utils/case-classifier.ts`、`backend/src/utils/validation.ts`、`backend/prisma/schema.prisma`、`backend/prisma/migrations/20260504164500_add_notification_cancelled_status/migration.sql`、`backend/prisma/migrations/20260504173000_add_product_state_recovery_tasks/migration.sql`、`frontend/src/services/api`、`frontend-admin/src/services/api`
**最後核驗 Commit**：`a2dea6b`
**最後核驗日期**：`2026-05-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v2.12
**最後更新**：2026-05-04
**代碼基準**：`backend/src/routes/admin.routes.ts`、`backend/src/controllers/admin.controller.ts`、`backend/src/middleware/adminAuth.ts`、`backend/src/utils/case-classifier.ts`、`frontend/src/services/api/admin.ts`

---

## 模組定位

- 運維與治理域：配置、作業、審計、用戶治理、報表、告警、旗標。
- 權限模型為 RBAC 字串檢查，權限不足直接 403。

## 接口契約（字段級，按能力組）

### A. 身份與初始化

| API | Request | Success（前端使用） | 常見錯誤碼 | 權限/副作用 |
|---|---|---|---|---|
| `POST /api/v1/admin/bootstrap` | `email password name roleKey?` | 初始化結果（保留） | `FORBIDDEN` `VALIDATION_ERROR` | 建立首個 admin（候選） |
| `POST /api/v1/admin/login` | `email password` | `data.token` `data.admin` | `INVALID_CREDENTIALS` | 簽發 admin token |
| `GET /api/v1/admin/me` | header `Authorization` | `data.admin.permissions[]` | `UNAUTHORIZED` | 恢復會話與權限 |

### B. 作業與配置

| API | Request | Success（前端使用） | 常見錯誤碼 | 權限/副作用 |
|---|---|---|---|---|
| `GET /api/v1/admin/jobs` | 無 | `data.jobs[]` | `FORBIDDEN` | 需 `ops:read`，作業列表與最近執行紀錄 |
| `GET /api/v1/admin/jobs/stats` | query `days includeRunning maxRows` | `data.totals data.perJob data.dailyBuckets` | `VALIDATION_ERROR` | 需 `ops:read` |
| `POST /api/v1/admin/jobs/:jobKey/trigger` | `jobKey` | `data.status triggeredAt` | `FORBIDDEN` | 需 `ops:execute`，觸發任務 |
| `GET /api/v1/admin/health/detailed` | 無 | `data.status data.timestamp data.cronStarted data.activeJobCount data.adminCount data.userCount data.performance data.env` | `FORBIDDEN` | 需 `ops:read`，詳細健康檢查 |
| `GET /api/v1/admin/configs` | query `limit offset` | `data.items[]` | `FORBIDDEN` | 需 `config:read` |
| `PUT /api/v1/admin/configs` | `key value description? isRuntime? isSensitive?` | `data.item` | `VALIDATION_ERROR` | 需 `config:write`，配置落庫 |
| `PUT /api/v1/admin/alerts/rules` | `rules[]` | `data.item` | `VALIDATION_ERROR` | 需 `alerts:write + ops:execute` |
| `PUT /api/v1/admin/feature-flags` | `flags{}` | `data.item` | `VALIDATION_ERROR` | 需 `config:write` |

### C. 用戶與審計治理

| API | Request | Success（前端使用） | 常見錯誤碼 | 權限/副作用 |
|---|---|---|---|---|
| `GET /api/v1/admin/users` | query `q limit offset` | `data.items[]` | `FORBIDDEN` | `users:read` |
| `GET /api/v1/admin/users/:userId` | `userId(uuid)` | `data.user` | `NOT_FOUND` | `users:read` |
| `PATCH /api/v1/admin/users/:userId/status` | `action(lock/unlock/deactivate/activate) lockMinutes?` | `data.user` | `VALIDATION_ERROR` | `users:write`，更新帳號狀態 |
| `GET /api/v1/admin/audit-logs` | query `entityType action from to limit offset` | `data.items[]` | `FORBIDDEN` | `users:read + ops:read` |
| `GET /api/v1/admin/audit-logs.csv` | query `entityType action from to limit offset`（同 `/audit-logs`） | blob | `FORBIDDEN` | 匯出審計 |

### D. Admin 帳號與報表

| API | Request | Success（前端使用） | 常見錯誤碼 | 權限/副作用 |
|---|---|---|---|---|
| `GET /api/v1/admin/admin-users` | query `q? limit? offset?` | `data.items[]` | `FORBIDDEN` | `admin:all`，管理後台帳號列表 |
| `POST /api/v1/admin/admin-users` | `email password name roleKey` | `data.item` | `VALIDATION_ERROR` `FORBIDDEN` | `admin:all`，建立後台帳號 |
| `PATCH /api/v1/admin/admin-users/:adminUserId` | `name? roleKey? isActive? password?` | `data.item` | `VALIDATION_ERROR` `FORBIDDEN` `NOT_FOUND` | `admin:all`，更新後台帳號 |
| `DELETE /api/v1/admin/admin-users/:adminUserId` | `adminUserId(uuid)` | `data.item` | `FORBIDDEN` `NOT_FOUND` | `admin:all`，刪除後台帳號 |
| `POST /api/v1/admin/reports/custom` | `metrics[]`（`dau/mau/judgment_failed`，`1-20`） | `data.metrics{}` | `FORBIDDEN` `VALIDATION_ERROR` | `reports:read` |
| `GET /api/v1/admin/reports/overview.csv` | 無 | `blob`（CSV：`metric,value`，當前輸出 `users/cases/judgments`） | `FORBIDDEN` | `reports:read` |
| `GET /api/v1/admin/reports/overview` | 無 | `data.totals(users/activePairings/cases/judgments/reconciliationPlans/executionCompleted/interviewCompleted) data.productFlows array: quick_single, quick_collaborative, formal_remote, formal_collaborative, chat_to_case with count+ratio; data.productFlowOperationalSignals[]`（每組含 `stuckInProgressCases/judgmentFailedCases/attentionCases/notificationRecallReviewRequired`）；`data.conversion(pairingRate/caseCreationRate/judgmentCompletionRate/caseCompletionRate)` | `FORBIDDEN` | `reports:read`，已由 admin reports 頁接線 |
| `GET /api/v1/admin/reports/funnel` | 無 | `data.stages[]`（`register/pairing/case/judgment/execution_complete`）; `data.productFlowStages[]`（固定 `quick_single / quick_collaborative / formal_remote / formal_collaborative / chat_to_case`，每組含 `case/judgment/execution_complete` 與 `judgmentCompletionRate/executionCompletionRate`） | `FORBIDDEN` | `reports:read`，已由 admin reports 頁接線 |
| `GET /api/v1/admin/reports/costs` | 無 | `data.generatedAt data.currency data.partial data.reasons[] data.summary data.redis data.railway data.openai`；`data.openai.ledger.source=ai_request_ledger`，含 `requestCount24h/7d`、`input/output/totalTokens24h/7d`、`productFlows[]`（`productFlow/requestCount*/succeededRequests7d/failedRequests7d/cancelledRequests7d/tokens*/costUsd24h/7d/costSource`） | `FORBIDDEN` | `reports:read`，已由 admin reports 頁接線；ledger breakdown 不把 organization cost 假分攤 |
| `GET /api/v1/admin/reports/ai-streams` | query `days?(1-90) limit?(1-50)` | `data.windowDays data.retentionPolicy data.totals data.byStatus data.byScopeType data.byBackendMode data.recentFailures[]` | `FORBIDDEN` `VALIDATION_ERROR` | `reports:read`，AI Stream 治理報表，已由 admin reports 頁接線 |
| `GET /api/v1/admin/reports/ai-streams/sessions` | query `days?(1-90) limit?(1-100) offset?(>=0) status? scopeType? scopeId? requestId? streamId? source?(live/archive/all)` | `data.source data.total data.limit data.offset data.items[]` | `FORBIDDEN` `VALIDATION_ERROR` | `reports:read`，AI Stream session 明細查詢 |
| `GET /api/v1/admin/reports/ai-streams/sessions/:streamId` | params `streamId` + query `eventLimit?(1-1000) source?(live/archive/all)` | `data.source(live/archive) data.session data.events[]` | `FORBIDDEN` `NOT_FOUND` `VALIDATION_ERROR` | `reports:read`，單條 stream 詳情 |
| `GET /api/v1/admin/notifications` | query `status?(pending/sent/failed/cancelled) template_code? user_id? dedup_key? limit? offset?` | `data.items[] data.total data.limit data.offset`；item 包含通知狀態、`dedup_key`、`user{id,email}`、`render_payload.product_flow` | `FORBIDDEN` `VALIDATION_ERROR` | `reports:read`，Admin 通知排查列表 |
| `POST /api/v1/admin/notifications/:notificationId/cancel` | `notificationId(uuid)` `reason?` | `data.notification.status=cancelled` | `FORBIDDEN` `VALIDATION_ERROR` `NOT_FOUND` | `ops:execute`；只允許 pending，會寫 audit log，並以 `status=cancelled + error_message=admin_cancelled:*` 退出發送隊列 |
| `POST /api/v1/admin/notifications/bulk-cancel` | `filters{template_code?/user_id?/dedup_key?/group_key?}`（至少一項） `reason?` `limit?(1-100)` | `data.matchedCount data.cancelledCount data.notificationIds[] data.items[]` | `FORBIDDEN` `VALIDATION_ERROR` | `ops:execute`；只查最多 100 條 pending 並按 id 集合取消，會寫 batch audit log |
| `POST /api/v1/admin/notifications/:notificationId/retry` | `notificationId(uuid)` `reason?` | `data.notification.status=pending` | `FORBIDDEN` `VALIDATION_ERROR` `NOT_FOUND` | `ops:execute`；只允許真正 failed 通知重送，會清空 `error_message/sent_at` 並排回 pending；`cancelled` 與 legacy `failed + admin_cancelled:*` 不可重送 |
| `GET /api/v1/admin/product-state/recovery-tasks` | query `status?(manual_review_required/in_review/resolved/dismissed) severity?(warning/critical) entity_type? entity_id? product_flow? source? proposal_id? limit? offset?` | `data.items[] data.total data.limit data.offset data.summary.byStatus data.summary.bySeverity` | `FORBIDDEN` `VALIDATION_ERROR` | `ops:read`；只讀人工恢復任務，不修改業務資料 |
| `PATCH /api/v1/admin/product-state/recovery-tasks/:taskId/status` | `taskId(uuid)` `status(manual_review_required/in_review/resolved/dismissed)` `reason?` | `data.task` | `FORBIDDEN` `VALIDATION_ERROR` `NOT_FOUND` | `ops:execute`；只更新 recovery task 狀態與 `resolved_at/dismissed_at`，寫 `audit_logs(entity_type=product_state_recovery_task, action=update_status)` |
| `GET /api/v1/admin/runtime/interview` | 無 | `data.defaults data.runtime data.source` | `FORBIDDEN` | `config:read`，訪談運行時設定，已由 admin settings 頁接線 |
| `GET /api/v1/providers` | query `providerType?` | `data.items[]` | `FORBIDDEN` `VALIDATION_ERROR` | `config:read`，media provider 目錄與配置檢視 |
| `POST /api/v1/providers/:providerKey/estimate` | `count? durationSeconds? pricingOverride?` | `data.billingUnit data.unitPriceUsd data.unitCount data.totalCostUsd` | `FORBIDDEN` `VALIDATION_ERROR` `NOT_FOUND` | `config:read`，試算 media provider 成本 |
| `POST /api/v1/providers/:providerKey/test` | `apiKey?/api_key? baseUrl?/base_url? timeoutMs?/timeout_ms? model? count? durationSeconds? sourceImageUrl?/source_image_url? prompt?` | `data.providerKey data.success data.message data.latencyMs data.detail?` | `FORBIDDEN` `VALIDATION_ERROR` `NOT_FOUND` | `config:write`，供應商健康探針 |
| `POST /api/v1/providers/:providerKey/images` | `prompt model? count? width? height? apiKey?/api_key? baseUrl?/base_url? timeoutMs?/timeout_ms?` | `data.providerKey data.requestId data.assets[] data.raw?` | `FORBIDDEN` `VALIDATION_ERROR` `NOT_FOUND` | `config:write`，執行圖片生成驗證 |
| `POST /api/v1/providers/:providerKey/videos` | `prompt model? durationSeconds? sourceImageUrl?/source_image_url? apiKey?/api_key? baseUrl?/base_url? timeoutMs?/timeout_ms?` | `data.providerKey data.requestId data.assets[] data.raw?` | `FORBIDDEN` `VALIDATION_ERROR` `NOT_FOUND` | `config:write`，執行視頻生成驗證 |

## 操作級規則（深水區）

- Admin token 與 user token 完全隔離，且優先存於 `sessionStorage`（降低長期暴露）。
- Admin API 的 401 處理與前台不同：`INVALID_CREDENTIALS` 不清 token，不應觸發全域導轉。
- CSV 下載鏈路（audit/reports）是運維高風險點，需回歸 responseType 與文件內容。
- `reports/overview.productFlows[]`、`reports/overview.productFlowOperationalSignals[]` 與 `reports/funnel.productFlowStages[]` 使用 `backend/src/utils/case-classifier.ts` 的產品流口徑，固定輸出 `quick_single / quick_collaborative / formal_remote / formal_collaborative / chat_to_case`；Admin/analytics 不得用 `case.mode` 另行推斷四主線分布、營運卡點或漏斗。`productFlowOperationalSignals` 目前以超過 30 分鐘仍在 `in_progress` 的 case 與 `judgment_failed` case 作為保守人工 review / 通知召回複核訊號，不自動改資料或自動重送通知。
- `reports/costs.openai` 同時保留 OpenAI organization costs/usage API 的聚合成本與 `ai_request_ledger` 的 request/scope/token breakdown；`openai.ledger.productFlows[]` 只代表 CJ 內部 ledger 口徑，`costSource=not_allocated` 時不得把 organization cost 按 token 或 request 數假分攤。只有當 ledger row 自身有 `cost_usd` 時，`costSource=ledger_cost_usd` 才可視為 request-level 成本來源。
- `GET /api/v1/admin/reports/ai-streams` 直接讀取 `ai_stream_sessions / ai_stream_events / archives` 聚合結果，主要用於排障、驗收與保留策略校驗；現已由 Admin Reports 頁接線。
- `GET /api/v1/admin/reports/ai-streams/sessions` 與 `:streamId` 用於直接查看 live/archive 明細，避免只剩匯總報表。
- `GET /api/v1/admin/notifications` 使用 `NotificationService.normalize()` 同一渲染口徑，Admin 不得自行從 template/path 推斷產品流；取消 pending 通知必須走 `POST /admin/notifications/:notificationId/cancel`，批量召回 pending 通知必須走 `POST /admin/notifications/bulk-cancel`，重送真正 failed 通知必須走 `POST /admin/notifications/:notificationId/retry`，三者都由 audit log 記錄操作者、reason、template/dedup/group/user 篩選與結果。批量召回必須提供至少一項篩選條件，單次最多處理 100 條，且後端會先查出通知 id 再按 id 集合更新，避免無條件掃表。`NotificationStatus.cancelled` 是正式人工取消狀態；legacy `failed + admin_cancelled:*` 僅作歷史兼容，同樣不可被 retry 重新排回 pending。
- Product-state recovery task API 只承接 `ops:product-state:audit:persist` 生成的人工任務；`PATCH /product-state/recovery-tasks/:taskId/status` 不會更新 case、chat、judgment 或 repair track。`resolved` 只寫 `resolved_at`、`dismissed` 只寫 `dismissed_at`，所有狀態變更必須透過 audit log 留痕。
- `cleanup_ai_stream_persistence` 已加入排程任務，會先 archive 再 delete；如需立即驗證清理策略，可透過既有 `POST /api/v1/admin/jobs/:jobKey/trigger` 手動觸發。
- Admin `Configs` 與 `Settings` 頁目前都以 `listConfigs({ limit: 100, offset: 0 })` 拉取配置列表，避免首屏拉取過大集合；如需翻頁能力須同步回寫前台查詢與本文件契約。

## 回歸測試最小集

1. login -> me -> 權限菜單顯示一致。  
2. 低權限帳號訪問高權限接口應穩定 403。  
3. 配置修改後對應運行時行為可觀察。  
4. audit csv / report csv 下載成功且格式正常。  

## 錯誤碼覆蓋矩陣（API -> code -> UI 行為）

| API | error.code | HTTP | UI 行為 | 重試策略 |
|---|---|---:|---|---|
| `POST /api/v1/admin/login` | `INVALID_CREDENTIALS` | 401 | 留在登入頁提示錯誤，不清其他本地狀態 | 修正帳密後重送 |
| `GET /api/v1/admin/me` | `UNAUTHORIZED` | 401 | 清 admin token 並返回 `/admin/login` | 登入後重拉 |
| `GET /api/v1/admin/jobs` | `FORBIDDEN` | 403 | 隱藏任務列表與手動觸發入口 | 不重試，申請權限 |
| `GET /api/v1/admin/jobs/stats` | `VALIDATION_ERROR` | 400 | 提示 query 參數錯誤 | 修正參數後重拉 |
| `POST /api/v1/admin/jobs/:jobKey/trigger` | `FORBIDDEN` | 403 | 顯示無執行權限 | 不重試，申請權限 |
| `POST /api/v1/admin/jobs/:jobKey/trigger` | `NOT_FOUND` | 404 | 提示任務不存在或不支援手動觸發 | 刷新任務列表後重試 |
| `GET /api/v1/admin/configs` | `FORBIDDEN` | 403 | 配置頁切唯讀或禁用 | 不重試 |
| `PUT /api/v1/admin/configs` | `VALIDATION_ERROR` | 400 | 提示 key/value 不合法 | 修正後重送 |
| `PUT /api/v1/admin/configs` | `FORBIDDEN` | 403 | 顯示權限不足 | 不重試 |
| `PATCH /api/v1/admin/users/:userId/status` | `VALIDATION_ERROR` | 400 | 高亮 action/lockMinutes | 修正後重送 |
| `PATCH /api/v1/admin/users/:userId/status` | `NOT_FOUND` | 404 | 提示目標用戶不存在 | 刷新列表後再操作 |
| `GET /api/v1/admin/audit-logs(.csv)` | `FORBIDDEN` | 403 | 提示無審計權限 | 不重試 |
| `GET /api/v1/admin/admin-users` / `POST /api/v1/admin/admin-users` / `PATCH /api/v1/admin/admin-users/:adminUserId` / `DELETE /api/v1/admin/admin-users/:adminUserId` | `FORBIDDEN` | 403 | 關閉管理員治理按鈕 | 不重試 |
| `POST /api/v1/admin/reports/custom` | `FORBIDDEN` | 403 | 顯示無自定義報表權限 | 不重試 |
| `POST /api/v1/admin/reports/custom` | `VALIDATION_ERROR` | 400 | 提示 metrics 列表不合法 | 修正後重送 |
| `GET /api/v1/admin/reports/ai-streams` | `FORBIDDEN` | 403 | 顯示無 AI Stream 報表權限 | 不重試 |
| `GET /api/v1/admin/reports/ai-streams/sessions` | `FORBIDDEN` | 403 | 顯示無 AI Stream 查詢權限 | 不重試 |
| `GET /api/v1/admin/reports/ai-streams/sessions/:streamId` | `NOT_FOUND` | 404 | 提示 stream 不存在或已被清理 | 可切換 source 後重查 |
| `GET /api/v1/admin/reports/overview.csv` | `FORBIDDEN` | 403 | 顯示無報表權限 | 不重試 |
| `GET /api/v1/admin/product-state/recovery-tasks` | `FORBIDDEN` / `VALIDATION_ERROR` | 403/400 | 顯示無運維讀取權限或提示查詢條件錯誤 | 修正查詢或申請權限 |
| `PATCH /api/v1/admin/product-state/recovery-tasks/:taskId/status` | `FORBIDDEN` / `VALIDATION_ERROR` / `NOT_FOUND` | 403/400/404 | 禁用狀態操作、提示狀態不合法或任務不存在 | 刷新列表後再操作 |
| `PUT /api/v1/admin/alerts/rules` | `VALIDATION_ERROR` | 400 | 顯示規則 schema 錯誤 | 修正後重送 |
| `PUT /api/v1/admin/feature-flags` | `VALIDATION_ERROR` | 400 | 提示旗標格式錯誤 | 修正後重送 |
| `GET /api/v1/providers` / `POST /api/v1/providers/:providerKey/(estimate|test|images|videos)` | `FORBIDDEN` / `NOT_FOUND` / `VALIDATION_ERROR` | 403/404/400 | provider 面板顯示權限、配置或 providerKey 錯誤 | 修正配置後重試 |

## 狀態標記

- 本模組接口狀態以 [`全接口清單-主文檔.md`](../全接口清單-主文檔.md) 為唯一裁決口徑；本文件僅維護模組級字段契約與錯誤碼矩陣。
