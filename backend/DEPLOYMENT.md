# 部署指南

## 部署選項

### 1. Railway (推薦)

Railway 提供免費額度，支持自動部署。

**當前項目現況**：

| 環境 | Redis 狀態 | Lock / AI Stream 狀態 | 健康口徑 |
|------|-----------|------------------------|----------|
| `production` | 已配置 Railway 內網 `REDIS_URL` + 專用 Redis 服務 | Redis-backed `lock` / `cache` / `chat metrics` / `ops metrics` / `AI Stream` | 正常情況下應為 `healthy` |
| `staging` | 已配置 Railway 內網 `REDIS_URL` + 專用 Redis 服務 | Redis-backed `lock` / `cache` / `chat metrics` / `ops metrics` / `AI Stream`；`METRICS_ENABLED=true` 並以 token / IP 保護 `/metrics` | 當前已回到 `healthy` |
| `local` | 推薦本地啟 Redis | 未配 `REDIS_URL` 時會 fallback memory / DB advisory lock | 取決於本地依賴是否齊全 |

補充：

- `production` 的 `REDIS_URL` 由後端統一復用於 `lock`、`cache`、`chat metrics`、`ops metrics` 與 `AI Stream`
- `staging` 已於 2026-04-05 補回 Railway Redis，`/health` 已恢復 `healthy`
- `staging` 已於同日補齊 `/metrics` token 保護並完成真實探測；現在與 `production` 的主要差異已不在核心 runtime 形態，而是域名與部署角色
- 公開狀態端點 `/health`、`/health/ready`、`/health/live`、`/version`、`/api/v1/version` 已放寬為可供探活 / CLI 驗證；受保護業務接口仍遵循 `ALLOWED_ORIGINS`

**步驟**:

1. 在 Railway 創建新項目
2. 連接 GitHub 倉庫
3. 設置環境變量
4. 部署自動開始

**環境變量設置**:
- `DATABASE_URL`: Railway 自動提供 PostgreSQL
- `JWT_SECRET`: 生成隨機字符串
- `OPENAI_API_KEY`: 你的 OpenAI API 密鑰
- `NODE_ENV`: `production`
- `REDIS_URL`: Railway Redis 提供的內網連接串；`production` / `staging` 都應配置
- `ALLOW_SIMPLE_LOCK`: 僅在無 Redis 的臨時環境顯式設為 `true`
- `METRICS_ENABLED`: `production` / `staging` 建議保持 `true`
- `METRICS_TOKEN`: `production` / `staging` 至少配置其一；抓取端需帶 `X-Metrics-Token`
- `METRICS_ALLOWED_IPS`: 可選，適合內網抓取來源固定的環境
- `ADMIN_JWT_SECRET`: production / staging 都需配置
- `ADMIN_JWT_EXPIRES_IN`: production / staging 都需配置

### 2. Render

Render 也提供免費 PostgreSQL。

**步驟**:

1. 在 Render 創建 Web Service
2. 連接 GitHub 倉庫
3. 構建命令: `npm install && npm run build`
4. 啟動命令: `npm start`
5. 設置環境變量

### 3. Docker 部署

**構建鏡像**:

```bash
docker build -t mother-bear-court-backend .
```

**運行容器**:

```bash
docker run -p 3001:3001 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=... \
  -e OPENAI_API_KEY=... \
  mother-bear-court-backend
```

### 4. 傳統服務器部署

**步驟**:

1. 在服務器上安裝 Node.js 20+
2. 克隆項目
3. 安裝依賴: `npm ci --production`
4. 設置環境變量
5. 運行數據庫遷移: `npm run prisma:migrate`
6. 構建項目: `npm run build`
7. 使用 PM2 管理進程:

```bash
npm install -g pm2
pm2 start dist/index.js --name mother-bear-court-backend
pm2 save
pm2 startup
```

## 環境變量配置

