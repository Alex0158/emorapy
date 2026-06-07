# Production 部署 Workflow Secrets 待補待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：GitHub Actions `Production Deploy and Verify` 正式部署 workflow 的 production secrets、variables 與 release gate 可執行性
**取證代碼入口**：`.github/workflows/production-deploy-and-verify.yml`、`scripts/ops-release-gate.sh`、`scripts/ops-release-gate-evidence.sh`
**最後核驗 Commit**：`61aff90`
**最後核驗日期**：`2026-06-07`
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

2026-06-07 已在 GitHub `Production` environment 補齊 production workflow 所需 secrets，並已建立專用 release smoke admin。secret 值不得寫入文檔、commit message、chat 或 log；本文件只記錄 key name 與 presence。

## 缺口

原缺口已補齊：

1. `VERCEL_TOKEN`
2. `PRODUCTION_REDIS_URL`
3. `PRODUCTION_ADMIN_JWT_EXPIRES_IN`
4. `RELEASE_SMOKE_ADMIN_EMAIL`
5. `RELEASE_SMOKE_ADMIN_PASSWORD`

`RAILWAY_API_TOKEN` 已在 repo secrets 存在；workflow 也允許暫時 fallback 到既有 Railway project id secret，但長期應補明確命名的 `PRODUCTION_RAILWAY_PROJECT_ID`，避免 production workflow 依賴舊 staging 命名。

目前剩餘缺口不是 secret presence，而是尚未在 `deploy_web=true`、`deploy_backend=true`、`run_release_gate=true` 下完成一次正式 production workflow。

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
- Status：待完整部署驗證
- Notes：2026-06-07 已補齊 GitHub `Production` environment secrets；下一步需由操作者確認後觸發完整 production deploy + release gate。不得在 chat、commit message 或文檔中記錄 secret 值。
