# API設計

**文檔版本**：v1.0  
**最後更新**：2024年

---

## 📋 API設計原則

### RESTful規範

1. **資源導向**：URL表示資源，動詞表示操作
2. **HTTP方法**：GET（查詢）、POST（創建）、PUT（更新）、DELETE（刪除）
3. **狀態碼**：使用標準HTTP狀態碼
4. **版本控制**：URL中包含版本號 `/api/v1/`

### 統一響應格式

**成功響應**：
```json
{
  "success": true,
  "data": {
    // 響應數據
  },
  "message": "操作成功"
}
```

**錯誤響應**：
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

### 認證方式

所有需要認證的接口使用JWT Token：

```
Authorization: Bearer <token>
```

---

## 🔐 認證相關API

### 1. 用戶註冊

**POST** `/api/v1/auth/register`

**請求體**：
```json
{
  "email": "user@example.com",
  "password": "password123",
  "nickname": "用戶暱稱"
}
```

**響應**：
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "nickname": "用戶暱稱",
      "email_verified": false
    },
    "token": "jwt_token"
  },
  "message": "註冊成功，請查收驗證郵件"
}
```

**錯誤碼**：
- `EMAIL_EXISTS`：郵箱已存在
- `INVALID_EMAIL`：郵箱格式錯誤
- `WEAK_PASSWORD`：密碼強度不足

---

### 2. 發送郵件驗證碼

**POST** `/api/v1/auth/send-verification-code`

**請求體**：
```json
{
  "email": "user@example.com",
  "type": "register" // register | reset_password | verify_email
}
```

**響應**：
```json
{
  "success": true,
  "data": {
    "expires_in": 300 // 5分鐘
  },
  "message": "驗證碼已發送"
}
```

**限制**：
- 同一郵箱每5分鐘只能發送一次
- 每日最多發送10次

---

### 3. 驗證郵件驗證碼

**POST** `/api/v1/auth/verify-email`

**請求體**：
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**響應**：
```json
{
  "success": true,
  "data": {
    "verified": true
  },
  "message": "郵箱驗證成功"
}
```

**錯誤碼**：
- `INVALID_CODE`：驗證碼錯誤
- `CODE_EXPIRED`：驗證碼已過期
- `CODE_USED`：驗證碼已使用

---

### 4. 用戶登錄

**POST** `/api/v1/auth/login`

**請求體**：
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**響應**：
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "nickname": "用戶暱稱",
      "avatar_url": "https://...",
      "email_verified": true
    },
    "token": "jwt_token",
    "expires_in": 604800 // 7天（秒）
  },
  "message": "登錄成功"
}
```

**錯誤碼**：
- `INVALID_CREDENTIALS`：郵箱或密碼錯誤
- `ACCOUNT_INACTIVE`：帳號未激活
- `EMAIL_NOT_VERIFIED`：郵箱未驗證

---

### 5. 重置密碼

**POST** `/api/v1/auth/reset-password`

**請求體**：
```json
{
  "email": "user@example.com"
}
```

**響應**：
```json
{
  "success": true,
  "data": {
    "expires_in": 300
  },
  "message": "重置密碼郵件已發送"
}
```

---

### 6. 確認重置密碼

**POST** `/api/v1/auth/reset-password-confirm`

**請求體**：
```json
{
  "email": "user@example.com",
  "code": "123456",
  "new_password": "newpassword123"
}
```

**響應**：
```json
{
  "success": true,
  "data": {},
  "message": "密碼重置成功"
}
```

---

## 👤 用戶相關API

### 1. 獲取用戶資料

**GET** `/api/v1/user/profile`

**Headers**：
```
Authorization: Bearer <token>
```

**響應**：
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "nickname": "用戶暱稱",
      "avatar_url": "https://...",
      "gender": "male",
      "age": 25,
      "relationship_status": "dating",
      "language": "zh",
      "timezone": "Asia/Shanghai",
      "notification_enabled": true,
      "privacy_level": "private",
      "created_at": "2024-01-01T00:00:00Z",
      "last_login_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

