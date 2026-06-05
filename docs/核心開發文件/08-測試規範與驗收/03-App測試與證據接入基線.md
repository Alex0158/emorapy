# App 測試與證據接入基線

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：測試規範
**覆蓋範圍**：App smoke / regression / CI / evidence 接入前置規則
**取證代碼入口**：`mobile/package.json`、`mobile/app`、`mobile/src/platform`、`mobile/maestro`、`packages/contracts/src`、`packages/api-client/src`、`backend/src/routes`、`backend/prisma/schema.prisma`
**最後核驗 Commit**：`fb2880d`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本文定義 App 測試、回歸、CI 與 evidence 進入正式體系前的基線。它裁決「什麼測試可以證明什麼」，不保存單次執行流水，也不把本地、dry-run、simulator 或 emulator 證據外推為 release sign-off。

當前現碼事實：

1. `mobile/` 已是 Expo / React Native 專案，`mobile/app` 已替換 template tabs，建立 CJ public / authenticated route group 與 M0-M5 普通用戶 screen。
2. `mobile/src/platform` 已建立 API / SecureStore / SSE / upload / notifications / linking / lifecycle / telemetry runtime adapter，native side effect 必須收斂到 platform layer。
3. App 已以 package resolution 消費 `@cj/api-client` 與 `@cj/contracts`，M1-M5 shared domain client、AI stream hook、Deep Link / Push / Upload / Telemetry adapter 與相關 backend route 已成 baseline 接線。
4. M0-M5 普通用戶 App 工程已有 unit / component / static contract / local true-service / simulator / emulator evidence；M6 release sign-off 仍必須以 structured EAS / TestFlight / physical device / provider delivery / production native crash runtime evidence 為準。

## 1. 進場條件

App smoke / regression / CI 進入 `08-測試規範與驗收/`、`測試/` 或 `90-證據與盤點/` 前，必須先滿足以下條件：

1. 對應能力已在 [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md) 找到 screen、navigation 或 platform adapter 落點。
2. 對應 Backend / API / DB / shared package 影響已在 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md) 標清。
3. 若 API、DB、shared enum、Push token、Deep Link、upload 授權或 session restore 尚未閉環，必須更新 [../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md](../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md) 或新增更細待辦。
4. 測試名稱、證據名稱與 case id 必須使用跨端產品能力語義，不得沿用 `Tab One` / `Tab Two` 等模板名稱作正式測試主體。

## 2. 最小測試分層

| 層級 | 覆蓋對象 | 可證明 | 不可替代 |
| --- | --- | --- | --- |
| Static contract | route topology、feature source contract、copy / accessibility / platform boundary | source shape、route / selector / native side-effect 邊界未回退 | runtime flow、native side effect、provider delivery |
| Unit / component tests | adapter helper、screen state、form validation、stream reducer、label helper | 模組行為與 UI 分支符合預期 | connected backend、native lifecycle、真機讀屏 |
| Web export / route smoke | Expo web export 與 App route rendering | route 可掛載、body 非空、基本 web rendering 無阻塞 | native navigation、Deep Link、auth resume runtime |
| Local true-service smoke | local API + local DB 下的 M1-M5 backend-connected flow | API / DB / shared client / App smoke harness 可串接 | staging / production、physical device、provider side effect |
| Simulator / emulator native smoke | iOS simulator、Android emulator、release APK install / launch、Maestro flow | local native build / launch / selector flow 可用 | TestFlight、EAS store artifact、physical device |
| Structured external evidence | EAS iOS / TestFlight、EAS Android、physical device、push provider、native crash runtime、release DB parity、telemetry runtime | release audit 可解析的 pass / blocked 狀態 | 不可由 markdown、console output、dry-run 或 local artifact 替代 |

只有「App screen 可以啟動」不足以宣稱 App parity 完成；必須同時說明它對 API、DB、shared contract、platform adapter 與跨端產品語義的影響。

## 3. 穩定 Gate

