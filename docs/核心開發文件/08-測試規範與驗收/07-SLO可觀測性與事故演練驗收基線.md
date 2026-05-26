# SLO 可觀測性與事故演練驗收基線

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：測試規範
**覆蓋範圍**：health / ready / live、metrics、ops alerts、request id、logs、release gate evidence、incident drill、postmortem、App telemetry 缺口與 SLO 驗收口徑
**取證代碼入口**：`backend/src/routes/health.routes.ts`、`backend/src/routes/metrics.routes.ts`、`backend/src/middleware/requestId.ts`、`backend/src/middleware/logger.ts`、`backend/src/middleware/performance.ts`、`backend/src/middleware/opsMetrics.ts`、`backend/src/services/ops-metrics.service.ts`、`backend/src/services/ops-alerts.service.ts`、`backend/src/services/ai-stream-metrics.service.ts`、`backend/src/services/chat-metrics.service.ts`、`backend/tests/unit/routes/health.routes.test.ts`、`backend/tests/unit/routes/metrics.routes.test.ts`、`backend/tests/unit/services/ai-stream-metrics.service.test.ts`、`backend/ops/prometheus/chat-alerts.rules.yml`、`scripts/ops-release-gate.sh`、`scripts/ops-release-gate-evidence.sh`、`scripts/smoke-production-like.sh`、`scripts/smoke-staging.sh`、`frontend-admin/src/pages/Admin/Health`、`mobile/app`、`mobile/src/platform`
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-07`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 定位

本文把 SLO、可觀測性與事故治理接入驗收層。它不新增運維 runtime，不設定對外 SLA，也不把單次 `/health` 或 release gate pass 當作長期可靠性證明。

頂級工程級 PRD / SRS 會把「系統可用、可監控、可恢復」拆成可驗證的信號、門檻、演練與證據。CJ 目前已有 health、metrics、ops alerts、release gate 與局部 Admin 報表；本文補齊哪些證據可以阻斷發布、哪些只能輔助排障、哪些仍屬待建立基線。

## 2. 外部基線參考

| 外部基線 | 驗收採用方式 | 不宣稱 |
| --- | --- | --- |
| Google SRE SLO / Error Budget | 用 SLI、SLO、error budget、burn-rate 思路區分「告警門檻」與「可靠性目標」 | 不宣稱 CJ 已有正式 error budget |
| Google SRE Alerting on SLOs | 用 actionable、error-budget threat、multi-window / burn-rate 思路校準告警品質 | 不宣稱現有 Redis 15m ratio 已是 burn-rate alerting |
| OpenTelemetry Signals | 用 traces / metrics / logs / baggage 分清信號類型與關聯缺口 | 不宣稱已接入 OTel trace 或 collector |
| Prometheus Alerting | 用 alerting rules、`for` duration、Alertmanager / notification chain 校準 Prometheus 規則邊界 | 不宣稱只存在 Prometheus text 就等於有告警閉環 |
| NIST SP 800-61r3 | 用 Prepare / Detect / Analyze / Respond / Recover / Learn 校準事故演練與 postmortem 證據 | 不宣稱已有正式 CSIRT |

來源：

1. [Google SRE Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)
2. [Google SRE Workbook: Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)
3. [OpenTelemetry Signals](https://opentelemetry.io/docs/concepts/signals/)
4. [Prometheus Alerting Overview](https://prometheus.io/docs/alerting/latest/overview/)
5. [Prometheus Alerting Rules](https://prometheus.io/docs/prometheus/2.53/configuration/alerting_rules/)
6. [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final)

## 3. 信號裁決分層

| 信號層 | 現有入口 | 可用於 | 不能用於 |
| --- | --- | --- | --- |
| Release Gate Evidence | `scripts/ops-release-gate.sh`、`scripts/ops-release-gate-evidence.sh` | 發布是否成立、發布後事故回溯 | 長期可用性或 SLA |
| Health Probes | `/health`、`/health/ready`、`/health/live` | readiness、liveness、degraded 檢查、流量切入判斷 | 單獨證明主流程可用 |
| Prometheus Metrics | `/metrics`、chat / AI stream counters and histograms | chat / AI stream 指標、Prometheus rule input | 未有 Alertmanager / rule runtime 時不得宣稱告警閉環 |
| Redis Ops Metrics | `opsMetricsService` minute buckets、`runOpsAlertChecks` | 5xx / 409 ratio 偵測、Slack dedupe | 全 API latency SLO 或 burn-rate error budget |
| Logs | request id、masked session id、user id、error / slow request log | 排障、incident timeline、資料級別檢查 | 長期指標或用戶影響比例 |
| Admin Reports | Admin health、reports、costs、AI stream sessions | 人工分析與治理面板 | 自動事故 detector |
| App Telemetry | `mobile/` 已有 safe telemetry adapter、OpenTelemetry provider first pass 與 native crash SDK configuration first pass；backend 已有 ingest / CJ OTLP JSON trace ingest / minimized persistence / Admin report / 30d cleanup first pass | App release 排障、error context 與 crash-free sessions 初始聚合 | 不能用 Web metrics 代表 App；也不能把 safe ingest / SDK configuration 當 native crash runtime evidence / external tracing backend / 長期 SLO |

## 4. 最小驗收矩陣

| 驗收 ID | 驗收對象 | 最小證據 | 通過口徑 | 當前狀態 |
| --- | --- | --- | --- | --- |
| CJ-OPS-T-001 | Health contract | `health.routes.test.ts`、`smoke-production-like.sh` | `/health` 需區分 `healthy/degraded` payload；`/health/ready` 故障時 503；`/health/live` 200 alive | 已部分覆蓋 |
| CJ-OPS-T-002 | Metrics guard | `metrics.routes.test.ts`、`smoke-staging.sh` | production 無 token / IP 不得讀 `/metrics`；disabled 回 404；export fail 回 500 | 已部分覆蓋 |
| CJ-OPS-T-003 | Ops ratio alert | `ops-alerts.service.ts`、ops alert job / script output | 需保留 lookback、sample size、5xx / 409 ratio、threshold、Slack attempted / sent / deduped | 部分覆蓋；需固定證據落點 |
| CJ-OPS-T-004 | Chat / AI stream metrics | `chat-metrics.service.ts`、`ai-stream-metrics.service.ts`、Prometheus rule | metric name、label、terminal result、latency histogram 必須可導出；AI failed / cancelled ratio 不能只看 UI | 部分覆蓋 |
| CJ-OPS-T-005 | Request correlation | `requestId.ts`、`logger.ts`、`errorHandler.ts`、`performance.ts` | 事故記錄必須能追到 request id、time window、commitSha、env、affected flow；session id 只能 masked | 部分覆蓋；無 trace id |
| CJ-OPS-T-006 | Release evidence | `ops-release-gate-evidence.sh` | 發布宣稱必須有 docs、build/lint、version、health、DB parity、pricing、smoke、product audit 的 gate result | 已有 gate；不是長期監控 |
| CJ-OPS-T-007 | Incident drill | 本文第 6 節、`03/06` 主基線 | 至少能用一次 degraded health、metrics forbidden、release gate failure 或 product-state audit failure 走完整記錄 | 待建立演練證據 |
| CJ-OPS-T-008 | App observability parity | `20-App端`、`50-跨端Mapping與Parity`、`mobile/`、`backend/src/services/app-telemetry.service.ts` | App 上線前需有 crash / network / reconnect / background / native storage 最小 telemetry 或 smoke 證據；現有 safe ingest / OTLP JSON trace ingest / report / SDK configuration 只覆蓋 first pass | 部分覆蓋；native crash runtime evidence / external tracing backend / device lifecycle evidence 待承接 |

## 5. SLI 驗收邏輯

| SLI | 計算或裁決方式 | 驗收要求 |
| --- | --- | --- |
| Backend readiness | `/health/ready` HTTP 200 / 503 | release gate 必須讀 HTTP code；不得用 `/health` 200 替代 ready |
| Health degradation | `/health.status` + `checks.*.status` | `status=degraded` 即使 HTTP 200 也要標 degraded；文件或事故記錄不得只寫「health 200」 |
| 5xx ratio | `status5xx / total` over lookback window | 必須同時記 total、window、threshold、sample size；低樣本只能 warn |
| 409 ratio | `status409 / total` over lookback window | 只能表示衝突風暴偵測，不代表全部業務不變式健康 |
| Slow request | `duration > 1000ms` log | 目前只能作排障信號；無 histogram 前不得宣稱 p95 / p99 SLO |
| AI stream first delta | `ai_stream_time_to_first_delta_ms` histogram | 可作 AI 體驗退化信號；未定 target 前只能標待建立基線 |
| AI complete-to-persist | `ai_stream_complete_to_persist_ms` histogram | 可作 persistence handoff 退化信號；需和 terminal result 一起看 |
| Chat judgment failure | `chat_judgment_total{result}` | Prometheus rule 可偵測 failure rate；需保留 window 與 rule runtime 證據 |

## 6. 事故演練最小模板

每次 SEV0-SEV2 或 release gate failure，至少保留以下欄位：

| 欄位 | 必填口徑 |
| --- | --- |
| Incident ID | `CJ-INC-YYYYMMDD-xx` |
| Time Window | detected / mitigated / recovered 的 UTC 或 Asia/Shanghai 時間 |
| Severity | SEV0-SEV3，依 `03/06` 主基線裁決 |
| Affected Scope | Web / Admin / Backend / DB / AI stream / Chat / App / release |
| User / Data Impact | affected flow、估算用戶、資料級別、是否涉及 `CJ-DATA-2+` |
| Commit / Env | `commitSha`、release / staging / local、backend base URL 或 masked project id |
| Signals | health payload、metrics window、logs request id、Admin report、user report、release evidence |
| Root Cause | 已知 / 假設 / 待查；不可把症狀寫成根因 |
| Mitigation | rollback、feature flag、停用 job、修 env / DB / Redis、降級或人工恢復 |
| Recovery Evidence | `/health*`、smoke、product-state audit、DB parity、metrics recovery |
| Follow-up | owner、due date、docs / tests / gates / runtime 需要補什麼 |

演練可以用真事故、release gate failure 或人工故障注入完成。若只討論流程但沒有時間線、信號和恢復證據，不得算完成 incident drill。

## 7. 不得宣稱

1. 不得用 `/health` HTTP 200 宣稱服務 healthy；必須看 payload `status` 與 `checks`。
2. 不得用 `/metrics` 可導出宣稱告警閉環；需要 Prometheus rule、Alertmanager / notification 或等價證據。
3. 不得把 Redis 15m 5xx / 409 threshold 宣稱為正式 SLO 或 error budget。
4. 不得把 release gate 單次通過宣稱為長期 SLA。
5. 不得用 Web / Admin health 或 metrics 推導 App 已穩定。
6. 不得在沒有全 API latency histogram 前宣稱 p95 / p99 latency SLO。
7. 不得把 log 內 user id / request id 直接輸出到對外報告；需按資料治理基線做最小化。

## 8. 維護規則

1. 新增 health / metrics / alert / release gate / smoke 行為時，必須同步 `03-管理端與平台治理/06-SLO可觀測性與事故治理基線.md`、本文、NFR 與 RTM。
2. 新增 Prometheus metric 時，必須標明 metric name、type、label、cardinality risk、owner、是否進 alert。
3. 新增事故分級或 postmortem 規則時，必須同步資料治理與安全需求文件；涉及高敏資料時先回查資料分類。
4. 新增 App telemetry 或 App smoke 時，不得把它寫在 Web/Admin evidence 下，需回寫 App / Parity 與本文 `CJ-OPS-T-008`。
5. 任何「SLO 已完成」「SLA 達成」「error budget 可用」的表述，都必須有長期 SLI 資料源、target、window、burn-rate 或 error budget policy，否則只能寫待建立基線。