---

### 2. 更新用戶資料

**PUT** `/api/v1/user/profile`

**Headers**：
```
Authorization: Bearer <token>
```

**請求體**：
```json
{
  "nickname": "新暱稱",
  "avatar_url": "https://...",
  "gender": "male",
  "age": 26,
  "relationship_status": "dating",
  "language": "en",
  "timezone": "America/New_York",
  "notification_enabled": true,
  "privacy_level": "partner_only"
}
```

**響應**：
```json
{
  "success": true,
  "data": {
    "user": {
      // 更新後的用戶信息
    }
  },
  "message": "資料更新成功"
}
```

---

## 💑 配對相關API

### 1. 創建配對（生成邀請碼）

**POST** `/api/v1/pairing/create`

**Headers**：
```
Authorization: Bearer <token>
```

**響應**：
```json
{
  "success": true,
  "data": {
    "pairing": {
      "id": "uuid",
      "invite_code": "ABC123",
      "status": "pending",
      "expires_at": "2024-01-02T00:00:00Z"
    }
  },
  "message": "邀請碼已生成"
}
```

---

### 2. 加入配對（使用邀請碼）

**POST** `/api/v1/pairing/join`

**Headers**：
```
Authorization: Bearer <token>
```

**請求體**：
```json
{
  "invite_code": "ABC123"
}
```

**響應**：
```json
{
  "success": true,
  "data": {
    "pairing": {
      "id": "uuid",
      "user1": {
        "id": "uuid",
        "nickname": "用戶1"
      },
      "user2": {
        "id": "uuid",
        "nickname": "用戶2"
      },
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z",
      "confirmed_at": "2024-01-01T00:05:00Z"
    }
  },
  "message": "配對成功"
}
```

**錯誤碼**：
- `INVALID_CODE`：邀請碼無效
- `CODE_EXPIRED`：邀請碼已過期
- `CODE_USED`：邀請碼已使用
- `SELF_PAIRING`：不能與自己配對
- `ALREADY_PAIRED`：已經有配對關係

---

### 3. 獲取配對狀態

**GET** `/api/v1/pairing/status`

**Headers**：
```
Authorization: Bearer <token>
```

