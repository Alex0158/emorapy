# 接口描述：health + metrics

**文檔版本**：v2.1  
**最後更新**：2026-03-05  
**代碼基準**：`backend/src/routes/health.routes.ts`、`backend/src/routes/metrics.routes.ts`、`backend/src/config/env.ts`

---

## 模組定位

- 平台健康探針與 Prometheus 指標接口。
- 非前台業務能力，但屬部署與運維硬依賴。

## 接口契約（字段級）

| API | Request | Success（核心字段） | 常見錯誤碼/狀態 | 副作用 |
|---|---|---|---|---|
| `GET /health` | 無 | `status` `checks{database/environment/lock/cron}` `responseTime` | 200（healthy/degraded）或 500 | 無 |
| `GET /health/ready` | 無 | `status=ready` | 503（not ready） | 無 |
| `GET /health/live` | 無 | `status=alive` | 通常固定 200 | 無 |
| `GET /metrics` | header `X-Metrics-Token?`（prod） | Prometheus text body | 404（disabled）/403（forbidden）/500（unavailable） | 無 |

## 操作級規則（深水區）

- `/health` 即使 degraded 仍回 200，判斷健康要看 payload `status`，不能只看 HTTP code。
- `/health/ready` 專用於就緒檢查；DB 不可用時 503。
- `/metrics` 在生產環境必須由 token 或 IP 白名單保護；這在 `env.ts` 有強校驗。
- `METRICS_ENABLED=false` 時 `/metrics` 必須返回 404（而不是空 body/200）。

## 回歸測試最小集

1. 正常環境 `/health` 返回 `status=healthy`。  
2. 故障注入下 `/health` 返回 `degraded` 並含問題項。  
3. 生產配置下，無 token 請求 `/metrics` 返回 403。  
4. `METRICS_ENABLED=false` 時 `/metrics` 返回 404。  

## 錯誤碼覆蓋矩陣（API -> code -> UI 行為）

| API | error.code / 狀態 | HTTP | UI/運維行為 | 重試策略 |
|---|---|---:|---|---|
| `GET /health` | `INTERNAL_ERROR`（handler fail） | 500 | 視為健康探針失敗，立即告警 | 指數退避重試並查 logs |
| `GET /health` | `status=degraded`（payload） | 200 | 標記降級，不可僅以 200 視為健康 | 持續輪詢並擴大探測 |
| `GET /health/ready` | `not ready` | 503 | 暫停流量切入/滾動發布 | 等待依賴恢復後重試 |
| `GET /health/live` | 非預期 5xx | 500 | 視為存活異常，觸發重啟策略 | 依平台策略重啟 |
| `GET /metrics` | disabled | 404 | 標記指標未啟用 | 檢查 `METRICS_ENABLED` |
| `GET /metrics` | forbidden | 403 | 標記認證失敗 | 補 token 或白名單後重試 |
| `GET /metrics` | unavailable | 500 | 標記指標服務不可用 | 排查 metrics collector |

## 狀態標記

- 本模組接口狀態：候選廢棄（運維保留接口）。
