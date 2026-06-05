# API 契約與 OpenAPI 缺口台賬

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：接口詳規
**覆蓋範圍**：API 契約治理、接口主冊、模組接口文檔、錯誤碼、版本、OpenAPI / schema 缺口與跨端 client 生成準入
**取證代碼入口**：`backend/src/app.ts`、`backend/src/routes`、`backend/src/middleware/responseFormatter.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/utils/validation.ts`、`scripts/check-docs-truth.mjs`、`scripts/lib/core-docs-truth.mjs`、`packages/contracts/src`、`packages/api-client/src`、`frontend/src/services/api`、`frontend-admin/src/services/api`、`mobile/src/platform`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 定位

本文是接口子域的治理層文件。它不替代 [../全接口清單-主文檔.md](../全接口清單-主文檔.md)，也不替代 `01-10` 模組接口詳規；它回答「CJ 的 API 契約距離頂級工程級 API 規格還缺什麼，以及哪些缺口不得被誤認為已完成」。

本文參考 OpenAPI Specification、ISO/IEC/IEEE 29148 需求追溯、OWASP ASVS API 安全控制思路與本倉庫 `docs:check:truth` 現碼抽取結果。外部基線只作工程對標，不宣稱 CJ 已有正式 OpenAPI 規格或第三方 API 安全審計。

## 2. 當前 API 真相來源

| 層級 | 當前 SSOT | 作用 | 限制 |
| --- | --- | --- | --- |
| Route 真相 | `backend/src/app.ts` + `backend/src/routes` | 端點存在性、method/path、掛載前綴 | 不完整描述 request / response schema |
| 主接口清單 | `全接口清單-主文檔.md` | 端點狀態、授權、限流、功能域、前端使用狀態 | 不是機器可消費 OpenAPI |
| 模組接口詳規 | `06-接口描述/01-10*.md` | 字段、錯誤碼、副作用、頁面對接與深水區規則 | 表格與文字仍需人工維護 |
| Truth guard | `scripts/check-docs-truth.mjs` | 檢查接口總數、端點行、狀態與 stale endpoint | 不驗證 body schema / response schema 完整性 |
| Shared packages | `packages/contracts/src`、`packages/api-client/src` | 跨端共享型別與 API client 基礎 | 尚未覆蓋全部接口；App M1-M5 已正式消費 `@cj/api-client` domain client，後續新增接口仍需先補 shared contract / client，再接平台 adapter |
| 平台投影 | Web / Admin API service、`mobile/src/platform` | 實際調用與平台差異 | Web 調用不等於 App 已覆蓋 |

## 3. 工程級 API 契約最低屬性

新增或修改接口時，至少要能在主冊、模組文檔、代碼或測試中追到下列屬性。

| 屬性 | 最低要求 | 當前承接 | 不足時不得宣稱 |
| --- | --- | --- | --- |
| Method / Path | 真實 route 註冊與文檔一致 | `docs:check:truth` | 接口已文檔化 |
| Auth / Session | 明確 Public / User / Admin / Session / Mixed credential | 主接口清單、模組文檔 | 權限模型已清晰 |
| Request schema | body/query/params 主要字段、限制與可選性 | 模組詳規 + route validator | 已具備 OpenAPI schema |
| Response schema | 前端實際消費字段與狀態 envelope | 模組詳規、frontend api service | 可生成 typed client |
| Error model | error.code、HTTP、UI 行為、重試策略 | 模組錯誤碼矩陣 | 錯誤恢復完整 |
| Side effects | DB 寫入、通知、AI 任務、ledger、狀態轉移 | 模組深水區規則 | 接口是純查詢或無副作用 |
| Idempotency / concurrency | 重入、lock、retry、duplicate request 語義 | chat / judgment / repair 文檔與代碼 | 連點或重試安全 |
| Version / deprecation | `已使用 / 待承接 / 候選廢棄 / 已確認廢棄` 與兼容入口 | 主接口清單 | 可安全移除接口 |
| Platform projection | Web / Admin / App 是否消費 | Mapping / Parity | App 已覆蓋 |
| Evidence | 單測、e2e、smoke、manual evidence 或 Baseline Pending | RTM / 測試 / 90 證據 | 已驗收 |

## 4. OpenAPI 對標缺口

