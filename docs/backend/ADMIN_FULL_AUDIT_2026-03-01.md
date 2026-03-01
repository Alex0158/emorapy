# 管理端全量審計報告（後端 + 前端）

日期：2026-03-01  
範圍：`backend` 管理 API、`frontend-admin`/`frontend` 管理頁、測試與文件  
目標：盤點「未完善 / 不合理 / 漏洞 / 顯示問題」，並給出可落地修復順序

---

## 1. 系統盤點總覽

### 1.1 管理頁面 -> API 對照

| 頁面 | 路由 | 主要 API |
|---|---|---|
| 管理員登入 | `/admin/login` | `POST /api/v1/admin/login` |
| Ops Jobs | `/admin/ops/jobs` | `GET /api/v1/admin/me`, `GET /api/v1/admin/jobs/stats` |
| Jobs | `/admin/jobs` | `GET /api/v1/admin/jobs`, `POST /api/v1/admin/jobs/:jobKey/trigger` |
| Health | `/admin/health` | `GET /api/v1/admin/health/detailed` |
| Configs | `/admin/configs` | `GET /api/v1/admin/configs`, `PUT /api/v1/admin/configs`, `GET /api/v1/admin/runtime/interview` |
| Users | `/admin/users` | `GET /api/v1/admin/users`, `GET /api/v1/admin/users/:userId`, `PATCH /api/v1/admin/users/:userId/status` |
| Audit Logs | `/admin/audit-logs` | `GET /api/v1/admin/audit-logs`, `GET /api/v1/admin/audit-logs.csv` |
| Reports | `/admin/reports` | `GET /api/v1/admin/reports/overview`, `GET /api/v1/admin/reports/funnel`, `GET /api/v1/admin/reports/costs`, `POST /api/v1/admin/reports/custom`, `GET /api/v1/admin/reports/overview.csv` |
| Settings | `/admin/settings` | `GET/POST/PATCH/DELETE /api/v1/admin/admin-users`, `PUT /api/v1/admin/alerts/rules`, `PUT /api/v1/admin/feature-flags`, `GET /api/v1/admin/configs` |

### 1.2 管理 API 權限模型（路由層）

- `ops:read`：`/health/detailed`、`/jobs`、`/jobs/stats`
- `ops:execute`：`/jobs/:jobKey/trigger`
- `config:read`：`/configs`、`/runtime/interview`
- `config:write`：`/configs`、`/feature-flags`
- `users:read`：`/users`、`/users/:userId`
- `users:write`：`/users/:userId/status`
- `reports:read`：`/reports/*`
- `alerts:write + ops:execute (all)`：`/alerts/rules`
- `admin:all`：`/admin-users/*`

---

## 2. 主要問題清單（按嚴重度）

> 分類：`漏洞/安全`、`不合理`、`功能缺漏`、`顯示問題`。  
> 每項含：現象、影響、重現、建議修復。

### 2.1 高風險（P0）

#### A-01 管理員 JWT 祕鑰可回退到一般 JWT 祕鑰（安全邊界不足）
- 類型：漏洞/安全
- 位置：`backend/src/utils/admin-jwt.ts`
- 現象：`ADMIN_JWT_SECRET` 未設定時，admin token 會使用 `JWT_SECRET`。
- 影響：一旦一般 JWT 祕鑰洩漏，攻擊面可橫向擴大到管理端 token。
- 重現：
  1. 生產未設 `ADMIN_JWT_SECRET`
  2. 仍可簽發/驗證 admin token
- 建議修復：
  - 生產強制 `ADMIN_JWT_SECRET` 必填且長度/格式合規
  - 移除 fallback 行為
  - 建立 admin 專用祕鑰輪替（可含 previous key 過渡）

#### A-02 管理員 token 缺少版本化撤銷機制
- 類型：漏洞/安全
- 位置：`backend/src/utils/admin-jwt.ts`、`backend/src/middleware/adminAuth.ts`、`backend/src/services/admin.service.ts`
- 現象：admin token payload 沒有 `token_version`，驗證時也不比對版本。
- 影響：密碼重設後，舊 token 可用到自然過期（預設 12h）。
- 重現：
  1. 先登入拿 token A
  2. 變更同帳號密碼
  3. token A 仍可呼叫 `/api/v1/admin/me`
- 建議修復：
  - 在 `admin_users` 增 `token_version` 或 `token_invalid_before`
  - token 簽發寫入版本，`authenticateAdmin` 每次比對
  - 密碼變更/停用/高風險操作時遞增版本

#### A-03 生產環境啟動驗證未強制 admin 安全變數
- 類型：漏洞/安全
- 位置：`backend/src/config/validation.ts`
- 現象：僅檢查 `JWT_SECRET` 等通用變數，未強制 `ADMIN_JWT_SECRET`、`ADMIN_JWT_EXPIRES_IN`、`ADMIN_BOOTSTRAP_TOKEN`。
- 影響：配置錯誤可能進入 runtime 才暴露。
- 重現：移除上述 admin 變數仍可啟動（依賴 fallback）。
- 建議修復：
  - `NODE_ENV=production` fail-fast 驗證 admin 安全變數
  - 檢查祕鑰格式（單行、最小熵、無 `KEY=VALUE` 污染）

