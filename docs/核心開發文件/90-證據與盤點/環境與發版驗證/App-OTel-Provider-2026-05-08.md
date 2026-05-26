# App OpenTelemetry Provider 驗證記錄

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據文檔
**來源時間**：2026-05-08
**上下文**：App M6 observability baseline、OpenTelemetry provider、CJ OTLP JSON trace ingest、safe telemetry exporter
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-08`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v1.0
**最後更新**：2026-05-08
**對應範圍**：`mobile/src/platform/telemetry/client.ts`、`mobile/src/platform/telemetry/client.test.js`、`mobile/src/platform/telemetry/observability.ts`、`backend/src/routes/app-telemetry.routes.ts`、`backend/src/services/app-telemetry.service.ts`、`backend/tests/unit/routes/app-telemetry.routes.test.ts`、`backend/tests/unit/services/app-telemetry.service.test.ts`、`mobile/package.json`

---

## 本次確認到的狀態

App telemetry 已從手寫 span summary 升級為 App-side OpenTelemetry provider first pass：

- `mobile` 已新增 `@opentelemetry/api`、`@opentelemetry/core`、`@opentelemetry/sdk-trace-base`。
- `startTelemetrySpan` 由 `BasicTracerProvider` + `SimpleSpanProcessor` + custom `SafeTelemetrySpanExporter` 驅動。
- exporter 以 OTLP JSON shape 送出 `resourceSpans` 到 `POST /api/v1/telemetry/otlp/v1/traces`。
- backend CJ OTLP JSON trace ingest 只把 span 轉成 `app_otel_span` safe telemetry summary，復用 `app_telemetry_events` 最小化 persistence / Admin report / 30d cleanup。
- token / session / authorization / secret / password 類 context key 仍會被 redacted。
- span output 包含 `spanName`、`spanStatus`、`traceId`、`spanId`、`durationMs`、`instrumentationScope` 與 `otlpCollector=true`，不輸出 raw exception message。

## 已通過的本地驗證

| 命令 | 結果 | 備註 |
| --- | --- | --- |
| `npm --prefix mobile test -- --runInBand src/platform/telemetry/client.test.js src/platform/telemetry/observability.test.js` | 已通過 | 2 suites / 8 tests passed；覆蓋 OpenTelemetry provider span export、OTLP JSON exporter、safe context redaction、failure span 不暴露 raw message、JS fatal / unhandled promise safe telemetry |
| `npm --prefix backend test -- --runInBand tests/unit/services/app-telemetry.service.test.ts tests/unit/routes/app-telemetry.routes.test.ts` | 已通過 | 2 suites / 10 tests passed；覆蓋 `POST /telemetry/otlp/v1/traces` route contract、span batch limit、OTLP span -> `app_otel_span` safe summary、token redaction、duration / trace context summary |
| `npm --prefix mobile run typecheck` | 已通過 | OpenTelemetry SDK 型別與 App telemetry adapter 無 TypeScript 阻塞 |
| `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer npm --prefix mobile run release:preflight` | 已通過 | 30 suites / 134 tests passed，並通過 accessibility / copy / routes / features / platform boundary / typecheck / Expo web export / web route smoke / Maestro static gate / native readiness / Android readiness / release evidence / evidence redaction + sanitization / external evidence status + contract / handoff check + contract / external fixture contract / external evidence dry-run / external sign-off dry-run / Android sign-off dry-run / prerequisite report contract / workflow contract / env template contract / release completion audit + contract / goal completion audit + contract / release readiness；non-strict audit 仍列出 release sign-off blockers |
| `npm --prefix mobile run release:completion:audit` | 已通過 / not complete report | 已驗證 iOS simulator native Maestro evidence、Android native evidence、native ImagePicker picker-cancel evidence 與本 OpenTelemetry provider evidence；仍列出 EAS / TestFlight / 真機 / provider delivery / native crash runtime / release DB parity blockers |
| `npm --prefix mobile run release:completion:audit:strict` | 預期失敗 | strict mode 已確認 OpenTelemetry provider evidence 在 verified 區塊；失敗原因僅是 11 個 release completion blockers 未清零，外部交接另由 status / handoff report 暴露 13 個 normalized blockers |
| `npm audit --prefix mobile --audit-level=high` | 已通過 / 仍有 low-moderate report | non-force audit 已無 high gate 阻塞；剩餘 5 low / 4 moderate 需要 `npm audit fix --force` 且會降級 / 破壞 `jest-expo` 或 `expo`，本輪不套用 force 修復 |

## 明確未閉環項

以下事項仍不得宣稱已完成：

- native crash SDK configuration first pass 已另行接入；JS fatal / unhandled promise safe telemetry 與 SDK configuration 不等同於 native crash runtime capture。
- 尚未建立 TestFlight crash-free sessions 或長期 crash-free baseline。
- 已接 CJ OTLP JSON trace ingest baseline；尚未接 external tracing backend / vendor collector。
- 尚未取得 physical device / TestFlight 上的 OpenTelemetry provider runtime evidence。
