# 接口描述：admin

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：接口詳規
**覆蓋範圍**：接口字段契約、錯誤碼、守衛與頁面對接：09-admin
**取證代碼入口**：`backend/src/app.ts`、`backend/src/routes`、`frontend/src/services/api`、`frontend-admin/src/services/api`
**最後核驗 Commit**：`70e3436`
**最後核驗日期**：`2026-04-19`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v2.5  
**最後更新**：2026-04-19  
**代碼基準**：`backend/src/routes/admin.routes.ts`、`backend/src/middleware/adminAuth.ts`、`frontend/src/services/api/admin.ts`

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
| `GET /api/v1/admin/reports/overview` | 無 | `data.totals(users/activePairings/cases/judgments/reconciliationPlans/executionCompleted/interviewCompleted) data.conversion(pairingRate/caseCreationRate/judgmentCompletionRate/caseCompletionRate)` | `FORBIDDEN` | `reports:read`，已由 admin reports 頁接線 |
| `GET /api/v1/admin/reports/funnel` | 無 | `data.stages[]`（`register/pairing/case/judgment/execution_complete`） | `FORBIDDEN` | `reports:read`，已由 admin reports 頁接線 |
| `GET /api/v1/admin/reports/costs` | 無 | `data.generatedAt data.currency data.partial data.reasons[] data.summary data.redis data.railway data.openai` | `FORBIDDEN` | `reports:read`，已由 admin reports 頁接線 |
| `GET /api/v1/admin/reports/ai-streams` | query `days?(1-90) limit?(1-50)` | `data.windowDays data.retentionPolicy data.totals data.byStatus data.byScopeType data.byBackendMode data.recentFailures[]` | `FORBIDDEN` `VALIDATION_ERROR` | `reports:read`，AI Stream 治理報表，已由 admin reports 頁接線 |
| `GET /api/v1/admin/reports/ai-streams/sessions` | query `days?(1-90) limit?(1-100) offset?(>=0) status? scopeType? scopeId? requestId? streamId? source?(live/archive/all)` | `data.source data.total data.limit data.offset data.items[]` | `FORBIDDEN` `VALIDATION_ERROR` | `reports:read`，AI Stream session 明細查詢 |
| `GET /api/v1/admin/reports/ai-streams/sessions/:streamId` | params `streamId` + query `eventLimit?(1-1000) source?(live/archive/all)` | `data.source(live/archive) data.session data.events[]` | `FORBIDDEN` `NOT_FOUND` `VALIDATION_ERROR` | `reports:read`，單條 stream 詳情 |
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
- `GET /api/v1/admin/reports/ai-streams` 直接讀取 `ai_stream_sessions / ai_stream_events / archives` 聚合結果，主要用於排障、驗收與保留策略校驗；現已由 Admin Reports 頁接線。
- `GET /api/v1/admin/reports/ai-streams/sessions` 與 `:streamId` 用於直接查看 live/archive 明細，避免只剩匯總報表。
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
| `PUT /api/v1/admin/alerts/rules` | `VALIDATION_ERROR` | 400 | 顯示規則 schema 錯誤 | 修正後重送 |
| `PUT /api/v1/admin/feature-flags` | `VALIDATION_ERROR` | 400 | 提示旗標格式錯誤 | 修正後重送 |
| `GET /api/v1/providers` / `POST /api/v1/providers/:providerKey/(estimate|test|images|videos)` | `FORBIDDEN` / `NOT_FOUND` / `VALIDATION_ERROR` | 403/404/400 | provider 面板顯示權限、配置或 providerKey 錯誤 | 修正配置後重試 |

## 狀態標記

- 本模組接口狀態以 [`全接口清單-主文檔.md`](../全接口清單-主文檔.md) 為唯一裁決口徑；本文件僅維護模組級字段契約與錯誤碼矩陣。
