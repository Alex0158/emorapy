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

### 前後台分離運行（推薦）

- 主前台：`/frontend`（一般用戶入口）
- 管理後台：`/frontend-admin`（管理員入口）

```bash
# 主前台
cd frontend && npm run dev

# 管理後台（另一個 terminal）
cd frontend-admin && npm run dev
```

## 🧪 測試

使用 Vitest + Testing Library 進行單元測試。

```bash
# 安裝依賴後執行
npm install
npm run test          # 執行一次所有測試（CI 建議）
npm run test:run       # 同上（別名）
npm run test:coverage # 覆蓋率報告（當前等同於 vitest run）
# watch 模式：npx vitest
```

測試涵蓋：執行儀表板頁面、statusTags/format/formatDate/helpers/seo/apiError/url/validation/storage 工具、執行 API、useToggle Hook、utils/hooks/store/config/components/pages 等。

補充：
- 聊天室訊息列表使用 `react-virtuoso`（依賴 DOM 量測）。在 jsdom 測試環境下，`frontend/src/pages/Chat/Room/index.test.tsx` 會對 `react-virtuoso` 做 stub，以確保測試能穩定驗證訊息送出/禁用狀態等核心行為。

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
- `VITE_ADMIN_LOGIN_URL`: 主前台跳轉管理台入口（僅 frontend 需要，必須是絕對 URL）

`frontend-admin` 也建議設置 `VITE_ADMIN_LOGIN_URL` 為絕對 URL（供 admin 401 回登入頁使用）。

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

frontend-admin/
├── src/                # Admin 專屬入口與路由
├── vite.config.ts      # 共享 frontend/src 的 alias 設定
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

### 🧠 個人化判決系統（v2.0）
- 📋 AI 引導訪談對話頁面（`/interview/:id`，iMessage 風格）
- 📋 知情同意機制（頁面 mount 時檢查 + `ConsentModal` 彈窗 + 後端 `requireConsent` 中間件；⚠️ 無獨立 ConsentGuard 組件）
- 📋 訪談結果反饋頁（`/interview/:id`，session 完成後展示洞察卡片）
- 📋 「我的故事」卡片（個人頁面，豐富度進度環）
- 📋 畫像數據清除（設定頁面，遺忘權）
- 📋 4 種觸發入口：主動進入 / 建案前 / 判決後 / 首次登入

### 💬 聊天室（Chat v1）
- 📋 單人訴苦聊天室（A+AI），可隨時建立邀請碼 Invite B 入房
- 📋 A/B/AI 三方對話（含 SSE 即時更新 + 斷線輪詢回補）
- 📋 訊息可見性：`all` / `summary_only` / `owner_only`
- 📋 回覆引用（reply）與訊息錨點定位（`#msg-<id>`）+ 複製連結
- 📋 歷史訊息分頁載入（cursor-based pagination）
- 📋 大量訊息效能：訊息列表使用 `react-virtuoso` 虛擬列表，並設有前端快取上限避免卡頓
- 📋 轉判決前預覽與手動勾選納入訊息（提交 `included_message_ids`）

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
- `interview.ts`: 訪談相關（v2.0，含 SSE）
- `psychProfile.ts`: 心理畫像相關（v2.0）
- `chat.ts`: 聊天室相關（v1，含 SSE）

### v2.0 新增 SSE 通訊

`sseRequest.ts`：基於 `fetch` + `ReadableStream` 的 SSE 請求工具，支援 POST + Bearer token，
用於訪談 `/respond` 和 `/skip` 的流式回應。

## 🔐 狀態管理

使用 Zustand 進行狀態管理：

- `authStore.ts`: 認證狀態
- `caseStore.ts`: 案件狀態
- `judgmentStore.ts`: 判決狀態
- `sessionStore.ts`: Session狀態
- `interviewStore.ts`: 訪談狀態（v2.0，管理 session、turns、SSE、feedback）
- `psychProfileStore.ts`: 心理畫像狀態（v2.0，管理 consent、richness、overview）

## 🎨 樣式

使用 Less 進行樣式管理：

- `variables.less`: 變量定義
- `mixins.less`: 混入函數
- `global.less`: 全局樣式

## 🧪 開發規範

### 代碼風格

- 使用 TypeScript 嚴格模式
- 使用 Biome 進行 lint 和格式化

```bash
# 檢查代碼
npm run lint
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

前台與後台建議使用兩個獨立 Vercel 專案：
- `frontend`（Production Domain: 例如 `app.xxx.com`）
- `frontend-admin`（Production Domain: 例如 `admin.xxx.com`）

若 `frontend-admin` 仍引用 `../frontend/src` 共用代碼，Vercel 需採用 **repo root** 建置（使用 root `vercel.json`，輸出 `frontend-admin/dist`），避免子目錄建置時出現模組解析失敗。

### 環境變量

生產環境需要設置：
- `VITE_API_BASE_URL`: 生產環境API地址
- `VITE_ADMIN_LOGIN_URL`: 主前台導向管理後台登入頁（必須為絕對 URL）

## 🌐 國際化（i18n）

- 支援繁體中文（zh-TW）和英文（en-US）
- 翻譯檔案位於 `src/assets/i18n/`，zh-TW 與 en-US 共 634 個 key 完全對應
- 使用 `t('key')` 函式取得翻譯文字
- 語言偵測：優先讀取 localStorage，否則使用 navigator.language
- 切換語言後透過 `RouterProvider key={locale}` 強制重新渲染

## 📝 開發注意事項

1. **API對接**: 確保後端服務運行在配置的地址
2. **Session管理**: 快速體驗模式使用 sessionStorage 存儲 Session ID
3. **Token管理**: 勾選「記住我」時存入 `localStorage`，否則存入 `sessionStorage`（關閉瀏覽器即失效）。Zustand persist 僅持久化 `user`，不持久化 `token`，避免 rememberMe 語義被繞過
4. **錯誤處理**: 統一使用 `getErrorMessage()` 從 `@/utils/apiError` 提取錯誤訊息；避免使用 `error instanceof Error`（request interceptor 拋出的是普通物件，非 Error 實例）
5. **類型安全**: 所有API調用都有類型定義
6. **安全**: ErrorBoundary 在生產環境隱藏具體錯誤訊息；Login 頁面驗證 redirect 路徑防止 open redirect

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
