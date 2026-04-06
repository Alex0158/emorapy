# 開發指南

## 環境要求

- Node.js 20+
- PostgreSQL 14+ 或 Supabase
- Redis（本地開發推薦；建議使用 Docker）
- npm 或 yarn

## 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 配置環境變量

複製 `.env.example` 為 `.env` 並填入配置：

```bash
cp .env.example .env
```

必需配置項：
- `DATABASE_URL`: 數據庫連接字符串
- `JWT_SECRET`: JWT密鑰（建議使用隨機字符串）
- `OPENAI_API_KEY`: OpenAI API密鑰

本地推薦額外配置：
- `REDIS_URL`: 建議使用 `redis://127.0.0.1:6379`
- 若使用倉庫內 compose，可先執行 `npm run dev:redis:up`

### 3. 數據庫設置

```bash
# 生成Prisma Client
npm run prisma:generate

# 運行數據庫遷移
npm run prisma:migrate

# （可選）打開Prisma Studio查看數據
npm run prisma:studio

# Docker 開發默認數據庫（參考 ../docs/11-開發環境配置.md）
# DATABASE_URL=postgresql://mbc:mbc_dev_pass@localhost:55432/mbc_dev
```

### 4. 啟動開發服務器

```bash
npm run dev:redis:up
npm run dev
```

服務器將運行在 `http://localhost:3001`（若 `.env` 未覆蓋則為 3000，請與前端/反向代理保持一致）

本地 Redis 輔助腳本：

```bash
npm run dev:redis:up
npm run dev:redis:logs
npm run dev:redis:down
```

如需在本機使用 Railway 遠端環境變量啟動後端：

```bash
# 推薦：只連 staging
npm run dev:railway

# 等價於上面，顯式寫法
npm run dev:railway:staging

# 僅在明確認知風險時才允許連 production
npm run dev:railway:production
```

注意：
- `dev:railway` 現在默認只連 `staging`，避免本機誤連 production。
- `dev:railway:production` 會注入 Railway production 的遠端 `DATABASE_URL`、JWT、Redis 等環境變量，不應作為日常本地開發入口。
- 若只是本機聯調，優先使用 `npm run dev` + 本地 `.env`。

## 開發規範

### 代碼風格

- 使用 TypeScript 嚴格模式
- 遵循 ESLint 規則
- 使用 Prettier 格式化代碼

```bash
# 檢查代碼風格
npm run lint

# 自動修復
npm run lint -- --fix

# 格式化代碼
npm run format
```

### 項目結構

```
backend/
├── src/
│   ├── config/          # 配置文件
│   ├── middleware/      # 中間件
│   ├── routes/         # 路由定義
│   ├── controllers/    # 控制器層
│   ├── services/       # 業務邏輯層
│   ├── utils/          # 工具函數
│   ├── types/          # 類型定義
│   └── jobs/           # 定時任務
├── prisma/
│   └── schema.prisma   # 數據庫Schema
└── tests/              # 測試文件
```

### 命名規範

- **文件**: kebab-case (如: `user.service.ts`)
- **類**: PascalCase (如: `UserService`)
- **函數/變量**: camelCase (如: `createUser`)
- **常量**: UPPER_SNAKE_CASE (如: `MAX_FILE_SIZE`)

### 提交規範

- `feat`: 新功能
- `fix`: 修復bug
- `docs`: 文檔更新
- `style`: 代碼格式調整
- `refactor`: 代碼重構
- `test`: 測試相關
- `chore`: 構建/工具相關

## 數據庫操作

### 創建遷移

```bash
npm run prisma:migrate
```

### 同步當前 schema 到開發庫

```bash
npx prisma db push
```

### 檢查真庫與 `schema.prisma` 是否仍有差異

```bash
export DATABASE_URL="postgresql://..."
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
```

說明：
- `prisma migrate status` / `npm run ops:migration:report` 只能證明 Prisma migration baseline 與 `_prisma_migrations` 一致。
- 若 repo 同時存在補充 SQL、`db push` 歷史或 `supabase/migrations`，仍必須用 `migrate diff` 再確認真庫是否已和當前 `schema.prisma` 對齊。
- 開發環境看到 `No difference detected.` 才代表這一輪 schema 真正收口。

### 重置數據庫（開發環境）

```bash
npx prisma migrate reset
```

### 查看數據

```bash
npm run prisma:studio
```

## 測試

```bash
# 運行測試
npm test

# 運行測試並查看覆蓋率
npm test -- --coverage

# 快速體驗全流程（需可用 DATABASE_URL）
# RUN_FLOW_TESTS=true npm test -- --selectProjects integration --runInBand

> 布林開關請使用小寫 true/false（如 ALLOW_PUBLIC_UPLOADS、RUN_FLOW_TESTS、SKIP_DB_INIT 等），錯誤值會被拒絕。
```

## 調試

### 日誌級別

開發環境默認使用 `debug` 級別，生產環境使用 `info` 級別。

日誌文件位置：
- `logs/error.log`: 錯誤日誌
- `logs/combined.log`: 所有日誌

### 常見問題

1. **數據庫連接失敗**
   - 檢查 `DATABASE_URL` 配置
   - 確認數據庫服務正在運行
   - 若你是用 `npm run dev:railway` 啟動，請先確認當前注入的是 `staging` 還是 `production`
   - 可查看啟動日誌中的 `railwayEnvironment` 與 `databaseHost`
   - 本機若使用 Node 24 跑 Prisma 連遠端 Supabase，可能出現資料庫連線異常；當前項目本地開發請優先使用 Node 20