**響應**：
```json
{
  "success": true,
  "data": {
    "pairing": {
      "id": "uuid",
      "user1": {
        "id": "uuid",
        "nickname": "用戶1"
      },
      "user2": {
        "id": "uuid",
        "nickname": "用戶2"
      },
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

---

## 🔄 Session管理API（快速體驗模式）

### 1. 創建Session

**GET** `/api/v1/sessions/create`

**說明**：
- 快速體驗模式專用接口，用於創建Session
- 無需認證，前端訪問快速體驗頁面時自動調用
- 如果前端已有Session ID（localStorage），可跳過此步驟

**響應**：
```json
{
  "success": true,
  "data": {
    "session_id": "guest_1704067200_abc123",
    "expires_at": "2024-01-02T00:00:00Z"
  },
  "message": "Session創建成功"
}
```

**Session ID格式**：
- 格式：`guest_{timestamp}_{random}`
- 示例：`guest_1704067200_abc123`
- 有效期：24小時（未完成案件）或7天（已完成案件）

**說明**：
- Session ID用於追蹤快速體驗模式的案件
- 前端應將Session ID保存到localStorage
- 後續所有快速體驗模式API都需要傳遞Session ID

---

## 📝 案件相關API

### 1. 創建案件（快速體驗模式）

**POST** `/api/v1/cases/quick`

**請求體**（無需認證）：
```json
{
  "plaintiff_statement": "發生了什麼事？我的感受是什麼？我希望對方怎麼做？",
  "defendant_statement": "發生了什麼事？我的感受是什麼？我希望對方怎麼做？",
  "evidence_urls": ["https://...", "https://..."] // 可選，最多3張
}
```

**請求頭**（可選）：
```
X-Session-Id: session_uuid // 如果已有Session ID，可傳遞；否則服務器自動生成
```

**響應**：
```json
{
  "success": true,
  "data": {
    "case": {
      "id": "uuid",
      "status": "submitted",
      "mode": "quick",
      "created_at": "2024-01-01T00:00:00Z"
    },
    "session_id": "guest_1704067200_abc123" // 用於後續查詢
  },
  "message": "案件已提交，AI正在分析中..."
}
```

**說明**：
- 快速體驗模式不需要認證
- 使用Session ID追蹤案件（格式：`guest_timestamp_random`）
- AI自動判斷案件類型
- Session ID有效期：24小時
- 如果請求中沒有Session ID，服務器自動生成並返回

---

### 2. 創建案件（完整模式）

**POST** `/api/v1/cases`

**Headers**：
```
Authorization: Bearer <token>
```

**請求體**：
```json
{
  "pairing_id": "uuid",
  "title": "案件標題",
  "plaintiff_statement": "發生了什麼事？我的感受是什麼？我希望對方怎麼做？",
  "defendant_statement": "發生了什麼事？我的感受是什麼？我希望對方怎麼做？",
  "evidence_urls": ["https://...", "https://..."] // 可選
}
```

**響應**：
```json
{
  "success": true,
  "data": {
    "case": {
      "id": "uuid",
      "pairing_id": "uuid",
      "title": "案件標題",
      "type": "生活習慣衝突", // AI自動識別
      "status": "submitted",
      "plaintiff_id": "uuid",
      "defendant_id": "uuid",
      "created_at": "2024-01-01T00:00:00Z",
      "submitted_at": "2024-01-01T00:00:00Z"
    }
  },
  "message": "案件已提交"
}
```

---

### 3. 獲取案件詳情

**GET** `/api/v1/cases/:id`

**Headers**（完整模式需要）：
```
Authorization: Bearer <token>
```

**查詢參數**（快速體驗模式）：
```
?session_id=session_uuid
```

**請求頭**（快速體驗模式，可選）：
```
X-Session-Id: session_uuid
```

**說明**：
- 完整模式：需要JWT Token認證，驗證用戶是否有權限訪問該案件
- 快速體驗模式：使用session_id驗證，確保Session ID匹配
- 如果session_id不匹配，返回403錯誤

**響應**：
```json
{
  "success": true,
  "data": {
    "case": {
      "id": "uuid",
      "pairing_id": "uuid",
      "title": "案件標題",
      "type": "生活習慣衝突",
      "status": "in_progress",
      "plaintiff_statement": "...",
      "defendant_statement": "...",
      "evidences": [
        {
          "id": "uuid",
          "file_url": "https://...",
          "file_type": "image"
        }
      ],
      "created_at": "2024-01-01T00:00:00Z",
      "submitted_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

---

### 4. 更新案件陳述（被告方）

**PUT** `/api/v1/cases/:id/statement`

**Headers**：
```
Authorization: Bearer <token>
```

**請求體**：
```json
{
  "statement": "我的答辯陳述..."
}
```

**響應**：
```json
{
  "success": true,
  "data": {
    "case": {
      // 更新後的案件信息
    }
  },
  "message": "陳述已更新"
}
```

---

### 5. 上傳證據

**POST** `/api/v1/cases/:id/evidence`

**說明**：
- 支持快速體驗模式和完整模式
- 快速體驗模式使用session_id驗證，完整模式需要JWT Token認證

**Headers**（完整模式需要）：
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**查詢參數**（快速體驗模式）：
```
?session_id=session_uuid
```

**請求頭**（快速體驗模式，可選）：
```
X-Session-Id: session_uuid
```

**請求體**（FormData）：
```
file: <File>              // 必填，文件對象
description: "證據說明"   // 可選，證據描述
```

**響應**：
```json
{
  "success": true,
  "data": {
    "evidence": {
      "id": "uuid",
      "case_id": "uuid",
      "file_url": "https://...",
      "file_type": "image",
      "file_size": 1024000,
      "description": "證據說明",
      "created_at": "2024-01-01T00:00:00Z"
    }
  },
  "message": "證據上傳成功"
}
```

**限制**：
- **文件大小**：單個文件不超過5MB
- **文件數量**：每個案件最多3張圖片或1個視頻
- **文件格式**：只允許JPG、PNG、GIF、MP4格式
- **上傳時機**：僅在案件狀態為`draft`或`submitted`時可上傳

**錯誤碼**：
- `FILE_TOO_LARGE`：文件大小超過5MB
- `INVALID_FILE_TYPE`：不支持的文件格式
- `TOO_MANY_FILES`：已達到文件數量上限
- `CASE_NOT_EDITABLE`：案件狀態不允許上傳證據

**上傳流程**：
1. 前端選擇文件並驗證（大小、格式、數量）
2. 調用上傳接口，使用FormData格式
3. 後端驗證文件並上傳到文件存儲服務（Cloudinary）
4. 保存證據記錄到數據庫
5. 返回證據信息

---

## ⚖️ 判決相關API

### 1. 生成判決

**POST** `/api/v1/cases/:id/judgment`

**說明**：
- **觸發時機**：案件提交後自動觸發判決生成（異步處理，不阻塞響應）
- **手動觸發**：此接口也可手動調用以重新生成判決（如果判決生成失敗）
- 如果案件已生成判決，直接返回現有判決，不會重複生成

**Headers**（完整模式需要）：
```
Authorization: Bearer <token>
```

**查詢參數**（快速體驗模式）：
```
?session_id=session_uuid
```

**請求頭**（快速體驗模式，可選）：
```
X-Session-Id: session_uuid
```

**說明**：
- 完整模式：需要JWT Token認證
- 快速體驗模式：使用session_id驗證
- 如果案件已生成判決，直接返回現有判決

**響應**：
```json
{
  "success": true,
  "data": {
    "judgment": {
      "id": "uuid",
      "case_id": "uuid",
      "judgment_content": "# 判決書\n\n## 📋 案件信息\n...",
      "summary": "判決摘要",
      "responsibility_ratio": {
        "plaintiff": 60,
        "defendant": 40
      },
      "ai_model": "gpt-3.5-turbo",
      "created_at": "2024-01-01T00:01:00Z"
    }
  },
  "message": "判決已生成"
}
```

**說明**：
- 此接口會觸發AI判決生成
- 生成時間約30-60秒
- 支持輪詢查詢狀態

---

### 2. 獲取判決詳情

**GET** `/api/v1/judgments/:id`

**說明**：
- 此接口統一用於獲取判決詳情，支持完整模式和快速體驗模式
- 通過判決ID獲取，符合RESTful資源導向設計原則

**Headers**（完整模式需要）：
```
Authorization: Bearer <token>
```

**查詢參數**（快速體驗模式）：
```
?session_id=session_uuid
```

**請求頭**（快速體驗模式，可選）：
```
X-Session-Id: session_uuid
```

**說明**：
- 完整模式：需要JWT Token認證，驗證用戶是否有權限訪問該判決對應的案件
- 快速體驗模式：使用session_id驗證，確保Session ID與案件匹配
- 如果判決尚未生成，返回狀態碼202（Accepted），提示「判決生成中，請稍後再試」

**響應**：
```json
{
  "success": true,
  "data": {
    "judgment": {
      "id": "uuid",
      "case_id": "uuid",
      "judgment_content": "# 判決書\n\n...",
      "summary": "判決摘要",
      "responsibility_ratio": {
        "plaintiff": 60,
        "defendant": 40
      },
      "user1_acceptance": null,
      "user2_acceptance": null,
      "user1_rating": null,
      "user2_rating": null,
      "created_at": "2024-01-01T00:01:00Z"
    }
  }
}
```

**備註**：
- 也可以通過案件ID獲取判決：`GET /api/v1/cases/:id/judgment`（此接口作為便捷方式保留，內部會查詢判決ID並重定向）

---

### 3. 接受/拒絕判決

**POST** `/api/v1/judgments/:id/accept`

**Headers**：
```
Authorization: Bearer <token>
```

**請求體**：
```json
{
  "accepted": true,
  "rating": 5 // 1-5，可選
}
```

**響應**：
```json
{
  "success": true,
  "data": {
    "judgment": {
      // 更新後的判決信息
      "user1_acceptance": true,
      "user1_rating": 5
    }
  },
  "message": "判決已接受"
}
```

---

## 💝 和好方案相關API

### 1. 生成和好方案

**POST** `/api/v1/judgments/:id/reconciliation-plans`

**說明**：
- **生成時機**：判決生成後，用戶點擊「生成和好方案」按鈕時觸發（手動生成）
- **未來優化**：可考慮判決生成後自動生成和好方案（提升用戶體驗，但增加AI成本）
- 如果該判決已有和好方案，直接返回現有方案列表，不會重複生成

**Headers**：
```
Authorization: Bearer <token>
```

**請求體**（可選）：
```json
{
  "preferences": {
    "difficulty": "easy", // easy | medium | hard
    "duration": 7, // 天數
    "types": ["activity", "communication"] // 方案類型
  }
}
```

**響應**：
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": "uuid",
        "plan_content": "方案內容...",
        "plan_type": "activity",
        "difficulty_level": "easy",
        "estimated_duration": 3,
        "time_cost": 2,
        "money_cost": 1,
        "emotion_cost": 1,
        "skill_requirement": 1,
        "recommended": true // 是否推薦
      },
      // ... 更多方案
    ]
  },
  "message": "和好方案已生成"
}
```

---

### 2. 獲取和好方案列表

**GET** `/api/v1/judgments/:id/reconciliation-plans`

**Headers**：
```
Authorization: Bearer <token>
```

**查詢參數**：
```
?difficulty=easy&type=activity&limit=10&offset=0
```

**響應**：
```json
{
  "success": true,
  "data": {
    "plans": [
      // 方案列表
    ],
    "pagination": {
      "total": 20,
      "limit": 10,
      "offset": 0,
      "has_more": true
    }
  }
}
```

---

### 3. 選擇和好方案

**POST** `/api/v1/reconciliation-plans/:id/select`

**Headers**：
```
Authorization: Bearer <token>
```

**響應**：
```json
{
  "success": true,
  "data": {
    "plan": {
      // 更新後的方案信息
      "user1_selected": true
    }
  },
  "message": "方案已選擇"
}
```

---

## ✅ 執行相關API

### 1. 確認執行

**POST** `/api/v1/execution/confirm`

**Headers**：
```
Authorization: Bearer <token>
```

**請求體**：
```json
{
  "plan_id": "uuid"
}
```

**響應**：
```json
{
  "success": true,
  "data": {
    "execution": {
      "id": "uuid",
      "plan_id": "uuid",
      "status": "in_progress",
      "created_at": "2024-01-01T00:00:00Z"
    }
  },
  "message": "執行已確認"
}
```

---

### 2. 執行打卡

**POST** `/api/v1/execution/checkin`

**Headers**：
```
Authorization: Bearer <token>
```

**請求體**：
```json
{
  "plan_id": "uuid",
  "notes": "執行感受...",
  "photos": ["https://..."] // 可選
}
```

**響應**：
```json
{
  "success": true,
  "data": {
    "execution": {
      "id": "uuid",
      "status": "in_progress",
      "notes": "執行感受...",
      "photos_urls": ["https://..."],
      "updated_at": "2024-01-01T00:00:00Z"
    }
  },
  "message": "打卡成功"
}
```

---

### 3. 獲取執行狀態

**GET** `/api/v1/execution/status`

**Headers**：
```
Authorization: Bearer <token>
```

**查詢參數**：
```
?plan_id=uuid
```

**響應**：
```json
{
  "success": true,
  "data": {
    "execution": {
      "id": "uuid",
      "plan_id": "uuid",
      "status": "in_progress",
      "records": [
        {
          "id": "uuid",
          "action": "checkin",
          "notes": "執行感受...",
          "created_at": "2024-01-01T00:00:00Z"
        }
      ],
      "progress": 50 // 完成百分比
    }
  }
}
```

---

## 🔍 錯誤碼定義

### 認證錯誤（4xx）

| 錯誤碼 | HTTP狀態碼 | 說明 |
|--------|-----------|------|
| `UNAUTHORIZED` | 401 | 未認證或Token無效 |
| `FORBIDDEN` | 403 | 無權限訪問 |
| `TOKEN_EXPIRED` | 401 | Token已過期 |
| `INVALID_CREDENTIALS` | 401 | 郵箱或密碼錯誤 |

### 驗證錯誤（4xx）

| 錯誤碼 | HTTP狀態碼 | 說明 |
|--------|-----------|------|
| `VALIDATION_ERROR` | 400 | 請求參數驗證失敗 |
| `INVALID_EMAIL` | 400 | 郵箱格式錯誤 |
| `WEAK_PASSWORD` | 400 | 密碼強度不足 |
| `INVALID_CODE` | 400 | 驗證碼錯誤 |
| `CODE_EXPIRED` | 400 | 驗證碼已過期 |
| `SESSION_ID_REQUIRED` | 400 | Session ID是必需的（快速體驗模式） |
| `INVALID_SESSION_ID` | 400 | 無效的Session ID格式 |
| `SESSION_EXPIRED` | 401 | Session已過期或不存在 |

### 資源錯誤（4xx）

| 錯誤碼 | HTTP狀態碼 | 說明 |
|--------|-----------|------|
| `NOT_FOUND` | 404 | 資源不存在 |
| `EMAIL_EXISTS` | 409 | 郵箱已存在 |
| `INVALID_CODE` | 400 | 邀請碼無效 |
| `ALREADY_PAIRED` | 409 | 已經有配對關係 |

### 業務邏輯錯誤（4xx）

| 錯誤碼 | HTTP狀態碼 | 說明 |
|--------|-----------|------|
| `CASE_NOT_READY` | 422 | 案件尚未準備好 |
| `JUDGMENT_EXISTS` | 409 | 判決已存在 |
| `FILE_TOO_LARGE` | 413 | 文件過大 |
| `INVALID_FILE_TYPE` | 400 | 文件類型不支持 |

### 服務器錯誤（5xx）

| 錯誤碼 | HTTP狀態碼 | 說明 |
|--------|-----------|------|
| `INTERNAL_ERROR` | 500 | 服務器內部錯誤 |
| `AI_SERVICE_ERROR` | 503 | AI服務錯誤 |
| `DATABASE_ERROR` | 500 | 數據庫錯誤 |
| `EXTERNAL_SERVICE_ERROR` | 503 | 外部服務錯誤 |

---

## 📊 分頁和排序

### 分頁參數

所有列表接口支持分頁：

```
?limit=10&offset=0
```

**默認值**：
- `limit`: 10
- `offset`: 0

**響應格式**：
```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}
```

### 排序參數

支持排序的接口：

```
?sort_by=created_at&order=desc
```

**可用排序字段**：
- `created_at`: 創建時間
- `updated_at`: 更新時間
- `status`: 狀態

**排序方向**：
- `asc`: 升序
- `desc`: 降序（默認）

---

## 🔒 限流策略

### API限流

- **認證接口**：每IP每5分鐘10次
- **註冊接口**：每IP每小時5次
- **驗證碼接口**：每郵箱每5分鐘1次
- **其他接口**：每用戶每分鐘100次

### 限流響應

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "請求過於頻繁，請稍後再試",
    "details": {
      "retry_after": 60 // 秒
    }
  }
}
```

---

## 📚 相關文檔

- [後端架構設計](./01-後端架構設計.md)
- [數據庫設計](./02-數據庫設計.md)
- [服務層設計](./04-服務層設計.md)
- [中間件和安全](./05-中間件和安全.md)

---

**文檔版本**：v1.0  
**最後更新**：2024年

