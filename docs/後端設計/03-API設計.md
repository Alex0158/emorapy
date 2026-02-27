# API設計

**文檔版本**：v2.2  
**最後更新**：2026-02-20

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

**POST** `/api/v1/sessions/quick`

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

### 2. 新建 Session（非續期）

**POST** `/api/v1/sessions/refresh`

**說明**：
- 快速體驗模式專用接口，實作上會**新建 Session**（非續期同一 Session）
- 前端判斷 Session 過期時可呼叫以取得新 Session ID
- 注意：舊案件需用原 Session 才能訪問；新 Session 與舊案件無關

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

### 3. 案件列表

**GET** `/api/v1/cases`

**Headers**：
```
Authorization: Bearer <token>
```

**查詢參數**：

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `status` | string | 否 | 篩選狀態（draft/submitted/in_progress/judged 等） |
| `type` | string | 否 | 篩選案件類型 |
| `page` | number | 否 | 頁碼（默認 1） |
| `page_size` | number | 否 | 每頁數量（默認 10，最大 50） |
| `sort_by` | string | 否 | 排序欄位（created_at/updated_at/submitted_at，默認 created_at） |
| `sort_order` | string | 否 | 排序方向（asc/desc，默認 desc） |
| `search` | string | 否 | 標題模糊搜索 |

**響應**：
```json
{
  "success": true,
  "data": {
    "cases": [...],
    "pagination": {
      "page": 1,
      "page_size": 10,
      "total": 25,
      "total_pages": 3
    }
  }
}
```

---

### 4. 獲取案件詳情

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

### 5. 更新案件

**PUT** `/api/v1/cases/:id`

**Headers**：
```
Authorization: Bearer <token>
```

**請求體**（所有欄位可選）：
```json
{
  "title": "更新的標題",
  "plaintiff_statement": "更新的原告陳述...",
  "defendant_statement": "更新的被告答辯陳述..."
}
```

**說明**：
- 原告可更新 `title` 和 `plaintiff_statement`
- 被告可更新 `defendant_statement`
- 僅案件狀態為 `draft` / `submitted` / `in_progress` 時允許更新

**響應**：
```json
{
  "success": true,
  "data": {
    "case": {
      // 更新後的案件信息
    }
  },
  "message": "案件已更新"
}
```

---

### 6. 提交案件

**POST** `/api/v1/cases/:id/submit`

**Headers**：
```
Authorization: Bearer <token>
```

**說明**：
- 將案件狀態從 `draft` 推進到 `submitted`
- 僅案件所有者（原告）可提交
- 提交後被告收到通知

