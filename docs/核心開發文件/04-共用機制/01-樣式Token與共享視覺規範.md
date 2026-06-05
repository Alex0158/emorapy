# 樣式 Token 與共享視覺規範

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：正式規格
**覆蓋範圍**：前後台共享元件、樣式 token 與流式通用機制：01-樣式Token與共享視覺規範
**取證代碼入口**：`frontend/src/index.css`、`frontend-admin/src/index.css`、`frontend/src/App.tsx`、`frontend-admin/src/App.tsx`、`frontend/src/components/common`、`frontend/src/components/ui`、`frontend/src/components/business`、`frontend-admin/src/pages`、`frontend/src/assets/i18n`、`frontend-admin/src/assets/i18n`、`package.json`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本文件承接 theme token、樣式變量與視覺收斂規則，避免頁面層繼續分散硬編碼。

當前現碼的正式真相是：

1. 主 Web 的設計 token 定義在 `frontend/src/index.css` 的 `@theme` 區塊（CSS Custom Properties, oklch 色彩空間）
2. Admin Web 的設計 token 定義在 `frontend-admin/src/index.css`（同樣結構）
3. **Ant Design 已完全移除**——不再有 `ConfigProvider` 或 antd theme token
4. 字體：Inter + Plus Jakarta Sans 自託管 (`public/fonts/`)，Noto Sans TC 從 Google Fonts 異步加載
5. 當前裁決為「runtime/source UI 已歸零 Ant Design 與 `.less` 源文件」；若 lockfile、工具鏈或歷史治理文件中仍可搜尋到相關字串，只能視為非 runtime 記憶或歷史證據，不能被當作現行 UI 依賴。

## 1. Token 責任邊界

### 1.1 Design Token（CSS Custom Properties）

定義在 `index.css` 的 `@theme` 區塊，控制：

1. 品牌色（oklch 色彩空間：`--color-primary`, `--color-secondary` 等）
2. 語義色（success, warning, destructive）
3. 中性色（background, foreground, muted, border）
4. 圓角（`--radius-sm` ~ `--radius-full`）
5. 陰影（`--shadow-xs` ~ `--shadow-xl`）
6. 字體（`--font-heading`, `--font-body`）
7. 動畫（`--animate-duration-*`, `--animate-easing`）

### 1.2 Tailwind CSS 4 整合

- Tailwind 4 直接從 `@theme` 區塊讀取 token 作為 utility class
- 組件使用 `className="bg-primary text-foreground"` 等 Tailwind utilities
- shadcn/ui 組件自動繼承 CSS variables

### 1.3 Utility / Layout 樣式

只承接 layout 與少量 utility，不直接承擔品牌色細節。

## 2. 禁止清單

1. **禁止引入 antd** — 已完全移除，不得重新引入
2. 非特殊場景，禁止在 JSX 新增 hex/rgb/rgba 硬編碼色碼（使用 token）
3. 禁止使用 inline `style` 承擔陰影、圓角、背景等長期視覺真相（使用 Tailwind classes）
4. 不得把主 Web 與 Admin 都會依賴的 token 再分散到多個頁面檔內各自命名
5. 禁止使用 LESS/SCSS — 純 CSS + Tailwind only
6. 禁止把 `antd`、`@ant-design/icons`、`.less` 重新引入 runtime 或源樣式；工具鏈/測試中的歷史字串只能作短期遷移殘留，需有待辦追蹤。

## 3. 收斂原則

1. 新增或重構頁面時，先判斷應修改 `index.css` 的 `@theme` token，還是只屬於局部 Tailwind classes
2. 主 Web 與 Admin 若要共享同一批 token，應使用相同的 CSS variable 命名規則
3. 所有樣式通過 Tailwind utility classes 實現
4. code review 需檢查是否把視覺真相重新分散到頁面層

## 4. 關聯正文

1. 跨流共用規則：見 [00-共用機制總覽.md](./00-共用機制總覽.md)
2. 工程分層與共享包：見 [../05-工程架構與共享層/README.md](../05-工程架構與共享層/README.md)
