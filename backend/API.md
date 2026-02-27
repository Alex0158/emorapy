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

### 2. 刷新/續期 Session
**POST** `/sessions/refresh`

> 當前端檢測到 Session 失效時可直接呼叫；若舊 Session 仍有效會返回同一 ID，否則返回新 ID。

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

---

## 管理後台（Admin）

> Base URL: `/api/v1/admin`，需管理員 JWT。

### 定時任務統計
**GET** `/jobs/stats`

**Query 參數**:
- `days`：統計天數（1~90，預設 7）
- `includeRunning`：`true|false`（預設 `true`）
  - `true`：`successRate/failureRate` 分母為 `totalRuns`
  - `false`：`successRate/failureRate` 分母為 `completedRuns`
- `maxRows`：查詢保護上限（100~20000，預設 5000）

**響應重點（contract）**:
- `totals`：
  - `totalRuns/successRuns/failedRuns/runningRuns/completedRuns`
  - `successRate/failureRate`
  - `successRateCompleted/failureRateCompleted`
  - `avgDurationMs`
- `perJob[]`：每個 job 的同維度聚合
- `dailyBuckets[]`：日粒度趨勢（缺值補 0）
- `rateBase`：`total_runs | completed_runs`
- `statsMeta`：
  - `maxRows`
  - `sampled`（是否發生截斷）
  - `sampleStrategy`（目前為 `latest_runs_desc`）

**採樣語義說明**:
- 後端採用 `maxRows + 1` 探測：
  - 若回傳行數 `> maxRows`，則 `sampled=true`，並只使用最新 `maxRows` 筆聚合
  - 否則 `sampled=false`

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
| `SESSION_NOT_FOUND` | 404 | 訪談 session 不存在（v2.0） |
| `SESSION_NOT_OWNED` | 403 | session 不屬於當前用戶（v2.0） |
| `SESSION_COMPLETED` | 409 | session 已結束（含 completed/abandoned）（v2.0） |
| `MAX_TURNS_REACHED` | **422** | 已達最大 turn 數（⚠️ 代碼返回 422 非 409）（v2.0） |
| `CONCURRENT_REQUEST` | 409 | session 正在處理中（v2.0） |
| `TURN_TOO_FAST` | 429 | turn 間隔不足 3 秒（v2.0） |
| `RATE_LIMIT_EXCEEDED` | 429 | 開始訪談頻率超限。⚠️ 代碼統一使用 `RATE_LIMIT_EXCEEDED`（設計中的 `START_RATE_LIMIT` 未被使用）。雙層：①中間件每用戶每小時 3 次；②業務邏輯每天 5 個 substantive session（v2.0） |
| `AI_CALL_FAILED` | SSE error | AI 調用失敗（SSE 流內推送）（v2.0） |
| _(無專用碼)_ | **200** | polling `GET /:id` 始終返回 200。⚠️ 設計曾規劃 `PROCESSING_NOT_DONE` (202) / `PROCESSING_FAILED` (500)，代碼統一 200 + session 對象，前端從 `status` 判斷（v2.0） |

## 限流規則

- 認證接口：每5分鐘10次
- 註冊接口：每小時5次
- 驗證碼接口：每郵箱每5分鐘1次
- AI接口：每小時10次
- 訪談 start：雙層限流——①中間件每用戶每小時 3 次（`INTERVIEW_START_RATE_LIMIT`，防濫用）；②業務邏輯每用戶每天 5 個 substantive session（`INTERVIEW_DAILY_SESSION_LIMIT`，僅計 ≥ 3 輪）
- 訪談 respond：每 session 25 輪上限（`INTERVIEW_MAX_TURNS`），每輪間隔 ≥ 3 秒
- 其他接口：每分鐘100次

---

## 🧠 心理畫像與 AI 訪談（v2.0 新增）

> 詳細 API 規格見 `docs/後端設計/03-API設計.md`
> 技術方案見 `UPGRADE_PLAN_PERSONALIZED_JUDGMENT.md`（v10）
> 路由參數使用 `:id`（非 `:sessionId`），與源碼對齊。

### 訪談

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/interview/start` | 開始訪談（需 consent）。響應 201，返回完整 session 對象（`id`, `status`, `trigger`, `turns[]`, `created_at`），非 session_id + first_message + consent_required。使用 requireConsent 中間件。 |
| POST | `/interview/:id/respond` | 提交回答。請求體用 `message`（非 `response`）。SSE 非逐字流式（完整文本單次 token 事件）。 |
| POST | `/interview/:id/skip` | 跳過問題（SSE 同 respond） |
| POST | `/interview/:id/end` | 結束訪談。響應僅 `{ success, message }`，無 data.processing。 |
| GET | `/interview/:id` | 獲取訪談詳情 / polling。取代原 result 與 history 兩端點，返回完整 session（turns、status、feedback_card、richness_score）。 |
| GET | `/interview/resume` | 檢查未完成訪談 |
| POST | `/interview/:id/retry` | 重試失敗的處理（僅 processing_failed 狀態） |

### 心理畫像

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/psych-profile` | 畫像概覽。返回 `consent_given`, `consent_at`, `richness_score`, `narratives[]`, `insights[]`（非 feedback_summary / has_data / last_interview_at）。 |
| GET | `/psych-profile/feedback` | 洞察反饋歷史。返回 `history[]`，每項含 `session_id`, `feedback_card`, `domains_touched`（非 observations[]）。 |
| DELETE | `/psych-profile` | 清除畫像（遺忘權）。響應 `{ success, message }`（非 data.deleted）。 |
| POST | `/psych-profile/consent` | 記錄知情同意。響應 `{ success, message }`（非 data.consent_given / consent_at）。 |

### SSE 響應格式

`POST /interview/:id/respond` 和 `/skip` 返回 SSE 事件流（當前為非逐字流式，單次推送完整文本）：
- `event: token` — 文本，data: `{ "text": "AI 完整回應文本" }`
- `event: metadata` — AI 元數據，data: `{ "intent": "...", "target_domains": [...], "should_end": false, "safety_flag": false }`
- `event: safety_alert` — 安全警報，data: `{ "message": "...", "resources": [...] }`
- `event: complete` — 本輪完成，data: `{ "session_id": "uuid", "status": "in_progress" }`（非 turn_order / domains_touched_so_far）
- `event: error` — 錯誤，data: `{ "code": "AI_CALL_FAILED", "message": "..." }`