**響應**：
```json
{
  "success": true,
  "data": {
    "case": {
      "id": "uuid",
      "status": "submitted",
      "submitted_at": "2024-01-01T00:00:00Z"
    }
  },
  "message": "案件已提交"
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
- **上傳時機**：僅在案件狀態為`draft`、`submitted`或`in_progress`時可上傳（判決完成後關閉上傳）

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

**POST** `/api/v1/judgments/generate/:id`

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
      "judgment_content": "## ⚖️ 判決結果\n**責任分比例**：\n- 原告：60% 責任\n- 被告：40% 責任\n\n### 問題分析\n...\n\n### 判決理由\n...\n\n### 具體建議\n1. ...\n\n### 關係修復建議\n...",
      "summary": "判決摘要（50-80字）",
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
- `judgment_content` 為固定 Markdown 格式（⚖️ 判決結果 / 問題分析 / 判決理由 / 具體建議 / 關係修復建議）

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
      "judgment_content": "## ⚖️ 判決結果\n**責任分比例**：\n- 原告：60% 責任\n- 被告：40% 責任\n\n### 問題分析\n...\n\n### 判決理由\n...\n\n### 具體建議\n1. ...\n\n### 關係修復建議\n...",
      "summary": "判決摘要（50-80字）",
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
        "skill_requirement": 1
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

### 4. 執行總覽（Dashboard）

**GET** `/api/v1/execution/dashboard`

**Headers**：
```
Authorization: Bearer <token>
```

**說明**：
- 獲取當前用戶所有方案的執行狀態彙總
- 用於前端的執行追蹤 Dashboard 頁面

**響應**：
```json
{
  "success": true,
  "data": {
    "executions": [
      {
        "plan_id": "uuid",
        "plan_title": "方案標題",
        "status": "in_progress",
        "progress": 50,
        "last_checkin_at": "2024-01-05T00:00:00Z"
      }
    ]
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

## 📌 實現補充接口（與代碼對齊）

以下接口已在後端實現，可視需要在本文檔中補充完整規格：

- **POST** `/api/v1/user/avatar`：上傳並更新用戶頭像（multipart/form-data）。
- **POST** `/api/v1/pairing/cancel`：解除當前配對關係。
- **DELETE** `/api/v1/cases/:id/evidence/:evidenceId`：刪除指定證據（需案件權限或 session_id）。

執行記錄：獲取某方案的執行狀態與記錄列表使用 **GET** `/api/v1/execution/status?plan_id=xxx`（見上文「獲取執行狀態」），無單獨的 `GET /execution/:planId/records` 路徑。

詳見 [08-接口一覽表](../前端設計/08-接口一覽表.md) 與本文件的完整端點定義。

---

## 🧠 心理畫像與 AI 訪談 API（v2.0 新增）

> 設計依據：`UPGRADE_PLAN_PERSONALIZED_JUDGMENT.md` v10  
> **實現對齊**：以下 API 規格已與實際源碼（`interview.routes.ts`、`interview.controller.ts`、`psych-profile.routes.ts`、`psych-profile.controller.ts`）對齊。路由參數使用 `:id`（非 `:sessionId`）。

### 1. 開始訪談

**POST** `/api/v1/interview/start`

**認證**：需要 JWT  
**中間件**：`requireConsent`、`interviewStartLimiter`、`validate(interviewStartSchema)`

**請求體**：
```json
{
  "trigger": "organic" | "pre_case" | "post_judgment" | "onboarding"
}
```

**響應**（201）：
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "status": "in_progress",
    "trigger": "organic",
    "turns": [
      {
        "turn_order": 1,
        "ai_message": "嗨！我想更了解你。先從輕鬆的開始——你知道自己的MBTI嗎？或者星座？",
        "user_response": null,
        "skipped": false
      }
    ],
    "created_at": "2026-02-20T10:00:00Z"
  },
  "message": "訪談已開始"
}
```

**說明**：
- `requireConsent` 中間件在路由層強制檢查 `psych_consent_given`，未同意則返回 `403 CONSENT_REQUIRED`。前端在訪談頁面 mount 時檢查，未同意則展示 ConsentModal（⚠️ 無獨立 ConsentGuard 組件）
- 首次 session 的 `first_message`（`turns[0].ai_message`）為靜態種子（零 AI 調用、零延遲）；續聊 session 由 AI 動態生成
- 每用戶同時只能有 1 個 `in_progress` session；呼叫此端點自動處理舊 session：≥ 3 輪 → 標記為 `processing` 並觸發異步管線保存數據；< 3 輪 → 標記為 `abandoned`
- Rate Limit：雙層限流——①中間件：每用戶每小時 3 次（express-rate-limit，防濫用）；②業務邏輯：每用戶每天 5 個 substantive session（僅計 ≥ 3 輪）

### 2. 提交回答（SSE）

**POST** `/api/v1/interview/:id/respond`

**認證**：需要 JWT + `requireConsent`  
**中間件**：`interviewRespondLimiter`、`validate(uuidParamSchema)`、`validate(interviewRespondSchema)`

**請求體**：
```json
{ "message": "用戶的回答文字" }
```

**響應**：SSE 事件流
```
event: token
data: {"text": "AI 完整回應文本"}

event: metadata
data: {"intent": "deepen_attachment", "target_domains": ["attachment"], "should_end": false, "safety_flag": false}

event: safety_alert
data: {"message": "我注意到你提到了一些讓我擔心的事情...", "resources": ["https://..."]}

event: complete
data: {"session_id": "uuid", "status": "in_progress"}

