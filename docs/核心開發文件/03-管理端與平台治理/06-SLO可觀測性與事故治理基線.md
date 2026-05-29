# SLO 可觀測性與事故治理基線

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：正式規格
**覆蓋範圍**：平台 SLI / SLO、可觀測性信號、告警、事故分級、處置流程、postmortem、incident drill、release gate 與 App telemetry 缺口治理基線
**取證代碼入口**：`backend/src/routes/health.routes.ts`、`backend/src/routes/metrics.routes.ts`、`backend/src/middleware/requestId.ts`、`backend/src/middleware/logger.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/performance.ts`、`backend/src/middleware/opsMetrics.ts`、`backend/src/services/ops-metrics.service.ts`、`backend/src/services/ops-alerts.service.ts`、`backend/src/services/ai-stream-metrics.service.ts`、`backend/src/services/chat-metrics.service.ts`、`backend/src/jobs/cleanup.job.ts`、`backend/ops/prometheus/chat-alerts.rules.yml`、`backend/tests/unit/routes/health.routes.test.ts`、`backend/tests/unit/routes/metrics.routes.test.ts`、`backend/tests/unit/services/ai-stream-metrics.service.test.ts`、`scripts/ops-release-gate.sh`、`scripts/ops-release-gate-evidence.sh`、`scripts/smoke-production-like.sh`、`scripts/smoke-staging.sh`
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-07`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 定位

本文把 CJ 的運維觀測從「有 health / metrics / alert 腳本」提升為 SLI / SLO / incident governance 基線。它參考 Google SRE SLO、Google SRE Alerting on SLOs、OpenTelemetry Signals、Prometheus Alerting、NIST CSF 2.0、NIST SP 800-61r3、NIST SSDF 與既有 release gate，但只作工程治理對標；不宣稱 CJ 已建立完整 SRE 組織、SLA、SOC、OpenTelemetry trace runtime 或外部資安事件響應認證。

本文屬平台治理級。Backend、Admin、release gate、metrics、jobs、alerts、AI stream、chat、App telemetry 或 production smoke 只要新增可用性、性能、告警或事故相關行為，都必須回查本文。

## 2. 外部基線採用口徑

| 外部基線 | CJ 採用方式 | 不採用 / 不宣稱 |
| --- | --- | --- |
| Google SRE SLO | 用 SLI / SLO / error budget 思路把「健康」變成可量測指標與行動門檻 | 不對外承諾 SLA |
| Google SRE Alerting on SLOs | 用 actionable alert、error-budget threat、burn-rate 與 low-traffic caveat 校準告警品質 | 不把現有 15m ratio alert 宣稱為 burn-rate alert |
| OpenTelemetry Signals | 用 traces、metrics、logs、baggage 分清可觀測信號與關聯缺口 | 不宣稱已接入 OTel tracing / collector |
| Prometheus Alerting | 用 alerting rules、`for` duration、Alertmanager / notification chain 校準 metrics 到告警的閉環 | 不把 `/metrics` text 存在等同於告警閉環 |
| NIST CSF 2.0 | 用 Govern / Identify / Protect / Detect / Respond / Recover 校準平台風險與事故治理 | 不把 CSF profile 當合規認證 |
| NIST SP 800-61r3 | 用 incident response profile 校準準備、偵測、回應、恢復與改進 | 不聲稱已具備正式 CSIRT |
| NIST SP 800-218 SSDF | 用 release gate、證據、回歸與變更控制對齊 secure SDLC 証據 | 不替代安全審計或滲透測試 |

## 3. 現有可觀測性地圖

| 層級 | 現有入口 | 能觀測什麼 | 限制 |
| --- | --- | --- | --- |
| 健康探針 | `/health`、`/health/ready`、`/health/live`、`/version` | DB、env、lock backend、cron、uptime、responseTime、commitSha | `/health` degraded 仍回 200，不能只看 HTTP code |
| Prometheus metrics | `/metrics` | chat counters、AI stream event/terminal/latency histograms | production 需 token / IP；尚無全 API p95 latency histogram |
| HTTP 窗口指標 | `opsMetricsService` Redis minute buckets | 3d 內 total / 5xx / 409 ratio | 只覆蓋 status ratio，不覆蓋 per-route latency |
| Ops alerts | `runOpsAlertChecks`、`ops_alerts_check` job | lock degraded、5xx ratio、409 ratio、Slack dedupe | 門檻是 alert threshold，不等於正式 SLO |
| Chat alerts | `backend/ops/prometheus/chat-alerts.rules.yml` | safety spike、judgment failure rate、rate limit flood | 需外部 Prometheus / alerting runtime 承接 |
| AI stream metrics | `ai_stream_*` metrics | event count、terminal result、time to first delta、complete-to-persist | 未設定正式 SLO target |
| Logs | request id、masked session id、user id、error/slow request | 排障、trace correlation | userId 仍是個人資料；需遵守資料治理基線 |
| Release evidence | `ops:release:gate`、`ops:release:gate:evidence` | docs、build/lint、version、health、DB parity、pricing、smoke、product audit | 不是長期監控，只是發版時點證據 |

## 3.1 信號裁決權重

| 信號 | 裁決權重 | 使用規則 |
| --- | --- | --- |
| `/health/ready` | 可阻斷發布 / 流量切入 | HTTP 503 直接表示 not ready；不能用 `/health` 200 替代 |
| `/health` payload | 可判定 degraded | 必須讀 `status` 與 `checks`；HTTP 200 只代表 handler 有回應 |
| `/metrics` | 可作 alert / dashboard input | 需要 Prometheus rule、window、`for` duration 與 notification 證據後才算告警閉環 |
| Redis 5xx / 409 minute buckets | 可作短窗偵測 | 必須保留 sample size、lookback、threshold；低樣本只能 warn |
| Request logs | 排障與 incident timeline | request id 可關聯請求；沒有 trace id 時不可宣稱 distributed tracing |
| Release gate evidence | 發布裁決 | 可以說 gate pass / fail，不能說 SLA 達成 |
| Admin reports | 人工分析 | 可輔助 triage，不能替代 automated detector |

## 4. SLI 與初始 SLO 狀態

| SLI ID | 指標 | 現碼來源 | 初始治理口徑 | 狀態 |
| --- | --- | --- | --- | --- |
| CJ-SLI-001 | Backend readiness | `/health/ready` 200 / 503 | release gate 必須通過；production 持續失敗視為 SEV1 或以上 | 已有來源，需監控接線 |
| CJ-SLI-002 | Backend health degradation | `/health.status`、`checks` | `status=degraded` 不能被 HTTP 200 掩蓋；lock / cron / DB degradation 需告警 | 已有來源 |
| CJ-SLI-003 | HTTP 5xx ratio | Redis 15m window `status5xx / total` | 當前 alert threshold 預設 `>5%` 且 sample >= 30；這是告警門檻，不是用戶承諾 SLO | 部分覆蓋 |
| CJ-SLI-004 | HTTP 409 ratio | Redis 15m window `status409 / total` | 預設 `>20%` 觸發衝突風暴告警 | 部分覆蓋 |
| CJ-SLI-005 | API latency | `performanceMonitor` slow request > 1000ms | 目前只有慢請求 log，無 p95/p99 指標；不得宣稱 latency SLO 達成 | 待建立基線 |
| CJ-SLI-006 | Chat judgment failure | Prometheus `chat_judgment_total{result}` | Prometheus rule 10m failure ratio > 3% critical | 部分覆蓋 |
| CJ-SLI-007 | Chat safety/rate limit spike | Prometheus `chat_safety_hits_total`、`chat_rate_limit_hits_total` | safety spike / flood 需觸發人工審查 | 部分覆蓋 |
| CJ-SLI-008 | AI stream recovery | `ai_stream_terminal_total`、`time_to_first_delta`、`complete_to_persist` | 有 metrics；無正式 SLO target；stream failed/cancelled ratio 需進報表與回歸 | 待建立基線 |
| CJ-SLI-009 | Release correctness | release gate pass/fail | 正式發布前 gate 必須全部通過，並優先留 evidence | 已有 gate |
| CJ-SLI-010 | Data/privacy incident signal | logs、audit、manual report、Admin audit logs | 需接入事故分級；尚無專門 privacy incident detector | 待建立基線 |

在沒有穩定長期數據前，本文不設定 99.9% 之類硬 SLO。現階段只能把 release gate 設為硬門檻，把 alert threshold 設為偵測門檻，把 SLO target 標為待建立基線。

## 4.1 SLI 計算與驗收口徑

| SLI | 計算或裁決方式 | 驗收口徑 |
| --- | --- | --- |
| Backend readiness | `/health/ready` HTTP code | 200 才可視為 ready；503 需阻斷 release / traffic cutover |
| Health degradation | `/health.status != healthy` 或任一關鍵 `checks.*.status != healthy/skipped` | degraded 即使 HTTP 200 也不得寫成 healthy |
| HTTP 5xx ratio | `status5xx / total` over `lookbackMinutes` | 必須同時記錄 total、window、threshold、sample size；低樣本不升級為 page |
| HTTP 409 ratio | `status409 / total` over `lookbackMinutes` | 只代表 conflict storm 偵測，不代表狀態機不變式完整健康 |
| AI terminal failure ratio | `ai_stream_terminal_total{result="failed|cancelled"} / all terminal` | 目前有 metric source，但無正式 target；只能作退化信號 |
| API latency | p95 / p99 over route / operation | 現碼只有 slow request log；沒有 histogram 前不得宣稱 latency SLO |

## 4.2 可觀測性缺口

| 類型 | 現狀 | 缺口 |
| --- | --- | --- |
| Metrics | chat / AI stream Prometheus metrics、Redis ops ratio、health payload | 缺全 API latency histogram、per-route volume、formal burn-rate alert |
| Logs | winston JSON、request id、masked session id、錯誤與慢請求 | 缺 trace id、span id、sampling / retention policy |
| Traces | 無正式 OTel traces | 無 distributed trace、collector、trace-to-log correlation |
| Events / Audit | Admin audit logs、product-state recovery tasks | privacy / data incident detector 尚未建立 |
| Release Evidence | evidence wrapper 可保留 gate output | 不是長期監控，需與 incident record 分開 |

## 5. 事故分級

| 級別 | 觸發條件 | 立即行動 | 典型 owner |
| --- | --- | --- | --- |
| SEV0 | 大規模資料外洩、真實用戶安全/危機誤路由、production 核心流程完全不可用且無替代、錯誤發布造成資料破壞 | 停止發布、凍結高風險操作、保全證據、啟動事故紀錄與回滾/隔離 | 工程 + 產品 + 安全/隱私 owner |
| SEV1 | `/health/ready` 持續失敗、DB/lock/cron 關鍵依賴降級、5xx 高比例、chat judgment 大面積失敗、release gate 發現 production parity 阻斷 | 進入 mitigation，必要時 rollback，保留 release / logs / metrics 證據 | 工程 owner + ops owner |
| SEV2 | 單一主流程 degraded、AI stream failed/cancelled 明顯上升、Admin report/metrics 部分不可用、notification/recovery task 卡住 | 建立任務，修復或降級，更新待處理問題與回歸入口 | 功能 owner |
| SEV3 | 文檔/指標/台賬漂移、非核心報表異常、低影響配置錯誤、測試或 evidence 不完整 | 排期修正，必要時補 docs / tests | 對應子域 owner |

若事故涉及 `CJ-DATA-2` 以上資料，必須同時回查 [../04-共用機制/04-資料治理與隱私風險基線.md](../04-共用機制/04-資料治理與隱私風險基線.md)，並在事故紀錄中標出資料級別與暴露面。

## 6. 事故處置流程

| 階段 | CJ 動作 | 最小證據 |
| --- | --- | --- |
| Govern / Prepare | 明確 owner、runbook、release gate、資料級別、告警門檻 | 本文、Runbook、NFR、RTM |
| Detect | 收集 health、metrics、logs、release evidence、Admin report、user report | request id、time window、commitSha、env、affected flow |
| Triage | 判定 SEV、影響範圍、資料級別、是否需停發/回滾 | 事故紀錄草稿 |
| Mitigate | rollback、feature flag、停用高風險 job、降級 AI stream、修復 env / DB / Redis | 操作命令、版本差異、健康恢復證據 |
| Recover | 驗證 `/health*`、`/metrics`、主流程 smoke、product-state audit、資料一致性 | gate / smoke / audit 結果 |
| Learn | postmortem、root cause、prevention task、文檔 / RTM / NFR 更新 | 待辦、PR、文件回寫 |

事故紀錄至少包含：incident id、開始/發現/緩解/恢復時間、SEV、affected users/flows、資料級別、commitSha、signals、root cause、mitigation、recovery evidence、follow-up owners、需要更新的 docs/tests/gates。

事故演練與可觀測性驗收的最小模板見 [../08-測試規範與驗收/07-SLO可觀測性與事故演練驗收基線.md](../08-測試規範與驗收/07-SLO可觀測性與事故演練驗收基線.md)。若只有口頭復盤、聊天記錄或單一截圖，沒有 time window、signals、mitigation、recovery evidence 與 follow-up，不能標為 incident drill 已完成。

## 7. Release 與事故邏輯

正式發布不得只以「服務能回 200」作閉環。`ops:release:gate` 的硬門檻包括：

1. `docs:check`
2. backend build / lint
3. Web / Admin / Backend version commit 對齊
4. `/health/live`、`/health/ready`、`/health`
5. DB migration parity
6. AI pricing catalog
7. smoke account hygiene
8. mutating release smoke
9. product-state audit

如果 gate 任何一項失敗，狀態只能寫「未通過發布 gate」或「部分發布」，不能寫「已完成發布」。若事故由發布引入，postmortem 必須回查對應 gate 為何未阻斷。

## 8. Web / App 分層

| 維度 | Web / Admin Web | App |
| --- | --- | --- |
| 健康與狀態 | Admin 可直接使用 `/health*`、reports、jobs、configs | 普通 App 不顯示 Admin health；若需要用戶可見狀態頁，需另定產品語義 |
| Metrics | Backend / Admin / Prometheus 為主 | App telemetry safe ingest / OTLP / Admin report / runtime evidence 已建立 first pass；仍不得用 Web metrics 或單次 telemetry pass 代表 App 長期穩定性 |
| 事故影響 | Web route / Admin route 可由現有頁面與 e2e 對應 | App screen、Push、Deep Link、offline/reconnect 需獨立 smoke / evidence |
| 降級策略 | Web 可用 route guard、error state、retry、SSE reconnect | App 需考慮 background、network transition、notification entry、SecureStore restore |

## 9. 缺口台賬

| 缺口 ID | 現狀 | 風險 | 處置規則 |
| --- | --- | --- | --- |
| CJ-OPS-GAP-001 | 有 alert threshold，但無正式 SLO / error budget | 團隊無法判斷「健康但不可接受」的服務狀態 | 持續收集 SLI，下一輪再定 target |
| CJ-OPS-GAP-002 | 有 runbook / gate，但無固定 incident record 模板 | 事故復盤容易丟失時間線、資料級別與防復發任務 | 本文第 6 節作最低模板 |
| CJ-OPS-GAP-003 | 缺少全 API latency p95/p99 與 per-route volume 指標 | 性能 NFR 難以量化 | 不宣稱 latency SLO；需後續補 metrics |
| CJ-OPS-GAP-004 | data/privacy incident 尚未接入專門 detector | 隱私事件可能只靠人工發現 | 資料治理基線 + 事故分級先建立，detector 待辦另立 |
| CJ-OPS-GAP-005 | App telemetry / App smoke evidence 已建立 first pass，但 physical device、provider delivery、production native crash runtime 與長期 SLO baseline 仍未閉環 | App 版無法繼承 Web 運維結論，也不能把 telemetry runtime pass 當完整 App reliability | App 能力或 release gate 變更時回查 App 測試證據接入基線與 release completion audit |
| CJ-OPS-GAP-006 | Chat / AI stream 有 metrics，但沒有產品級 target | AI 體驗退化只能被動排查 | 暫以 metrics + regression + Admin report 管控 |
| CJ-OPS-GAP-007 | App 已有 OpenTelemetry provider first pass 與 CJ OTLP JSON ingest，但無 external tracing backend / vendor collector / cross-service distributed trace | 跨服務、AI provider、DB、Redis 的慢路徑根因難以定位 | 先以 request id + logs + metrics + App OTLP safe summary 管控；接 external collector 前不得宣稱完整 tracing |
| CJ-OPS-GAP-008 | 無固定 incident drill 證據落點 | 事故流程可能只停留在文檔描述 | 以 `08/07` 建立驗收模板，後續演練證據下沉 `90-證據與盤點/` |

## 10. 驗收口徑

1. Test：health / metrics routes、ops alert checks、chat metrics、AI stream metrics、release gate script 應有單測或 smoke 入口。
2. Analysis：每次平台事故或 release gate failure 必須能追到 commitSha、request id、env、metrics window 與相關文檔。
3. Inspection：新增 SLI / alert / job / release gate 必須同步 `03-管理端與平台治理/`、NFR、RTM 與必要接口文檔。
4. Demonstration：正式發布優先用 `ops:release:gate:evidence` 留存證據；事故恢復後至少保留 health/ready/smoke/audit 結果。
5. Drill：SEV0-SEV2 或 release gate failure 至少需按 `08/07` 模板保留一次 incident drill / record，才能宣稱事故流程已被驗收。
6. Baseline Pending：未建立 p95/p99、error budget、長期 App reliability SLI、external tracing backend / distributed trace 或 privacy detector 前，不得宣稱完整 SLO、SLA、SOC 或 incident response maturity。