| Gate | 證明範圍 |
| --- | --- |
| `npm --prefix mobile run routes:check` | `mobile/app` route topology、layout registrations、protected route hiding 與 template route 防回流 |
| `npm --prefix mobile run features:check` | M0-M5 source contract：screen action、shared API endpoint、SSE / Deep Link / Push / Upload / Telemetry adapter、backend notification / telemetry / push route |
| `npm --prefix mobile run platform:check` | screen / feature 層不得直接調 native Expo side effect，必須經 `mobile/src/platform` |
| `npm --prefix mobile run true-service:check` | true-service smoke harness contract 必須保留 M1-M5 true-service smoke scope、local-only DB-state injection safety 與關鍵 probe contract |
| `npm --prefix mobile run accessibility:check` | App TextInput label / hint static contract |
| `npm --prefix mobile run copy:check` | 普通用戶可見文案不得回退到工程詞、raw backend enum、internal id 或 legacy English screen label |
| `npm --prefix mobile run web:routes:smoke` | App web export route smoke，不替代 native runtime |
| `npm --prefix mobile run maestro:check` | Maestro flow artifact / selector static gate，不替代 native execution |
| `npm --prefix mobile run release:evidence:check` | App release evidence pack 形狀、redaction、引用與 accepted evidence class |
| `npm --prefix mobile run release:completion:audit` | 當前 App release sign-off blocker 盤點與 core docs alignment |

## 4. Roadmap Gate

| Roadmap | 最小測試 / 證據 gate |
| --- | --- |
| M0 Foundation | route topology、provider render、storage / API adapter unit、copy / accessibility / platform boundary |
| M1 Quick + Auth | quick create -> result、session restore、claim-session、expired session handling、`case_judgment` stream replay |
| M2 Profile + Interview | consent、interview start/respond/end、my-story、failed retry、partial success、stream interruption gate |
| M3 Chat | room create、invite accept / auth resume、message stream、request judgment、chat AI draft replay |
| M4 Formal Case + Repair | pairing -> case -> judgment -> repair、evidence upload safety assertion、`repair_track` replan replay |
| M5 Push + Deep Link + Upload + Telemetry | token register / revoke、notification state sync、Deep Link auth resume、upload handoff、safe telemetry ingest |
| M6 Release Hardening | EAS iOS / TestFlight、EAS Android、physical device、provider delivery、native crash runtime、release DB parity、telemetry runtime |

`true-service smoke harness contract` 的穩定能力 id 由 `mobile/scripts/check-app-true-service-smoke-contracts.mjs` 守護；正式文件需保留 `--m1-stream-replay`、`--m1-inject-expired-session`、`--m2-inject-failure`、`--m2-inject-partial-success`、`--request-ai`、`m4.repair_track_replan_stream` 與 `m5.telemetry_ingest` 這些 contract needle，作為 M1-M5 true-service smoke harness 覆蓋範圍索引。這些 id 是 runner 能力契約，不是單次執行流水。

M5 notification 語言驗收還必須覆蓋 backend render 邊界：notification list API 以 request locale render `render_payload.title/body/cta_label`，notification create 在 payload 記錄 target locale，背景 push dispatch 以 payload locale render title/body/fallback。聚焦單測入口為 `backend/tests/unit/services/notification.service.test.ts` 與 `backend/tests/unit/controllers/notification.controller.test.ts`；它們可證明本地 backend render / push message shape，不替代真 provider delivery、APNs sandbox 或真機通知點擊。

## 5. 不得替代

以下情況不能被視為 App 已驗收：

1. Web / Admin Web 單元測試、Playwright 或手動回歸通過。
2. `mobile/` Expo 模板可以啟動。
3. `mobile/src/platform` 只有型別檔存在。
4. App 使用本地 mock DTO 跑通，但沒有對齊 `packages/contracts` 或 `packages/api-client`。
5. App 截圖或錄屏沒有對應可追溯的能力分組、測試步驟、API / DB / shared 影響說明。
6. Expo Go、本地 web export、本機 true-service、simulator / emulator、blocked JSON 或 dry-run runner 存在，被用來替代 TestFlight、EAS build artifact、physical device、provider side-effect 或 production native crash runtime evidence。
7. Web route、Web storage、Web guard 或 Web/Admin gate 通過，被用來替代 App native accessibility、SecureStore、Push、Deep Link、upload 或 lifecycle 驗收。

## 6. True-Service Smoke Safety Gate

`npm --prefix mobile run smoke:true-service` 的預設模式是 dry-run。只有 `--run` 或 `APP_TRUE_SERVICE_SMOKE_RUN=true` 才會打 backend。run mode 必須先通過 safety gate：