event: error
data: {"code": "AI_CALL_FAILED", "message": "AI 回應失敗，請重試"}
```

> **SSE 實現說明**：當前實現為**非逐字流式**——後端先完成完整 AI call，再一次性推送 `token` 事件（含完整回應文本）和 `metadata` 事件。SSE 通道用於分離可見文本與結構化元數據，並支持 `safety_alert` 和 `error` 事件。未來可升級為 `stream: true` 的逐字流式。
>
> **SSE data 結構約定**：每個事件的 `data:` 行直接包含 payload JSON，前端 `JSON.parse(event.data)` 即可。此約定與 [12-接口建設規範](./12-接口建設規範.md) §SSE 和 [INTEGRATION.md](../INTEGRATION.md) §SSE 一致。

**說明**：
- SSE 使用 `token` / `metadata` / `safety_alert` / `complete` 事件推送。⚠️ **實現說明**：當前 AI 回應格式為單一 JSON（含 text/intent/target_domains/should_end/safety_flag/safety_message），由 `interview.service.ts` 解析後轉為 SSE 事件。設計方案中的「文本 + `---METADATA---` + JSON」雙通道格式尚未實現
- `should_end: true` 時前端自動隱藏輸入框、調用 POST /end（用戶零操作）
- Rate Limit：每 session 最多 25 輪（`INTERVIEW_MAX_TURNS` 默認 25）、每輪最少間隔 3 秒
- 併發防護：session 級 mutex lock，重複請求返回 `409 CONCURRENT_REQUEST`

### 3. 跳過問題

**POST** `/api/v1/interview/:id/skip`

**認證**：需要 JWT + `requireConsent`  
**中間件**：`interviewRespondLimiter`、`validate(uuidParamSchema)`

**請求體**：無（空 body）

**響應**：同 respond 的 SSE 流（AI 會自然轉到其他話題，退回更輕鬆的話題層級）

### 4. 結束訪談

**POST** `/api/v1/interview/:id/end`

**認證**：需要 JWT + `requireConsent`  
**中間件**：`validate(uuidParamSchema)`

**請求體**：無（空 body）

**非冪等**：僅當 session 狀態為 `in_progress` 時可調用；對已 completed/processing/processing_failed 的 session 調用會返回錯誤（VALIDATION_ERROR）。

**響應**：
```json
{ "success": true, "message": "訪談已結束" }
```

**說明**：
- Session 狀態從 `in_progress` 變為 `processing`
- 後端啟動異步管線（進程內非阻塞）：敘事提取 → 敘事摘要 → 洞察提取 → 豐富度計算 → 反饋卡片
- 異步管線使用逐步 try-catch + 重試 2 次（固定退避 2s/4s）+ 部分成功策略
- 全部完成 → `completed`；全部失敗 → `processing_failed`
- **processing_failed 重試**：另見端點 7（`POST /:id/retry`）

### 5. 獲取訪談詳情 / Polling 結果

**GET** `/api/v1/interview/:id`

**認證**：需要 JWT + `requireConsent`  
**中間件**：`validate(uuidParamSchema)`

**響應**：
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "processing" | "completed" | "processing_failed" | "in_progress" | "abandoned",
    "trigger": "organic",
    "feedback_card": "從你的故事中，我注意到了...",
    "richness_score": 0.23,
    "pipeline_step": 5,
    "turns": [
      {
        "turn_order": 1,
        "ai_message": "嗨！...",
        "user_response": "...",
        "skipped": false,
        "created_at": "..."
      }
    ],
    "created_at": "...",
    "updated_at": "..."
  }
}
```

**說明**：此端點同時充當 **Polling**（前端輪詢直到 `status` 為 `completed` 或 `processing_failed`）和**歷史載入**（`turns` 陣列包含完整對話記錄）。前端 polling 每 3 秒一次，`status === 'processing'` 時繼續輪詢，60 秒超時後顯示非阻塞提示。

### 6. 檢查未完成訪談

**GET** `/api/v1/interview/resume`

**認證**：需要 JWT + `requireConsent`

**響應**：
```json
{
  "success": true,
  "data": {
    "has_pending": true,
    "session_id": "uuid",
    "last_ai_message": "你剛才提到...",
    "turn_count": 5,
    "has_failed": false,
    "failed_session_id": null
  }
}
```

### 7. 重試失敗的處理

**POST** `/api/v1/interview/:id/retry`

**認證**：需要 JWT + `requireConsent`  
**中間件**：`validate(uuidParamSchema)`

**響應**：
```json
{ "success": true, "message": "已重試" }
```

