# Admin E2E（Playwright）

## 1) 安裝

```bash
cd e2e
npm install
npx playwright install --with-deps chromium
```

## 2) 必要環境變數

- `E2E_BASE_URL`（選填，預設 `http://127.0.0.1:5173`）
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_LIMITED_ADMIN_EMAIL`（權限拒絕測試用）
- `E2E_LIMITED_ADMIN_PASSWORD`

## 3) 執行

```bash
cd e2e
npm test
```

本地未提供帳號密碼時，測試會以 `skip` 呈現。

在 CI 會啟用 `E2E_STRICT=true`，若缺少必要環境變數會直接 fail，避免「全 skip 但流程綠燈」。

目前專案的 GitHub Actions 會自動啟動 Postgres + Backend + Frontend，並用 seed 建立測試管理員帳號後執行 Admin E2E。
