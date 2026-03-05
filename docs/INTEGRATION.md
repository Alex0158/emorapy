# 前後端集成指南（代碼對齊版）

**文檔版本**：v3.0  
**最後更新**：2026-03-05  
**對齊基準**：`backend/src/app.ts`、`frontend/src/router/index.tsx`、`frontend/src/services/*`

---

## 1. 啟動與基礎連通

### 1.1 後端

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

預設：`http://localhost:3001`

### 1.2 前端

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

預設：`http://localhost:5173`  
`VITE_API_BASE_URL` 應指向 `http://localhost:3001/api/v1`

---

## 2. 實作中的集成邊界

### 2.1 後端掛載路由（`app.ts`）

- 健康/指標：`/health`、`/health/ready`、`/health/live`、`/metrics`
- API 前綴：`/api/v1/*`
  - auth/sessions/user/profile/pairing/cases/judgments/reconciliation/execution/content/notification
  - interview/psych-profile
  - chat
  - admin

### 2.2 前端路由（`router/index.tsx`）

- 快速體驗：`/quick-experience/create`、`/quick-experience/result/:id`、`/quick-experience/collaborative`
- 正式流程：case/judgment/reconciliation/execution/profile/interview
- 聊天室：`/chat/room`、`/chat/room/:roomId`

### 2.3 前端 API 調用層

- REST：`frontend/src/services/api/*`
- 訪談 SSE：`frontend/src/services/sseRequest.ts`
- 聊天室 SSE：`frontend/src/services/api/chat.ts`（`connectChatStream`）

---

## 3. 端到端流程（當前實作）

### 3.1 快速體驗

1. `POST /sessions/quick|refresh`
2. `POST /cases/quick`
3. （可選）`POST /cases/:id/evidence`
4. `GET /cases/:id/judgment`
5. 前端結果頁渲染 + 註冊引導

### 3.2 訪談與心理畫像

1. `POST /psych-profile/consent`（首次）
2. `POST /interview/start`
3. `POST /interview/:id/respond|skip`（SSE）
4. `POST /interview/:id/end`
5. pipeline：分類 -> 摘要 -> 洞察 -> richness -> feedback
6. `GET /interview/:id` / `GET /psych-profile` / `GET /psych-profile/feedback`

### 3.3 聊天室轉判決

1. `POST /chat/rooms`
2. `POST /chat/rooms/:roomId/invites`
3. `POST /chat/invites/:inviteCode/accept`
4. `POST /chat/rooms/:roomId/messages` + SSE stream
5. `POST /chat/rooms/:roomId/request-judgment`（目前需 A 方）
6. `GET /chat/rooms/:roomId/judgment-status`

---

## 4. 驗證檢查清單

- `GET /health` 返回 `healthy` 或 `degraded`（非 500）
- 快速體驗能完成建案與取判決
- 訪談頁 SSE 有 `token/metadata/complete` 事件
- 聊天室 stream 有 `ready/ping/message`
- `request-judgment` 後 room 狀態可達 `judgment_completed|judgment_failed`

---

## 5. 常見錯誤對照

- `CONSENT_REQUIRED`：前端需先走 consent
- `RATE_LIMIT_EXCEEDED`：命中全域或業務限流
- `MAX_TURNS_REACHED`：訪談達上限
- `TURN_TOO_FAST`：訪談回覆間隔不足
- `CONCURRENT_REQUEST`：同一訪談同時送出 respond
- `CASE_NOT_READY`：聊天轉判決資料不足/安全路由阻擋

---

## 6. 備註

- 本文件僅記錄「已實作」集成面；規劃內容請放在設計稿，不放在此文件。
