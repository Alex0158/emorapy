# App 端

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：20-App端 子域入口與閱讀順序
**取證代碼入口**：`mobile/package.json`、`mobile/tsconfig.json`、`mobile/app/_layout.tsx`、`mobile/app/modal.tsx`、`mobile/src/platform`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-08`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本目錄是 App 版開發入口。App 版以現有 `mobile/` Expo 專案為承載位置，與 Web 共用產品核心、後端 API、DB schema 與共享 contracts 方向。

目前 App 已完成開發前工程 PRD 與 Roadmap 裁決：正式採用 Expo + React Native + TypeScript，iOS 優先、Android 兼容、單一 `mobile/` codebase。2026-05-08 已完成 M0-M5 首輪工程接線並進入 M6 外部發版證據階段：`mobile/app` 已從 Expo template tabs 轉為 CJ route group 與普通用戶業務 screen，`mobile/src/platform` 已建立 API / SecureStore / SSE / upload / notifications / linking / lifecycle / telemetry runtime adapter，M0 provider render、auth/session bootstrap、root error boundary 與 upload / notifications / lifecycle adapter branch tests 已有首輪 gate，M1 Quick/Auth、同機雙人 Quick 協作路由、Quick result pending polling、`case_judgment` stream replay / ready snapshot fallback、Quick result AppState background abort / foreground `afterSeq` reconnect、過期 anonymous session recovery 與 result access cleanup、M2 Profile/Interview、M3 Chat 及 M4 Repair replan 已接 App AI stream subscription hook（`after_seq` replay、ready snapshot、close/error retry、screen-level AppState 前後台中斷恢復 gate），M3 invite accept 未登入 auth resume 與 notification invite landing path 映射已接入，M4 Case/Repair 與 M5 Notification/Deep Link/Upload/Telemetry shared client 及 App screen / adapter 已接線，M0-M5 Maestro flow artifact 與 selector static gate 已建立，M1-M5 true-service smoke harness 已建立 dry-run / safety gate，並已在本機隔離 Postgres + local backend + `--bootstrap-local-users` 下跑通 M1 claim-session、M2 `--deep` 5-turn interview / my-story completion、M3 `--request-ai` judgment、M4 `--request-ai` formal evidence upload / repair plan select / execution confirm / live replan stream persisted / backend restart 後 DB-backed replay 與 M5 notification state sync / evidence upload / telemetry ingest；AI stream persistence migration 已補齊 `ai_stream_sessions` / `ai_stream_events` / archive tables，AI stream backend 已補 live subscription race gate、live DB replay / snapshot fallback 且 SSE endpoint 已禁用 compression，M2 interview facts migrations 已補齊 `interview_sessions.collected_facts` / `interview_turns.extracted_facts`，M5 notification action metadata migration 已補齊 read / snooze / dismiss / act state 欄位，Push device token registration / revoke / logout cleanup / registration-time token rotation revoke 已有 backend schema/API/client 與 App token sync，backend Expo push sender / pending dispatch / receipt polling job 已接線，App telemetry 已接 non-blocking `POST /api/v1/telemetry/events` safe ingest、`POST /api/v1/telemetry/otlp/v1/traces` CJ OTLP JSON trace ingest、backend 二次清洗 structured log、最小化 persistence、Admin 聚合報表與 30d cleanup，App observability bootstrap 已接 session start、lifecycle transition、global JS fatal / unhandled promise、OpenTelemetry provider span export 與 native crash SDK configuration first pass，notification landing handler 已能處理 last notification response 與 foreground response target，非通知 Deep Link handler 已能處理 cold-start / foreground `cj://` 入口，未登入受保護 target 會保存安全 App href 並在登入後 resume，M6 release config / EAS profile / readiness script、iOS simulator native Maestro 7/7 evidence、Android SDK/toolchain readiness、Android emulator boot smoke、Android release APK install/launch smoke、Android Maestro 7/7 flow evidence、release / production DB parity evidence 與 telemetry runtime evidence 已建立。這代表 App foundation、M1-M5 普通用戶主流程首輪工程與本機 true-service probes 已落地；完整 `/goal` completion 仍需 M6 strict release sign-off，包含 EAS/TestFlight、physical device、真 provider delivery、native crash runtime 與長期 crash-free / external tracing 證據。

## 閱讀順序

1. [00-App端總覽.md](./00-App端總覽.md)
2. [01-App導航與平台Adapter基線.md](./01-App導航與平台Adapter基線.md)
3. [02-App完整版本工程PRD.md](./02-App完整版本工程PRD.md)
4. [03-App完整版本開發Roadmap.md](./03-App完整版本開發Roadmap.md)
5. [../00-跨端產品核心/00-跨端產品核心總覽.md](../00-跨端產品核心/00-跨端產品核心總覽.md)
6. [../00-跨端產品核心/01-產品PRD總章.md](../00-跨端產品核心/01-產品PRD總章.md)
7. [../00-跨端產品核心/03-成功指標與產品健康.md](../00-跨端產品核心/03-成功指標與產品健康.md)
8. [../10-Web端/00-Web端凍結基線總覽.md](../10-Web端/00-Web端凍結基線總覽.md)
9. [../50-跨端Mapping與Parity/00-跨端Parity總覽.md](../50-跨端Mapping與Parity/00-跨端Parity總覽.md)
10. [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)
11. [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md)

## 維護規則

1. App 端文件只能描述 `mobile/` 的平台投影與原生差異。
2. App 不另建獨立產品規則；跨端 PRD 需求、成功指標與產品能力以 `00-跨端產品核心/` 為準。
3. App 尚未實現但 Web 已存在的能力，先記入 Parity 缺口，不在 App 文件中假裝已完成。
4. `mobile/app` 的 CJ route group 與 M0-M5 screen 已可作首輪普通用戶 App flow 入口；是否可宣稱完整完成，仍以 Roadmap 對應 true-service、native evidence 與 M6 strict release sign-off 為準。
5. `mobile/src/platform` 的 runtime adapter 只能證明平台副作用已有收斂入口；SecureStore / API / Deep Link / upload / telemetry / notification landing 已有首輪 unit / simulator / emulator gate，且 telemetry safe ingest / OTLP JSON trace ingest / persistence / Admin report / 30d cleanup / App JS fatal first pass / native crash SDK configuration、release / production DB parity 與 telemetry runtime evidence 已有 contract / structured gate，但未有 physical device 與 production native crash runtime evidence 前，不得當作 Push delivery、selected-media upload、SSE native runtime 或 crash-free telemetry 已完整驗收；external tracing backend 與長期 crash-free / SLO 屬 post-release baseline pending。後續若新增 release-blocking migration，仍需重新產生 fresh release DB parity evidence。
6. App 對 DB schema、API contract、Push、Deep Link、SecureStore 的需求若影響 Web 或 backend，一律同步建立待處理任務。
7. App screen 或 adapter 進入實作前，必須先在 `50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md` 補齊 Backend / API / DB / shared package 對照與缺口裁決。
8. App smoke / regression / CI 或證據留存進場前，必須先符合 `08-測試規範與驗收/03-App測試與證據接入基線.md`；不得用 Expo 模板可啟動或 Web/Admin 測試通過替代 App 驗收。
9. App 開發順序固定以 `03-App完整版本開發Roadmap.md` 的 M0-M6 為主控；若需要調整順序，必須同步更新 Roadmap、Parity、待辦與 RTM。
