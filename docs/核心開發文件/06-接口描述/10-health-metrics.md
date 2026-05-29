# 接口描述：health + metrics + version + App telemetry

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：接口詳規
**覆蓋範圍**：接口字段契約、錯誤碼、守衛與頁面對接：10-health-metrics
**取證代碼入口**：`backend/src/app.ts`、`backend/src/routes`、`backend/src/services`、`frontend/src/services/api`、`frontend-admin/src/services/api`、`mobile/src/platform`
**最後核驗 Commit**：`adda512`
**最後核驗日期**：`2026-05-08`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v2.6
**最後更新**：2026-05-08
**代碼基準**：`backend/src/routes/health.routes.ts`、`backend/src/routes/metrics.routes.ts`、`backend/src/routes/meta.routes.ts`、`backend/src/routes/app-telemetry.routes.ts`、`backend/src/config/env.ts`

---

## 模組定位

- 平台健康探針、Prometheus 指標、版本資訊與 App safe telemetry ingest 接口。
- 非前台業務能力，但屬部署與運維硬依賴。
- `GET /version` 是目前客戶前端與 Admin 版本面板實際打到的後端版本接口，用於三端版本核對與部署驗證。
- `GET /api/v1/version` 與 `/version` 輸出同 payload，保留在 API 命名空間作 metadata / 兼容入口。
- `POST /api/v1/telemetry/events` 是 App M5/M6 的 safe telemetry ingest 端點，只接受已最小化事件、做 backend 二次清洗，並寫入最小化 `app_telemetry_events` 摘要；它可承接 App session start、lifecycle、JS fatal / unhandled promise，但不保存 prompt / relationship / psych 原文，不建立完整使用者行為分析、native crash runtime capture、external tracing backend 或長期產品分析基線。
- `POST /api/v1/telemetry/otlp/v1/traces` 是 CJ 內建 OTLP JSON trace ingest baseline，只接受 JSON `resourceSpans`，將 App-side OpenTelemetry provider span 轉為安全 `app_otel_span` 摘要並復用 App telemetry persistence / report；它不是 vendor collector，也不替代真機 / TestFlight runtime trace evidence。

## 接口契約（字段級）

| API | Request | Success（核心字段） | 常見錯誤碼/狀態 | 副作用 |
|---|---|---|---|---|
| `GET /api/v1/version` | 無 | `service` `version` `commitSha` `commitShortSha` `timestamp` | 200 或 500 | 無 |
| `GET /version` | 無 | `service` `version` `commitSha` `commitShortSha` `timestamp` | 200 或 500 | 無 |
| `GET /health` | 無 | `status` `checks{database/environment/lock/aiStream/cron}` `responseTime` `version` `commitSha` `commitShortSha` | 200（healthy/degraded）或 500 | 無 |
| `GET /health/ready` | 無 | `status=ready` | 503（not ready） | 無 |
| `GET /health/live` | 無 | `status=alive` | 通常固定 200 | 無 |
| `GET /metrics` | header `X-Metrics-Token?`（prod） | Prometheus text body | 404（disabled）/403（forbidden）/500（unavailable） | 無 |
| `POST /api/v1/telemetry/events` | body `events[1..20]`；單項含 `name`、`severity?`、`route?`、`request_id?`、`app_version?`、`platform?`、`build_number?`、`context?`；可帶 JWT、`X-Session-Id`、`X-Locale`、`X-Request-Id` | 202 `data.accepted_count` `data.persisted_count` `data.severities{info,warning,error}` | `VALIDATION_ERROR`、`RATE_LIMIT_EXCEEDED` | structured log；嘗試寫入最小化 `app_telemetry_events`，DB failure 不阻塞 ingest |
| `POST /api/v1/telemetry/otlp/v1/traces` | body `resourceSpans[1..10].scopeSpans[1..10].spans[1..50]`；span 可含 `traceId`、`spanId`、`name`、`startTimeUnixNano`、`endTimeUnixNano`、`attributes[]`、`status.code`；可帶 JWT、`X-Session-Id`、`X-Locale`、`X-Request-Id` | 202 `data.accepted_count` `data.persisted_count` `data.severities{info,warning,error}` `data.partial_success.rejected_spans=0` | `VALIDATION_ERROR`、`RATE_LIMIT_EXCEEDED` | 將 OTLP JSON span 正規化為 `app_otel_span` safe summary；DB failure 不阻塞 ingest |

## 操作級規則（深水區）

