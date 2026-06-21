# 跨端 Mapping 與 Parity

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：50-跨端Mapping與Parity 子域入口與閱讀順序
**取證代碼入口**：`backend/src/routes`、`backend/prisma/schema.prisma`、`frontend/src/router/index.tsx`、`frontend-admin/src/router.tsx`、`mobile/app`、`mobile/tsconfig.json`、`mobile/src/platform`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本目錄負責把跨端產品核心映射到 Web、App、Backend、API、DB 與共享層。它是 Web 凍結版與 App 開發版之間的差異追蹤入口。

## 閱讀順序

1. [00-跨端Parity總覽.md](./00-跨端Parity總覽.md)
2. [01-App首輪能力與工程落點Mapping.md](./01-App首輪能力與工程落點Mapping.md)
3. [../00-跨端產品核心/00-跨端產品核心總覽.md](../00-跨端產品核心/00-跨端產品核心總覽.md)
4. [../00-跨端產品核心/01-產品PRD總章.md](../00-跨端產品核心/01-產品PRD總章.md)
5. [../10-Web端/00-Web端凍結基線總覽.md](../10-Web端/00-Web端凍結基線總覽.md)
6. [../20-App端/00-App端總覽.md](../20-App端/00-App端總覽.md)
7. [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md)
8. [../20-App端/02-App完整版本工程PRD.md](../20-App端/02-App完整版本工程PRD.md)
9. [../20-App端/03-App完整版本開發Roadmap.md](../20-App端/03-App完整版本開發Roadmap.md)
10. [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md)
11. [../08-測試規範與驗收/04-需求驗證矩陣.md](../08-測試規範與驗收/04-需求驗證矩陣.md)

## 維護規則

1. 每個跨端能力都必須能在本目錄看到 Web / App / Backend / API / DB 的對照狀態。
2. 每個跨端 PRD 需求若進入 App 或 Web 平台投影，必須能回鏈到通用級 `EMO-PRD-*` 或共用 `EMO-NFR-*`。
3. App 暫未承接的 Web 能力，記為 Parity 缺口，不直接視為設計刪除。
4. Web 專屬或 App 專屬平台差異要明確標註，不得混成產品核心差異。
5. 任何必須雙端統一但尚未統一的事項，都要新增待處理任務並回鏈到本目錄。
6. App navigation / platform adapter 的具體落點由 `20-App端/01-App導航與平台Adapter基線.md` 裁決；本目錄只追蹤它對 Backend / API / DB / shared package 與跨端一致性的影響。
7. App 測試、回歸、CI 或證據入口只在 `08-測試規範與驗收/03-App測試與證據接入基線.md` 的進場條件滿足後承認為有效 Parity 證據。
8. 完整 App M0-M6 Roadmap 相關能力必須同步更新 App PRD / Roadmap、Parity、RTM 與待辦，不能只改單一平台文件。
