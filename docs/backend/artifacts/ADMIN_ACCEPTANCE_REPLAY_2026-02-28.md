# 管理端驗收補跑留檔（2026-02-28）

## 執行環境

- 日期：2026-02-28
- 範圍：`/admin` 主流程（login / jobs / users / audit）
- 目的：補跑 P1 驗收並留存可追溯 artifact

## 執行命令與結果

### Backend

1. `npm run build`  
   - 結果：PASS

2. `npx jest tests/unit/routes/admin.routes.test.ts --runInBand`  
   - 結果：PASS（12 passed）

3. `npx jest tests/unit/controllers/admin.controller.test.ts --runInBand`  
   - 結果：PASS（15 passed）

4. `npx jest tests/unit/services/admin.service.test.ts --runInBand`  
   - 結果：PASS（8 passed）

5. `npx jest tests/unit/services/admin-config-rules.test.ts --runInBand`  
   - 結果：PASS（10 passed）

6. `npx jest tests/integration/admin-api-flow.test.ts --runInBand`  
   - 結果：PASS（5 passed）
   - 覆蓋：bootstrap token 邊界、低權限 403、停用後 token 401 即時失效

### Frontend

1. `npm run test:run -- src/services/request.test.ts`  
   - 結果：PASS（43 passed）
   - 重點：admin API 401 token 清理機制

2. `npm run build`  
   - 結果：PASS

## 驗收結論

- 管理端核心流程（login/jobs/users/audit）相關測試均通過。
- 本輪新增 `/admin/reports/costs` 路由後，已同步補齊 `admin.routes` 單測覆蓋。
- 可作為本次 P1 驗收補跑 artifact，供 staging -> production gate 檢查引用。

