# App 端

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：20-App端 子域入口與閱讀順序
**取證代碼入口**：`mobile/package.json`、`mobile/tsconfig.json`、`mobile/app/_layout.tsx`、`mobile/app/(tabs)/_layout.tsx`、`mobile/components/Themed.tsx`、`mobile/constants/Colors.ts`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`adda512`
**最後核驗日期**：`2026-05-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本目錄是 App 版開發入口。App 版以現有 `mobile/` Expo 專案為承載位置，與 Web 共用產品核心、後端 API、DB schema 與共享 contracts 方向。

## 閱讀順序

1. [00-App端總覽.md](./00-App端總覽.md)
2. [../00-跨端產品核心/00-跨端產品核心總覽.md](../00-跨端產品核心/00-跨端產品核心總覽.md)
3. [../10-Web端/00-Web端凍結基線總覽.md](../10-Web端/00-Web端凍結基線總覽.md)
4. [../50-跨端Mapping與Parity/00-跨端Parity總覽.md](../50-跨端Mapping與Parity/00-跨端Parity總覽.md)

## 維護規則

1. App 端文件只能描述 `mobile/` 的平台投影與原生差異。
2. App 不另建獨立產品規則；跨端能力以 `00-跨端產品核心/` 為準。
3. App 尚未實現但 Web 已存在的能力，先記入 Parity 缺口，不在 App 文件中假裝已完成。
4. App 對 DB schema、API contract、Push、Deep Link、SecureStore 的需求若影響 Web 或 backend，一律同步建立待處理任務。

