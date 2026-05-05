# 發布版 Redis 與 Admin Token Gate 收斂待辦（2026-05-05）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：release runtime Redis 前提、AI Stream backend mode、LockService 降級、Admin token env gate
**取證代碼入口**：`backend/src/config/env.ts`、`backend/src/utils/lock.ts`、`backend/src/routes/health.routes.ts`、`backend/src/services/ai-stream.service.ts`、`backend/src/utils/admin-jwt.ts`、`backend/.env.example`、`scripts/ops-release-gate.sh`
**最後核驗 Commit**：`adda512`
**最後核驗日期**：`2026-05-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v1.0  
**最後更新**：2026-05-05  
**狀態**：待處理  
**Owner**：Ops / Backend  
**優先級**：P0

## 1. 裁決

核心文件要求 staging / production 使用 Redis-backed runtime；現碼已有 health degraded 訊號與 `ALLOW_SIMPLE_LOCK` 風險開關，但啟動階段不會因缺 `REDIS_URL` 直接失敗，AI Stream 也可 fallback 到 memory。這對本機開發可接受，對發布版是否可接受需要硬性 gate 收斂。

同時，`ADMIN_JWT_SECRET` 在 production 已強制校驗，但 `ADMIN_JWT_EXPIRES_IN` 仍由 `backend/src/utils/admin-jwt.ts` fallback 到 `12h`。若文件規則是 production 顯式配置，則代碼 gate 未閉環；若接受預設，則需改核心文件。当前按「發布版應顯式配置」記為代碼待辦。

## 2. 目標狀態

1. production / staging 發布前必須能證明 `REDIS_URL` 已配置且 runtime 實際為 Redis-backed。
2. `ALLOW_SIMPLE_LOCK=true` 若在 production 使用，必須被 release gate 標為高風險或阻斷，除非有明確 emergency override 記錄。
3. `/health` 中 `checks.lock` 不得在 production 缺 Redis 時被誤讀為 healthy；AI Stream backend mode 也需在 release smoke 或 admin report 中可見。
4. `ADMIN_JWT_EXPIRES_IN` production 規則需二選一並落地：顯式必填並由 `env.ts` 強制；或修改核心文件承認 `12h` 是正式預設。

## 3. 建議實作方向

1. 在 `backend/src/config/env.ts` 增加 production/staging Redis 與 `ADMIN_JWT_EXPIRES_IN` 的強校驗，或在 `scripts/ops-release-gate.sh` 增加等價 release-blocking check。
2. 在 release gate 中驗證 `/health` 的 lock backend 與 AI Stream backend mode，避免只看 HTTP 200。
3. 將 `backend/.env.example` 補成明確三態：local dev 可本機 Redis；staging/production 必須 Railway Redis；test 可使用 memory 或 test Redis。

## 4. 驗收命令

```bash
npm run docs:check
NODE_ENV=production REDIS_URL= ADMIN_JWT_EXPIRES_IN= npm --workspace backend run build
npm run ops:release:gate
```

正式驗收還需在發布環境用真實 env 跑一次 release gate evidence，並留存 `/health`、version manifest、AI Stream backend mode 或 Admin report 證據。
