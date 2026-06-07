# Production Vercel Public Env Build 注入缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：GitHub Actions `Production Deploy and Verify` 中 Vercel production public env 對 Vite build 的注入與發布後前端 runtime smoke
**取證代碼入口**：`.github/workflows/production-deploy-and-verify.yml`、`scripts/import-vercel-public-env.mjs`、`frontend/src/config/env.ts`
**最後核驗 Commit**：`10fa7a5`
**最後核驗日期**：`2026-06-07`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 現狀

2026-06-07 production workflow `27086103610` 已部署主站、Admin 與 Railway backend，且 release gate 通過；但主站 live page 空白。Chrome console 顯示 production runtime throw：

```text
生產環境缺少必需的環境變量: VITE_API_BASE_URL
```

已核對 Vercel 主站 production env 內存在 `VITE_API_BASE_URL`，問題不是 platform env key 缺失，而是 workflow 內 `vercel pull` 產生 `.vercel/.env.production.local` 後，`scripts/import-vercel-public-env.mjs` 只寫入 `GITHUB_ENV`。同一 GitHub Actions step 內後續 `npm run build --workspace frontend` 讀不到剛寫入的 `GITHUB_ENV`；Vite 也不會自動讀 `.vercel/.env.production.local`，導致 bundle 沒有 production API base URL。

## 修復目標

1. `scripts/import-vercel-public-env.mjs` 必須把 `VITE_*` public env 寫入當前 app 目錄的 `.env.production.local`，讓同一步 Vite production build 可讀。
2. Production workflow 在 build 前必須檢查主站 `.env.production.local` 含 `VITE_API_BASE_URL`。
3. 發布後必須用 live page / bundle / browser smoke 確認主站不再因 env validation 空白。
4. Runbook 必須記錄 `vercel pull` env 檔與 Vite build env 檔的差異，避免後續回退。

## 已處理

1. `scripts/import-vercel-public-env.mjs` 已改為同時寫入 GitHub Actions `GITHUB_ENV` 與當前 app 目錄 `.env.production.local`，讓同一步 `npm run build --workspace frontend` / `frontend-admin` 能被 Vite 讀到 production `VITE_*`。
2. `.github/workflows/production-deploy-and-verify.yml` 已在主站與 Admin build 前檢查 `.env.production.local` 存在且含 `VITE_API_BASE_URL`。
3. `scripts/check-vercel-static-env.mjs` 與 `scripts/ops-release-gate.sh` 已新增 Vercel Static Env Gate，發布後會檢查主站與 Admin live JS bundle 內含 expected production API base URL。
4. `03-管理端與平台治理/05-運維連接與調用Runbook.md` 已回寫 `vercel pull` 輸出檔與 Vite app env 檔差異，避免誤把 `.vercel/.env.production.local` 或同一步 `GITHUB_ENV` 當成 Vite build input。

## 驗證命令

```bash
node --test scripts/import-vercel-public-env.test.mjs scripts/check-vercel-static-env.test.mjs
npm run docs:check
gh workflow run production-deploy-and-verify.yml --ref main -f deploy_web=true -f deploy_backend=true -f run_release_gate=true
node scripts/check-vercel-static-env.mjs "main web" https://mother-bear-court.vercel.app https://mother-bear-court-production.up.railway.app/api/v1
node scripts/check-vercel-static-env.mjs "admin web" https://frontend-admin-sigma-virid.vercel.app https://mother-bear-court-production.up.railway.app/api/v1
```

## Owner / Status

- Owner：Release / Ops / Frontend platform
- Status：已處理
- Notes：只記錄 public `VITE_*` key 與注入方式，不記錄 secret 值。
