# 環境配置文檔

本文檔詳細說明熊媽媽法庭項目的環境配置和開發/生產環境分離策略。

## 📋 目錄

- [環境概述](#環境概述)
- [環境變量配置](#環境變量配置)
- [開發環境配置](#開發環境配置)
- [生產環境配置](#生產環境配置)
- [環境分離策略](#環境分離策略)
- [構建配置](#構建配置)
- [驗證和檢查](#驗證和檢查)

## 🌍 環境概述

項目支持兩種主要環境：

1. **開發環境 (Development)**
   - 用於本地開發和調試
   - 啟用詳細日誌和調試信息
   - 使用本地數據庫和服務

2. **生產環境 (Production)**
   - 用於正式部署
   - 優化性能和安全性
   - 使用生產數據庫和服務

> 建議新增 **Staging/Preview**：使用與生產相同的配置（含外部依賴），僅用測試資料，供聯調與迭代驗證。端口/域名按部署平台自動分配，環境變量與 Production 一致但憑證不同。

## 🔧 環境變量配置

### 後端環境變量

後端環境變量配置文件：`backend/.env`

#### 必需變量

| 變量名 | 說明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 連接字符串 | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | JWT 簽名密鑰（至少32字符） | `your-super-secret-key-32-chars-min` |
| `OPENAI_API_KEY` | OpenAI API 密鑰 | `sk-...` |

#### 可選變量

| 變量名 | 說明 | 默認值 |
|--------|------|--------|
| `PORT` | 服務器端口 | `3001`（`.env.example`）。⚠️ `env.ts` 代碼 fallback 為 `3000`，但運行時由 `.env` 覆蓋 |
| `NODE_ENV` | 運行環境 | `development` |
| `JWT_EXPIRES_IN` | JWT 過期時間 | `7d`（`.env.example`）。⚠️ `env.ts` 代碼 fallback 為 `24h`，但運行時由 `.env` 覆蓋 |
| `OPENAI_MODEL` | OpenAI 模型 | `gpt-3.5-turbo` |
| `OPENAI_MAX_TOKENS` | 最大 Token 數 | `2000` |
| `OPENAI_DAILY_LIMIT` | 每日調用限制 | `1000` |
| `SMTP_HOST` | SMTP 服務器 | - |
| `SMTP_PORT` | SMTP 端口 | `587` |
| `SMTP_USER` | SMTP 用戶名 | - |
| `SMTP_PASS` | SMTP 密碼 | - |
| `UPLOAD_DIR` | 文件上傳目錄 | `./uploads` |
| `MAX_FILE_SIZE` | 最大文件大小（字節） | `5242880` (5MB) |
| `FRONTEND_URL` | 前端 URL | `http://localhost:5173` |
| `ALLOWED_ORIGINS` | 允許的 CORS 來源 | `http://localhost:5173` |
| `FILE_BASE_URL` | 文件訪問基礎 URL（返回上傳文件可訪問地址） | `http://localhost:3001` |
| `METRICS_ENABLED` | 是否啟用 `/metrics` | `true` |
| `METRICS_TOKEN` | `/metrics` 保護 token（Header: `X-Metrics-Token`） | - |
| `METRICS_ALLOWED_IPS` | `/metrics` 允許抓取來源 IP（逗號分隔） | - |

#### v2.0 新增（心理畫像系統）

| 變量名 | 說明 | 默認值 |
|--------|------|--------|
| `OPENAI_INTERVIEW_MODEL` | 訪談對話模型 | `gpt-4o-mini` |
| `OPENAI_ANALYSIS_MODEL` | 分析/提取模型 | `gpt-4o` |
| `INTERVIEW_MAX_TURNS` | 訪談最大 turn 數（硬限） | `25` |
| `INTERVIEW_SOFT_TARGET` | AI 建議結束的 turn 數 | `15` |
| `INTERVIEW_TURN_INTERVAL_MS` | turn 最小間隔（毫秒） | `3000` |
| `INTERVIEW_START_RATE_LIMIT` | start 端點每用戶每小時最多請求數（express-rate-limit 中間件，防濫用，不計 turn 數） | `3` |
| `INTERVIEW_DAILY_SESSION_LIMIT` | 每用戶每天最多 substantive session 數（業務邏輯，僅計 ≥ 3 輪的 session） | `5` |
| `REDIS_URL` | Redis URL（用於分佈式鎖、訪談 session mutex、以及 Chat minute-bucket metrics） | - |

> 若不配置 `REDIS_URL`，mutex lock 會 fallback 到 PostgreSQL advisory lock。

詳細說明請參考 `backend/.env.example`。後端另有可選變量（如 `AI_MOCK`、`ENABLE_SCHEDULED_JOBS`、`DB_CONNECT_TIMEOUT`、`DB_RETRY_INTERVAL` 等），這些僅在 `backend/src/config/env.ts` 中定義默認值，未列入 `.env.example`。

### 前端環境變量

前端環境變量配置文件：`frontend/.env`

**注意**：Vite 要求環境變量必須以 `VITE_` 開頭才能在代碼中訪問。

#### 必需變量

| 變量名 | 說明 | 示例 |
|--------|------|------|
| `VITE_API_BASE_URL` | 後端 API 基礎 URL | `http://localhost:3001/api/v1` |

#### 可選變量

| 變量名 | 說明 | 默認值 |
|--------|------|--------|
| `VITE_APP_TITLE` | 應用標題 | `熊媽媽法庭` |
| `VITE_APP_DESCRIPTION` | 應用描述 | `大愛、包容、保護、呵護...` |
| `VITE_GA_TRACKING_ID` | Google Analytics ID | - |
| `VITE_SENTRY_DSN` | Sentry 錯誤追蹤 DSN | - |

詳細說明請參考 `frontend/.env.example`

## 💻 開發環境配置

### 快速開始

1. **複製環境變量示例文件**

```bash
# 後端
cd backend
cp .env.example .env
# 編輯 .env 文件，填入實際配置值

# 前端
cd frontend
cp .env.example .env
# 編輯 .env 文件，填入實際配置值
```

2. **安裝依賴**

```bash
# 後端
cd backend
npm install

# 前端
cd frontend
npm install
```

3. **啟動開發服務器**

```bash
# 後端（終端1）
cd backend
npm run dev

# 前端（終端2）
cd frontend
npm run dev
```

### 開發環境特性

- ✅ 啟用詳細日誌（debug 級別）
- ✅ 控制台輸出所有日誌
- ✅ 生成 sourcemap 用於調試
- ✅ 顯示詳細錯誤信息（包括堆棧）
- ✅ 熱重載支持
- ✅ 數據庫查詢日誌

## 🚀 生產環境配置

### 構建步驟

1. **配置環境變量**

確保所有環境變量都已正確配置，特別是：
- `NODE_ENV=production`
- `FRONTEND_URL` 和 `ALLOWED_ORIGINS` 使用 HTTPS
- 強隨機的 `JWT_SECRET`
- 真實的 `OPENAI_API_KEY`

2. **構建後端**

```bash
cd backend
npm run build:prod  # 生產環境構建（不生成 sourcemap）
# 或
npm run build      # 開發構建（生成 sourcemap）
```

3. **構建前端**

```bash
cd frontend
npm run build  # 自動檢測生產環境，優化構建
```

### 生產環境特性

- ✅ 僅記錄 info 級別及以上日誌
- ✅ 不輸出調試信息到控制台
- ✅ 不生成 sourcemap（減小體積）
- ✅ 代碼壓縮和優化
- ✅ 移除 console 和 debugger
- ✅ 隱藏詳細錯誤信息（僅顯示友好消息）
- ✅ 啟用錯誤追蹤（如 Sentry）

## 🔀 環境分離策略

### 1. 環境變量分離

- **開發環境**：使用 `.env` 文件（不提交到版本控制）
- **生產環境**：使用部署平台的環境變量配置

### 2. 日誌級別分離

**後端** (`backend/src/config/logger.ts`):
```typescript
level: env.NODE_ENV === 'production' ? 'info' : 'debug'
```

**前端** (`frontend/src/utils/logger.ts`):
```typescript
if (import.meta.env.DEV) {
  console.debug(...)  // 僅開發環境輸出
}
```

### 3. 錯誤處理分離

**後端** (`backend/src/middleware/errorHandler.ts`):
- 開發環境：返回詳細錯誤信息（包括堆棧和 details）
- 生產環境：僅返回友好錯誤消息

**前端** (`frontend/src/components/common/ErrorBoundary.tsx`):
- 開發環境：控制台輸出詳細錯誤
- 生產環境：發送到 Sentry（如配置）

### 4. 構建配置分離

**後端**:
- 開發構建：`npm run build`（生成 sourcemap）
- 生產構建：`npm run build:prod`（不生成 sourcemap）

**前端**:
- 自動檢測環境：`npm run build`
- 開發環境：生成 sourcemap，不壓縮
- 生產環境：不生成 sourcemap，terser 壓縮，移除 console

### 5. 數據庫日誌分離

**後端** (`backend/src/config/database.ts`):
```typescript
log: env.NODE_ENV === 'development' 
  ? ['query', 'error', 'warn'] 
  : ['error']
```

## 🛠️ 構建配置

### 後端構建

#### 開發構建 (`tsconfig.json`)
- 生成 sourcemap
- 生成類型聲明文件
- 保留註釋

#### 生產構建 (`tsconfig.prod.json`)
- 不生成 sourcemap
- 不生成類型聲明文件
- 移除註釋
- 啟用未使用變量檢查

**使用方式**:
```bash
npm run build:prod  # 生產構建
```

### 前端構建

#### Vite 配置 (`frontend/vite.config.ts`)

**開發環境**:
- 生成 sourcemap
- 不壓縮代碼
- 保留 console 和 debugger

**生產環境**:
- 不生成 sourcemap
- terser 壓縮
- 移除 console 和 debugger
- 代碼分割優化

**使用方式**:
```bash
npm run build  # 自動檢測環境
```

## ✅ 驗證和檢查

### 環境變量驗證

運行驗證腳本檢查環境變量配置：

```bash
./scripts/validate-env.sh
```

腳本會檢查：
- ✅ 必需環境變量是否存在
- ✅ 環境變量格式是否正確
- ✅ 生產環境安全配置
- ✅ 環境變量示例文件是否存在

### 手動驗證

#### 後端環境驗證

後端啟動時會自動驗證環境變量（`backend/src/config/env.ts`）：
- 檢查必需變量
- 驗證變量格式
- 生產環境額外檢查（如 JWT_SECRET 強度）

#### 前端環境驗證

前端在加載時會驗證環境變量（`frontend/src/config/env.ts`）：
- 檢查 API URL 配置
- 生產環境必須配置 API URL
- 驗證 HTTPS 使用

## 🔒 安全注意事項

### 開發環境

- ✅ 可以使用較弱的 JWT_SECRET（但建議仍使用強密鑰）
- ✅ 可以使用示例 API 密鑰進行測試
- ✅ 允許 HTTP 連接

### 生產環境

- ❌ **禁止**使用默認或示例密鑰
- ❌ **禁止**使用示例 API 密鑰
- ❌ **禁止**使用 HTTP（必須使用 HTTPS）
- ✅ JWT_SECRET 必須至少 32 字符
- ✅ 所有敏感信息必須使用強隨機值

## 📝 最佳實踐

1. **環境變量管理**
   - 始終從 `.env.example` 創建 `.env`
   - 不要將 `.env` 提交到版本控制
   - 定期更新 `.env.example` 以反映新變量

2. **構建流程**
   - 開發時使用 `npm run dev`
   - 生產構建使用 `npm run build:prod`（後端）
   - 生產構建使用 `npm run build`（前端）

3. **部署前檢查**
   - 運行 `./scripts/validate-env.sh` 驗證配置
   - 確認所有必需變量已設置
   - 確認生產環境使用 HTTPS
   - 確認敏感信息已正確配置

4. **監控和日誌**
   - 開發環境：使用控制台日誌
   - 生產環境：配置 Sentry 或其他錯誤追蹤服務
   - 定期檢查日誌文件

## 🐛 常見問題

### Q: 如何生成強隨機 JWT_SECRET？

```bash
openssl rand -base64 32
```

### Q: 開發環境和生產環境使用不同的數據庫嗎？

是的，建議：
- 開發環境：本地 PostgreSQL 或 Supabase 開發實例
- 生產環境：Supabase 生產實例或專用數據庫服務

### Q: 如何切換環境？

通過 `NODE_ENV` 環境變量：
- 開發：`NODE_ENV=development` 或不設置（默認）
- 生產：`NODE_ENV=production`

### Q: 前端如何知道當前環境？

前端使用 Vite 的內置環境變量：
- `import.meta.env.DEV` - 是否為開發環境
- `import.meta.env.PROD` - 是否為生產環境

## 📚 相關文檔

- [後端開發指南](./backend/DEVELOPMENT.md)
- [前端開發指南](./frontend/README.md)
- [發佈流程指引](./發佈流程指引.md)、[後端部署與運維](後端設計/11-部署和運維.md)

---

**文檔版本**：v2.0  
**最後更新**：2026-02-21（v2.0：新增 `INTERVIEW_START_RATE_LIMIT`、修正 `INTERVIEW_MAX_TURNS` 默認值 25、v2.0 環境變量完整覆蓋）
