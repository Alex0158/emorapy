# 前後端集成指南

## 📋 概述

本文檔說明如何啟動和運行完整的前後端系統。

## 🚀 快速開始

### 1. 後端啟動

```bash
cd backend

# 安裝依賴
npm install

# 配置環境變量
cp .env.example .env
# 編輯 .env 文件，填入必要的配置

# 生成Prisma Client
npm run prisma:generate

# 運行數據庫遷移
npm run prisma:migrate

# 啟動開發服務器
npm run dev
```

後端將運行在 `http://localhost:3001`

### 2. 前端啟動

```bash
cd frontend

# 安裝依賴
npm install

# 配置環境變量
cp .env.example .env
# 確保 VITE_API_BASE_URL=http://localhost:3001/api/v1

# 啟動開發服務器
npm run dev
```

前端將運行在 `http://localhost:5173`

## 🔗 API對接

### 基礎配置

前端通過 `VITE_API_BASE_URL` 環境變量配置後端地址。

開發環境默認配置：
- 前端：`http://localhost:5173`
- 後端：`http://localhost:3001`
- API基礎URL：`http://localhost:3001/api/v1`

### 代理配置

前端Vite配置了代理，開發環境下 `/api` 請求會自動代理到後端：

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
  },
}
```

## 📡 接口對接驗證

### 1. 健康檢查

```bash
# 檢查後端健康狀態（/health）
curl http://localhost:3001/health
```

### 2. Session創建（快速體驗模式）

```bash
# 創建Session（快速體驗）
curl -X POST http://localhost:3001/api/v1/sessions/quick
```

### 3. 案件創建（快速體驗模式）

```bash
# 創建案件
curl -X POST http://localhost:3001/api/v1/cases/quick \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: guest_xxx" \
  -d '{
    "plaintiff_statement": "測試原告陳述...",
    "defendant_statement": "測試被告陳述..."
  }'
```

### 4. 聊天室（Chat v1）基本驗證（可選）

```bash
# 建立聊天室（匿名示例：請自行帶 X-Session-Id）
curl -X POST http://localhost:3001/api/v1/chat/rooms \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: guest_xxx" \
  -d '{"history_visibility_mode":"share_summary_only"}'

# 讀取 / 發訊息 / 分頁 / SSE 等，詳見 docs/backend/API.md 的「聊天室（Chat v1）」段落

# Prometheus 指標（非 /api/v1）
curl http://localhost:3001/metrics
# 生產環境若設置 METRICS_TOKEN，需附帶：
# -H "X-Metrics-Token: <your-token>"
```

## 🔐 認證流程

### 完整模式認證流程

1. **用戶註冊**
   ```typescript
   POST /api/v1/auth/register
   {
     "email": "user@example.com",
     "password": "password123",
     "nickname": "用戶暱稱"
   }
   ```

2. **用戶登錄**
   ```typescript
   POST /api/v1/auth/login
   {
     "email": "user@example.com",
     "password": "password123"
   }
   ```

3. **獲取Token**
   - 響應中包含 `token`
   - 前端存儲到 `localStorage`

4. **後續請求**
   - 在請求頭中添加：`Authorization: Bearer <token>`

### 快速體驗模式流程

1. **創建Session**
   ```typescript
   POST /api/v1/sessions/quick
   ```

2. **獲取Session ID**
   - 響應中包含 `session_id`
   - 前端存儲到 `localStorage`

3. **後續請求**
   - 在請求頭中添加：`X-Session-Id: <session_id>`
   - 或在查詢參數中添加：`?session_id=<session_id>`

> 補充：Session 初始有效期 24 小時；判決生成成功後會延長到 7 天。

## 🔄 數據流程

### 快速體驗模式流程

```
1. 用戶訪問快速體驗頁面
   ↓
2. 前端自動創建Session（如果沒有）
   ↓
3. 用戶填寫案件信息
   ↓
4. 前端提交案件（POST /cases/quick）
   ↓
5. 後端創建案件並異步觸發AI判決生成
   ↓
6. 前端輪詢判決狀態（GET /judgments/:id）
   ↓
7. 判決生成完成，前端展示結果
```

### 完整模式流程

```
1. 用戶註冊/登錄
   ↓
2. 創建配對（生成邀請碼）
   ↓
3. 對方使用邀請碼加入配對
   ↓
4. 創建案件（POST /cases）
   ↓
5. 後端生成判決
   ↓
6. 雙方查看判決
   ↓
7. 生成和好方案
   ↓
8. 選擇方案並執行追蹤
```

## 🐛 常見問題

### 1. CORS錯誤

**問題**: 前端請求後端時出現CORS錯誤

**解決**:
- 檢查後端 `ALLOWED_ORIGINS` 配置
- 確保包含前端地址：`http://localhost:5173`

### 2. 401未認證錯誤

**問題**: 請求返回401錯誤

**解決**:
- 檢查Token是否正確存儲
- 檢查Token是否過期
- 確認請求頭中包含 `Authorization: Bearer <token>`

