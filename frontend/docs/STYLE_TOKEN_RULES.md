# 樣式 Token 使用規範

本文件定義 Ant Design theme、Less variables、Tailwind token 的責任邊界，以及硬編碼顏色與 inline 視覺樣式的收斂原則。

## 一、Token 責任邊界

### 1. App.tsx 主題 Token（Ant Design Theme）

**用途**：控制 Ant Design 元件基礎樣式
- 主色、輔色、成功/警告/錯誤色
- 圓角、字體、高度等元件預設
- 透過 `ConfigProvider` 的 `theme` 傳入

**範例**：
```ts
colorPrimary: '#84A59D',
colorInfo: '#84A59D',
borderRadius: 16,
```

## 2. variables.less（Less 變量）

**用途**：頁面級與業務元件視覺樣式
- 品牌色、字體、間距、圓角、陰影
- 頁面專屬 less 檔應 `@import` 此檔
- 業務元件樣式應引用 `@color-primary`、`@spacing-lg` 等變量

**範例**：
```less
@color-primary: #84A59D;
@spacing-lg: 24px;
@border-radius-md: 12px;
@shadow-small: 0 2px 8px rgba(0, 0, 0, 0.04);
```

## 3. index.css Tailwind Token

**用途**：layout 與少量 utility
- 保留 `@theme` 定義的 CSS 變量（如 `--color-primary`）
- 用於 layout、flex、grid、spacing 等
- **不直接承擔品牌色細節**：避免在 JSX 用 Tailwind 寫 `text-[#84A59D]`、`bg-[#xxx]` 等

## 二、禁止清單

1. **色碼**：非特殊頁面（如深色主題頁），不直接在 JSX 寫 hex、rgb、rgba
2. **陰影/圓角/背景**：非極少數例外，不用 inline `style` 寫陰影、圓角、背景
3. **重複控制**：同層 layout 不同時用 Tailwind utility 與 Less class 重複控制

## 三、收斂原則

- 新增或重構頁面時，優先使用 Less 語意 class 與 variables.less
- 品牌色、間距、圓角、陰影應從 variables.less 引用
- 若需 Tailwind，僅用於 layout（flex、grid、gap、padding）與少量 utility
- Code Review 時應檢查是否符合上述邊界
