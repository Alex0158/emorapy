# 熊媽媽法庭 - API文檔

## 基礎信息

- **Base URL**: `http://localhost:3001/api/v1`
- **認證方式**: JWT Token (Bearer Token)
- **響應格式**: JSON

## 統一響應格式

### 成功響應
```json
{
  "success": true,
  "data": {},
  "message": "操作成功",
  "meta": {
    "request_id": "uuid",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### 錯誤響應
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "錯誤描述",
    "details": {}
  }
}
```

## 認證相關

### 1. 用戶註冊
**POST** `/auth/register`

**請求體**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "nickname": "用戶暱稱"
}
```

### 2. 用戶登錄
**POST** `/auth/login`

**請求體**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### 3. 發送驗證碼
**POST** `/auth/send-verification-code`

**請求體**:
```json
{
  "email": "user@example.com",
  "type": "register"
}
```

## Session管理（快速體驗模式）

### 1. 創建 Session
**POST** `/sessions/quick`

**響應**:
```json
{
  "success": true,
  "data": {
    "session_id": "guest_1704067200_abc123",
    "expires_at": "2024-01-02T00:00:00Z"
  }
}
```

### 2. 新建 Session
**POST** `/sessions/refresh`

> 當前端檢測到 Session 失效時可直接呼叫；此接口會**新建** Session 並返回新 Session ID（非續期同一 Session）。
> 舊案件需用原 Session 才能訪問；判決生成成功後，後端會將該 Session 有效期延長至 7 天。

## 案件相關

### 1. 創建案件（快速體驗模式）
**POST** `/cases/quick`

**請求頭**:
```
X-Session-Id: guest_1704067200_abc123
```

**請求體**:
```json
{
  "plaintiff_statement": "發生了什麼事？我的感受是什麼？我希望對方怎麼做？",
  "defendant_statement": "發生了什麼事？我的感受是什麼？我希望對方怎麼做？",
  "evidence_urls": ["https://..."]
}
```

### 2. 創建案件（完整模式）
**POST** `/cases`

**請求頭**:
```
Authorization: Bearer <token>
```

**請求體**:
```json
{
  "pairing_id": "uuid",
  "plaintiff_statement": "...",
  "defendant_statement": "...",
  "evidence_urls": ["https://..."]
}
```

### 3. 案件列表
**GET** `/cases`

**查詢參數**：`status`、`type`、`page`、`page_size`（默認 10）、`sort_by`（默認 created_at）、`sort_order`（默認 desc）、`search`

**響應**：`{ cases: [...], pagination: { page, page_size, total, total_pages } }`

### 4. 獲取案件詳情
**GET** `/cases/:id`

**查詢參數**（快速體驗模式）:
```
?session_id=guest_1704067200_abc123
```

### 5. 更新案件
**PUT** `/cases/:id`

**請求體**（所有欄位可選）：
```json
{
  "title": "...",
  "plaintiff_statement": "...",
  "defendant_statement": "..."
}
```
> 僅 draft / submitted / in_progress 狀態可更新。原告可更新 title + plaintiff_statement，被告可更新 defendant_statement。

### 6. 提交案件
**POST** `/cases/:id/submit`

> 將案件從 draft 推進到 submitted。僅案件所有者（原告）可提交。

### 7. 上傳證據
**POST** `/cases/:id/evidence`

**Content-Type**: `multipart/form-data`

**表單數據**:
- `files`: 文件（最多3個）
> 上傳僅允許案件狀態為 `draft` / `submitted` / `in_progress`；判決完成後關閉上傳。

### 8. 刪除證據
**DELETE** `/cases/:id/evidence/:evidenceId`

> 權限：完整模式需當事人；快速體驗需 session_id/頭部 X-Session-Id。

### 6. 上傳頭像
**POST** `/user/avatar`

**Content-Type**: `multipart/form-data`

**表單數據**:
- `avatar`: 圖片文件（將自動壓縮）

> 返回的證據/頭像 URL 為簽名鏈接，含過期與路徑校驗；請直接使用返回值，不要存裸鏈接。

## 判決相關

### 1. 生成判決
**POST** `/judgments/generate/:id`

**說明**: `:id` 為案件ID
> 權限：必須為案件當事人；快速體驗可用 session_id 特判。判決失敗可重試（前端需提供入口）。

### 2. 獲取判決詳情
**GET** `/judgments/:id`

**說明**: `:id` 為判決ID  
**返回重點字段**：`judgment_content`、`summary`、`plaintiff_ratio`、`defendant_ratio`（同時向後兼容 `responsibility_ratio {plaintiff, defendant}`）、`user1_acceptance`、`user2_acceptance`、`user1_rating`、`user2_rating`

**judgment_content 格式**（Markdown，後端已標準化）：
```
## ⚖️ 判決結果
**責任分比例**：
- 原告：X% 責任
- 被告：Y% 責任