2. **Redis 未連上 / AI Stream 降級到 memory**
   - 檢查 `REDIS_URL` 是否存在
   - 執行 `npm run dev:redis:up`
   - 觀察後端啟動日誌是否出現 `Redis connected for AI Stream runtime`
   - 補充：當前線上 `production` / `staging` 都以 Redis-backed 鏈路為準；本地若要模擬線上，更應直接啟 Redis，而不是用 simple-lock 假裝等價

3. **Prisma Client未生成**
   - 運行 `npm run prisma:generate`

4. **端口被佔用**
   - 修改 `.env` 中的 `PORT` 配置
   - 若是 Redis `6379` 衝突，修改 `docker-compose.redis.yml` 與 `.env` 的 `REDIS_URL`

## 性能優化建議

1. **數據庫查詢**
   - 使用索引優化查詢
   - 避免N+1查詢問題
   - 使用分頁限制數據量

2. **緩存策略**
   - 熱點數據使用緩存
   - 判決結果緩存24小時

3. **異步處理**
   - AI調用異步處理
   - 郵件發送異步處理

## 部署準備

1. 設置生產環境變量
2. 運行數據庫遷移
3. 構建項目: `npm run build`
4. 啟動服務: `npm start`

詳見 [部署文檔](./DEPLOYMENT.md)

---

## 🧠 v2.0 個人化判決系統開發指引

### 新增服務

| 服務 | 職責 | 模型 |
|------|------|------|
| `InterviewService` | 訪談 session/turn 管理、SSE 流式回應 | GPT-4o-mini |
| `AsyncPipelineService` | POST /end 後觸發的異步處理管線 | — |
| `NarrativeService` | 域級敘事合併與摘要 | GPT-4o |
| `InsightExtractionService` | 結構化洞察提取 | GPT-4o |
| `ProfileSnapshotService` | 判決前凍結畫像快照 | — |
| `ProfileRichnessService` | 8 域加權豐富度計算 | — |

### 新增環境變量

```bash
# .env
INTERVIEW_START_RATE_LIMIT=3          # start 端點每用戶每小時上限（express-rate-limit，防濫用）
INTERVIEW_DAILY_SESSION_LIMIT=5       # 每用戶每天最多 substantive session（業務邏輯，僅計 ≥ 3 輪）
INTERVIEW_MAX_TURNS=25                # 單 session 最大輪數（硬限）
INTERVIEW_TURN_INTERVAL_MS=3000       # 輪間最小間隔
OPENAI_INTERVIEW_MODEL=gpt-4o-mini   # 訪談對話 + 域分類使用的模型（INTERVIEW_AI_CONFIG）
OPENAI_ANALYSIS_MODEL=gpt-4o         # 敘事摘要 / 洞察提取 / 反饋卡片使用的模型（ANALYSIS_AI_CONFIG）
INTERVIEW_SOFT_TARGET=15              # AI 軟目標輪數（13 輪起準備收尾，15 輪尋找自然結束點）
```

### Stream 端點開發

訪談已改為提交式觸發，統一可見流輸出由 `GET /api/v1/streams/:scopeType/:scopeId` 提供。若本地未配置 Redis，`AI Stream` 仍可工作，但會退回單機 memory runtime，無法模擬線上 Redis-backed 行為。

```typescript
res.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
});
```

SSE 客戶端協議：`token` / `metadata` / `complete` 等事件不變。⚠️ **實現說明**：當前 AI 回應格式為單一 JSON（含 `text`/`intent`/`target_domains`/`should_end`/`safety_flag`/`safety_message`），由 `interview.service.ts` 解析後轉為 SSE 事件推送。設計方案中的「雙通道」格式（文本 + `---METADATA---` + JSON）尚未實現。

### 異步管線

`POST /interview/:id/end` 後，session 狀態由 `in_progress` → `processing`。後端啟動 5 步異步管線：

1. **NARRATIVE_EXTRACTION**：`domainClassificationService.batchClassify()` 域分類 AI（INTERVIEW_AI_CONFIG gpt-4o-mini）+ `narrativeService.extractNarratives()` 按域歸類
2. **NARRATIVE_SUMMARY**：`narrativeService.summarizeNarratives()` 每域 AI 摘要（ANALYSIS_AI_CONFIG gpt-4o）
3. **INSIGHT_EXTRACTION**：`insightExtractionService.extractInsights()` 批次 AI（ANALYSIS_AI_CONFIG gpt-4o）
4. **RICHNESS_CALCULATION**：`profileRichnessService.calculateRichness()` 純計算
5. **FEEDBACK_GENERATION**：AI 生成反饋卡片 JSON（ANALYSIS_AI_CONFIG gpt-4o）

每步失敗可重試 2 次（固定退避 2s/4s）。SSE 實現為 **callback-based**（`onSSE` 函數參數），非 AsyncGenerator。

### 資料庫遷移

v2.0 新增 5 個表和 4 個 ENUM，執行遷移：

```bash
npm run prisma:migrate
```

詳見 [UPGRADE_PLAN_PERSONALIZED_JUDGMENT.md](../UPGRADE_PLAN_PERSONALIZED_JUDGMENT.md)
