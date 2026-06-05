# 工程架構與共享層

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：05-工程架構與共享層 子域入口、閱讀順序、架構決策、ADR、資料模型、schema migration 與相容性治理
**取證代碼入口**：`package.json`、`scripts/start-dev.sh`、`frontend/tsconfig.app.json`、`frontend-admin/tsconfig.app.json`、`backend/tsconfig.json`、`backend/prisma/schema.prisma`、`backend/prisma/migrations`、`backend/scripts/check-release-db-parity.ts`、`scripts/ops-release-gate.sh`、`mobile/package.json`、`mobile/tsconfig.json`、`packages/contracts/package.json`、`packages/api-client/package.json`、`backend/src/app.ts`、`backend/src/routes`、`frontend/src`、`frontend-admin/src`、`mobile/app`、`mobile/src/platform`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本子域承接 `CJ` repo 的工程分層、共享 package、tsconfig alias 與跨端落點規則。

當前正式文檔：

1. [00-工程架構與共享層總覽.md](./00-工程架構與共享層總覽.md)
2. [Repo平台分層與共享規範.md](./Repo平台分層與共享規範.md)
3. [01-本地開發與工作區基線.md](./01-本地開發與工作區基線.md)
4. [02-架構決策與ADR治理基線.md](./02-架構決策與ADR治理基線.md)
5. [03-資料模型SchemaMigration與相容性治理基線.md](./03-資料模型SchemaMigration與相容性治理基線.md)

本子域的固定前提：

1. root npm workspaces 目前包含 `frontend/`、`frontend-admin/` 與 `packages/*`
2. `backend/`、`mobile/` 仍是 repo-local 目錄，不是 root workspace
3. `mobile/` 目前已從 Expo Router 模板進入 CJ App M0-M5 普通用戶主流程，`mobile/app` 承接 route group / screen，`mobile/src/platform` 承接 API、SecureStore、SSE、upload、notifications、linking、lifecycle、telemetry runtime adapter
4. 新增或改動 App navigation、Deep Link、SecureStore、Push、upload、SSE、telemetry、App API adapter 或 release evidence 口徑前，必須先回查 `20-App端/01-App導航與平台Adapter基線.md` 與 `50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`
5. 共享 alias 的接線狀態必須以各自 `tsconfig`、manifest 與真實 import 為準，不按理想化 monorepo 假設寫正文；`frontend/` 目前已依賴 `@cj/contracts` / `@cj/api-client` 並消費 M1-M5 domain client 與 AI stream pure helper，`frontend-admin/` 目前已局部接入 `@cj/contracts` 與 `@cj/api-client` transport baseline
6. workspace、shared package、API contract、DB schema、AI runtime、安全邊界、App native adapter 或 release gate 的架構性變更，必須更新 [02-架構決策與ADR治理基線.md](./02-架構決策與ADR治理基線.md) 或補充 ADR
7. 涉及 Prisma schema、migration history、release DB parity、backfill、棄用、enum / DTO / DB 相容性的變更，必須回查 [03-資料模型SchemaMigration與相容性治理基線.md](./03-資料模型SchemaMigration與相容性治理基線.md)

本子域不回答：

1. 具體功能是否存在
2. 頁面正式入口與守衛的產品口徑
3. dated 驗收記錄與一次性推進方案

閱讀順序：

1. 先讀 [../README.md](../README.md)
2. 再讀 [00-工程架構與共享層總覽.md](./00-工程架構與共享層總覽.md)
3. 再讀根層的 `全接口清單-主文檔.md` 與 `接口-功能-頁面-Mapping.md`
4. 再讀 [01-本地開發與工作區基線.md](./01-本地開發與工作區基線.md)
5. 再讀 [Repo平台分層與共享規範.md](./Repo平台分層與共享規範.md)
6. 若改動會改變架構取捨、共享層、信任邊界、DB/API/shared/App adapter 或 release gate，讀 [02-架構決策與ADR治理基線.md](./02-架構決策與ADR治理基線.md)
7. 若改動涉及 schema migration、backfill、DB parity、棄用、shared contract compatibility 或 release-blocking migration，讀 [03-資料模型SchemaMigration與相容性治理基線.md](./03-資料模型SchemaMigration與相容性治理基線.md)
8. 若改動涉及 App 端，補讀 [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md) 與 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)