### 問題分析
### 判決理由
### 具體建議
### 關係修復建議
```
> `summary` 為 50-80 字純文字摘要，不含標題與條列。

## 和好方案相關

### 1. 生成和好方案
**POST** `/judgments/:id/reconciliation-plans`

**請求體**（可選）:
```json
{
  "preferences": {
    "difficulty": "easy",
    "duration": 7,
    "types": ["activity", "communication", "intimacy", "gift", "service"]
  }
}
```

### 2. 獲取和好方案列表
**GET** `/judgments/:id/reconciliation-plans`

**查詢參數**:
```
?difficulty=easy&type=activity|communication|intimacy|gift|service
```

### 3. 選擇和好方案
**POST** `/reconciliation-plans/:id/select`
> 判決詳情頁應提供「生成方案」入口；方案生成後可選擇並進入執行。

## 執行相關

### 1. 確認執行
**POST** `/execution/confirm`

**請求體**:
```json
{
  "plan_id": "uuid"
}
```

### 2. 執行打卡
**POST** `/execution/checkin`

> 前端可附帶照片；後端已支持 `photos_urls`。

**請求體**:
```json
{
  "plan_id": "uuid",
  "notes": "執行感受...",
  "photos": ["https://..."]
}
```

### 3. 獲取執行狀態
**GET** `/execution/status?plan_id=uuid`

> 提示：系統會根據打卡進度自動計算進度並在達到預期天數時標記完成。

### 4. 執行總覽
**GET** `/execution/dashboard`

**響應**：`{ executions: [{ plan_id, plan_title, status, progress, last_checkin_at }] }`

> 獲取當前用戶所有方案的執行狀態彙總，用於 Dashboard 頁面。

---

## 個人/關係檔案

### 1. 獲取/更新個人背景
- **GET** `/profile/me`
- **PUT** `/profile/me`
  - 請求體：`user_profiles` 對應字段（教育、文化、宗教、性格等，可部分更新）

### 2. 獲取/更新關係檔案
- **GET** `/profile/relationship/:pairingId`
- **PUT** `/profile/relationship/:pairingId`
  - 請求體：`relationship_profiles` 對應字段（階段、里程碑、喜好、雷點等）

> 均需登入；會驗證用戶是否為該配對成員。

---

## 內容推薦/等待區

### 1. 列表內容
**GET** `/content-items`
- 查詢：`type`、`tags=tag1,tag2`、`language`、`is_active`、`limit`

### 2. 案件推薦內容
**GET** `/content-items/recommendations/:caseId?relation=recommend`

### 3. 關聯內容到案件（需登入）
**POST** `/content-links`
```json
{ "case_id": "uuid", "content_id": "uuid", "relation": "recommend|similar|waiting" }
```

---

## 通知

### 1. 查詢通知
**GET** `/notifications?status=pending|sent|failed` （需登入）

### 2. 新增通知記錄
**POST** `/notifications` （需登入）
```json
{
  "channel": "email",
  "template_code": "judgment_ready",
  "payload": { "case_id": "uuid" },
  "dedup_key": "case-uuid-judgment"
}
```

## 🛠️ 管理員後台（運維）

### 認證與身份

- `POST /admin/bootstrap`：初始化首個管理員（需 `X-Admin-Bootstrap-Token`）
- `POST /admin/login`：管理員登入，返回 `token + admin`
- `GET /admin/me`：獲取當前管理員身份與權限

### 健康、任務與配置

- `GET /admin/health/detailed`：後台健康度（DB、cron、性能統計）
- `GET /admin/jobs`：任務列表與最近一次執行
- `POST /admin/jobs/:jobKey/trigger`：手動觸發任務（`ops:execute`）
- `GET /admin/jobs/stats`：任務統計（見下節）
- `GET /admin/configs`：配置列表（敏感值遮罩）
- `PUT /admin/configs`：配置新增/更新（白名單+跨欄位規則）
- `GET /admin/runtime/interview`：訪談運行時配置（default/runtime）

### 用戶與審計

- `GET /admin/users`：用戶列表（支持 `q/limit/offset`）
- `GET /admin/users/:userId`：單用戶詳情（profile、pairings、cases）
- `PATCH /admin/users/:userId/status`：用戶狀態操作（lock/unlock/activate/deactivate）
- `GET /admin/audit-logs`：審計列表（支持 `entityType/action/from/to`）
- `GET /admin/audit-logs.csv`：審計導出 CSV（同篩選條件）
- 審計端點權限策略：`users:read` + `ops:read`（AND）

### 報表、告警與旗標

- `GET /admin/reports/overview`：總覽指標
- `GET /admin/reports/funnel`：漏斗指標
- `GET /admin/reports/costs`：成本監控（Redis / Railway egress / OpenAI，可能 `partial=true`）
- `GET /admin/reports/overview.csv`：總覽 CSV
- `POST /admin/reports/custom`：自定義指標（如 `dau/mau/judgment_failed`）
  - `metrics` 僅允許：`dau`、`mau`、`judgment_failed`
- `PUT /admin/alerts/rules`：告警規則
- `PUT /admin/feature-flags`：功能旗標
- 告警規則端點權限策略：`alerts:write` + `ops:execute`（AND）

### 管理員帳號治理（`admin:all`）

- `GET /admin/admin-users`：管理員列表
- `POST /admin/admin-users`：新增管理員
- `PATCH /admin/admin-users/:adminUserId`：更新管理員（角色、啟用、重置密碼）
- `DELETE /admin/admin-users/:adminUserId`：軟刪除管理員（停用並記錄審計）
  - 安全護欄：不可自刪、不可停用自己、不可降級/刪除最後一位啟用中的 `super_admin`

### Cron 統計（dashboard-ready）
**GET** `/admin/jobs/stats`（需 Admin JWT + `ops:read`）

**查詢參數**：
- `days`：回溯天數，`1~90`，默認 `7`
- `includeRunning`：成功/失敗率分母是否包含 `running`，默認 `true`
- `maxRows`：最多讀取最新執行記錄數，`100~20000`，默認 `5000`

> 後端內部會查詢 `maxRows + 1` 判斷是否採樣，實際聚合最多使用 `maxRows`。

**響應關鍵字段**：
- `totals`：總體計數與比率（含 `completedRuns`、`successRateCompleted`、`failureRateCompleted`）
- `perJob`：按 job 聚合結果（同上）
- `dailyBuckets`：按日桶聚合（缺資料日期補 0）
- `rateBase`：`total_runs` 或 `completed_runs`（對應 `includeRunning`）
- `statsMeta`：`maxRows`、`returnedRows`、`sampled`、`sampleStrategy`

**分母語義**：
- `successRate/failureRate`：
  - `includeRunning=true` → 分母 `totalRuns`
  - `includeRunning=false` → 分母 `completedRuns`
- `successRateCompleted/failureRateCompleted`：固定以 `completedRuns` 為分母

**完整響應範例**：
```json
{
  "success": true,
  "data": {
    "days": 7,
    "since": "2026-02-18T00:00:00.000Z",
    "totals": {
      "totalRuns": 123,
      "successRuns": 90,
      "failedRuns": 20,
      "runningRuns": 13,
      "completedRuns": 110,
      "successRate": 0.7317,
      "failureRate": 0.1626,
      "successRateCompleted": 0.8182,
      "failureRateCompleted": 0.1818,
      "avgDurationMs": 1420
    },
    "perJob": [
      {
        "jobKey": "cleanup_expired_sessions",
        "totalRuns": 70,
        "successRuns": 60,
        "failedRuns": 8,
        "runningRuns": 2,
        "completedRuns": 68,
        "successRate": 0.8571,
        "failureRate": 0.1143,
        "successRateCompleted": 0.8824,
        "failureRateCompleted": 0.1176,
        "avgDurationMs": 980,
        "totalAffectedCount": 1560,
        "lastRunAt": "2026-02-25T09:01:00.000Z"
      }
    ],
    "dailyBuckets": [
      {
        "date": "2026-02-24",
        "totalRuns": 20,
        "successRuns": 15,
        "failedRuns": 3,
        "runningRuns": 2,
        "completedRuns": 18,
        "successRate": 0.75,
        "failureRate": 0.15,
        "successRateCompleted": 0.8333,
        "failureRateCompleted": 0.1667
      }
    ],
    "rateBase": "total_runs",
    "statsMeta": {
      "maxRows": 5000,
      "returnedRows": 5000,
      "sampled": true,
      "sampleStrategy": "latest_runs_desc"
    }
  }
}
```

**對照範例 A（`includeRunning=true`）**：
```json
{
  "rateBase": "total_runs",
  "totals": {
    "totalRuns": 3,
    "successRuns": 1,
    "failedRuns": 1,
    "runningRuns": 1,
    "completedRuns": 2,
    "successRate": 0.3333,
    "failureRate": 0.3333,
    "successRateCompleted": 0.5,
    "failureRateCompleted": 0.5
  }
}
```

**對照範例 B（`includeRunning=false`）**：
```json
{
  "rateBase": "completed_runs",
  "totals": {
    "totalRuns": 3,
    "successRuns": 1,
    "failedRuns": 1,
    "runningRuns": 1,
    "completedRuns": 2,
    "successRate": 0.5,
    "failureRate": 0.5,
    "successRateCompleted": 0.5,
    "failureRateCompleted": 0.5
  }
}
```

**向後相容說明**：
- 保留舊欄位：`totalRuns/successRuns/failedRuns/runningRuns/avgDurationMs`。
- 新增欄位：`completedRuns`、`successRateCompleted`、`failureRateCompleted`、`rateBase`、`statsMeta.*`。
- 舊前端若缺少 `rateBase` 可回退按 `total_runs` 解讀。

### 前端接入檢查清單
- 顯示比率前先讀 `rateBase`，避免把 total 與 completed 語義混用。
- 若 `statsMeta.sampled=true`，在圖表或表格顯示「資料已採樣」提示。
- 若缺少 `rateBase`（舊版本），前端回退按 `total_runs` 解讀。
- 對 `dailyBuckets` 按 `date` 直接渲染，不自行補洞，避免雙重補零。
- 大窗口分析時優先調整 `days`，避免盲目提高 `maxRows`。

## 錯誤碼

| 錯誤碼 | HTTP狀態碼 | 說明 |
|--------|-----------|------|
| `UNAUTHORIZED` | 401 | 未認證 |
| `FORBIDDEN` | 403 | 無權限 |
| `NOT_FOUND` | 404 | 資源不存在 |
| `VALIDATION_ERROR` | 400 | 驗證失敗 |
| `RATE_LIMIT_EXCEEDED` | 429 | 請求過於頻繁 |
| `AI_SERVICE_ERROR` | 503 | AI服務錯誤 |
| `CONSENT_REQUIRED` | 403 | 用戶未同意知情同意（v2.0） |
| `NOT_FOUND` | 404 | 訪談 session 不存在或不屬於當前用戶（⚠️ 代碼統一使用 `NOT_FOUND`，不再區分 `SESSION_NOT_FOUND`/`SESSION_NOT_OWNED`）（v2.0） |
| `SESSION_COMPLETED` | 409 | session 已結束（含 completed/abandoned）（v2.0） |
| `MAX_TURNS_REACHED` | **422** | 已達最大 turn 數（⚠️ 代碼返回 422 非 409）（v2.0） |
| `CONCURRENT_REQUEST` | 409 | session 正在處理中（v2.0） |
| `TURN_TOO_FAST` | 429 | turn 間隔不足 3 秒（v2.0） |
| `RATE_LIMIT_EXCEEDED` | 429 | 開始訪談頻率超限。⚠️ 代碼統一使用 `RATE_LIMIT_EXCEEDED`（設計中的 `START_RATE_LIMIT` 未被使用）。雙層：①中間件每用戶每小時 3 次；②業務邏輯每天 5 個 substantive session（v2.0） |
| `AI_CALL_FAILED` | SSE error | AI 調用失敗（SSE 流內推送）（v2.0） |
| _(無專用碼)_ | **200** | polling `GET /:id` 始終返回 200。⚠️ 設計曾規劃 `PROCESSING_NOT_DONE` (202) / `PROCESSING_FAILED` (500)，代碼統一 200 + session 對象，前端從 `status` 判斷（v2.0） |

---

## 💬 聊天室（Chat v1）

> Base URL：`/api/v1/chat`。聊天室同時支援「登入使用者」與「匿名 session」兩種 actor。

### Actor（登入 / 匿名）傳遞方式

- 登入：`Authorization: Bearer <token>`
- 匿名：`X-Session-Id: <sessionId>` 或 query `?session_id=<sessionId>`
- ⚠️ 若同時提供 header 與 query 且值不同，會返回 `INVALID_SESSION_ID`（400）

### 1) 建立聊天室

**POST** `/chat/rooms`

Request body：
```json
{
  "history_visibility_mode": "share_summary_only"
}
```

`history_visibility_mode` 允許值：
- `share_full_history`：B 加入後可見完整歷史（僅限 `all` / `summary_only`）
- `share_summary_only`：B 加入前僅可見 `summary_only`；加入後可見 `all` + `summary_only`
- `share_from_join_time`：B 僅可見加入後的 `all` + `summary_only`

Response：
```json
{
  "success": true,
  "data": {
    "room": {
      "id": "uuid",
      "status": "solo_active",
      "history_visibility_mode": "share_summary_only",
      "participants": []
    }
  }
}
```

### 2) 讀取聊天室

**GET** `/chat/rooms/:roomId`

Response：`{ success, data: { room } }`

### 3) 建立邀請

**POST** `/chat/rooms/:roomId/invites`

Request body（皆可省略）：
```json
{
  "history_visibility_mode": "share_summary_only",
  "expires_in_hours": 24
}
```

Response：`{ success, data: { invite } }`

### 4) 接受邀請 / 拒絕邀請

**POST** `/chat/invites/:inviteCode/accept`

**POST** `/chat/invites/:inviteCode/decline`

Response：
- accept：`{ success, data: { room } }`
- decline：`{ success, data: { invite } }`

### 5) 讀取訊息（分頁）

**GET** `/chat/rooms/:roomId/messages?limit=50&cursor=2026-03-01T00:00:00.000Z`

說明：
- `limit` 預設 30
- `cursor` 為 ISO 時間字串，表示「取游標時間之前更舊的訊息」
- Response 內的 `nextCursor` 為本次返回的最舊訊息時間（用於下一頁）

Response：
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "uuid",
        "content": "hello",
        "message_type": "user_text",
        "visibility_scope": "all",
        "reply_to_message_id": null,
        "ai_strategy": null,
        "ai_confidence": null,
        "safety_flag": false,
        "safety_detail": null,
        "created_at": "2026-03-01T00:00:00.000Z",
        "sender_participant": { "id": "uuid", "role_in_room": "roleA" }
      }
    ],
    "nextCursor": "2026-03-01T00:00:00.000Z"
  }
}
```