### 生產環境必需變量

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=2000
FRONTEND_URL=https://your-frontend-domain.com
ALLOWED_ORIGINS=https://your-frontend-domain.com
REDIS_URL=redis://default:***@redis.railway.internal:6379
ADMIN_JWT_SECRET=another-strong-secret
ADMIN_JWT_EXPIRES_IN=12h
METRICS_ENABLED=true
```

### Staging 最小可用配置

若 staging 需要先行收口、但暫未掛 Redis，至少應顯式配置：

```env
NODE_ENV=production
ALLOW_SIMPLE_LOCK=true
METRICS_ENABLED=false
ADMIN_JWT_SECRET=another-strong-secret
ADMIN_JWT_EXPIRES_IN=12h
ALLOWED_ORIGINS=https://frontend-lilac-three-52.vercel.app,https://mother-bear-court.vercel.app,https://mother-bear-court-staging.up.railway.app
```

說明：

- 此配置可讓 staging 正常啟動與回歸，但 `/health` 會因 simple-lock 顯示 `degraded`
- 當前 staging 已完成這一步後續收口，現況為：已補 Railway Redis、已恢復 `REDIS_URL`、`ALLOW_SIMPLE_LOCK=false`、`METRICS_ENABLED=true` 並配置獨立 metrics token

### 可選變量

```env
# 郵件服務（可選）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password

