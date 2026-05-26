# 錯誤模型與 Problem Details 缺口台賬

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：接口詳規
**覆蓋範圍**：API 錯誤模型、HTTP status、錯誤碼、request_id、Problem Details / OpenAPI 缺口與跨端失敗契約
**取證代碼入口**：`backend/src/utils/errors.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`backend/src/middleware/validator.ts`、`backend/src/app.ts`、`backend/src/middleware/rateLimiter.ts`、`frontend/src/services/request.ts`、`frontend-admin/src/services/request.ts`、`packages/api-client/src`
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-07`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 定位

本文把 CJ 的 API 失敗語義從「每個接口列常見錯誤」提升為跨端可依賴的錯誤契約。頂級工程級 API / PRD 文件通常會把 HTTP status、業務錯誤碼、validation details、request id、重試語義、隱私遮罩與 OpenAPI schema 一起納入 contract。

CJ 當前使用自有 JSON envelope：`{ success: false, error: { code, message, details? }, meta: { request_id, timestamp } }`。這不是 RFC 9457 `application/problem+json`。本文的作用是承認現狀、固定最小契約、列出 Problem Details / OpenAPI 缺口，避免把人工錯誤表誤宣稱為 machine-readable error schema。

## 2. 外部基線參考

| 基線 | 採用原因 | CJ 採用方式 |
| --- | --- | --- |
| RFC 9110 HTTP Semantics | 定義 HTTP status class 與語義 | 用於校準 4xx / 5xx / 409 / 422 / 429 / 503 等 status 使用，不新增非標 HTTP code |
| RFC 9457 Problem Details for HTTP APIs | 定義 `type / title / status / detail / instance` 與 `application/problem+json` | 用於校準未來錯誤 schema；現狀標為 Problem Details gap |
| OpenAPI Specification | 支持在 API contract 中定義 response schema、error response 與 security scheme | 用於未來把錯誤 envelope / Problem Details 轉成 machine-readable schema |
| ISO/IEC/IEEE 29148 | 要求需求和驗收可追溯 | 用於要求錯誤碼、狀態碼與前端處理能追到測試和接口文檔 |

外部來源：