1. API URL 必須是 localhost / 127.0.0.1 / ::1；若要打 staging API，必須顯式使用 `--allow-remote-api` 或 `APP_SMOKE_ALLOW_REMOTE_API=true`。
2. 當 API URL 是本機時，腳本會讀取 `backend/.env` 或 process env 的 `DATABASE_URL`，並拒絕 non-local DB；若確定是 staging/sandbox，才可顯式使用 `--allow-remote-db` 或 `APP_SMOKE_ALLOW_REMOTE_DB=true`。
3. dry-run report 中 `blocked: true` 是環境缺口，不是 flow 完成證據；不得用 dry-run 取代真服務 run evidence。
4. `--bootstrap-local-users` 只允許 local API + local DB，會建立暫時 smoke users 並在同一次 run 內重用 token；不得對 staging / production 使用。
5. 若沒有啟動本機 Redis，local backend 可能輸出 metrics / AI stream Redis warning；這只代表 Redis-backed replay / metrics 未在該次 smoke 覆蓋，不可把該次 smoke 說成 production-like runtime parity。

## 7. 證據命名與回寫

新增 App 證據時，必須同時標明：

1. 對應跨端能力組：Auth、Quick、Case、Chat、Profile、Notification、Media、Telemetry。
2. 對應 App screen / adapter。
3. 對應 Backend route / DB schema / shared package，若沒有影響需明確寫「無新增後端/DB/shared 影響」。
4. 測試方式：unit、integration、simulator、device、manual regression、CI、release structured runner。
5. 尚未閉環項：直接鏈接待辦，不得只在證據中口頭保留。

若 App 測試結果暴露產品語義或 schema/runtime 差異，必須回寫 `00-跨端產品核心/`、`20-App端/`、`50-跨端Mapping與Parity/` 或 `07-待處理問題與治理/待處理/`，不能只留在測試證據中。

## 8. Release Evidence 邊界

| Evidence class | Accepted shape | 不得替代 |
| --- | --- | --- |
| EAS iOS / TestFlight | `App-EAS-iOS-Release-*.json`，run mode，iOS store production build，必要時 App Store Connect TestFlight query pass | `.ipa` path、raw build id、blocked JSON、手寫 markdown |
| EAS Android | `App-EAS-Android-Release-*.json`，run mode，Android store production build，package / version / versionCode match | local APK、emulator smoke、blocked JSON、手寫 markdown |
| Physical device | `App-Physical-Device-*.json`，真機、platform readiness、App runtime launch、M0 Maestro smoke | simulator UDID、offline device、blocked JSON |
| Push provider delivery | `App-Push-Delivery-*.json`，run mode，Expo / APNs ticket accepted、receipt checked、receipt ok | local token sync、notification UI unit test、blocked JSON |
| Native crash runtime | `App-Native-Crash-Runtime-*.json`，production environment、Sentry event found、native runtime signal、crash-like event、`blocked=false` | native crash SDK configuration、development event、TestFlight crash-free sessions |
| Release DB parity | `App-Release-DB-Parity-*.json`，release / production target、non-local DB、required migrations ok | local DB、staging DB、raw console output |
| Telemetry runtime | `App-Telemetry-Runtime-*.json`，non-local release backend version alignment、event ingest、OTLP ingest | local telemetry unit test、external tracing backend plan |

當前 release completion blockers 由 [../07-待處理問題與治理/待處理/App外部ReleaseSignoff待辦-2026-05-16.md](../07-待處理問題與治理/待處理/App外部ReleaseSignoff待辦-2026-05-16.md) 與 `npm --prefix mobile run release:completion:audit` 承接。release DB parity 與 telemetry runtime 已有 pass evidence 時，不再作當前 completion blocker；若後續新增 release-blocking migration 或改動 backend telemetry/version runtime，必須重新取證。

## 9. 證據索引

App release hardening evidence、external status / handoff、manual runbook、blocked diagnosis 與 pass JSON 入口統一見 [../90-證據與盤點/環境與發版驗證/README.md](../90-證據與盤點/環境與發版驗證/README.md)。

本文件只保留長期有效的測試與證據接入規則；單次命令輸出、機型、耗時、artifact 檔名與歷史修復過程不在本規範正文展開。
