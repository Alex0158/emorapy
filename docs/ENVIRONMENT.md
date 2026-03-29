# 環境配置文檔（代碼對齊版）

**文檔版本**：v3.1  
**最後更新**：2026-03-06  
**對齊基準**：`backend/src/config/env.ts`、`backend/.env.example`、`frontend/.env.example`

---

## 1. 環境分層

- `development`：本地開發
- `test`：測試流程（可配合 `SKIP_DB_INIT`）
- `production`：正式環境（會啟用更嚴格檢查）

---

## 2. 後端環境變量

檔案：`backend/.env`

### 2.1 必填（程式啟動即校驗）

- `DATABASE_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY`

若缺少，`env.ts` 會直接拋錯中止啟動。

### 2.2 主要配置（含預設值）

| 變量 | 預設值 | 說明 |
|---|---:|---|
| `PORT` | `3000` | 服務端口（`.env.example` 建議填 `3001`） |
| `NODE_ENV` | `development` | 執行環境 |
| `REDIS_URL` | - | Redis（鎖/快取） |
| `AI_MOCK` | `false` | AI mock 模式 |
| `JWT_EXPIRES_IN` | `24h` | token 壽命 |
| `OPENAI_MODEL` | `gpt-3.5-turbo` | 通用模型 |
| `OPENAI_MAX_TOKENS` | `2000` | OpenAI token 上限 |
| `OPENAI_DAILY_LIMIT` | `1000` | 每日 OpenAI 配額 |
| `UPLOAD_DIR` | `./uploads` | 上傳目錄 |
| `MAX_FILE_SIZE` | `5242880` | 檔案大小上限（5MB） |
| `FRONTEND_URL` | `http://localhost:5173` | 前端 URL |
| `FILE_BASE_URL` | 推導值 | 檔案可訪問基礎 URL |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | CORS 來源列表；生產環境若前台為 Vercel 預設網域（如 `https://mother-bear-court.vercel.app`），須包含該網址，否則會 CORS 403。 |

### 2.3 訪談 v2 配置

| 變量 | 預設值 | 說明 |
|---|---:|---|
| `OPENAI_INTERVIEW_MODEL` | `gpt-4o-mini` | 訪談對話模型 |
| `OPENAI_ANALYSIS_MODEL` | `gpt-4o` | 分析/摘要/洞察模型 |
| `INTERVIEW_MAX_TURNS` | `25` | 訪談硬上限 |
| `INTERVIEW_SOFT_TARGET` | `15` | AI 結束軟目標 |
| `INTERVIEW_TURN_INTERVAL_MS` | `3000` | 單輪最小間隔 |
| `INTERVIEW_START_RATE_LIMIT` | `3` | 每小時 substantive session 上限（業務層） |
| `INTERVIEW_DAILY_SESSION_LIMIT` | `5` | 每日 substantive session 上限（業務層） |

> 補充：中間件另有 start/respond 限流（防濫用），見 `backend/src/middleware/rateLimiter.ts`。

### 2.4 判決上下文治理

- `JUDGMENT_ENABLE_PROFILE_CONTEXT`（預設 true）
- `JUDGMENT_ENABLE_CASE_CONTEXT`（預設 true）
- `JUDGMENT_PROFILE_REQUIRE_CONSENT`（預設 true）
- `JUDGMENT_PROFILE_MAX_AGE_DAYS`（預設 365）
- `JUDGMENT_CONTEXT_AUDIT_ENABLED`（預設 true）

### 2.5 Metrics 與告警

- `METRICS_ENABLED`（預設 true）
- `METRICS_TOKEN`
- `METRICS_ALLOWED_IPS`
- `OPS_ALERTS_*`、`ALERT_*`（ops 告警參數）

---

## 3. 前端環境變量

檔案：`frontend/.env`

### 3.1 必需

- `VITE_API_BASE_URL`（例如 `http://localhost:3001/api/v1`）

### 3.2 常用

- `VITE_ADMIN_LOGIN_URL`（主站 `/admin/*` 轉跳地址）

### 3.3 可選

- `VITE_APP_TITLE`
- `VITE_APP_DESCRIPTION`
- `VITE_GA_TRACKING_ID`
- `VITE_SENTRY_DSN`

---

## 4. 生產環境嚴格檢查

由 `backend/src/config/env.ts` 驗證：

- `JWT_SECRET` 生產長度 >= 32 且不得為示例值
- `ADMIN_JWT_SECRET` 生產必填，且不可等於 `JWT_SECRET`
- `OPENAI_API_KEY` 格式校驗
- `PORT` 範圍校驗
- 若 `METRICS_ENABLED=true`，生產必須配置 `METRICS_TOKEN` 或 `METRICS_ALLOWED_IPS`

---

## 5. 本地配置建議

1. `cp backend/.env.example backend/.env`
2. `cp frontend/.env.example frontend/.env`
3. 後端先跑：
   - `npm run prisma:generate`
   - `npm run prisma:migrate`
4. 再啟前端

---

## 6. 驗證命令

```bash
./scripts/validate-env.sh
```

此腳本會檢查：

- 必填變量存在
- 主要格式（URL/KEY/SECRET）合理性
- 前端 `.env` 是否可用

---

## 7. 注意事項

- `.env` 不應提交版本控制
- 文檔若與程式衝突，以 `env.ts` 實作為準