#### A-04 分頁參數未完整驗證，可能引發 500
- 類型：功能缺漏/穩定性
- 位置：`backend/src/controllers/admin.controller.ts` (`parsePagination`) + `backend/src/routes/admin.routes.ts`
- 現象：`/users`、`/configs`、`/admin-users` 未掛 query validator，`limit=abc` 會走 `NaN`。
- 影響：應回 `400 VALIDATION_ERROR` 的輸入，可能落成 `500`。
- 重現：
  - `GET /api/v1/admin/users?limit=abc`
- 建議修復：
  - 為三個端點加 query schema
  - `parsePagination` 內加 `Number.isFinite` 防衛

#### A-05 審計日誌 BigInt 回傳存在序列化風險
- 類型：功能缺漏/穩定性
- 位置：`backend/prisma/schema.prisma`（`AuditLog.id BigInt`）+ `backend/src/controllers/admin.controller.ts`
- 現象：`listAuditLogs` 直接回傳 Prisma row，`id` 為 BigInt。
- 影響：在未統一 BigInt 序列化時，可能觸發 JSON 序列化錯誤或前端型別漂移。
- 重現：查詢含大量 audit log，觀察 `id` 型別與 JSON 輸出。
- 建議修復：
  - 在 controller 層統一轉 `id: String(row.id)`
  - 前端型別與 CSV 也一致用字串 id

---

### 2.2 中風險（P1）

#### B-01 管理員登入僅 IP 限流，缺帳號層防爆破
- 類型：漏洞/安全
- 位置：`backend/src/middleware/rateLimiter.ts`、`backend/src/routes/admin.routes.ts`
- 現象：`/admin/login` 使用 `authLimiter`（IP 維度）。
- 影響：攻擊者可用多 IP 對同一 admin 帳號長期嘗試。
- 建議修復：
  - 增加 email 維度失敗計數與暫時鎖定
  - 高權限帳號建議 MFA/WebAuthn

#### B-02 bootstrap header 未在 CORS allowedHeaders
- 類型：功能缺漏/可用性
- 位置：`backend/src/app.ts`（`allowedHeaders`）
- 現象：未列 `X-Admin-Bootstrap-Token`。
- 影響：若透過瀏覽器跨域呼叫 bootstrap，可能 preflight 失敗。
- 建議修復：
  - 若保留瀏覽器 bootstrap：補入 header 白名單
  - 若僅允許後台 CLI：文件明確標註並限制來源

#### B-03 系統角色權限可能發生 drift，升版不會自動收斂
- 類型：不合理
- 位置：`backend/src/services/admin.service.ts`（`ensureDefaultRoles`）
- 現象：upsert update 只更新 `name/description`，不更新 `permissions`。
- 影響：歷史錯誤權限會持續存在。
- 建議修復：
  - 對 `is_system=true` 角色做受控權限同步（或啟動告警）

#### B-04 報表口徑不一致（overview vs funnel）
- 類型：不合理
- 位置：`backend/src/controllers/admin.controller.ts`
- 現象：
  - overview 用 `executionRecord.status = completed`
  - funnel 用 `executionRecord.action = complete`
- 影響：管理報表數字可互相矛盾。
- 建議修復：
  - 統一指標定義並寫入報表註解
  - 補回歸測試確保口徑固定

#### B-05 `alerts/rules`、`feature-flags` 缺路由級 validate
- 類型：功能缺漏
- 位置：`backend/src/routes/admin.routes.ts`
- 現象：依賴 controller 內自行判斷。
- 影響：驗證邏輯分散、錯誤回應一致性變差。
- 建議修復：
  - 增加 Joi schema + `validate(...)` 中介層

---

### 2.3 前端顯示/交互問題（P1/P2）

#### C-01 `OpsJobs` 與其他管理頁門禁模型不一致
- 類型：不合理/顯示問題
- 位置：`frontend/src/pages/Admin/OpsJobs/index.tsx`
- 現象：頁內額外包 `ProtectedRoute`（前台使用者登入），其他 admin 頁沒有。
- 影響：可能要求「前台 token + admin token」雙重門禁，導致進入行為不一致。
- 建議修復：移除該頁 `ProtectedRoute`，統一以 `AdminPermissionRoute + admin token`。

#### C-02 401/403 錯誤可能重複彈提示
- 類型：顯示問題
- 位置：`frontend/src/services/request.ts` + 多個頁面的 `onError`
- 現象：全域攔截已 `message.error`，頁面 mutation `onError` 又再顯示一次。
- 影響：同一錯誤出現重複 toast，使用者感知混亂。
- 建議修復：統一策略（全域負責導轉/清 token，頁面負責業務提示；或反向）。

#### C-03 權限路由顯示語義過粗
- 類型：顯示問題
- 位置：`frontend/src/components/common/AdminPermissionRoute.tsx`
- 現象：`adminMeQuery.error` 一律顯示「identity failed」。
- 影響：網路錯誤、401、403 的使用者處置指引不明確。
- 建議修復：按錯誤碼分類顯示（重新登入/權限不足/稍後重試）。

