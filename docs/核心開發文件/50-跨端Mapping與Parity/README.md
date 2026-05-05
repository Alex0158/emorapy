# 跨端 Mapping 與 Parity

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：50-跨端Mapping與Parity 子域入口與閱讀順序
**取證代碼入口**：`backend/src/routes`、`backend/prisma/schema.prisma`、`frontend/src/router/index.tsx`、`frontend-admin/src/router.tsx`、`mobile/tsconfig.json`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`adda512`
**最後核驗日期**：`2026-05-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本目錄負責把跨端產品核心映射到 Web、App、Backend、API、DB 與共享層。它是 Web 凍結版與 App 開發版之間的差異追蹤入口。

## 閱讀順序

1. [00-跨端Parity總覽.md](./00-跨端Parity總覽.md)
2. [../00-跨端產品核心/00-跨端產品核心總覽.md](../00-跨端產品核心/00-跨端產品核心總覽.md)
3. [../10-Web端/00-Web端凍結基線總覽.md](../10-Web端/00-Web端凍結基線總覽.md)
4. [../20-App端/00-App端總覽.md](../20-App端/00-App端總覽.md)

## 維護規則

1. 每個跨端能力都必須能在本目錄看到 Web / App / Backend / API / DB 的對照狀態。
2. App 暫未承接的 Web 能力，記為 Parity 缺口，不直接視為設計刪除。
3. Web 專屬或 App 專屬平台差異要明確標註，不得混成產品核心差異。
4. 任何必須雙端統一但尚未統一的事項，都要新增待處理任務並回鏈到本目錄。

