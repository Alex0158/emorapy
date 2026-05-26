# 接口描述

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：06-接口描述 子域入口、閱讀順序、API contract、OpenAPI 與錯誤模型缺口
**取證代碼入口**：`backend/src/app.ts`、`backend/src/routes`、`backend/src/utils/errors.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`backend/src/middleware/validator.ts`、`backend/src/middleware/rateLimiter.ts`、`frontend/src/services/api`、`frontend/src/services/request.ts`、`frontend-admin/src/services/api`、`frontend-admin/src/services/request.ts`、`packages/api-client/src`
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-07`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本子域承接 `CJ` 的模組級接口契約、常見錯誤碼、副作用與最小回歸集。

當前正式文檔：

1. `01-auth-session.md`
2. `02-user-profile-pairing.md`
3. `03-case.md`
4. `04-judgment.md`
5. `05-reconciliation-execution.md`
6. `06-interview-psych-profile.md`
7. `07-chat.md`
8. `08-content-notification.md`
9. `09-admin.md`
10. `10-health-metrics.md`
11. `11-API契約與OpenAPI缺口台賬.md`
12. `12-錯誤模型與ProblemDetails缺口台賬.md`

本子域不單獨裁決：

1. 某個接口是否在用、候選廢棄或已確認廢棄。該狀態以 [../全接口清單-主文檔.md](../全接口清單-主文檔.md) 為準；本目錄內若附帶模組級狀態摘要，只作閱讀輔助。
2. 某個功能或頁面的正式存在性
3. 跨端產品核心、平台投影或 Web / App parity；這些分別回 [../00-跨端產品核心/README.md](../00-跨端產品核心/README.md)、[../10-Web端/README.md](../10-Web端/README.md)、[../20-App端/README.md](../20-App端/README.md) 與 [../50-跨端Mapping與Parity/README.md](../50-跨端Mapping與Parity/README.md)。若涉及 App screen / native navigation / platform adapter，直接補看 [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md)；若涉及 App 首輪能力到 Backend / API / DB / shared package 的落點，直接補看 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)
4. OpenAPI / machine-readable contract 已完成。當前接口治理仍是現碼守衛 + 主冊 + 模組詳規；OpenAPI 缺口與準入規則見 [11-API契約與OpenAPI缺口台賬.md](./11-API契約與OpenAPI缺口台賬.md)。
5. Problem Details / machine-readable error schema 已完成。當前 API 錯誤使用 CJ 自有 envelope；錯誤模型、HTTP status、`error.code`、request id、retry policy 與 RFC 9457 缺口見 [12-錯誤模型與ProblemDetails缺口台賬.md](./12-錯誤模型與ProblemDetails缺口台賬.md)。

使用順序：

1. 先查 [../全接口清單-主文檔.md](../全接口清單-主文檔.md) 確認接口狀態。
2. 再進入本目錄查看模組內契約、業務規則、限流與回歸風險。
3. 若要做影響分析，回查 [../接口-功能-頁面-Mapping.md](../接口-功能-頁面-Mapping.md)。
4. 若接口變更會造成 Web / App / Backend / DB 一致性差異，必須同步回查 [../50-跨端Mapping與Parity/00-跨端Parity總覽.md](../50-跨端Mapping與Parity/00-跨端Parity總覽.md) 與 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)。
5. 若接口變更會新增或改變 App Push token、Deep Link、Upload、SecureStore/session restore、telemetry 或 App-only response shape，不得只改本目錄；必須同步更新 App / Parity 文件或新增 `07-待處理問題與治理/待處理/` 任務。
6. 若接口變更要支持 typed client、schema contract、OpenAPI、SDK 或第三方接入，先回查 [11-API契約與OpenAPI缺口台賬.md](./11-API契約與OpenAPI缺口台賬.md)，不得把人工表格視作 OpenAPI。
7. 若接口變更新增錯誤碼、改變 HTTP status、validation details、rate limit retry、AI failure retry 或 App 錯誤展示策略，先回查 [12-錯誤模型與ProblemDetails缺口台賬.md](./12-錯誤模型與ProblemDetails缺口台賬.md)，不得把現有 envelope 宣稱為 RFC 9457 Problem Details。

本目錄從屬於接口主冊，不替代主註冊表。
