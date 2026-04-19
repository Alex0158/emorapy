# 運維告警與 AI / Chat 治理基線

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：正式規格
**覆蓋範圍**：admin 平台治理、環境部署與運維基線：03-運維告警與AI-Chat治理基線
**取證代碼入口**：`backend/src/routes/admin.routes.ts`、`backend/src/routes/health.routes.ts`、`backend/src/routes/metrics.routes.ts`、`backend/src/middleware/adminAuth.ts`、`backend/src/config/env.ts`、`backend/src/utils/admin-jwt.ts`、`frontend/src/router/index.tsx`、`frontend/src/utils/adminEntry.ts`、`frontend-admin/src/router.tsx`、`frontend-admin/src/pages`、`backend/package.json`
**最後核驗 Commit**：`963c0d3`
**最後核驗日期**：`2026-04-19`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本文件承接 ops alerts、metrics、chat stage gate、benchmark readiness 與 migration rehearsal 的正式治理口徑。

## 1. 告警來源

當前正式告警來源只認三類：

1. `GET /health` 的健康檢查結果
2. `/metrics` 暴露的 Prometheus 指標
3. 後端治理腳本輸出的運維報告，例如 `npm run ops:alerts:check`、`npm run ops:migration:report`

## 2. Ops 告警基線

需持續監控的最低集合：

1. `health.lock` degraded / unhealthy
2. API `5xx` 異常比例
3. API `409` 異常比例
4. Chat 安全命中、判決失敗率、限流風暴

告警檢查可由定時腳本或平台排程驅動，但無論用哪種觸發方式，裁決口徑都相同。

## 3. Chat / AI Stream 治理基線

Chat 與 AI Stream 的平台治理至少包含：

1. `/metrics` 可觀測
2. `AI Stream` runtime 可恢復
3. chat 判決失敗率可量化
4. benchmark readiness 有固定檢查集
5. migration report / precheck 有固定 runbook 與報告口徑

## 4. Stage Gate 最低要求

若要把 chat 或 AI stream 相關變更視為可發布，最低要求如下：

1. conversion / context governance / rollback controls 已驗證
2. backend integration chain 已驗證
3. frontend e2e matrix 已驗證
4. benchmark dry-run gate 可產生報告
5. migration report 文檔與預檢 / 修復腳本可運行

## 5. 建議驗證命令

```bash
cd backend
npx jest tests/unit/services/chat.service.test.ts tests/unit/services/judgment.service.test.ts --runInBand
npx jest tests/integration/chat-routes.smoke.test.ts tests/integration/chat-invite-judgment-flow.test.ts --runInBand
npm run ops:alerts:check
DRY_RUN=true GATE_RUN_JUDGMENT=true GATE_RUN_INVITE_ACCEPT=true npm run bench:chat:concurrency-gate
npm run precheck:chat:active-roles-uniqueness
npm run ops:migration:report
cd ../frontend
npm run test:e2e -- e2e/chat
```

## 6. 文檔角色邊界

本文件只裁決治理要求，不直接保存每次驗證的輸出證據。

證據與一次性結果固定下沉到：

1. [../90-證據與盤點/AI流式驗證/README.md](../90-證據與盤點/AI流式驗證/README.md)
2. [../90-證據與盤點/環境與發版驗證/README.md](../90-證據與盤點/環境與發版驗證/README.md)

## 7. 關聯正文

1. 環境矩陣與部署前提：見 [01-環境與部署基線.md](./01-環境與部署基線.md)
2. 正式發布與回滾：見 [02-發布與回滾檢查表.md](./02-發布與回滾檢查表.md)
3. AI / chat 驗收口徑：見 [../08-測試規範與驗收/02-AI流式與Chat治理驗收基線.md](../08-測試規範與驗收/02-AI流式與Chat治理驗收基線.md)
