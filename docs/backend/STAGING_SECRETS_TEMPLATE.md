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

## 2. Staging 服務端環境（建議）

- `NODE_ENV=production`
- `DATABASE_URL=<staging 專用 DB>`
- `REDIS_URL=<staging 專用 Redis>`
- `OPENAI_API_KEY=<staging 專用 key>`
- `ALLOWED_ORIGINS=<staging frontend domain>`
- `ADMIN_JWT_SECRET=<staging 專用 secret>`
- `JWT_SECRET=<staging 專用 secret>`
- `METRICS_TOKEN` 或 `METRICS_ALLOWED_IPS`

## 3. 檢查清單

1. 所有 `STAGING_*` secrets 已建立。  
2. staging admin 帳號可正常登入後台。  
3. `ALLOWED_ORIGINS` 含 `STAGING_FRONTEND_BASE_URL`。  
4. workflow `Staging Smoke Gate` 可成功執行。