### 3. Session過期

**問題**: 快速體驗模式Session過期

**解決**:
- Session有效期24小時
- 已完成案件的Session延長到7天
- 如果過期，前端應自動創建新Session

### 4. API路徑不匹配

**問題**: 404錯誤，接口不存在

**解決**:
- 檢查API路徑是否正確
- 確認後端路由已正確註冊
- 檢查API版本號（`/api/v1`）

## 📊 接口對接檢查清單

### 認證相關
- [ ] 用戶註冊
- [ ] 用戶登錄
- [ ] Token驗證
- [ ] 郵件驗證碼發送
- [ ] 郵件驗證

### Session相關
- [ ] Session創建
- [ ] Session驗證
- [ ] Session過期處理

### 案件相關
- [ ] 快速體驗案件創建
- [ ] 完整模式案件創建
- [ ] 案件查詢
- [ ] 證據上傳

### 判決相關
- [ ] 判決生成
- [ ] 判決查詢
- [ ] 判決接受/拒絕

### 和好方案相關
- [ ] 方案生成
- [ ] 方案查詢
- [ ] 方案選擇

### 執行相關
- [ ] 執行確認
- [ ] 執行打卡
- [ ] 執行狀態查詢

## 🔍 調試技巧

### 1. 查看網絡請求

- 瀏覽器開發者工具 → Network
- 檢查請求URL、請求頭、請求體
- 檢查響應狀態碼、響應體

### 2. 查看後端日誌

```bash
# 後端日誌位置
backend/logs/combined.log
backend/logs/error.log
```

### 3. 使用Postman/Insomnia測試

- 導入API文檔
- 測試各個接口
- 驗證請求/響應格式

---

## 個人化判決系統集成要點（v2.0）

- **SSE 流式訪談**：訪談回答使用 `fetch` + `ReadableStream` 消費 SSE（因需 POST + Bearer token，不使用 EventSource）；收到 5 種事件（`token` / `metadata` / `safety_alert` / `complete` / `error`）後更新 UI。⚠️ **實現說明**：後端為**非逐字流式**——先完成整次 AI 呼叫取得單一 JSON 回應，再由 `interview.service.ts` 解析後依序推送 SSE 事件（`token` → `metadata` → `safety_alert`（如有）→ `complete`）。
- **異步管線輪詢**：訪談結束（`POST /interview/:id/end`）後，後端異步執行 5 步管線：**敘事提取 → 敘事摘要 → 洞察提取 → 豐富度計算 → 反饋卡片生成**；前端以 **輪詢**（`GET /interview/:id`，建議間隔 3s）取得 `processing` → `completed` 或 `processing_failed`，再展示反饋卡片或調用 `POST /interview/:id/retry` 重試。
- **知情同意機制**：訪談相關 API 路由受 `requireConsent` 中間件保護。未同意的用戶直接收到 **403** 錯誤碼 **CONSENT_REQUIRED**（非 200 且非 response body 中的欄位）。前端應在進入訪談前檢查 consent 狀態，未同意則顯示 `ConsentModal`，同意後調用 `POST /psych-profile/consent`。
- **訪談觸發點**：在既有流程中可於以下時機跳轉至訪談：`pre_case`（判決前引導）、`post_judgment`（判決後引導）、`organic`（個人中心入口）、`onboarding`（首次登入引導）；觸發時先檢查 consent，再進入訪談頁呼叫 `POST /interview/start` 或 `GET /interview/resume`。
- **限流規則**：`POST /interview/start` 雙層限流——①中間件：每用戶每小時 3 次（express-rate-limit，防濫用）；②業務邏輯：每用戶每天 5 個 substantive session（僅計 ≥3 輪）；`POST /interview/:id/respond` 每 session 最多 25 輪、每輪最少間隔 3 秒。

### 訪談與心理畫像 API 端點一覽

| # | 方法 | 路徑 | 說明 |
|---|------|------|------|
| 1 | POST | `/api/v1/interview/start` | 開始新訪談（trigger: pre_case/post_judgment/organic/onboarding） |
| 2 | POST | `/api/v1/interview/:id/respond` | 回答問題（SSE 流式回應） |
| 3 | POST | `/api/v1/interview/:id/skip` | 跳過當前問題 |
| 4 | POST | `/api/v1/interview/:id/end` | 結束訪談（觸發異步管線） |
| 5 | GET | `/api/v1/interview/:id` | 取得 session 詳情（含 turns、pipeline 狀態、feedback_card） |
| 6 | GET | `/api/v1/interview/resume` | 取得用戶當前 in_progress session |
| 7 | POST | `/api/v1/interview/:id/retry` | 重試失敗的異步管線 |
| 8 | GET | `/api/v1/psych-profile` | 取得心理畫像概覽（narratives + insights） |
| 9 | GET | `/api/v1/psych-profile/feedback` | 取得洞察反饋歷史 |
| 10 | DELETE | `/api/v1/psych-profile` | 清除所有畫像資料（遺忘權） |
| 11 | POST | `/api/v1/psych-profile/consent` | 給予知情同意 |

