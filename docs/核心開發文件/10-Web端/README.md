# Web 端

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：10-Web端 子域入口與閱讀順序
**取證代碼入口**：`frontend/src/router/index.tsx`、`frontend/src/pages`、`frontend-admin/src/router.tsx`、`frontend-admin/src/pages`、`backend/src/routes`、`scripts/start-dev.sh`
**最後核驗 Commit**：`adda512`
**最後核驗日期**：`2026-05-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本目錄記錄目前 Web 版與 Admin Web 版的凍結基線。它是 App 開發的已實作對照，不是跨端產品規則的最高來源。

## 閱讀順序

1. [00-Web端凍結基線總覽.md](./00-Web端凍結基線總覽.md)
2. [../00-跨端產品核心/01-產品PRD總章.md](../00-跨端產品核心/01-產品PRD總章.md)
3. [../頁面清單.md](../頁面清單.md)
4. [../接口-功能-頁面-Mapping.md](../接口-功能-頁面-Mapping.md)
5. [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md)
6. [../50-跨端Mapping與Parity/00-跨端Parity總覽.md](../50-跨端Mapping與Parity/00-跨端Parity總覽.md)
7. [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)

## 維護規則

1. Web 端文件只描述 `frontend/` 與 `frontend-admin/` 的平台投影。
2. 產品核心、PRD 需求或成功指標變更應先回寫 `00-跨端產品核心/`，再更新 Web 端差異。
3. Web 凍結後若仍修 bug 或治理缺口，必須更新本目錄的凍結基線與待處理任務狀態。
4. App 開發使用 Web 基線時，必須通過 App navigation / adapter 基線與 App 首輪工程落點 Mapping 做轉譯，不得直接把 Web route、guard、storage 或 Admin 入口當成 App 方案。
