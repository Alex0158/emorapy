# 跨端產品核心

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：00-跨端產品核心 子域入口與閱讀順序
**取證代碼入口**：`backend/prisma/schema.prisma`、`backend/src/routes`、`frontend/src/router/index.tsx`、`frontend-admin/src/router.tsx`、`mobile/tsconfig.json`、`packages/contracts/src`
**最後核驗 Commit**：`1295216`
**最後核驗日期**：`2026-05-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本目錄定義 Web 版與 App 版共用的產品核心。這裡描述跨平台不變的產品意圖、PRD 需求、用戶場景、成功指標、能力、角色、流程、狀態與治理規則，不描述某一端的 UI 實作細節。

## 閱讀順序

1. [00-跨端產品核心總覽.md](./00-跨端產品核心總覽.md)
2. [01-產品PRD總章.md](./01-產品PRD總章.md)
3. [02-用戶場景與假設台帳.md](./02-用戶場景與假設台帳.md)
4. [03-成功指標與產品健康.md](./03-成功指標與產品健康.md)
5. [04-PRFAQ與非目標.md](./04-PRFAQ與非目標.md)
6. [05-工程級PRD對標與治理缺口台賬.md](./05-工程級PRD對標與治理缺口台賬.md)
7. [../50-跨端Mapping與Parity/00-跨端Parity總覽.md](../50-跨端Mapping與Parity/00-跨端Parity總覽.md)
8. 需要看 Web 已落地狀態時，轉到 [../10-Web端/00-Web端凍結基線總覽.md](../10-Web端/00-Web端凍結基線總覽.md)
9. 需要看 App 開發投影時，轉到 [../20-App端/00-App端總覽.md](../20-App端/00-App端總覽.md)
10. 需要進入 App 實作時，補讀 [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md) 與 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)

## SSOT 規則

1. 產品意圖、PRD 需求、成功指標、產品能力、角色語義、案件狀態、流程轉移與風險治理規則，優先在本目錄定義。
2. Web / Admin Web / App 文件只能描述平台投影與差異，不得重新定義本目錄已裁決的核心業務規則。
3. `05-工程級PRD對標與治理缺口台賬.md` 裁決需求屬性、強制程度、外部標準對標和缺口記錄方式；它不構成第三方合規聲明。
4. 若代碼已超前本目錄，應回寫本目錄；若代碼未達成本目錄設計，應在 `07-待處理問題與治理/待處理/` 建立待處理任務。
5. 任一端改動 DB schema、API contract、角色權限、狀態機或持久化資料語義時，必須同步更新跨端 Mapping / Parity 文件。
6. App 端改動 navigation、SecureStore、Push、Deep Link、upload、telemetry 或 shared contracts / api-client 消費時，不能只更新 App 文件；必須同步回查 App 中層基線、Parity 中層 Mapping 與待辦治理。