# 文件上傳（可選）
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
```

## 數據庫遷移

在部署前，確保運行數據庫遷移：

```bash
npm run prisma:migrate
```

或使用 Prisma Migrate Deploy（生產環境）：

```bash
npx prisma migrate deploy
```

## 監控和日誌

### 日誌管理

日誌文件位置：
- `logs/error.log`: 錯誤日誌
- `logs/combined.log`: 所有日誌

建議使用日誌聚合服務（如 Logtail、Papertrail）進行日誌管理。

### 健康檢查

公開狀態端點：

- `GET /health`
- `GET /health/ready`
- `GET /health/live`
- `GET /version`
- `GET /api/v1/version`

這些端點允許探活 / CLI / 平台健康檢查使用，不受一般 `ALLOWED_ORIGINS` 拒絕規則影響。

受保護接口（例如 `/api/v1/admin/*`）仍嚴格遵循 `ALLOWED_ORIGINS`。

`GET /metrics` 屬機器保護端點，不作為公開狀態端點。它不應被全局 CORS 提前拒絕；是否返回 Prometheus 文本由 `METRICS_TOKEN` / `METRICS_ALLOWED_IPS` 決定。

### 性能監控

建議集成：
- Sentry: 錯誤追蹤
- New Relic: 性能監控
- Datadog: 全棧監控

## 安全建議

1. **HTTPS**: 使用 HTTPS 加密傳輸
2. **環境變量**: 不要在代碼中硬編碼敏感信息
3. **CORS**: 正確配置允許的來源
4. **限流**: 已內置限流保護
5. **Helmet**: 已配置安全頭
6. **數據庫**: 使用連接池，限制連接數

## 擴展性

### 水平擴展

如果需要多實例部署：

1. 使用負載均衡器（如 Nginx）
2. 確保 `REDIS_URL` 可用，供分布式鎖、快取、metrics 與 `AI Stream` 跨實例分發 / replay 使用
   如 staging 暫未配置 Redis，需接受 `simple-lock` / 非 production 等價語義，並在文檔與驗收記錄中明確標註
3. 數據庫連接池配置

### 垂直擴展

增加服務器資源：
- CPU: 處理 AI 請求
- 內存: 緩存和並發處理
- 數據庫: 增加連接數

## 備份策略

1. **數據庫備份**: 定期備份 PostgreSQL
2. **文件備份**: 備份上傳的文件
3. **配置備份**: 備份環境變量配置

## 故障恢復

1. **監控告警**: 設置監控告警
2. **自動重啟**: 使用 PM2 或系統服務自動重啟
3. **回滾機制**: 保留舊版本以便快速回滾

## 維護

### 定期任務

1. **清理過期數據**: 定時任務自動清理
2. **數據庫優化**: 定期執行 VACUUM
3. **日誌輪轉**: 定期清理舊日誌
4. **依賴更新**: 定期更新依賴包

### 更新流程

1. 在測試環境測試
2. 備份生產數據
3. 部署新版本
4. 運行數據庫遷移
5. 驗證功能
6. 監控錯誤

---

## 🧠 v2.0 部署注意事項（個人化判決系統）

### 新增環境變量

v2.0 訪談系統需要以下可選環境變量（均有預設值，不配不影響既有功能）：

| 變量 | 預設值 | 說明 |
|------|--------|------|
| `OPENAI_INTERVIEW_MODEL` | `gpt-4o-mini` | 訪談對話模型 |
| `OPENAI_ANALYSIS_MODEL` | `gpt-4o` | 敘事提取/洞察分析模型 |
| `INTERVIEW_MAX_TURNS` | `25` | 單次訪談最大輪數（硬限） |
| `INTERVIEW_SOFT_TARGET` | `15` | AI 軟目標輪數 |
| `INTERVIEW_TURN_INTERVAL_MS` | `3000` | 輪次最小間隔（毫秒） |
| `INTERVIEW_START_RATE_LIMIT` | `3` | start 每用戶每小時上限（express-rate-limit，防濫用，不計 turn 數） |
| `INTERVIEW_DAILY_SESSION_LIMIT` | `5` | 每用戶每天最多 session 數 |
| `REDIS_URL` | — | Railway Redis 連接串；`production` / `staging` 建議同樣配置，以保持 lock、metrics、AI Stream 語義一致。 |
| `METRICS_TOKEN` | — | `/metrics` header token；`production` / `staging` 至少配置 token 或 allowed IP 其中之一。 |

在 Railway / Render / Docker 中增加上述環境變量即可。當前 production / staging 已確認配置 Railway Redis，且 staging 已實測啟用受保護 `/metrics`。詳見 `docs/ENVIRONMENT.md` 與 `docs/核心開發文件/Staging 運行時收口記錄-2026-04-05.md`。

### 數據庫遷移

v2.0 包含 **4 個新 ENUM + 5 張新表**，部署前必須執行：

```bash
npx prisma migrate deploy
```

遷移後需額外執行以下 SQL（Prisma DSL 不支援部分唯一索引和 CHECK 約束）：

```sql
-- 1. 部分唯一索引：每用戶僅 1 個 in_progress session
CREATE UNIQUE INDEX ux_interview_sessions_user_in_progress
  ON interview_sessions(user_id) WHERE status = 'in_progress';

-- 2. 部分唯一索引：每用戶每域僅 1 個 is_latest 敘事
CREATE UNIQUE INDEX ux_profile_narratives_user_domain_latest
  ON profile_narratives(user_id, domain) WHERE is_latest = true;

-- 3-5. CHECK 約束
ALTER TABLE profile_narratives ADD CONSTRAINT chk_completeness CHECK (completeness BETWEEN 0 AND 1);
ALTER TABLE profile_insights ADD CONSTRAINT chk_confidence CHECK (confidence BETWEEN 0 AND 1);
ALTER TABLE profile_snapshots ADD CONSTRAINT chk_richness_score CHECK (richness_score BETWEEN 0 AND 1);
```

### Nginx / 反向代理 SSE 配置

`Interview` 現已改為 `respond/skip/cancel` 提交式觸發，AI 可見輸出統一由 `GET /api/v1/streams/interview_session/:id` 提供。
若使用 Nginx 反向代理，需為統一 stream 端點關閉緩衝、延長超時：

```nginx
location /api/v1/streams/ {
    proxy_buffering off;
    proxy_read_timeout 120s;
    proxy_set_header Connection '';
    chunked_transfer_encoding off;
}
```

Railway 和 Render 原生支援 SSE，無需額外配置。

### 監控要點

- **AsyncPipelineService 失敗率**：`processing_failed` 狀態的 session 數量
- **AI Stream 超時率**：`/api/v1/streams/*` 首字、連線與 persisted 延遲異常比例
- **AI 調用費用**：每日 GPT-4o-mini / GPT-4o 的 token 消耗
- **併發鎖衝突率**：`CONCURRENT_REQUEST` 錯誤的頻率
