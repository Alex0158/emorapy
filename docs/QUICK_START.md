# 快速開始指南

## 🚀 5分鐘快速啟動

### 前置要求

- Node.js 20+（建議 ≥20.19.0，見 backend/package.json engines）
- npm 或 yarn
- PostgreSQL 數據庫（或使用 Supabase/Railway 等）

> 與 [INTEGRATION](INTEGRATION.md)、[ENVIRONMENT](ENVIRONMENT.md) 一致；詳見 [11-開發環境配置](11-開發環境配置.md)。

### 步驟1: 克隆項目（如果還沒有）

```bash
cd <專案根目錄>   # 例如 clone 後的目錄路徑
```

### 步驟2: 啟動後端

```bash
cd backend

# 安裝依賴
npm install

# 配置環境變量
cp .env.example .env
# 編輯 .env 文件，至少配置：
# - DATABASE_URL
# - JWT_SECRET
# - OPENAI_API_KEY
# v2.0 訪談功能可選配置：OPENAI_INTERVIEW_MODEL、OPENAI_ANALYSIS_MODEL、INTERVIEW_MAX_TURNS、INTERVIEW_SOFT_TARGET 等，詳見 docs/ENVIRONMENT.md

# 生成Prisma Client
npm run prisma:generate

# 運行數據庫遷移
npm run prisma:migrate

# 啟動服務器
npm run dev
```

後端將運行在 `http://localhost:3001`

### 步驟3: 啟動前端（新終端）

```bash
cd frontend

# 安裝依賴
npm install

# 配置環境變量（可選，有默認值）
cp .env.example .env
# 確保 VITE_API_BASE_URL=http://localhost:3001/api/v1

# 啟動開發服務器
npm run dev
```

前端將運行在 `http://localhost:5173`

### 步驟4: 訪問應用

打開瀏覽器訪問：`http://localhost:5173`

## 🎯 快速體驗

### 方式1: 快速體驗模式（推薦）

1. 訪問首頁
2. 點擊「快速體驗」
3. 填寫案件信息（一人扮演雙方角色）
4. 提交案件
5. 等待AI生成判決（約30-60秒）
6. 查看判決結果

### 方式2: 完整模式

1. 註冊帳號
2. 創建配對（生成邀請碼）
3. 對方使用邀請碼加入
4. **（可選）完成「我的故事」訪談**：在配對頁面或個人中心的「我的故事」卡片，花 5-10 分鐘和 AI 聊聊你的背景故事，讓判決更貼合你（需知情同意，可隨時跳過或中途離開）
5. 創建案件
6. 查看判決（若已完成訪談，判決將根據你的心理畫像進行個人化）
7. 生成和好方案
8. 執行追蹤

> 💡 **v2.0 個人化判決**：訪談完全可選。不參與訪談也能獲得完整的標準判決。訪談入口有 4 個時機：註冊配對後、案件提交前、判決結果頁、個人中心「我的故事」。詳見 [02-產品設計 § 個人化判決系統](02-產品設計.md)。

## 🔧 一鍵啟動腳本

```bash
# 同時啟動前後端
./scripts/start-dev.sh
```

## ✅ 驗證安裝

```bash
# 運行集成驗證腳本
./scripts/verify-integration.sh
```

## 🧪 運行單元測試

### 後端（Jest）

```bash
cd backend
npm install   # 若尚未安裝
npm run test:unit      # 僅單元測試
npm run test:integration  # 集成測試（默認跳過 quick flow）
npm run test:integration:flow  # 需可用 PostgreSQL，顯式啟用 quick flow
npm run test:coverage  # 單元測試 + 覆蓋率報告
```

### 前端（Vitest）

```bash
cd frontend
npm install   # 若尚未安裝（含 vitest、@testing-library 等）
npm run test           # 執行一次所有測試（CI 建議）
npm run test:run       # 同上（別名）
npm run test:coverage  # 覆蓋率（當前等同於 vitest run）
# watch 模式：npx vitest
```

前端測試涵蓋：執行儀表板頁面、statusTags 工具、執行 API、format/formatDate 工具等（約 35 個用例）。

**本地 CI 驗證（不含 lint）**：若需快速確認單元測試與構建通過，可執行 `./scripts/ci-local.sh`（後端 test:unit、前端 test:run、兩端 build）。請先於 backend 與 frontend 目錄各執行一次 `npm install`。Lint 在 GitHub Actions 中執行。

## 🔄 CI

推送到 `main` 或 `master`（或對應分支的 PR）會觸發 [.github/workflows/ci.yml](.github/workflows/ci.yml)：後端與前端分別執行 `npm ci`、`npm run lint`、後端 `npm run test:unit`、兩端 `npm run build`；`npm audit --audit-level=high` 僅報告不阻斷。Lint 步驟限時 2 分鐘。

## 📚 更多信息

- [後端開發指南](./backend/DEVELOPMENT.md)
- [前端開發指南](./frontend/README.md)
- [集成指南](./INTEGRATION.md)

## 🐛 遇到問題？

### 後端無法啟動
- 檢查Node.js版本：`node -v`（需要 >=20.19，建議 22.12，用 nvm 管理）
- 檢查環境變量配置
- 檢查數據庫連接

### 前端無法啟動
- 檢查Node.js版本
- 檢查端口5173是否被佔用
- 檢查API地址配置

### API請求失敗
- 確認後端服務正在運行
- 檢查CORS配置
- 查看瀏覽器控制台錯誤信息
