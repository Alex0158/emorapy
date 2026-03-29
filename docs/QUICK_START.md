# 快速開始指南（代碼對齊版）

**文檔版本**：v3.2  
**最後更新**：2026-03-09  
**對齊基準**：`backend/package.json`、`frontend/package.json`、`scripts/*.sh`

---

## 1. 前置要求

- Node.js `>= 20.19.0`（前後端 `engines.node`）
- npm（專案含 `package-lock.json`）
- PostgreSQL（本地或雲端）

---

## 2. 5 分鐘啟動（推薦手動）

### 2.1 啟動後端

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

後端預設：`http://localhost:3001`

### 2.2 啟動前端（新終端）

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

前端預設：`http://localhost:5173`

---

## 3. 一鍵啟動（可選）

```bash
./scripts/start-dev.sh
```

說明：

- 會背景啟動前後端並輸出到 `logs/backend.log`、`logs/frontend.log`
- 依賴你已先完成必要安裝與 `.env` 配置

---

## 4. 快速驗證

### 4.1 集成驗證腳本

```bash
./scripts/verify-integration.sh
```

此腳本會檢查：

- `GET /health`
- `POST /api/v1/sessions/quick`

### 4.2 手動驗證

1. 打開 `http://localhost:5173`
2. 進入快速體驗並提交案件
3. 於結果頁確認判決可讀取

---

## 5. 核心流程入口

### 5.1 快速體驗

- 前端：`/quick-experience/create`
- 主要 API：
  - `POST /api/v1/sessions/quick`
  - `POST /api/v1/sessions/refresh`
  - `POST /api/v1/cases/quick`
  - `GET /api/v1/cases/:id/judgment`
  - `POST /api/v1/auth/claim-session`（登入/註冊成功後隱式承接）

### 5.2 完整模式（登入後）

- 註冊/登入 -> 配對 -> 建案 -> 判決 -> 和好方案 -> 執行追蹤

### 5.3 訪談畫像（可選）

- 路由：`/interview/:sessionId`、`/interview/:sessionId/result`
- 前置：需 consent（否則後端回 `CONSENT_REQUIRED`）

### 5.4 聊天室轉判決

- 路由：`/chat/room`、`/chat/room/:roomId`
- API：`/api/v1/chat/*`
- 補充：匿名 A 房主建立 invite 時，需 `room.session_id` 與當前 `canonical session_id` 匹配
- 補充：B 接受 invite 前需先登入，`accept invite` 已收斂為 `User only`
- judgment ready 後，未登入用戶會先跳 `/auth/login`，再回跳 `/judgment/:id`

---

## 6. 測試與本地 CI

### 6.1 後端

```bash
cd backend
npm run test:unit
npm run test:integration
npm run test:integration:flow
```

### 6.2 前端

```bash
cd frontend
npm run test
npm run test:coverage
```

### 6.3 本地 CI 快速回歸

```bash
./scripts/ci-local.sh
```

包含：

- backend `test:unit` + build
- frontend `test:run` + build

---

## 7. 常見問題（現況）

### 後端起不來

- 檢查 `.env` 是否具備：`DATABASE_URL`、`JWT_SECRET`、`OPENAI_API_KEY`
- 檢查遷移是否完成：`npm run prisma:migrate`

### 前端請求失敗

- 檢查 `frontend/.env` 的 `VITE_API_BASE_URL`
- 檢查後端是否在 `3001` 啟動

### 訪談打不開

- 常見原因：未 consent -> 403 `CONSENT_REQUIRED`
- 先觸發 `POST /api/v1/psych-profile/consent`

### 聊天室轉判決失敗

- 常見原因：目前版本需 A 方觸發、或可納入訊息不足（`CASE_NOT_READY`）

---

## 8. 延伸閱讀

- `docs/INTEGRATION.md`
- `docs/ENVIRONMENT.md`
- `docs/核心開發文件/功能特性清單.md`
- `docs/後端設計/03-API設計.md`