可見性（後端強制）：
- A（房主）可見全部訊息（含 `owner_only`）
- B 只能看 `all` / `summary_only`，且依 `history_visibility_mode` + `joined_at` 進一步裁切

### 6) 發送訊息

**POST** `/chat/rooms/:roomId/messages`

Request body：
```json
{
  "content": "text",
  "visibility_scope": "all",
  "reply_to_message_id": "uuid"
}
```

說明：
- `visibility_scope` 預設 `all`（可選：`owner_only`、`summary_only`）
- `reply_to_message_id` 可省略（回覆引用）
- 房級限流：5 秒內最多 1 則，30 秒滑窗最多 6 則；超限返回 `RATE_LIMIT_EXCEEDED`（429）

Response：`{ success, data: { message } }`

### 7) SSE 訂閱（即時事件）

**GET** `/chat/rooms/:roomId/stream`

Headers：
```
Accept: text/event-stream
Authorization: Bearer <token> (optional)
X-Session-Id: <sessionId> (optional)
```

事件格式（示例）：
```text
event: message
data: {"type":"message","roomId":"...","payload":{"messageId":"..."},"at":"2026-03-01T00:00:00.000Z"}
```

事件類型：
- `ready`：連線建立完成（data: `{ roomId }`）
- `ping`：心跳
- `message`：新訊息事件
- `invite`：邀請狀態變更
- `room_status`：房間狀態變更 / 參與者離開或被移除

