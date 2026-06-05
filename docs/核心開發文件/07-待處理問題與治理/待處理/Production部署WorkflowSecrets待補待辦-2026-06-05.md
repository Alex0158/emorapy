# Production 部署 Workflow Secrets 待補待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：GitHub Actions `Production Deploy and Verify` 正式部署 workflow 的 production secrets、variables 與 release gate 可執行性
**取證代碼入口**：`.github/workflows/production-deploy-and-verify.yml`、`scripts/ops-release-gate.sh`、`scripts/ops-release-gate-evidence.sh`
**最後核驗 Commit**：`4115c88`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 現狀

本輪已把 production 正式部署入口收斂為 GitHub Actions `Production Deploy and Verify`，並移除 staging deployment workflow 與 `smoke:staging` 入口。非敏感 GitHub repository variables 已建立：

1. `VERCEL_ORG_ID`
2. `VERCEL_MAIN_PROJECT_ID`
3. `VERCEL_ADMIN_PROJECT_ID`
4. `PRODUCTION_BACKEND_BASE_URL`
5. `PRODUCTION_MAIN_WEB_URL`
6. `PRODUCTION_ADMIN_WEB_URL`
7. `PRODUCTION_RAILWAY_SERVICE`

目前 GitHub secrets 仍不足以讓完整 production workflow 真實部署並通過 release gate。已存在的 secrets 只有 repo-level Railway / staging secrets，以及 `Production` environment 下的 `APP_RELEASE_DATABASE_URL`、`APP_TELEMETRY_RUNTIME_API_BASE_URL`。

## 缺口

完整 workflow 至少仍缺：

1. `VERCEL_TOKEN`
2. `PRODUCTION_REDIS_URL`
3. `PRODUCTION_ADMIN_JWT_EXPIRES_IN`
4. `RELEASE_SMOKE_ADMIN_EMAIL`
5. `RELEASE_SMOKE_ADMIN_PASSWORD`

`RAILWAY_API_TOKEN` 已在 repo secrets 存在；workflow 也允許暫時 fallback 到既有 Railway project id secret，但長期應補明確命名的 `PRODUCTION_RAILWAY_PROJECT_ID`，避免 production workflow 依賴舊 staging 命名。

## 目標狀態

1. GitHub `Production` environment 或 repo secrets 中補齊上述 secrets。
2. `gh workflow run "Production Deploy and Verify" --ref main` 可在 `deploy_web=true`、`deploy_backend=true`、`run_release_gate=true` 下完成。
3. workflow artifact 產生 `production-release-gate-evidence-*`，且 `ops:release:gate:evidence` 通過。
4. 主站、Admin、Backend 三個 version endpoint 都回報同一個 release commit。

## 驗證命令

```bash
gh secret list --repo Alex0158/mother-bear-court
gh secret list --env Production --repo Alex0158/mother-bear-court
gh variable list --repo Alex0158/mother-bear-court
gh workflow run "Production Deploy and Verify" --ref main
gh run list --workflow "Production Deploy and Verify" --limit 1
```

發布 gate 驗證：

```bash
npm run ops:release:status
npm run ops:release:gate:evidence
```

## Owner / Status

- Owner：Release / Ops
- Status：待處理
- Notes：不得在 chat、commit message 或文檔中記錄 secret 值。若由本機 CLI 讀取 token 後寫入 GitHub secret，必須由操作者明確授權並避免輸出明文。
