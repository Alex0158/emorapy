# 接口描述：health + metrics + version

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：接口詳規
**覆蓋範圍**：接口字段契約、錯誤碼、守衛與頁面對接：10-health-metrics
**取證代碼入口**：`backend/src/app.ts`、`backend/src/routes`、`frontend/src/services/api`、`frontend-admin/src/services/api`
**最後核驗 Commit**：`4d14e4f`
**最後核驗日期**：`2026-04-19`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v2.3  
**最後更新**：2026-04-19  
**代碼基準**：`backend/src/routes/health.routes.ts`、`backend/src/routes/metrics.routes.ts`、`backend/src/routes/meta.routes.ts`、`backend/src/config/env.ts`

---

## 模組定位

- 平台健康探針、Prometheus 指標與版本資訊接口。
- 非前台業務能力，但屬部署與運維硬依賴。
- `GET /version` 是目前客戶前端與 Admin 版本面板實際打到的後端版本接口，用於三端版本核對與部署驗證。
- `GET /api/v1/version` 與 `/version` 輸出同 payload，保留在 API 命名空間作 metadata / 兼容入口。

## 接口契約（字段級）

| API | Request | Success（核心字段） | 常見錯誤碼/狀態 | 副作用 |
|---|---|---|---|---|
| `GET /api/v1/version` | 無 | `service` `version` `timestamp` | 200 或 500 | 無 |
| `GET /version` | 無 | `service` `version` `timestamp` | 200 或 500 | 無 |
| `GET /health` | 無 | `status` `checks{database/environment/lock/cron}` `responseTime` | 200（healthy/degraded）或 500 | 無 |
| `GET /health/ready` | 無 | `status=ready` | 503（not ready） | 無 |
| `GET /health/live` | 無 | `status=alive` | 通常固定 200 | 無 |
| `GET /metrics` | header `X-Metrics-Token?`（prod） | Prometheus text body | 404（disabled）/403（forbidden）/500（unavailable） | 無 |

## 操作級規則（深水區）

- `/version` 與 `/api/v1/version` 都回傳原始 `{ service, version, timestamp }`，版本來源為 `backend/package.json`；前端與 Admin 版本面板目前實際請求的是 `VITE_API_BASE_URL + '/version'`。
- `/api/v1/version` 屬 API 命名空間兼容入口；root alias `/version` 雖保留了探針語義，但當前也承接版本面板的真實流量。
- `/health` 即使 degraded 仍回 200，判斷健康要看 payload `status`，不能只看 HTTP code。
- `/health/ready` 專用於就緒檢查；DB 不可用時 503。
- `/health/live` 為進程存活探針，正常情況固定返回 `200 + {status:'alive'}`。
- `app.ts` 將 `/health*`、`/version`、`/api/v1/version` 歸為 public status path，來源驗證與 CORS 走白名單豁免分支（`origin: false`）；因此監控探針不依賴瀏覽器 Origin。
- `/metrics` 在生產環境必須由 token 或 IP 白名單保護；這在 `env.ts` 有強校驗。
- `METRICS_ENABLED=false` 時 `/metrics` 必須返回 404（而不是空 body/200）。
- Admin 健康頁使用的是 `/api/v1/admin/health/detailed`（本文件不覆蓋該接口，該接口歸 `09-admin.md`）。

## 回歸測試最小集

1. `GET /version` 返回 `version` 且與 `backend/package.json` 一致，供版本面板直接消費。  
2. `GET /api/v1/version` 與 `/version` 的版本值一致。  
3. 正常環境 `/health` 返回 `status=healthy`。  
4. 故障注入下 `/health` 返回 `degraded` 並含問題項。  
5. 生產配置下，無 token 請求 `/metrics` 返回 403。  
6. `METRICS_ENABLED=false` 時 `/metrics` 返回 404。  

## 錯誤碼覆蓋矩陣（API -> code -> UI 行為）

| API | error.code / 狀態 | HTTP | UI/運維行為 | 重試策略 |
|---|---|---:|---|---|
| `GET /api/v1/version` | `INTERNAL_ERROR`（handler fail） | 500 | API 空間調用方標記版本接口失敗 | 短快取後重試 |
| `GET /version` | `INTERNAL_ERROR`（handler fail） | 500 | 版本面板或平台探針標記版本端點失敗 | 短退避後重試 |
| `GET /health` | `INTERNAL_ERROR`（handler fail） | 500 | 視為健康探針失敗，立即告警 | 指數退避重試並查 logs |
| `GET /health` | `status=degraded`（payload） | 200 | 標記降級，不可僅以 200 視為健康 | 持續輪詢並擴大探測 |
| `GET /health/ready` | `not ready` | 503 | 暫停流量切入/滾動發布 | 等待依賴恢復後重試 |
| `GET /health/live` | 非預期 5xx | 500 | 視為存活異常，觸發重啟策略 | 依平台策略重啟 |
| `GET /metrics` | disabled | 404 | 標記指標未啟用 | 檢查 `METRICS_ENABLED` |
| `GET /metrics` | forbidden | 403 | 標記認證失敗 | 補 token 或白名單後重試 |
| `GET /metrics` | unavailable | 500 | 標記指標服務不可用 | 排查 metrics collector |

## 狀態標記

- 已使用（前台 / Admin 直連）：1（`GET /version`）
- 已使用（部署 / 運維探針）：4（`GET /health`、`GET /health/ready`、`GET /health/live`、`GET /metrics`）
- 候選廢棄：1（`GET /api/v1/version`，作 API namespace 兼容入口）