### 8) 轉判決 / 查詢判決狀態

**POST** `/chat/rooms/:roomId/request-judgment`

Request body（可省略；提供時至少 1 個）：
```json
{
  "included_message_ids": ["uuid-1", "uuid-2"]
}
```

說明：
- 不提供 `included_message_ids`：後端使用預設規則（僅納入 `message_type=user_text` 且 `visibility_scope=all`，並按 `history_visibility_mode`/B 加入時間裁切）
- 提供 `included_message_ids`：必須是「可被預設規則納入」的子集合；否則返回 `NOT_FOUND` 或 `CASE_NOT_READY`
- 轉換時 `conversion_snapshot` 會記錄 `included_message_ids`、過濾策略與訊息範圍，供稽核回溯

Response（成功）：
```json
{
  "success": true,
  "data": {
    "roomId": "uuid",
    "caseId": "uuid",
    "judgmentId": "uuid",
    "linkId": "uuid",
    "status": "judgment_completed"
  }
}
```

**GET** `/chat/rooms/:roomId/judgment-status`

### 9) 離開 / 移除 B 方

**POST** `/chat/rooms/:roomId/leave`（B 自離）

**POST** `/chat/rooms/:roomId/kick-b`（A 移除 B）

Response：`{ success, data: { room } }`

