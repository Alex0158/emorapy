# 工程架構與共享層

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：05-工程架構與共享層 子域入口與閱讀順序
**取證代碼入口**：`package.json`、`scripts/start-dev.sh`、`frontend/tsconfig.app.json`、`frontend-admin/tsconfig.app.json`、`backend/tsconfig.json`、`mobile/package.json`、`mobile/tsconfig.json`、`packages/contracts/package.json`、`packages/api-client/package.json`、`backend/src`、`frontend/src`、`frontend-admin/src`、`mobile/app`、`mobile/src/platform`
**最後核驗 Commit**：`1295216`
**最後核驗日期**：`2026-05-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本子域承接 `CJ` repo 的工程分層、共享 package、tsconfig alias 與跨端落點規則。

當前正式文檔：

1. [00-工程架構與共享層總覽.md](./00-工程架構與共享層總覽.md)
2. [Repo平台分層與共享規範.md](./Repo平台分層與共享規範.md)
3. [01-本地開發與工作區基線.md](./01-本地開發與工作區基線.md)

本子域的固定前提：

1. root npm workspaces 目前包含 `frontend/`、`frontend-admin/` 與 `packages/*`
2. `backend/`、`mobile/` 仍是 repo-local 目錄，不是 root workspace
3. `mobile/` 目前同時存在 Expo Router 模板入口 `mobile/app` 與 types-only 平台骨架 `mobile/src/platform`；這不是 CJ App 主流程已落地的證據
4. 進入 App navigation、Deep Link、SecureStore、Push、upload 或 App API adapter 實作前，必須先回查 `20-App端/01-App導航與平台Adapter基線.md` 與 `50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`
5. 共享 alias 的接線狀態必須以各自 `tsconfig` 與真實 import 為準，不按理想化 monorepo 假設寫正文；`frontend-admin/` 目前已局部接入 `@cj/contracts` 與 `@cj/api-client` transport baseline

本子域不回答：

1. 具體功能是否存在
2. 頁面正式入口與守衛的產品口徑
3. dated 驗收記錄與一次性推進方案

閱讀順序：

1. 先讀 [../README.md](../README.md)
2. 再讀 [00-工程架構與共享層總覽.md](./00-工程架構與共享層總覽.md)
3. 再讀根層的 `全接口清單-主文檔.md` 與 `接口-功能-頁面-Mapping.md`
4. 再讀 [01-本地開發與工作區基線.md](./01-本地開發與工作區基線.md)
5. 最後讀 [Repo平台分層與共享規範.md](./Repo平台分層與共享規範.md)
6. 若本次改動涉及 App 端，補讀 [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md) 與 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)
