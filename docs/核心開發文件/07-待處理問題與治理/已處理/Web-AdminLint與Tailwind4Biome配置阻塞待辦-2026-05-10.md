# Web Admin Lint 與 Tailwind 4 / Biome 配置阻塞待辦（2026-05-10）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Admin Web lint gate、Biome CSS parser、Tailwind CSS 4 指令、shadcn/ui type-only import 警告
**取證代碼入口**：`frontend-admin/package.json`、`frontend-admin/src/index.css`、`frontend-admin/src/components/ui`
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-10`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理
**Owner**：Frontend / Admin Web
**優先級**：P0
**分類**：質量 gate 阻塞

## 1. 問題

`frontend-admin` build 可以通過，但 lint gate 失敗。這代表 Admin Web 目前不能用 `npm run lint --workspace frontend-admin` 作為綠燈品質門檻，與核心文件把 Admin Web 列為平台治理正式入口的口徑不一致。

## 2. 證據

命令：

```bash
npm run lint --workspace frontend-admin
```

結果：失敗。

主要失敗點：

1. `frontend-admin/src/index.css` 第 2 行的 `@plugin "tailwindcss-animate";` 被 Biome 報 `Tailwind-specific syntax is disabled`。
2. `frontend-admin/src/index.css` 第 9 行的 `@theme { ... }` 同樣被 Biome CSS parser 擋住。
3. `frontend-admin/src/index.css` 第 99-100 行使用 `!important` 被 `lint/complexity/noImportantStyles` 擋住。
4. 多個 `frontend-admin/src/components/ui/*.tsx` 檔案有 `lint/style/useImportType` type-only import 警告。

同輪對照命令：

```bash
npm run build --workspace frontend-admin
```

結果：通過。因此問題集中在 lint/tooling gate，不是 production build 阻塞。

## 3. 核心文件依據

1. `10-Web端/00-Web端凍結基線總覽.md` 將 `frontend-admin/` 定義為 Admin Web 管理與平台治理入口。
2. `08-測試規範與驗收/README.md` 將 `frontend-admin/src` 納入 Web/Admin 測試與驗收證據入口。
3. 活躍問題總覽要求任何 dev / release、docs / code、schema / runtime、Web / App 需要統一的差異都必須在待辦中可追溯。

## 4. 風險

1. CI 或本地 release gate 若恢復 Admin lint，會直接失敗。
2. Tailwind 4 正式語法沒有被 Biome 配置承接，後續 CSS 變更可能出現「build 綠、lint 紅」的長期分裂。
3. shadcn/ui 基礎元件的 type-only import 警告會掩蓋真正高風險 lint 問題。

## 5. 目標狀態

1. Biome CSS parser 配置明確支持 Tailwind 4 指令，或 lint scope 明確排除由 Tailwind 4 管理的 CSS 指令並在文件中說明。
2. type-only import 警告歸零。
3. reduced motion 的全域覆蓋策略保留可訪問性意圖，但不讓 lint gate 失敗。
4. `npm run lint --workspace frontend-admin` 穩定通過。

## 5.1 修復裁決

本問題納入 [Web五項修復主控方案-2026-05-10.md](./Web五項修復主控方案-2026-05-10.md) 的 P0-A 階段。修復時優先用最窄 Biome / CSS override 承接 Tailwind 4 語法與 reduced motion 例外，並把 `frontend-admin/src/components/ui` 的 type-only import warning 清零；不得以移除 Admin lint gate 或刪除 reduced motion 策略換取綠燈。

## 5.2 本輪修復證據（2026-05-10）

已落地修復：

1. 新增 `frontend-admin/biome.json`，在 Admin Web scope 內啟用 Tailwind directive parser，並只針對 reduced-motion `!important` 關閉 `noImportantStyles`，未關閉 TS / TSX lint。
2. 將 `frontend-admin/src/components/ui/*.tsx` 的 React 型別 import 改成 type-only import，清除 `useImportType` 警告。

本輪驗證：

```bash
npm run lint --workspace frontend-admin
npm run build --workspace frontend-admin
```

結果：兩項均通過。Admin lint gate 已恢復為可執行綠燈，後續整理台帳時可移入 `已處理/`。

## 6. 驗收命令

```bash
npm run lint --workspace frontend-admin
npm run build --workspace frontend-admin
npm run docs:check
```