---

## 📈 Metrics（Prometheus）

**GET** `/metrics`

- Content-Type：`text/plain; version=0.0.4`
- 生產環境保護：需滿足其一（否則 `403`）
  - Header `X-Metrics-Token` = `METRICS_TOKEN`
  - 請求來源 IP 命中 `METRICS_ALLOWED_IPS`
- 可透過 `METRICS_ENABLED=false` 關閉端點（返回 `404`）
- 指標來源：`backend/src/services/chat-metrics.service.ts`
- Prometheus rules 示例：`backend/ops/prometheus/chat-alerts.rules.yml`（另見 `backend/docs/ALERTS_CHAT.md`）

## 🧠 心理畫像與 AI 訪談（v2.0 新增）

> 詳細規格見 `docs/後端設計/03-API設計.md`。路由參數使用 `:id`（非 `:sessionId`），與源碼對齊。

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/interview/start` | 開始訪談（需 consent）。響應 201，返回完整 session（id, status, trigger, turns[], created_at）。requireConsent 中間件。 |
| POST | `/interview/:id/respond` | 提交回答。請求體 `message`（非 response）。SSE 非逐字流式。 |
| POST | `/interview/:id/skip` | 跳過問題（SSE 同 respond） |
| POST | `/interview/:id/end` | 結束訪談。響應 `{ success, message }`。 |
| GET | `/interview/:id` | 訪談詳情 / polling。取代 result + history，返回完整 session（turns, status, feedback_card, richness_score）。 |
| GET | `/interview/resume` | 檢查未完成訪談 |
| POST | `/interview/:id/retry` | 重試失敗處理（僅 processing_failed） |
| GET | `/psych-profile` | 畫像概覽。返回 consent_given, consent_at, richness_score, narratives[], insights[]。 |
| GET | `/psych-profile/feedback` | 反饋歷史。返回 history[]（session_id, feedback_card, domains_touched）。 |
| DELETE | `/psych-profile` | 清除畫像。響應 `{ success, message }`。 |
| POST | `/psych-profile/consent` | 記錄知情同意。響應 `{ success, message }`。 |

### SSE 事件格式（respond / skip）

當前實現為非逐字流式（完整文本單次 token 事件）。事件類型：
- `event: token` — 文本，data: `{ "text": "AI 完整回應文本" }`
- `event: metadata` — AI 元數據，data: `{ "intent": "...", "target_domains": [...], "should_end": false, "safety_flag": false }`
- `event: safety_alert` — 安全警報，data: `{ "message": "...", "severity": "warning" }`（⚠️ 源碼無 `resources`，危機熱線內建於前端 SafetyAlert 組件）
- `event: complete` — 本輪完成，data: `{ "session_id": "uuid", "status": "in_progress" }`
- `event: error` — 錯誤，data: `{ "code": "AI_CALL_FAILED", "message": "..." }`

## 限流規則

- 認證接口：每5分鐘10次
- 註冊接口：每小時5次
- 驗證碼接口：每郵箱每5分鐘1次
- AI接口：每小時10次
- 聊天室訊息：房級限流（5 秒最多 1 則；30 秒滑窗最多 6 則）
- 訪談 start：雙層限流——①中間件：每用戶每小時 3 次（express-rate-limit，防濫用）；②業務邏輯：每用戶每天 5 個 substantive session（僅計 ≥ 3 輪）
- 訪談 respond：每輪間隔 ≥ 3 秒、每 session ≤ 25 輪
- 訪談全局：每用戶每天 5 個 substantive session（僅計 ≥ 3 輪）
- 其他接口：每分鐘100次