**說明**：僅對 `processing_failed` 狀態的 session 有效。從 `pipeline_step + 1` 恢復執行異步管線，session 重新進入 `processing`。

### 8. 獲取畫像概覽

**GET** `/api/v1/psych-profile`

**認證**：需要 JWT（無需 `requireConsent`，未同意用戶也可查看空畫像）

**響應**：
```json
{
  "success": true,
  "data": {
    "consent_given": true,
    "consent_at": "2026-02-20T12:00:00Z",
    "richness_score": 0.45,
    "narratives": [
      {
        "domain": "attachment",
        "completeness": 0.6,
        "ai_summary": "你很擅長照顧別人的感受..."
      }
    ],
    "insights": [
      {
        "domain": "attachment",
        "insight_type": "trait",
        "key": "attachment_style",
        "value": "anxious-preoccupied",
        "confidence": 0.82
      }
    ]
  }
}
```

**說明**：返回完整畫像數據。前端從此數據衍生 `has_data`（`narratives.length > 0`）、`richness_label`（根據 `richness_score` 閾值）、`last_interview_at`（需另從最近 session 取得或由前端 store 管理）。

### 9. 獲取洞察反饋歷史

**GET** `/api/v1/psych-profile/feedback`

**認證**：需要 JWT + `requireConsent`

**響應**：
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "session_id": "uuid",
        "feedback_card": "從你的故事中，我注意到了幾件事：\n1. 你很在乎關係中的公平...",
        "domains_touched": ["personality", "attachment"],
        "created_at": "2026-02-20T10:15:00Z",
        "updated_at": "2026-02-20T10:15:00Z"
      }
    ]
  }
}
```

**說明**：返回所有已完成 session 的反饋卡片歷史。前端 `FeedbackCard` 組件直接使用 `feedback_card` 字段渲染，`observations` 從反饋卡片文本中解析展示。

### 10. 清除畫像資料（遺忘權）

**DELETE** `/api/v1/psych-profile`

**認證**：需要 JWT + `requireConsent`

**響應**：
```json
{ "success": true, "message": "心理畫像相關資料已刪除" }
```

**說明**：級聯刪除 insights → narratives → turns → sessions，同時重設 `psych_consent_given = false`。✅ **ProfileSnapshot 保留**：已凍結的 snapshots（僅含 key/value，不含原始敘事）保留以維護判決紀錄完整性——設計與代碼一致（代碼註釋 `// ProfileSnapshot 保留`）。

### 11. 記錄知情同意

**POST** `/api/v1/psych-profile/consent`

**認證**：需要 JWT（無需 `requireConsent`，此端點本身就是建立同意）

**響應**：
```json
{ "success": true, "message": "已同意心理畫像知情同意" }
```

**說明**：設置 `User.psych_consent_given = true`、`psych_consent_at = now()`

### 訪談與心理畫像錯誤碼

> 完整錯誤碼定義見 [12-接口建設規範](./12-接口建設規範.md) §SSE 接口規範

| 錯誤碼 | HTTP / 通道 | 說明 |
|--------|-------------|------|
| `CONSENT_REQUIRED` | 403 | 用戶未同意知情同意（`requireConsent` 中間件） |
| `NOT_FOUND` | 404 | 訪談 session 不存在**或**不屬於當前用戶。⚠️ **實現說明**：代碼統一使用 `Errors.NOT_FOUND('訪談不存在或無權限')`，不區分 "不存在" 與 "無權限"（設計中的 `SESSION_NOT_FOUND` 和 `SESSION_NOT_OWNED` 已合併為單一 `NOT_FOUND`） |
| `SESSION_COMPLETED` | 409 | session 已結束（含 `completed` 和 `abandoned` 兩種狀態，統一使用此碼） |
| `MAX_TURNS_REACHED` | **422** | 已達最大 turn 數（硬限 25 輪，`INTERVIEW_MAX_TURNS`）。⚠️ **實現說明**：代碼返回 422（非 409），因為這是一種業務驗證失敗而非資源衝突 |
| `CONCURRENT_REQUEST` | 409 | session 正在處理中（mutex lock） |
| `TURN_TOO_FAST` | 429 | turn 間隔不足 3 秒 |
| `RATE_LIMIT_EXCEEDED` | 429 | 開始訪談頻率超限。⚠️ **實現說明**：代碼統一使用 `RATE_LIMIT_EXCEEDED`（設計中的 `START_RATE_LIMIT` 未被使用）。雙層觸發：① 中間件每用戶每小時 3 次；② 業務邏輯每用戶每天 5 個 substantive session（僅計 ≥ 3 輪） |
| `AI_CALL_FAILED` | SSE error 事件 | AI 調用失敗（重試 3 次仍失敗後，通過 SSE `error` 事件推送給前端）。⚠️ interview 的 retry 排除 429 和 401 |
| _(無專用碼)_ | 200 | polling `GET /:id` **始終返回 200**。⚠️ **實現說明**：設計曾規劃 `PROCESSING_NOT_DONE` (202) 和 `PROCESSING_FAILED` (500)，但代碼統一返回 200 + 完整 session 對象，前端從 `data.status` 判斷（`processing` / `completed` / `processing_failed`） |

