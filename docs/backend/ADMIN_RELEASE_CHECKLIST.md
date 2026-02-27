# 管理員後台發版驗收清單

## 1) 發版前準備

- 確認環境變數：`ADMIN_JWT_SECRET`、`ADMIN_BOOTSTRAP_TOKEN`、`DATABASE_URL`
- 確認 `admin_roles` 種子資料存在（`super_admin/ops/marketing/support`）
- 確認資料庫 migration 已執行且與當前程式版本一致
- 確認前端已配置 API Base URL 並可訪問 `/api/v1/admin/*`

## 2) 安全驗收

- 使用無效 token 訪問 `/admin/*` 應被攔截並顯示錯誤提示
- 低權限帳號無法進入超權限頁面（例如 `admin:all` 專區）
- 敏感配置 key（如 `JWT_` 前綴）不可透過後台寫入
- 用戶鎖定/停用、管理員帳號變更均產生審計紀錄

## 3) 功能驗收

- 管理員可從 `/admin/login` 登入並進入後台導航
- Jobs、Configs、Users、Audit、Reports、Settings 各頁至少完成一次讀寫
- Jobs 手動 trigger 成功，且 stats 可觀察到執行變化
- Audit Logs 查詢與 CSV 匯出可用
- Admin Users 新增與啟停可用
- 驗證管理員治理護欄：不可自刪、不可停用自己、不可移除最後一位 super_admin
- Admin Health（`/admin/health`）可讀取 `/api/v1/admin/health/detailed`
- Users 鎖定/解鎖（lock/unlock）可用

## 4) 測試驗收

- 前端：`npm run build`、`npm run test:run`
- 後端：`npm run build`
- 後端管理員關鍵測試：
  - `npx jest tests/unit/routes/admin.routes.test.ts --runInBand`
  - `npx jest tests/unit/controllers/admin.controller.test.ts --runInBand`
  - `npx jest tests/unit/services/admin.service.test.ts --runInBand`（含 bootstrap token/重入保護）
  - `npx jest tests/integration/admin-api-flow.test.ts --runInBand`（跨層驗證 bootstrap 安全路徑、權限邊界、停用後 token 即時失效）
- 前端管理員關鍵測試：
  - `npm run test:run -- src/services/request.test.ts`（admin API 401 token 清理）
- Admin E2E（Playwright，可執行）：
  - `cd e2e && npm test`
  - 需提供 `E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD`
  - 權限拒絕場景需額外提供 `E2E_LIMITED_ADMIN_EMAIL/E2E_LIMITED_ADMIN_PASSWORD`
  - CI `admin-e2e` 會自動啟動 Postgres + Backend + Frontend 並執行嚴格模式（`E2E_STRICT=true`）
  - CI 失敗時會輸出 `backend-e2e.log` / `frontend-e2e.log` tail，並上傳 Playwright report / test-results 供追蹤
  - 驗證 mixed-tighten：低權限帳號可訪問 `users`，但必須被拒於 `audit-logs/settings`
  - 功能矩陣：`admin-config-flow.e2e.ts`（configs 讀寫）、`admin-jobs-flow.e2e.ts`（list/trigger/stats）、`admin-reports-flow.e2e.ts`（overview/funnel/custom/csv）
  - 驗證審計閉環：管理員寫操作（create admin user）必須在 audit logs 可查
  - 驗證審計精確性：`actor_id / entity_id / action / detail` 與實際操作一致
  - 驗證 API 邊界：低權限 token 直接呼叫 `POST /admin/admin-users` 必須回 `403`
  - 驗證 API 邊界：低權限 token 直接呼叫 `GET /admin/audit-logs` 必須回 `403`
  - 驗證無副作用：低權限被拒建立的 email，不可用於 `POST /admin/login`
  - 驗證審計潔淨性：被 `403` 拒絕的管理員建立操作，不得出現 `admin_user_create` 成功審計
  - 驗證治理護欄：super admin 不可自刪、不可停用自己，且不得產生對應成功審計
  - 驗證治理護欄：super admin 不可修改自己角色（例如降為 `ops`）
  - 驗證認證即時性：管理員被停用後，既有 JWT 呼叫 `/admin/me` 應立即回 `401`
  - 驗證認證即時性：管理員被停用後，既有 JWT 呼叫 `/admin/users`、`/admin/audit-logs` 亦需回 `401`
  - 驗證停用封鎖：被停用管理員不可再次 `POST /admin/login` 取得新 token

## 5) 監控與告警

- 確認 health：`/api/v1/admin/health/detailed` 正常
- 確認 Cron 任務失敗率告警規則生效
- 確認 API 429/401/403/500 指標已接入監控看板
- 確認高敏權限邊界生效（audit/alerts 為 AND）

## 6) 回滾策略

- 前端回滾：切回上一個穩定版本靜態資源
- 後端回滾：切回上一個穩定 image/tag
- 配置回滾：使用 `system_configs` 審計紀錄恢復上版配置
- 若新管理員流程異常，可暫時收斂入口至 `/admin/ops/jobs` token 模式
