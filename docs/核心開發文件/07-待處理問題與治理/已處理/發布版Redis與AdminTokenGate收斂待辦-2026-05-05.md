# 發布版 Redis 與 Admin Token Gate 收斂待辦（2026-05-05）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：release runtime Redis 前提、AI Stream backend mode、LockService 降級、Admin token env gate
**取證代碼入口**：`backend/src/config/env.ts`、`backend/src/utils/lock.ts`、`backend/src/routes/health.routes.ts`、`backend/src/services/ai-stream.service.ts`、`backend/src/utils/admin-jwt.ts`、`backend/.env.example`、`scripts/ops-release-gate.sh`
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-12`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v1.0
**最後更新**：2026-05-12 21:35 CST
**狀態**：已處理
**Owner**：Ops / Backend
**優先級**：P0

## 1. 裁決

核心文件要求 staging / production 使用 Redis-backed runtime；現碼已有 health degraded 訊號與 `ALLOW_SIMPLE_LOCK` 風險開關，但啟動階段不會因缺 `REDIS_URL` 直接失敗，AI Stream 也可 fallback 到 memory。這對本機開發可接受，對發布版是否可接受需要硬性 gate 收斂。

同時，`ADMIN_JWT_SECRET` 在 production 已強制校驗，但 `ADMIN_JWT_EXPIRES_IN` 仍由 `backend/src/utils/admin-jwt.ts` fallback 到 `12h`。若文件規則是 production 顯式配置，則代碼 gate 未閉環；若接受預設，則需改核心文件。当前按「發布版應顯式配置」記為代碼待辦。

## 2. 目標狀態

1. production / staging 發布前必須能證明 `REDIS_URL` 已配置且 runtime 實際為 Redis-backed。
2. `ALLOW_SIMPLE_LOCK=true` 若在 production 使用，必須被 release gate 標為高風險或阻斷，除非有明確 emergency override 記錄。
3. `/health` 中 `checks.lock` 不得在 production 缺 Redis 時被誤讀為 healthy；AI Stream backend mode 也需在 release smoke 或 admin report 中可見。
4. `ADMIN_JWT_EXPIRES_IN` production 規則已改為顯式必填，由 `backend/src/utils/admin-jwt.ts` 與 `scripts/ops-release-gate.sh` 共同強制。

## 3. 建議實作方向

1. 已完成：`scripts/ops-release-gate.sh` 要求顯式 `REDIS_URL`、`ADMIN_JWT_EXPIRES_IN`，且禁止 `ALLOW_SIMPLE_LOCK=true`。
2. 已完成：release gate 驗證 `/health` 的 lock backend 與 AI Stream backend mode，而不只看 HTTP 200。
3. 已完成：`backend/.env.example` 已補充本機 / staging / production 的 Redis 使用口徑。

## 4. 驗收命令

```bash
npm run docs:check
NODE_ENV=production REDIS_URL= ADMIN_JWT_EXPIRES_IN= npm --workspace backend run build
npm run ops:release:gate
```

正式驗收仍需在發布環境用真實 env 跑一次 release gate evidence，並留存 `/health`、version manifest、AI Stream backend mode 或 Admin report 證據。

## 5. 2026-05-12 五輪核驗與收口裁決

1. 問題真實性輪：發布版 Redis 與 Admin token gate 仍是真實待辦，因為 gate 先前只看 `/health` HTTP 狀態，且 `ADMIN_JWT_EXPIRES_IN` 在 token helper 中仍是 fallback。
2. runtime 輪：本次不改本機 dev 基線，只把 release gate 與 health evidence 說清楚，避免 production / staging 用 fallback 口徑混過。
3. 業務輪：這個問題直接影響 Web / Admin 發布 runtime，不是純 backend 內部實作細節。
4. 工程輪：`ops:release:gate` 現已強制要求 `REDIS_URL`、`ADMIN_JWT_EXPIRES_IN` 與 Redis-backed `/health` payload，並禁止 `ALLOW_SIMPLE_LOCK=true`。
5. 測試輪：已補 `backend/tests/unit/routes/health.routes.test.ts` 與 `backend/tests/unit/utils/admin-jwt.test.ts`，以及 runbook 與 health metrics 文件，將發布 gate 轉成可驗證 contract。

本待辦已可移入 `已處理/`。