- `/version` 與 `/api/v1/version` 都回傳 `{ service, version, commitSha, commitShortSha, timestamp }`；`version` 來源為 `backend/package.json`，`commitSha` 來源依序為 `CJ_COMMIT_SHA`、`VERCEL_GIT_COMMIT_SHA`、`GITHUB_SHA`、`git rev-parse HEAD`，無法解析時為 `unknown`。前端與 Admin 版本面板目前實際請求的是 `VITE_API_BASE_URL + '/version'`。
- `/health` 也會帶 `version / commitSha / commitShortSha`，用於部署探針在同一 payload 內比對服務健康與後端代碼版本；`/health` 的 HTTP 200 不代表完全 healthy，仍要看 `status` 與 `checks`。
- `/health.checks.lock.message` 會揭示 `Lock backend: redis/simple-lock/...`；`/health.checks.aiStream.message` 會揭示 `AI Stream backend: redis/memory`。發布 gate 會要求 lock 與 AI Stream 都是 Redis-backed runtime。
- `/api/v1/version` 屬 API 命名空間兼容入口；root alias `/version` 雖保留了探針語義，但當前也承接版本面板的真實流量。
- `/health` 即使 degraded 仍回 200，判斷健康要看 payload `status`，不能只看 HTTP code。
- `/health/ready` 專用於就緒檢查；DB 不可用時 503。
- `/health/live` 為進程存活探針，正常情況固定返回 `200 + {status:'alive'}`。
- `app.ts` 將 `/health*`、`/version`、`/api/v1/version` 歸為 public status path，來源驗證與 CORS 走白名單豁免分支（`origin: false`）；因此監控探針不依賴瀏覽器 Origin。
- `app.ts` 在 production 只對 `/api/v1/telemetry/events` 與 `/api/v1/telemetry/otlp/v1/traces` 允許無 `Origin` 的 App native runtime 請求通過 CORS 前置檢查；非白名單瀏覽器 `Origin` 仍必須返回 `CORS_ORIGIN_DENIED`，其他 API 無 `Origin` 也不得被這個例外放行。
- `/metrics` 在生產環境必須由 token 或 IP 白名單保護；這在 `env.ts` 有強校驗。
- `METRICS_ENABLED=false` 時 `/metrics` 必須返回 404（而不是空 body/200）。
- Admin 健康頁使用的是 `/api/v1/admin/health/detailed`（本文件不覆蓋該接口，該接口歸 `09-admin.md`）。
- `POST /api/v1/telemetry/events` 使用 `generalLimiter` 與 `optionalAuthenticate`，可接匿名 session 或已登入 JWT；invalid optional JWT 只記 warning 並繼續處理匿名 telemetry。
- App telemetry request 必須使用 `{ events: [...] }` envelope；`events` 最多 20 條，`name` 僅允許英數、`_`、`.`、`:`、`-`，`context` 最多 30 個 key，value 只允許 string / number / boolean / null。backend 會再次把 `authorization`、`cookie`、`jwt`、`password`、`secret`、`session`、`token` 類 key redaction 成 `[redacted]`，object / array 等非 scalar value 會降級成 `[unsupported]`。
- `POST /api/v1/telemetry/otlp/v1/traces` 使用同一 limiter / optional auth；只接受 OTLP JSON trace subset，resource attributes 可帶 `app.version`、`app.build_number`、`app.platform`，span attributes 最多 30 個 scalar key-value。backend 會二次 redaction，並把 span 狀態映射為 `info/warning/error`。
- App telemetry 只允許回傳 route、request id、app version、platform、build number 與 safe context；不得上傳 relationship 原文、psych profile、prompt / completion payload、push token、JWT、session id 或完整 device fingerprint。
- `app_telemetry_events` 只保存最小事件摘要；`session_id` 只以 `JWT_SECRET` HMAC 後的 `session_hash` 保存，`user_id` 僅供已登入聚合且用戶刪除時 `SET NULL`，Admin report 不返回 `context`、`user_id` 或 `session_hash`。
- Admin crash-free 聚合目前把 `app_error_boundary`、`app_js_fatal`、`app_unhandled_promise` 與 `app_native_crash` 視為 crash session 事件；這只是 safe telemetry 口徑，不等於已有 native crash runtime evidence。
- `cleanup_app_telemetry` 每日 05:30 清理 30 天前 App telemetry event；這是事件摘要 retention first pass，不等於 DSAR、全域 log retention、native crash runtime evidence、vendor collector 或真機 OTel trace evidence 已完成。

## 回歸測試最小集

1. `GET /version` 返回 `version / commitSha / commitShortSha`，其中 `version` 與 `backend/package.json` 一致，供版本面板直接消費。
2. `GET /api/v1/version` 與 `/version` 的 payload 字段和值一致。
3. 正常環境 `/health` 返回 `status=healthy`，且帶後端 version manifest 字段。
4. 故障注入下 `/health` 返回 `degraded` 並含問題項。
5. 生產配置下，無 token 請求 `/metrics` 返回 403。
6. `METRICS_ENABLED=false` 時 `/metrics` 返回 404。
7. `POST /api/v1/telemetry/events` 匿名請求返回 202 並只回 accepted / persisted count 與 severity summary；invalid name 或超過 20 條 events 返回 `VALIDATION_ERROR`。
8. `POST /api/v1/telemetry/otlp/v1/traces` 匿名請求返回 202 並只回 accepted / persisted count / severity summary / partial_success；超過 span 上限或非法 trace id 返回 `VALIDATION_ERROR`。
9. App telemetry backend log 與 DB persistence 必須二次 redaction token/session/secret/password 類 key；DB persistence failure 只能降級為 `persisted_count=0`，不得阻塞 App 主流程。

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
| `POST /api/v1/telemetry/events` | `VALIDATION_ERROR` | 400 | App 保留本地 safe console telemetry，不阻塞主流程 | 修正 event name / batch size / context shape 後重送 |
| `POST /api/v1/telemetry/events` | `RATE_LIMIT_EXCEEDED` | 429 | App 丟棄或降頻，不向用戶彈錯 | 退避後再送；不能阻塞 UI |
| `POST /api/v1/telemetry/otlp/v1/traces` | `VALIDATION_ERROR` | 400 | App 保留本地 safe console telemetry，不阻塞主流程 | 修正 OTLP JSON shape / span batch size 後重送 |
| `POST /api/v1/telemetry/otlp/v1/traces` | `RATE_LIMIT_EXCEEDED` | 429 | App 丟棄或降頻，不向用戶彈錯 | 退避後再送；不能阻塞 UI |

## 狀態標記

- 已使用（前台 / Admin 直連）：1（`GET /version`）
- 已使用（部署 / 運維探針）：4（`GET /health`、`GET /health/ready`、`GET /health/live`、`GET /metrics`）
- 已使用（App safe telemetry ingest + minimized persistence）：2（`POST /api/v1/telemetry/events`、`POST /api/v1/telemetry/otlp/v1/traces`）
- 候選廢棄：1（`GET /api/v1/version`，作 API namespace 兼容入口）
