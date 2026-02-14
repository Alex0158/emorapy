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

### 3. 獲取案件詳情
**GET** `/cases/:id`

**查詢參數**（快速體驗模式）:
```
?session_id=guest_1704067200_abc123
```

### 4. 上傳證據
**POST** `/cases/:id/evidence`

**Content-Type**: `multipart/form-data`

**表單數據**:
- `files`: 文件（最多3個）
> 上傳僅允許案件狀態為 `draft` / `submitted` / `in_progress`；判決完成後關閉上傳。

### 5. 刪除證據
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

## 錯誤碼

| 錯誤碼 | HTTP狀態碼 | 說明 |
|--------|-----------|------|
| `UNAUTHORIZED` | 401 | 未認證 |
| `FORBIDDEN` | 403 | 無權限 |
| `NOT_FOUND` | 404 | 資源不存在 |
| `VALIDATION_ERROR` | 400 | 驗證失敗 |
| `RATE_LIMIT_EXCEEDED` | 429 | 請求過於頻繁 |
| `AI_SERVICE_ERROR` | 503 | AI服務錯誤 |

## 限流規則

- 認證接口：每5分鐘10次
- 註冊接口：每小時5次
- 驗證碼接口：每郵箱每5分鐘1次
- AI接口：每小時10次
- 其他接口：每分鐘100次
