# Staging Secrets 模板（Smoke Gate）

> 用途：供 `.github/workflows/staging-smoke.yml` 使用。
> 原則：staging 與 production 完全隔離，不共用密鑰與帳號。

## 1. GitHub Actions Secrets

必填：

- `STAGING_BACKEND_BASE_URL`
  - 例：`https://staging-api.example.com`
- `STAGING_FRONTEND_BASE_URL`
  - 例：`https://staging.example.com`
- `STAGING_ADMIN_EMAIL`
  - 例：`admin-staging@example.com`
- `STAGING_ADMIN_PASSWORD`
  - 例：`<長隨機密碼>`
- `STAGING_METRICS_TOKEN`
  - 例：`<staging 專用 metrics token>`
- `RAILWAY_API_TOKEN`
  - 例：`<Railway account/workspace token>`
- `RAILWAY_TOKEN`
  - 例：`<legacy Railway token，僅作兼容回退>`
- `STAGING_RAILWAY_PROJECT_ID`
  - 例：`<Railway project id>`

## 2. Staging 服務端環境（建議）

- `NODE_ENV=production`
- `DATABASE_URL=<staging 專用 DB>`
- `OPENAI_API_KEY=<staging 專用 key>`
- `ALLOWED_ORIGINS=<staging frontend domain>`
- `ADMIN_JWT_SECRET=<staging 專用 secret>`
- `JWT_SECRET=<staging 專用 secret>`
- `ADMIN_JWT_EXPIRES_IN=12h`

二選一：

- production 等價 staging：
  - `REDIS_URL=<staging 專用 Redis>`
  - `METRICS_TOKEN` 或 `METRICS_ALLOWED_IPS`
- 簡化回歸 staging：
  - `ALLOW_SIMPLE_LOCK=true`
  - `METRICS_ENABLED=false`

說明：

- 若選簡化回歸 staging，`/health` 會因 simple-lock 顯示 `degraded`
- 若要做 Redis replay / cross-instance / production 等價驗證，仍應配置 staging 專用 Redis

## 3. 檢查清單

1. 所有 `STAGING_*` secrets 已建立。  
2. `RAILWAY_API_TOKEN` 與 `STAGING_RAILWAY_PROJECT_ID` 已建立，且能對應到 staging project。  
   - `RAILWAY_API_TOKEN` 應是可供 GitHub Actions / CLI 使用的 Railway account 或 workspace token。
   - workflow 會優先讀 `RAILWAY_API_TOKEN`，沒有時才回退到 legacy `RAILWAY_TOKEN`。
3. staging admin 帳號可正常登入後台。  
   - 建議使用 `example.com` 或真實可解析網域作為 email。
   - 不要使用 `.local` / 內網假 TLD；目前後端 `admin/login` 走 Joi email 驗證，這類地址可能直接被判為 `VALIDATION_ERROR`，導致 smoke gate 卡在登入前。
4. `ALLOWED_ORIGINS` 含 `STAGING_FRONTEND_BASE_URL`。  
5. workflow `Staging Deploy and Smoke` 可成功執行；`Staging Smoke Gate` 可用於重跑 smoke。  
6. smoke gate 需同時驗證：
   - `/health` / 管理端登入與主流程可用
   - `/metrics` 無 token 時回 `403 # metrics forbidden`
   - `/metrics` 帶 `STAGING_METRICS_TOKEN` 時回 Prometheus 文本