> **備註**：
> - `AI_CALL_FAILED` 通過 SSE 流內 `error` 事件推送而非 HTTP status code，因為此時 SSE 連線已建立。前端應監聽此事件並顯示重試提示。
> - `retry` 端點對非 `processing_failed` 狀態的 session 返回 `VALIDATION_ERROR` (422)。
> - `end` 端點對非 `in_progress` 狀態的 session 返回 `VALIDATION_ERROR` (422)。

---

## 🛠️ 管理員後台 API（Round12 契約補充）

### Cron 統計（dashboard-ready）

**GET** `/api/v1/admin/jobs/stats`

**認證**：需要 Admin JWT  
**權限**：`ops:read`

**查詢參數**：

| 參數 | 類型 | 必填 | 默認 | 範圍 | 說明 |
|------|------|------|------|------|------|
| `days` | number | 否 | `7` | `1 ~ 90` | 回溯天數窗口 |
| `includeRunning` | boolean | 否 | `true` | - | 成功/失敗率分母是否包含 `running` |
| `maxRows` | number | 否 | `5000` | `100 ~ 20000` | 後端最多讀取的最新執行記錄數 |

> 實現細節：為判斷是否發生採樣，後端內部會查詢 `maxRows + 1` 筆，再裁切為 `maxRows`。

### 響應契約（穩定欄位）

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

### 分母語義說明（重要）

- `successRate` / `failureRate` 會依 `includeRunning` 切換：
  - `includeRunning=true` → 分母是 `totalRuns`
  - `includeRunning=false` → 分母是 `completedRuns`
- `successRateCompleted` / `failureRateCompleted` 永遠以 `completedRuns` 為分母（固定語義）。

### 範例 A：`includeRunning=true`（預設）

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

### 範例 B：`includeRunning=false`

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

### 向後相容與版本演進

- 舊欄位 `totalRuns/successRuns/failedRuns/runningRuns/avgDurationMs` 保留，既有前端不會中斷。
- 新增欄位（向後相容擴充）：
  - `completedRuns`
  - `successRateCompleted` / `failureRateCompleted`
  - `rateBase`
  - `statsMeta.maxRows` / `statsMeta.returnedRows` / `statsMeta.sampled` / `statsMeta.sampleStrategy`
- 建議前端策略：
  - 若不存在 `rateBase`，可回退為 `total_runs` 解讀（兼容舊版）。
  - 優先使用 `statsMeta.sampled` 呈現「資料已採樣」提示，避免誤讀為全量統計。

---

## 📚 相關文檔

- [後端架構設計](./01-後端架構設計.md)
- [數據庫設計](./02-數據庫設計.md)
- [服務層設計](./04-服務層設計.md)
- [中間件和安全](./05-中間件和安全.md)

---

**文檔版本**：v2.2  
**最後更新**：2026-02-20（v2.2：新增 admin `/api/v1/admin/jobs/stats` 契約、`includeRunning` 分母語義、`maxRows` 採樣元資訊、向後相容說明；v2.1：訪談/畫像 API 與源碼對齊——修正路由參數 `:id`、請求欄位 `message`、響應結構、SSE 實現說明、合併 result/history 為 GET /:id、新增 retry 端點；v2.0：新增心理畫像與 AI 訪談 API，共 11 個端點）
