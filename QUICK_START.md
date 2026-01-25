# 快速開始指南

## 🚀 5分鐘快速啟動

### 前置要求

- Node.js 18+
- npm 或 yarn
- PostgreSQL數據庫（或使用Supabase免費版）

### 步驟1: 克隆項目（如果還沒有）

```bash
cd /Users/alex/Desktop/CJ
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
4. 創建案件
5. 查看判決
6. 生成和好方案
7. 執行追蹤

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

## 📚 更多信息

- [後端開發指南](./backend/DEVELOPMENT.md)
- [前端開發指南](./frontend/README.md)
- [集成指南](./INTEGRATION.md)
- [本地 Docker 開發指引](./Docker-DEV-Guide.md)

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