| 缺口 ID | 對標 | 現狀 | 風險 | 治理處置 |
| --- | --- | --- | --- | --- |
| CJ-API-GAP-001 | OpenAPI paths / operations | 端點可由 route 與文檔守衛核對，但沒有正式 `openapi.yaml/json` | 第三方 client、App typed client、契約測試無法自動生成 | 標記為「OpenAPI 待建立」，不得宣稱 OAS 已完成 |
| CJ-API-GAP-002 | Request body / parameter schema | Joi / validator 分散在 routes / utils，文檔以人工表格承接 | body schema 可能和文檔漂移 | 新增高風險接口時，模組文檔必須列核心字段與限制；後續再評估 schema 生成 |
| CJ-API-GAP-003 | Response schema | 前端服務與文檔列出常用字段，但沒有集中 schema | response 變更可能破壞 Web/Admin/App 而 docs 守衛不知 | shared contracts / api-client 覆蓋前，不得自動生成跨端 client |
| CJ-API-GAP-004 | Error components | error code 已矩陣化，但未形成 machine-readable components | UI 恢復策略仍靠人工維護 | 所有新接口必須補 error.code / HTTP / UI 行為 / 重試策略 |
| CJ-API-GAP-005 | Security schemes | Auth/session/admin token/mixed credential 有文檔，但未抽象成 OpenAPI security schemes | 外部審查與 App 接入時容易誤配 | 任何 App 接口接入前，必須先明確安全 scheme 與 token/storage 邊界 |
| CJ-API-GAP-006 | API versioning | 路徑使用 `/api/v1`，但缺少正式 breaking-change policy | 候選廢棄接口可能被誤刪 | 主接口清單仍是接口狀態 SSOT；廢棄需先進候選狀態 |
| CJ-API-GAP-007 | Contract tests | `docs:check:truth` 查端點存在與狀態，但不做 schema contract tests | 欄位漂移可能漏檢 | 高風險接口以現有單測/e2e 補證據；schema 契約測試另立任務 |

## 5. 分層裁決

| 問題 | 裁決 |
| --- | --- |
| 能否把 `06-接口描述/*.md` 當 OpenAPI？ | 不能。它們是人工接口詳規，不是 machine-readable OAS。 |
| 能否直接從 Web API service 生成 App client？ | 不能。App 必須先經 `packages/contracts`、`packages/api-client`、`mobile/src/platform` 與 Parity 裁決。 |
| 能否因 `docs:check:truth` 通過就宣稱 schema 完整？ | 不能。該守衛只覆蓋 route / endpoint / 狀態 / 部分清單真相，不覆蓋完整 body/response schema。 |
| 能否在沒有 OpenAPI 前維持正式接口治理？ | 可以，但必須承認這是文檔 + 代碼守衛治理，不是 OAS contract governance。 |
| 哪些接口優先進 machine-readable contract？ | Auth/session、case/judgment、chat request-judgment、AI stream、Admin reports、notification、health/version。 |

## 6. 變更 gate

1. 新增 route：必須同步主接口清單、Mapping、對應 `06-接口描述` 模組文檔；若屬新模組，新增模組文檔或回寫本文缺口。
2. 修改 request / response 字段：必須同步對應 frontend / admin API service、shared contracts / api-client 影響判斷與模組詳規。
3. 修改 auth / session / admin token：必須同步接口主冊、認證與會話、NFR、安全文檔與 App / Parity 判斷。
4. 修改 error.code 或 HTTP status：必須同步模組錯誤碼矩陣與 UI 重試策略。
5. 新增 App 消費接口：必須先確認 shared package、platform adapter、storage / deep link / upload / notification 邊界，不得只復用 Web 文檔。
6. 生成 OpenAPI 前，不得以本文件替代 `openapi.yaml/json`；生成後，本文要改為 OAS governance / drift policy。

## 7. 後續優先級

| 優先級 | 任務 | 理由 |
| --- | --- | --- |
| P0 | 先把 high-risk endpoints 的 request / response / error / side effect 補到模組文檔 | 不等 OpenAPI 也能降低重大漂移 |
| P1 | 為 Auth / Case / Judgment / Chat / AI Stream / Admin Reports 設計 OpenAPI 生成或手寫策略 | 這些是跨端與治理最高風險接口 |
| P1 | 把 shared contracts / api-client 與接口文檔建立覆蓋表 | App 接入前必須知道哪些接口可復用 |
| P2 | 引入 schema contract tests 或 OAS lint | 等高風險接口 schema 穩定後再做；未建立 machine-readable schema 前不得編造完成狀態 |
