# 開發指南

## 環境要求

- Node.js 18+
- PostgreSQL 14+ 或 Supabase
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

### 3. 數據庫設置

```bash
# 生成Prisma Client
npm run prisma:generate

# 運行數據庫遷移
npm run prisma:migrate

# （可選）打開Prisma Studio查看數據
npm run prisma:studio

# Docker 開發默認數據庫（參考 Docker-DEV-Guide.md）
# DATABASE_URL=postgresql://mbc:mbc_dev_pass@localhost:55432/mbc_dev
```

### 4. 啟動開發服務器

```bash
npm run dev
```

服務器將運行在 `http://localhost:3001`（若 `.env` 未覆蓋則為 3001，請與前端/反向代理保持一致）

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

2. **Prisma Client未生成**
   - 運行 `npm run prisma:generate`

3. **端口被佔用**
   - 修改 `.env` 中的 `PORT` 配置

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
