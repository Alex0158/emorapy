# 熊媽媽法庭 - 前端應用

## 📋 項目簡介

熊媽媽法庭（Mother Bear Court）前端應用，使用 React + TypeScript + Vite + Ant Design 構建。

## 🛠️ 技術棧

- **框架**: React 19+
- **語言**: TypeScript 5.9+
- **構建工具**: Vite 7+
- **UI庫**: Ant Design 6+
- **路由**: React Router 7+
- **狀態管理**: Zustand 5+
- **HTTP客戶端**: Axios
- **樣式**: Less

## 📦 安裝

```bash
# 安裝依賴
npm install
```

## 🚀 運行

```bash
# 開發模式
npm run dev

# 構建生產版本
npm run build

# 預覽生產構建
npm run preview
```

## 🧪 測試

使用 Vitest + Testing Library 進行單元測試。

```bash
# 安裝依賴後執行
npm install
npm run test:run       # 執行一次所有測試
npm run test          # watch 模式
npm run test:coverage # 覆蓋率報告
```

測試涵蓋：執行儀表板頁面、statusTags/format/formatDate/helpers/seo/apiError/url/validation/storage 工具、執行 API、useToggle Hook、utils/hooks/store/config/components/pages 等。

**若出現 `vitest: command not found` 或 `ERR_MODULE_NOT_FOUND: vitest`**：依賴未正確安裝。請執行：

```bash
rm -rf node_modules
npm install
```

若 `npm install` 報錯 `ENOTEMPTY`（目錄不為空），通常是殘留的 `xxx 2` 目錄導致，刪除整個 `node_modules` 後再執行 `npm install` 即可。

## 🔧 環境變量

複製 `.env.example` 為 `.env` 並配置：

```bash
cp .env.example .env
```

必需配置：
- `VITE_API_BASE_URL`: 後端API地址（默認: http://localhost:3001/api/v1）

## 📁 項目結構

```
frontend/
├── src/
│   ├── components/      # 組件
│   │   ├── business/   # 業務組件
│   │   ├── common/     # 通用組件
│   │   ├── feedback/   # 反饋組件
│   │   └── layout/     # 布局組件
│   ├── pages/          # 頁面
│   ├── services/       # API服務
│   ├── store/          # 狀態管理
│   ├── hooks/          # 自定義Hooks
│   ├── utils/          # 工具函數
│   ├── types/          # 類型定義
│   ├── config/         # 配置文件
│   └── router/         # 路由配置
├── public/             # 靜態資源
└── package.json
```

## 🎯 核心功能

### 快速體驗模式（P0優先級）
- ✅ 零門檻 Session 創建與過期新建（/sessions/refresh，實為新建 Session 非續期）
- ✅ 單人雙角色介面
- ✅ 案件創建和提交
- ✅ 證據上傳/刪除（簽名 URL 過期自動換簽）
- ✅ AI 判決查看與責任分比例

### 完整模式
- ✅ 用戶註冊和登錄（未驗證郵箱時提示並可重發驗證碼）
- ✅ 配對系統
- ✅ 案件管理
- ✅ 判決查看和接受
- ✅ 和好方案生成和選擇
- ✅ 執行追蹤

## 📚 API服務

所有API服務位於 `src/services/api/`：

- `auth.ts`: 認證相關
- `user.ts`: 用戶相關
- `session.ts`: Session管理
- `pairing.ts`: 配對相關
- `case.ts`: 案件相關
- `judgment.ts`: 判決相關
- `reconciliation.ts`: 和好方案相關
- `execution.ts`: 執行相關

## 🔐 狀態管理

使用 Zustand 進行狀態管理：

- `authStore.ts`: 認證狀態
- `caseStore.ts`: 案件狀態
- `judgmentStore.ts`: 判決狀態
- `sessionStore.ts`: Session狀態

## 🎨 樣式

使用 Less 進行樣式管理：

- `variables.less`: 變量定義
- `mixins.less`: 混入函數
- `global.less`: 全局樣式

## 🧪 開發規範

### 代碼風格

- 使用 TypeScript 嚴格模式
- 遵循 ESLint 規則
- 使用 Prettier 格式化

```bash
# 檢查代碼
npm run lint

# 格式化代碼（需要配置prettier腳本）
```

### 組件規範

- 使用函數式組件
- 使用 TypeScript 類型定義
- Props 使用 interface 定義
- 組件文件夾包含 `index.tsx` 和 `*.less`

### 命名規範

- **組件**: PascalCase (如: `UserProfile`)
- **文件**: kebab-case (如: `user-profile.tsx`)
- **函數/變量**: camelCase (如: `getUserProfile`)
- **常量**: UPPER_SNAKE_CASE (如: `MAX_FILE_SIZE`)

## 🚀 部署

### 構建生產版本

```bash
npm run build
```

構建產物位於 `dist/` 目錄。

### 部署到靜態託管

可以部署到：
- Vercel
- Netlify
- GitHub Pages
- 任何靜態文件服務器

### 環境變量

生產環境需要設置：
- `VITE_API_BASE_URL`: 生產環境API地址

## 📝 開發注意事項

1. **API對接**: 確保後端服務運行在配置的地址
2. **Session管理**: 快速體驗模式使用localStorage存儲Session ID
3. **Token管理**: 認證Token存儲在localStorage
4. **錯誤處理**: 統一使用錯誤處理中間件
5. **類型安全**: 所有API調用都有類型定義

## 🐛 常見問題

1. **API請求失敗**
   - 檢查 `VITE_API_BASE_URL` 配置
   - 確認後端服務正在運行
   - 檢查CORS配置

2. **Session丟失**
   - 檢查localStorage是否被清除
   - 確認Session未過期

3. **構建失敗**
   - 檢查TypeScript錯誤
   - 確認所有依賴已安裝

## 📚 相關文檔

- [前端設計文檔](../前端設計/README.md)
- [後端API文檔](../backend/API.md)
