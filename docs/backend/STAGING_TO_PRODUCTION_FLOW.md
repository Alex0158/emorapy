# Staging -> Production 固定流程

> **與發布指引的關係**：本文件為**可選的嚴格 gate 流程**（需有 staging 環境）。若無 staging，僅需依 [docs/發布指引/發佈流程指引.md](../發布指引/發佈流程指引.md) 執行最小發布即可。

## 1) 原則

- 所有發版走同一條路：`feature/main -> staging -> production`
- production 不接受未經 staging 驗證的直接變更

## 2) 環境策略

- `staging`：功能驗證、壓測、回歸測試
- `production`：僅接收通過 gate 的版本

### 2.1 現有落地入口（2026-03-28）

- 新增 workflow：`.github/workflows/staging-smoke.yml`（`workflow_dispatch`）
- 新增腳本：`scripts/smoke-staging.sh`（包裝 `smoke-production-like.sh`）
- 必填 secrets：
  - `STAGING_BACKEND_BASE_URL`
  - `STAGING_FRONTEND_BASE_URL`
  - `STAGING_ADMIN_EMAIL`
  - `STAGING_ADMIN_PASSWORD`
- 配置模板：`docs/backend/STAGING_SECRETS_TEMPLATE.md`

## 3) 發布 Gate（最少）

1. migration baseline 報告：`npm run ops:migration:report` 無警告  
2. chat 併發 gate：`npm run bench:chat:concurrency-gate` 通過  
3. admin 主流程測試：login/jobs/users/audit 通過  
4. production-like smoke gate：CI `production-like-smoke` job 必須通過（可本地複驗 `bash scripts/smoke-production-like.sh`）  
5. ops 告警檢查：`npm run ops:alerts:check` 無 alert
6. 若涉及密鑰輪替：完成 `docs/backend/JWT_SECRET_ROTATION_RUNBOOK.md` 的 staging 驗證
7. health 檢查需同時驗證：
   - 平台內探測（無 Origin）
   - 外部探測（帶允許 Origin）可回 200
8. Slack 告警鏈路驗證：
   - staging 觸發一組測試 alert，可收到 Slack
   - `ALERT_SLACK_DEDUP_WINDOW_SECONDS` 防抖生效（不洗版）
9. 成本看板驗證：
   - `GET /api/v1/admin/reports/costs` 可回資料
   - 若外部 API 不可用，回傳 `partial=true` 並包含 `reasons`
   - 前端 Reports 成本區塊可正常展示

## 4) 建議流程

1. 合併到待發版分支（或 main 前）  
2. 部署 staging  
3. 跑 gate 與 smoke test（含 CI `production-like-smoke` 與管理員主流程）  
4. 紀錄 artifact（JSON 報告、commit SHA、環境）  
5. 同版本部署 production  
6. 發布後 30 分鐘觀察告警與 health

若本次含密鑰輪替，額外要求：

7. 留存輪替稽核資料（start time、remove-after、部署 ID）
8. 設定關窗排程（移除 `JWT_SECRET_PREVIOUS`）

### 4.1 staging smoke 操作命令

本地（需先提供環境變量）：

```bash
BACKEND_BASE_URL=https://<staging-backend-domain> \
FRONTEND_BASE_URL=https://<staging-frontend-domain> \
STAGING_ADMIN_EMAIL=<staging-admin-email> \
STAGING_ADMIN_PASSWORD=<staging-admin-password> \
npm run smoke:staging
```

GitHub Actions：

1. 進入 `Staging Smoke Gate` workflow  
2. 點擊 `Run workflow`  
3.（可選）提供 `origin` 覆蓋值  
4. 查看 smoke gate 結果與日誌

## 5) 回滾準則

- 任一 gate fail：不得升 production  
- production 新增 critical alert（lock degraded / 5xx 激增）且 10 分鐘內未恢復：回滾前一版

## 6) 審核責任

- 開發：提交變更與測試證據  
- 發版操作者：執行 gate、保留報告  
- Reviewer：批准 production promotion
