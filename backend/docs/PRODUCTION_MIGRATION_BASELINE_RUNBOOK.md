# Production Migration Baseline Runbook

## 1) 目的

把曾經的緊急操作（`prisma migrate resolve --applied` + `prisma db push`）轉成可追溯、可驗證、可交接的正式流程，避免未來再次出現「資料庫實際狀態」與「遷移紀錄」失配。

## 2) 本次基線背景（已發生）

- 曾發生 `P3005`（資料庫非空，無法直接套用歷史 migration）。
- 為恢復服務，先用 `migrate resolve --applied` 標記部分舊 migration，後續以 `migrate deploy` 套用新 migration。
- 因生產缺表，再執行一次 `db push` 作緊急補齊。

這是可接受的救火手段，但必須補齊正式紀錄與後續正規化收尾。

## 3) 正規化目標

- 以 `_prisma_migrations` 作為唯一 migration 真實來源。
- 每次部署前後都產生 migration baseline 報告（JSON artifact）。
- 若使用過 `resolve` / `db push`，必須在 runbook 中留下「原因、範圍、回補計畫、批准人」。

## 4) 標準操作流程

以下命令於 `backend/` 執行：

### 4.1 產出現況報告（必做）

```bash
MIGRATION_REPORT_PATH=./tmp/bench-reports/prisma-migration-baseline-report.json \
npm run ops:migration:report
```

說明：
- exit `0`：migration folder 與 DB 紀錄一致，且無 failed migration。
- exit `2`：存在不一致或失敗遷移，禁止直接上 production。

### 4.2 先修復不一致（視報告而定）

- `missingInDb` 非空：代表程式碼有 migration 但 DB 未紀錄，先確認是否需要 `migrate deploy` 或 `resolve --applied`。
- `missingInCode` 非空：代表 DB 記錄有 migration，但 repo 缺失；需補回 migration 目錄或提交 baseline 說明。
- `failedMigrations` 非空：先處理失敗原因，不可跳過。

### 4.3 正式遷移（production）

```bash
npx prisma migrate deploy
```

僅在 emergency 且經批准時才可使用：

- `npx prisma migrate resolve --applied <migration_name>`
- `npx prisma db push`

若使用上述 emergency 命令，必須在同次 PR 補上 runbook 紀錄（見第 5 節）。

## 5) Baseline 紀錄模板（每次 emergency 必填）

- Date:
- Operator:
- Environment:
- Commit SHA:
- Trigger Incident:
- Why migrate deploy not enough:
- `resolve --applied` migrations:
- `db push` executed: yes/no
- Data-risk assessment:
- Reviewer/Approver:
- Follow-up task link:

## 6) 發布 Gate（強制）

Production 發布前，必須同時滿足：

- migration baseline 報告為 `status=ok`，或有明確核准的例外單。
- 本次部署 runbook 已附 artifact 路徑與 commit SHA。
- 若有 emergency 操作，已附回補計畫（最晚下個迭代完成）。
