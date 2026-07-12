# 樣式 Token 與共享視覺規範

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：正式規格
**覆蓋範圍**：前後台共享元件、樣式 token 與流式通用機制：01-樣式Token與共享視覺規範
**取證代碼入口**：`frontend/src/index.css`、`frontend-admin/src/index.css`、`frontend/src/App.tsx`、`frontend-admin/src/App.tsx`、`frontend/src/components/common`、`frontend/src/components/ui`、`frontend/src/components/business`、`frontend-admin/src/pages`、`frontend/src/assets/i18n`、`frontend-admin/src/assets/i18n`、`package.json`
**最後核驗 Commit**：`e65a4b8`
**最後核驗日期**：`2026-07-12`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本文件承接 theme token、樣式變量與視覺收斂規則，避免頁面層繼續分散硬編碼。

當前現碼的正式真相是：

1. 主 Web 的設計 token 定義在 `frontend/src/index.css` 的 `@theme` 區塊（CSS Custom Properties, oklch 色彩空間）
2. Admin Web 的設計 token 定義在 `frontend-admin/src/index.css`（同樣結構）
3. **Ant Design 已完全移除**——不再有 `ConfigProvider` 或 antd theme token
4. 主 Web heading 使用 `Iowan Old Style / Palatino Linotype / Noto Serif TC / Songti TC / Georgia` fallback stack，body 使用 self-hosted Inter + `Noto Sans TC` fallback；Admin heading / body 均使用 Inter + `Noto Sans TC` + system fallback
5. 當前裁決為「runtime/source UI 已歸零 Ant Design 與 `.less` 源文件」；若 lockfile、工具鏈或歷史治理文件中仍可搜尋到相關字串，只能視為非 runtime 記憶或歷史證據，不能被當作現行 UI 依賴。

### 現行視覺方向：Guided Reflection

1. Consumer 主色：mineral canvas `#F5F1EA`、pine ink `#17372F`、clay action `#A64F3D`；surface / border 使用同一暖灰階。clay action 對 mineral canvas 對比約 `4.90:1`，白字對 clay action 約 `5.52:1`；input border `#968D82` 對 surface 約 `3.08:1`，不得回退到較淡的裝飾色。
2. Admin 沿用 mineral / pine / clay 語言，但以資料密度、狀態和操作風險為主，不複製 Consumer 的情緒引導版式。
3. 主 Web 與 Admin 的 shadow tokens 均固定為 `none`；層級依靠 spacing、type scale、border 與 surface tone。
4. 圓角保持 4-12px 的克制範圍；`rounded-full` 只用於 avatar、status dot、toggle 等具明確幾何理由的控制。

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
7. 禁止 gradient、glass/backdrop blur、發光、裝飾性 shadow、CSS/div art、emoji persona 或 handcrafted SVG 作品牌／AI 能力裝飾。
8. 禁止以大量 pills、統計卡、模型 phase、confidence/richness 數值或慶祝效果偽造價值；等待狀態只呈現使用者可理解的狀態與下一步。
9. 頁面先用 semantic section、type hierarchy、divider 與 whitespace 組織內容；只有需要建立群組、選取或互動邊界時才使用 card/container。

## 3. 收斂原則

1. 新增或重構頁面時，先判斷應修改 `index.css` 的 `@theme` token，還是只屬於局部 Tailwind classes
2. 主 Web 與 Admin 若要共享同一批 token，應使用相同的 CSS variable 命名規則
3. 所有樣式通過 Tailwind utility classes 實現
4. code review 需檢查是否把視覺真相重新分散到頁面層
5. route component 保留資料載入與 orchestration；重複或較長的純呈現區塊拆成具體 domain component，不建立萬能 page/step schema。
6. 每頁 primary action 應唯一且可辨識；危險操作與安全 route 使用語義狀態，不以主色混淆優先級。

## 4. 關聯正文

1. 跨流共用規則：見 [00-共用機制總覽.md](./00-共用機制總覽.md)
2. 工程分層與共享包：見 [../05-工程架構與共享層/README.md](../05-工程架構與共享層/README.md)
