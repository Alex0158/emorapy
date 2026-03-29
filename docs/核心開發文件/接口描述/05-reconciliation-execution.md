# 接口描述：reconciliation + execution

**文檔版本**：v2.2  
**最後更新**：2026-03-06  
**代碼基準**：`backend/src/routes/reconciliation.routes.ts`、`backend/src/routes/execution.routes.ts`、`backend/src/utils/validation.ts`

---

## 模組定位

- 判決後行動化鏈路：`plan 生成 -> plan 選擇 -> execution confirm/checkin -> dashboard`。
- 資料聚合分為「單方案明細」與「全局看板」。

## 接口契約（字段級）

| API | Request（核心字段） | Success（前端實際用到） | 常見錯誤碼 | 副作用/狀態轉移 | 前端入口 |
|---|---|---|---|---|---|
| `POST /api/v1/judgments/:id/reconciliation-plans` | `id(uuid)` + `preferences?{difficulty,duration,types[]}` | `data.plans[]` | `VALIDATION_ERROR` `RATE_LIMIT_EXCEEDED` | 生成新 plans 集合 | `/reconciliation/:judgmentId` |
| `GET /api/v1/judgments/:id/reconciliation-plans` | `id(uuid)` + optional filters | `data.plans[]` | `NOT_FOUND` | 無 | `/reconciliation/:judgmentId` |
| `GET /api/v1/reconciliation-plans/:id` | `id(uuid)` | `data.plan`（含 `judgment.case_id`） | `NOT_FOUND` | 無 | `/reconciliation/:judgmentId/:id` |
| `POST /api/v1/reconciliation-plans/:id/select` | `id(uuid)` | `data.plan.userX_selected` | `CONFLICT` `NOT_FOUND` | 方案選中狀態更新 | `/reconciliation/:judgmentId/:id` |
| `POST /api/v1/execution/confirm` | `plan_id(uuid)` | `data.execution` | `VALIDATION_ERROR` | 建立/更新執行記錄 | `/reconciliation/:judgmentId/:id` |
| `POST /api/v1/execution/checkin` | `plan_id(uuid)` `notes?` `photos?<=3` | `data.execution` | `VALIDATION_ERROR` | 新增打卡事件 | `/execution/:planId/checkin` |
| `GET /api/v1/execution/status` | query `plan_id(uuid)` | `data.records[]` `data.progress` | `NOT_FOUND` | 無 | `/execution/:planId/checkin` |
| `GET /api/v1/execution/dashboard` | 無 | `data.executions[]` | `UNAUTHORIZED` | 無 | `/execution/dashboard` |

## 操作級規則（深水區）

- `reconciliation-plans` 的生成與判決生成同屬 AI 高成本點，必須回歸 `aiLimiter` 行為。
- `select` 是 execution 的業務前置，未選方案不得進入確認執行主流程。
- `execution/status` 與 `dashboard` 是同域不同聚合層：一個追蹤單 plan、一個聚合多 plan。

## 回歸測試最小集

1. judgment -> generatePlans -> listPlans -> selectPlan 全鏈路。  
2. select 後 confirm + checkin，進度累計正確。  
3. dashboard 與 status 數據口徑一致（同 plan 的 progress 不衝突）。  
4. AI 生成失敗時可重試，不污染已選方案狀態。  

## 錯誤碼覆蓋矩陣（API -> code -> UI 行為）

| API | error.code | HTTP | UI 行為 | 重試策略 |
|---|---|---:|---|---|
| `POST /api/v1/judgments/:id/reconciliation-plans` | `VALIDATION_ERROR` | 400 | 提示偏好參數不合法 | 修正後重送 |
| `POST /api/v1/judgments/:id/reconciliation-plans` | `RATE_LIMIT_EXCEEDED` | 429 | 顯示生成過頻提示 | 冷卻後重試 |
| `GET /api/v1/judgments/:id/reconciliation-plans` | `NOT_FOUND` | 404 | 顯示尚無方案資料 | 可回判決頁重試生成 |
| `GET /api/v1/reconciliation-plans/:id` | `NOT_FOUND` | 404 | 顯示方案不存在 | 返回方案列表 |
| `POST /api/v1/reconciliation-plans/:id/select` | `CONFLICT` | 409 | 提示方案狀態衝突（可能已被選） | 先刷新列表再操作 |
| `POST /api/v1/reconciliation-plans/:id/select` | `NOT_FOUND` | 404 | 提示方案已失效 | 返回列表重選 |
| `POST /api/v1/execution/confirm` | `VALIDATION_ERROR` | 400 | 顯示 `plan_id` 錯誤 | 修正後重送 |
| `POST /api/v1/execution/checkin` | `VALIDATION_ERROR` | 400 | 提示打卡字段不合法 | 修正後重送 |
| `GET /api/v1/execution/status` | `NOT_FOUND` | 404 | 顯示尚無執行記錄 | 可先執行 confirm/checkin |
| `GET /api/v1/execution/dashboard` | `UNAUTHORIZED` | 401 | 清 token 導登入 | 登入後重拉 |

## 狀態標記

- 本模組接口狀態：全部 `已使用`。
