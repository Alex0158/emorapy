# 接口描述：admin

**文檔版本**：v2.5  
**最後更新**：2026-04-04  
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
| `GET /api/v1/admin/jobs/stats` | query `days includeRunning maxRows` | `data.totals data.perJob data.dailyBuckets` | `VALIDATION_ERROR` | 需 `ops:read` |
| `POST /api/v1/admin/jobs/:jobKey/trigger` | `jobKey` | `data.status triggeredAt` | `FORBIDDEN` | 需 `ops:execute`，觸發任務 |
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
| `GET /api/v1/admin/audit-logs.csv` | 同上 | blob | `FORBIDDEN` | 匯出審計 |

### D. Admin 帳號與報表

| API | Request | Success（前端使用） | 常見錯誤碼 | 權限/副作用 |
|---|---|---|---|---|
| `GET/POST/PATCH/DELETE /api/v1/admin/admin-users*` | `adminUserId?` + create/update body | `data.item/items` | `VALIDATION_ERROR` `FORBIDDEN` | `admin:all`，管理後台帳號 |
| `POST /api/v1/admin/reports/custom` | `metrics[]` | `data.metrics{}` | `VALIDATION_ERROR` | `reports:read` |
| `GET /api/v1/admin/reports/overview.csv` | 無 | blob | `FORBIDDEN` | `reports:read` |
| `GET /api/v1/admin/reports/overview|funnel|costs` | 無 | 報表資料 | `FORBIDDEN` | `reports:read`，已由 admin reports 頁接線 |
| `GET /api/v1/admin/reports/ai-streams` | query `days? limit?` | `data.windowDays data.retentionPolicy data.totals data.byStatus data.byScopeType data.byBackendMode data.recentFailures[]` | `FORBIDDEN` `VALIDATION_ERROR` | `reports:read`，AI Stream 治理報表，已由 admin reports 頁接線 |
| `GET /api/v1/admin/reports/ai-streams/sessions` | query `days? limit? offset? status? scopeType? scopeId? requestId? streamId? source?` | `data.items[] data.total data.source` | `FORBIDDEN` `VALIDATION_ERROR` | `reports:read`，AI Stream session 明細查詢 |
| `GET /api/v1/admin/reports/ai-streams/sessions/:streamId` | params `streamId` + query `eventLimit? source?` | `data.source data.session data.events[]` | `FORBIDDEN` `NOT_FOUND` `VALIDATION_ERROR` | `reports:read`，單條 stream 詳情 |
| `GET /api/v1/admin/health/detailed` / `GET /jobs` / `GET /runtime/interview` | 無 | 運維資料（保留） | `FORBIDDEN` | 候選接口，未前台接線 |

## 操作級規則（深水區）

- Admin token 與 user token 完全隔離，且優先存於 `sessionStorage`（降低長期暴露）。
- Admin API 的 401 處理與前台不同：`INVALID_CREDENTIALS` 不清 token，不應觸發全域導轉。
- CSV 下載鏈路（audit/reports）是運維高風險點，需回歸 responseType 與文件內容。
- `GET /api/v1/admin/reports/ai-streams` 直接讀取 `ai_stream_sessions / ai_stream_events / archives` 聚合結果，主要用於排障、驗收與保留策略校驗；現已由 Admin Reports 頁接線。
- `GET /api/v1/admin/reports/ai-streams/sessions` 與 `:streamId` 用於直接查看 live/archive 明細，避免只剩匯總報表。
- `cleanup_ai_stream_persistence` 已加入排程任務，會先 archive 再 delete；如需立即驗證清理策略，可透過既有 `POST /api/v1/admin/jobs/:jobKey/trigger` 手動觸發。

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
| `GET /api/v1/admin/jobs/stats` | `VALIDATION_ERROR` | 400 | 提示 query 參數錯誤 | 修正參數後重拉 |
| `POST /api/v1/admin/jobs/:jobKey/trigger` | `FORBIDDEN` | 403 | 顯示無執行權限 | 不重試，申請權限 |
| `GET /api/v1/admin/configs` | `FORBIDDEN` | 403 | 配置頁切唯讀或禁用 | 不重試 |
| `PUT /api/v1/admin/configs` | `VALIDATION_ERROR` | 400 | 提示 key/value 不合法 | 修正後重送 |
| `PUT /api/v1/admin/configs` | `FORBIDDEN` | 403 | 顯示權限不足 | 不重試 |
| `PATCH /api/v1/admin/users/:userId/status` | `VALIDATION_ERROR` | 400 | 高亮 action/lockMinutes | 修正後重送 |
| `PATCH /api/v1/admin/users/:userId/status` | `NOT_FOUND` | 404 | 提示目標用戶不存在 | 刷新列表後再操作 |
| `GET /api/v1/admin/audit-logs(.csv)` | `FORBIDDEN` | 403 | 提示無審計權限 | 不重試 |
| `GET/POST/PATCH/DELETE /api/v1/admin/admin-users*` | `FORBIDDEN` | 403 | 關閉管理員治理按鈕 | 不重試 |
| `POST /api/v1/admin/reports/custom` | `VALIDATION_ERROR` | 400 | 提示 metrics 列表不合法 | 修正後重送 |
| `GET /api/v1/admin/reports/ai-streams` | `FORBIDDEN` | 403 | 顯示無 AI Stream 報表權限 | 不重試 |
| `GET /api/v1/admin/reports/ai-streams/sessions` | `FORBIDDEN` | 403 | 顯示無 AI Stream 查詢權限 | 不重試 |
| `GET /api/v1/admin/reports/ai-streams/sessions/:streamId` | `NOT_FOUND` | 404 | 提示 stream 不存在或已被清理 | 可切換 source 後重查 |
| `GET /api/v1/admin/reports/overview.csv` | `FORBIDDEN` | 403 | 顯示無報表權限 | 不重試 |
| `PUT /api/v1/admin/alerts/rules` | `VALIDATION_ERROR` | 400 | 顯示規則 schema 錯誤 | 修正後重送 |
| `PUT /api/v1/admin/feature-flags` | `VALIDATION_ERROR` | 400 | 提示旗標格式錯誤 | 修正後重送 |

## 狀態標記

- 已使用：18
- 候選廢棄：9