#### C-04 `Users` 詳細抽屜缺 loading/error/empty 狀態
- 類型：未完善
- 位置：`frontend/src/pages/Admin/Users/index.tsx`
- 現象：直接渲染 `JSON.stringify(detailQuery.data?.user || {})`。
- 影響：慢網路或失敗時，畫面看起來像空資料，難排障。
- 建議修復：補三態 UI 與重試入口。

#### C-05 操作 loading 使用單一 mutation，行為粒度過粗
- 類型：顯示問題
- 位置：`frontend/src/pages/Admin/Users/index.tsx`、`frontend/src/pages/Admin/Jobs/index.tsx`、`frontend/src/pages/Admin/Settings/index.tsx`
- 現象：單一 `isPending` 綁多列按鈕。
- 影響：某列操作時其他列也顯示 loading/不可操作。
- 建議修復：改成 row-level pending key（例如 `pendingUserId`）。

#### C-06 管理頁 i18n 不完整（硬編碼中文）
- 類型：未完善
- 位置：`frontend/src/pages/Admin/Users/index.tsx`、`frontend/src/pages/Admin/Settings/index.tsx`
- 現象：多個 `Popconfirm`、驗證訊息與按鈕文字未走 `t(...)`。
- 影響：英語環境顯示中英混雜，體驗不一致。
- 建議修復：收斂到 `frontend/src/assets/i18n/*`。

---

## 3. 功能完整性與邏輯細節排查結論

### 3.1 後端功能點
- 已落地：認證、角色權限、管理員 CRUD、用戶狀態管理、配置治理、審計、報表、成本監控、健康檢查、jobs 觸發
- 尚不完善：
  - 分頁/輸入防衛不一致（部分端點只靠 controller）
  - 報表指標口徑未統一
  - 角色權限 drift 缺自動糾偏
  - admin token lifecycle（撤銷/全局登出）不足

### 3.2 前端功能點
- 已落地：路由權限守衛、token 管理、主要 CRUD 與報表頁
- 尚不完善：
  - 錯誤展示策略未收斂（全域 + 頁面重複提示）
  - 空狀態與載入狀態呈現不一致
  - 局部頁面門禁與主策略不一致（`OpsJobs`）
  - i18n 完整度不足

---

## 4. 測試與文件差距

### 4.1 測試覆蓋現況
- 已有：
  - 後端：`admin.routes`、`adminAuth`、`admin.service`、`admin-config-rules`、integration `admin-api-flow`
  - 前端：`adminApi`、`request`、admin hooks/pages 基礎測試
  - E2E：`e2e/admin` 多條主流程
- 缺口（優先）：
  - controller 實值行為測試覆蓋不足（`health/users/audit/reports/settings` 多分支）
  - `alerts/rules` 寫入與審計閉環缺專測
  - `reports/costs` 的 partial/reasons 語義缺 E2E 斷言
  - 分頁無效參數（`limit=abc`）缺回歸測試
  - Audit BigInt/CSV escaping 邊界缺測試

### 4.2 文件一致性
- `docs/backend/API.md` 未列出 `GET /admin/reports/costs`
- `docs/backend/ADMIN_RELEASE_CHECKLIST.md` 的功能矩陣未包含 `reports/costs`、`alerts/rules` 驗收細項

---

## 5. 修復路線圖（可直接派工）

### P0（立即，安全與穩定）
1. 移除 admin JWT fallback，生產強制 `ADMIN_JWT_SECRET`
2. 建立 admin token 版本化撤銷（改密即失效舊 token）
3. 補齊 `/users` `/configs` `/admin-users` 分頁 query 驗證，統一回 400
4. `AuditLog.id` 統一序列化為字串

### P1（短期，邏輯一致與可維運）
1. 報表指標口徑統一（overview/funnel）
2. `alerts/rules`、`feature-flags` 補路由層 schema 驗證
3. 角色權限 drift 收斂策略（同步或啟動告警）
4. 補關鍵測試：alerts、costs、audit CSV、invalid pagination

### P2（中期，管理端體驗）
1. 移除 `OpsJobs` 的 `ProtectedRoute`，統一 admin 門禁
2. 收斂 401/403 提示策略，避免重複 toast
3. `Users` detail drawer 加 loading/error/empty
4. 行級 pending + i18n 補齊

---

## 6. 建議驗收清單（修復後）

- 安全驗收：
  - 未設 `ADMIN_JWT_SECRET` 時 production 無法啟動
  - 管理員改密後，舊 token 立即 401
- API 驗收：
  - `limit=abc`、`offset=foo` 等均回 `400 VALIDATION_ERROR`
  - `audit_logs` API 回傳 `id` 一律字串
- 前端驗收：
  - 401/403 僅出現一次主提示
  - `/admin/ops/jobs` 不再依賴前台 `ProtectedRoute`
  - 管理端英文語系無硬編碼中文殘留
- 文件驗收：
  - API.md、release checklist 與實作一致

