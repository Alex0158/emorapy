# CJ 平台 - 後端服務

## 📋 項目簡介

CJ 平台（CJ Platform）是一個為情侶衝突提供公平、公正、溫暖的第三方判決平台。後端服務使用 Node.js + TypeScript + Express + Prisma 構建。

## 🛠️ 技術棧

- **運行時**: Node.js 20+
- **語言**: TypeScript 5.0+
- **框架**: Express.js 4.18+
- **ORM**: Prisma 5.0+
- **數據庫**: PostgreSQL (Supabase)
- **認證**: JWT
- **AI服務**: OpenAI API (GPT-4o-mini 對話 + GPT-4o 分析)

## 📦 安裝

```bash
# 安裝依賴
npm install

# 配置環境變量
cp .env.example .env
# 編輯 .env 文件，填入必要的配置

# 生成Prisma Client
npm run prisma:generate

# 運行數據庫遷移
npm run prisma:migrate
```

## 🚀 運行

```bash
# 開發模式（熱重載）
npm run dev

# 生產模式
npm run build
npm start
```

### 運行安全與運維要點
- **數據庫遷移**：生產環境默認不自動執行 Prisma `db push`；如需自動遷移，顯式設置 `RUN_MIGRATIONS=true`。開發/測試仍可自動同步。
- **上傳資源訪問**：上傳文件返回的 URL 內含 24 小時簽名 `token`；在生產環境請保持 `ALLOW_PUBLIC_UPLOADS` 為默認空或 `false` 以啟用保護。需要公開訪問（僅調試）可設置 `ALLOW_PUBLIC_UPLOADS=true`。
- **分布式鎖**：生產環境強烈建議配置 `REDIS_URL`；若未配置且 `ALLOW_SIMPLE_LOCK` 未顯式為 `true`，關鍵任務（如判決生成）會拒絕執行。
- **郵箱驗證**：登錄已強制要求 `email_verified=true`，確保用戶完成驗證流程。
- **AI 配額**：AI 調用使用分布式鎖計數，超限會直接拒絕；後續失敗會回補配額，避免額度縮水。
- **簽名媒體 URL**：返回的證據/頭像 URL 附帶簽名，簽名包含完整路徑、文件大小、mtime、內容 SHA256 以及隨機 nonce，請勿存儲裸 URL；訪問 `/uploads` 時會校驗簽名。
- **測試數據庫**：默認使用與生產一致的 Postgres。僅當 `TEST_USE_SQLITE=true` 且 schema 支持時才切換 SQLite；否則單測會拒絕啟動以避免 provider mismatch。`SKIP_DB_INIT` 未顯式為 `false` 時，測試環境會跳過 DB 初始化。
- **外鏈資源**：`avatar_url` 僅應使用上傳文件或受信任 CDN，配置 `ALLOWED_AVATAR_HOSTS` 控制白名單；未配置時僅允許本服務或指定 CDN 域名。
- **Cron 啟動**：若 DB 初始化被跳過或失敗，定時任務不應啟動；確保 `ENABLE_SCHEDULED_JOBS` 與 DB 可用性一致。
- **Flow 測試**：快速體驗端到端測試需 `RUN_FLOW_TESTS=true` 並提供可連的 `DATABASE_URL`，默認跳過不代表功能已被覆蓋。
- **健康檢查策略**：若 DB 不可用，應在啟動時阻斷或返回 degraded 狀態；監控應據此判定服務狀態，避免誤報。
- **媒體安全開關**：`ALLOW_PUBLIC_UPLOADS` 僅限本地調試，生產禁止；簽名校驗需要路徑/哈希匹配，不應存裸 URL。
- **文件訪問安全**：`/uploads` 僅允許 GET/HEAD；簽名包含路徑、大小、mtime、內容哈希與 nonce；下載端有速率限制，可用 `BLACKLIST_IPS`（逗號分隔）屏蔽惡意 IP。
- **臨時配對清理**：快速體驗臨時配對每天上限 5000，並有每日清理（30 天過期）。
- **健康檢查跳過**：測試環境且設置 `SKIP_DB_INIT!=false` 時會跳過 DB 檢查並標記為 `skipped`，避免誤報；生產不可跳過。

## 📁 項目結構

