# App 端

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：20-App端 子域入口與閱讀順序
**取證代碼入口**：`mobile/package.json`、`mobile/tsconfig.json`、`mobile/app/_layout.tsx`、`mobile/app/(tabs)/_layout.tsx`、`mobile/app/(tabs)/index.tsx`、`mobile/app/(tabs)/two.tsx`、`mobile/app/modal.tsx`、`mobile/components/Themed.tsx`、`mobile/constants/Colors.ts`、`mobile/src/platform`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`1295216`
**最後核驗日期**：`2026-05-06`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本目錄是 App 版開發入口。App 版以現有 `mobile/` Expo 專案為承載位置，與 Web 共用產品核心、後端 API、DB schema 與共享 contracts 方向。

## 閱讀順序

1. [00-App端總覽.md](./00-App端總覽.md)
2. [01-App導航與平台Adapter基線.md](./01-App導航與平台Adapter基線.md)
3. [../00-跨端產品核心/00-跨端產品核心總覽.md](../00-跨端產品核心/00-跨端產品核心總覽.md)
4. [../10-Web端/00-Web端凍結基線總覽.md](../10-Web端/00-Web端凍結基線總覽.md)
5. [../50-跨端Mapping與Parity/00-跨端Parity總覽.md](../50-跨端Mapping與Parity/00-跨端Parity總覽.md)
6. [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)
7. [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md)

## 維護規則

1. App 端文件只能描述 `mobile/` 的平台投影與原生差異。
2. App 不另建獨立產品規則；跨端能力以 `00-跨端產品核心/` 為準。
3. App 尚未實現但 Web 已存在的能力，先記入 Parity 缺口，不在 App 文件中假裝已完成。
4. `mobile/app/(tabs)/index.tsx`、`mobile/app/(tabs)/two.tsx`、`mobile/app/modal.tsx` 仍是 Expo 模板頁時，只能視為導航骨架，不得當作 CJ App screen 完成。
5. `mobile/src/platform` 的 types-only 骨架只能證明平台 adapter 邊界已開始定義，不得當作 SecureStore / Push / upload runtime 或主產品流程完成。
6. App 對 DB schema、API contract、Push、Deep Link、SecureStore 的需求若影響 Web 或 backend，一律同步建立待處理任務。
7. App screen 或 adapter 進入實作前，必須先在 `50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md` 補齊 Backend / API / DB / shared package 對照與缺口裁決。
8. App smoke / regression / CI 或證據留存進場前，必須先符合 `08-測試規範與驗收/03-App測試與證據接入基線.md`；不得用 Expo 模板可啟動或 Web/Admin 測試通過替代 App 驗收。