1. [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)
2. [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)
3. [OpenAPI Specification](https://spec.openapis.org/oas/latest)
4. [ISO/IEC/IEEE 29148:2018](https://www.iso.org/standard/72089.html)

## 3. CJ 當前錯誤 envelope

| 欄位 | 現狀 | 約束 |
| --- | --- | --- |
| `success` | 錯誤回應固定 `false` | 前端不得只靠 HTTP 200 判斷成功；當前錯誤多數使用 4xx / 5xx |
| `error.code` | `AppError.code`、Multer map、Prisma map、rate limiter、JSON parse handler | 錯誤碼一旦進入前端處理，不得複用舊語義 |
| `error.message` | 經 i18n 翻譯後給用戶或前端展示 | 生產環境不得暴露 stack、SQL、provider raw error 或 secret |
| `error.details` | `AppError.details` 目前只在 development 輸出 | 不得把高敏 relationship / psych / prompt / env payload 放入 details |
| `meta.request_id` | `responseFormatter` 注入，`requestId` middleware 生成 | 需與 logs / incident / support 排查對齊 |
| `meta.timestamp` | `responseFormatter` 注入 ISO timestamp | 只作診斷，不作業務狀態來源 |

## 4. 錯誤來源矩陣

| 來源 | 現有處理 | 風險 |
| --- | --- | --- |
| `AppError` | `errorHandler` 按 `statusCode / code / message / details` 回應 | details 僅 dev；沒有 field-level validation schema |
| Multer | `LIMIT_FILE_SIZE -> FILE_TOO_LARGE`、`LIMIT_FILE_COUNT -> TOO_MANY_FILES`、`LIMIT_UNEXPECTED_FILE -> INVALID_FILE_FIELD` | upload 錯誤未形成 OpenAPI schema |
| Prisma `P2002` | email duplicate -> `EMAIL_EXISTS`，其他 unique -> `CONFLICT` | 非 production message 可能含 target；production 已較保守 |
| Prisma `P2025` | `NOT_FOUND` | 無 resource type / instance field |
| JSON parse | `INVALID_JSON` 400 | 直接在 app middleware 回應，但仍有 `success=false` |
| Rate limit | `RATE_LIMIT_EXCEEDED` 429 | 沒有標準 Retry-After contract |
| Unknown error | `INTERNAL_ERROR` 500；production 隱藏細節 | 無 Problem Details instance URI，只靠 request_id |

## 5. 錯誤碼治理規則

| 規則 | 口徑 |
| --- | --- |
| HTTP status | 必須採用 RFC 9110 標準 status；不得新增自定義 HTTP status code |
| 業務錯誤碼 | `error.code` 是 CJ 自有 domain code；可比 HTTP status 更細，但不能替代 status |
| 語義穩定 | 前端 / App / Admin 依賴的 code 不得改名或改義；若廢棄需保留兼容期 |
| 重試語義 | 429、503、AI failure、processing not done、judgment_failed retry 需在接口文檔或錯誤矩陣標明 retryable 口徑 |
| 驗證錯誤 | validation 錯誤不應只剩自然語言；未來需補 field-level safe error list |
| 安全最小化 | 生產錯誤不得暴露 stack、DB target、prompt、provider raw body、token、session id 或 file path |
| request id | 所有錯誤需能追到 `meta.request_id`，並與 logger / incident / release evidence 對齊 |

## 6. Problem Details 對照

| RFC 9457 欄位 | CJ 現狀 | 缺口 |
| --- | --- | --- |
| `type` | 無；目前只有 `error.code` | 未定義 problem type URI |
| `title` | 無；目前 `message` 兼具 title/detail | 缺少穩定短標題 |
| `status` | HTTP status 存在；body 內不固定提供 | envelope 不等於 Problem Details |
| `detail` | `error.message` 類似 detail | 未區分 user-facing message 與 technical detail |
| `instance` | 無；以 `meta.request_id` 替代排查 | 缺少 instance URI 或 occurrence id |
| extension members | `error.code`、`meta.request_id` 可視為自有 extension | 未標準化 extension schema |
| media type | `application/json` | 尚未提供 `application/problem+json` |

## 7. 最小錯誤需求矩陣

| 錯誤需求 ID | 要求 | 現有證據 | 狀態 |
| --- | --- | --- | --- |
| CJ-ERR-001 | 所有 API 錯誤必須有穩定 `error.code` 與 HTTP status | `AppError`、`errorHandler` | 部分覆蓋 |
| CJ-ERR-002 | 所有錯誤 response 必須帶 request id 或可追溯 occurrence id | `requestId`、`responseFormatter`、logger | 部分覆蓋 |
| CJ-ERR-003 | 生產錯誤不得暴露 stack、DB internals、prompt、secret 或 session 原文 | `errorHandler`、`logger` masking | 部分覆蓋 |
| CJ-ERR-004 | validation errors 應有 field-level safe details，供 Web / App 精準呈現 | `validator.ts` 目前 flatten messages | 待建立 |
| CJ-ERR-005 | rate limit / retryable failure 應標明 retry policy 或 header | `rateLimiter.ts` 目前回 429 code/message | 待建立 |
| CJ-ERR-006 | OpenAPI / typed client 前必須有 machine-readable error schema | `06/11` OpenAPI gap、本文 | 待建立 |
| CJ-ERR-007 | 若採用 RFC 9457，必須定義兼容期與 envelope migration 策略 | 本文 | 待裁決 |

## 8. 當前缺口

| 缺口 ID | 對標基線 | 現狀 | 風險 | 處置 |
| --- | --- | --- | --- | --- |
| CJ-ERR-GAP-001 | RFC 9457 | 當前不是 Problem Details 格式 | 第三方 client、App typed client、SDK 生成難以標準化錯誤 | 本文先固定 gap，不改 runtime |
| CJ-ERR-GAP-002 | OpenAPI | 沒有 machine-readable error schema | OpenAPI / typed SDK / contract tests 無法穩定生成 | 需與 `06/11` 一起推進 |
| CJ-ERR-GAP-003 | 29148 traceability | 錯誤碼未集中追到 RTM | 失敗路徑可能不進需求驗收 | 新增 `CJ-NFR-018` 與 `CJ-RTM-016` |
| CJ-ERR-GAP-004 | RFC 9110 | 429 缺少 Retry-After，422 / 409 的 domain 邊界未集中說明 | 前端重試與用戶提示可能分叉 | 先補規則；代碼強化另立任務 |
| CJ-ERR-GAP-005 | Cross-platform parity | App 尚未建立錯誤展示、離線、retry、Deep Link failure 的平台策略 | Web error helper 可能被誤當 App contract | App 錯誤承接回 `20/01`、`50/01`、`08/03` |

## 9. 維護規則

1. 新增 `Errors.*`、新增錯誤碼或改變 status code 時，必須更新對應接口文檔；若跨多模組，更新本文。
2. 錯誤碼進入前端 / Admin / App 分支後，必須視為 contract，不能任意改名。
3. 若要導入 Problem Details，必須先決定 envelope coexistence、content negotiation、OpenAPI schema 與 migration plan。
4. validation details、provider error、DB error、AI error、upload error 只能暴露經審查的 safe fields。
5. App 錯誤 UX、離線重試、Deep Link failure 與 push landing failure 不得由 Web helper 自動推斷，需獨立驗收。