```
backend/
├── src/
│   ├── config/          # 配置文件
│   ├── middleware/      # 中間件
│   ├── routes/         # 路由定義
│   │   ├── interview.routes.ts      # v2.0 訪談路由
│   │   ├── psych-profile.routes.ts  # v2.0 畫像路由
│   │   ├── chat.routes.ts           # v1 聊天室路由（rooms/messages/invites/SSE/judgment）
│   │   └── metrics.routes.ts        # /metrics（Prometheus 指標）
│   ├── controllers/    # 控制器層
│   │   ├── interview.controller.ts      # v2.0 訪談控制器
│   │   └── psych-profile.controller.ts  # v2.0 畫像控制器
│   ├── services/       # 業務邏輯層
│   │   ├── interview.service.ts             # v2.0 訪談服務
│   │   ├── async-pipeline.service.ts        # v2.0 異步管線
│   │   ├── narrative.service.ts             # v2.0 敘事合併
│   │   ├── insight-extraction.service.ts    # v2.0 洞察提取
│   │   ├── profile-snapshot.service.ts      # v2.0 畫像快照
│   │   ├── profile-richness.service.ts      # v2.0 豐富度計算（ProfileRichnessService）
│   │   ├── chat.service.ts                  # v1 聊天室主流程（可見性、邀請、轉判決）
│   │   ├── chat-events.service.ts           # v1 聊天室 SSE 事件匯流排
│   │   ├── chat-ai-orchestrator.service.ts  # v1 聊天室 AI 回覆編排（support/mediation/safety）
│   │   └── chat-metrics.service.ts          # v1 聊天室 metrics（Prometheus + Redis minute buckets）
│   ├── utils/          # 工具函數
│   ├── types/          # TypeScript類型定義
│   ├── app.ts          # Express應用入口
│   └── index.ts        # 服務器啟動文件
├── prisma/
│   └── schema.prisma   # Prisma Schema（含聊天室 v1 與 v2.0 心理畫像）
└── package.json
```

## 🔐 環境變量

詳見 `.env.example` 文件。

## 📚 API文檔

- [API接口文檔](./API.md)
- [後端設計文檔](../後端設計/README.md)
  - 聊天室（Chat v1）與 `/metrics` 指標端點已收錄於 `docs/backend/API.md`

## 🧪 測試

```bash
# 單元測試
npm run test:unit

# 集成測試
npm run test:integration

# 覆蓋率
npm run test:coverage
```

若遇到 `jest: command not found` 或 `ts-jest not found`，請執行：
```bash
rm -rf node_modules && npm install
```

## 📝 開發規範

詳見 [接口建設規範](../後端設計/12-接口建設規範.md)。

---

## 🧠 v2.0 個人化判決系統

v2.0 新增 AI 引導式心理訪談，為用戶建立 8 維心理畫像，並在判決時按 `richness_score` 分級注入個人化上下文。

### 核心組件

- **訪談服務**（`InterviewService`）：Session/Turn 管理、SSE 流式回應（GPT-4o-mini）
- **異步管線**（`AsyncPipelineService`）：5 步後處理（敘事提取→敘事摘要→洞察提取→豐富度計算→反饋卡片生成）
- **畫像服務**（`NarrativeService`、`InsightExtractionService`）：域級敘事與結構化洞察
- **快照服務**（`ProfileSnapshotService`）：判決前凍結畫像
- **豐富度計算**（`ProfileRichnessService`）：8 域加權評分 → L0-L3 注入等級

### 新增 API 端點

11 個端點（`/api/interview/*`、`/api/psych-profile/*`），詳見 [API 文檔](./API.md)。

### 安全機制

- 知情同意驗證（`psych_consent_given`）
- Rate Limiting（start 頻率、turn 間隔）
- Session 級併發鎖
- SSE 分隔符注入防禦
- 安全風險即時偵測與資源轉介
- 遺忘權（DELETE 永久刪除訪談記錄和畫像數據）

詳見 [UPGRADE_PLAN_PERSONALIZED_JUDGMENT.md](../../UPGRADE_PLAN_PERSONALIZED_JUDGMENT.md)

## 🐛 問題反饋

如有問題，請提交Issue。

## 📄 許可證

ISC