詳細規格見 [03-API設計](./後端設計/03-API設計.md) §心理畫像與 AI 訪談 API。

### 訪談與心理畫像錯誤碼

| HTTP | 錯誤碼 | 說明 | 觸發情境 |
|------|--------|------|---------|
| 403 | CONSENT_REQUIRED | 未同意知情同意 | requireConsent 中間件攔截 |
| 404 | NOT_FOUND | Session 不存在或不屬於用戶（⚠️ 代碼使用 `NOT_FOUND`，非 `SESSION_NOT_FOUND`） | GET/POST /:id/* |
| 409 | SESSION_COMPLETED | Session 已完成，無法操作 | respond/skip/end |
| 422 | MAX_TURNS_REACHED | 已達 25 輪上限（⚠️ 代碼為業務驗證失敗，返回 422 而非 409） | respond |
| 409 | CONCURRENT_REQUEST | 同一 session 併發請求 | respond（mutex lock） |
| 429 | TURN_TOO_FAST | 兩次回答間隔 < 3 秒 | respond |
| 429 | RATE_LIMIT_EXCEEDED | 開始訪談頻率超限。⚠️ 代碼統一使用 `RATE_LIMIT_EXCEEDED`（設計中的 `START_RATE_LIMIT` 未被使用）。雙層觸發：① 中間件每用戶每小時 3 次；② 業務邏輯每用戶每天 5 個 substantive session | start |
| 200 | _(無專用碼)_ | `GET /:id` 始終返回 200。前端從 `data.status` 判斷（`processing` → 繼續輪詢、`completed` → 展示、`processing_failed` → 重試）。⚠️ 設計曾規劃 `PROCESSING_NOT_DONE` (202)，但未實現 | GET /:id |
| SSE | AI_CALL_FAILED | AI 呼叫失敗 | respond SSE error 事件 |

---

## 🧠 SSE 集成指南（v2.0 新增）

訪談系統使用 **Server-Sent Events** 進行流式通信，前後端集成需注意以下要點。

### 後端（Express）

```typescript
// interview.controller.ts - respond endpoint
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.setHeader('X-Accel-Buffering', 'no'); // Nginx 反向代理需要

// 使用 callback-based SSE（非 AsyncGenerator）
await interviewService.respond(sessionId, userId, message, (event) => {
  res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
});
res.end();
```

### 前端（React + Zustand）

```typescript
// services/sseRequest.ts — ⚠️ 實際前端也是 callback-based（非 AsyncGenerator）
export async function sseRequest(
  url: string,
  body: Record<string, unknown>,
  callbacks: {
    onToken: (text: string) => void;
    onMetadata: (meta: object) => void;
    onSafetyAlert?: (msg: object) => void;
    onComplete: (data: object) => void;
    onError?: (err: object) => void;
  }
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const reader = response.body!.getReader();
  // 解析 SSE 格式，調用對應 callback
}
```

### 事件類型對照

| SSE event name | data 格式 | 前端處理 |
|----------------|-----------|---------|
| `token` | `{ text: string }` | 追加到 pendingMessage → 渲染氣泡 |
| `metadata` | `{ intent, target_domains, should_end, safety_flag }` | 存儲元數據 |
| `safety_alert` | `{ message, severity }` | 暫停 + SafetyAlert 組件渲染（✅ 已接 SSE：store `onSafetyAlert` → `safetyAlert` state → Chat 渲染 SafetyAlert；severity=critical 時顯示危機熱線） |
| `error` | `{ code, message }` | Toast 提示 |
| `complete` | `{ session_id, status }` | 寫入 turns → 恢復輸入 |

### Nginx 配置注意

```nginx
location /api/v1/interview/ {
  proxy_buffering off;
  proxy_cache off;
  proxy_set_header Connection '';
  chunked_transfer_encoding off;
}
```

### 測試要點

- 使用 `curl` 測試 SSE：`curl -N -H "Authorization: Bearer ..." -X POST -d '{"message":"test"}' /api/v1/interview/:id/respond`
- 驗證斷線後後端仍完成 AI call 並存儲 turn
- 驗證前端 getSession 能恢復斷線前的對話

---

**文檔版本**：v2.1  
**最後更新**：2026-02-21（v2.1：補充 11 端點一覽、錯誤碼表、SSE 實現說明、限流規則、consent 403 機制、管線順序修正、callback-based SSE 範例）

---

## 📚 相關文檔

- [後端API文檔](./backend/API.md)
- [前端開發指南](./frontend/README.md)
- [後端開發指南](./backend/DEVELOPMENT.md)
- [API設計（訪談SSE）](./後端設計/03-API設計.md)
- [接口建設規範（SSE規範）](./後端設計/12-接口建設規範.md)
