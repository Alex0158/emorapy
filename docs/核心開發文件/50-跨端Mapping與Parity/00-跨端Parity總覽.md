# 跨端 Parity 總覽

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：跨端映射
**覆蓋範圍**：跨端能力到 Web / App / Backend / API / DB / 共享層的映射與缺口總覽
**取證代碼入口**：`backend/src/routes`、`backend/prisma/schema.prisma`、`frontend/src/router/index.tsx`、`frontend-admin/src/router.tsx`、`mobile/app`、`mobile/tsconfig.json`、`mobile/src/platform`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 定位

Parity 文件不重新定義產品功能或 PRD 需求，而是追蹤同一產品能力在不同平台的落地狀態。上游產品意圖與成功指標回到 `00-跨端產品核心/01-產品PRD總章.md` 與 `00-跨端產品核心/03-成功指標與產品健康.md`。

狀態口徑固定如下：

| 狀態 | 定義 |
| --- | --- |
| 已落地 | 對應端已有可用代碼與可追溯 API / 頁面 / 流程 |
| 待承接 | 產品核心存在，Web 已有或 backend 已有，但 App 尚未實作 |
| 平台差異 | 產品語義一致，但平台實作不同，例如 browser route vs Deep Link |
| 待裁決 | 需要產品或工程決策，不能由單端文件自行裁定 |
| 不承接 | 明確裁決該端不提供此能力，例如 Admin Web 不進普通 App |

## 2. 能力 Parity 矩陣

| 能力組 | Backend / DB | Web | Admin Web | App | Parity 裁決 |
| --- | --- | --- | --- | --- | --- |
| 快速判斷 | 已有 quick session / case / judgment 相關接口與 schema | 已落地 | 不承接普通用戶入口 | 部分承接 | App M1 baseline 已承接 quick、同機 collaborative quick、anonymous session recovery / result access cleanup、`case_judgment` stream replay、Quick result AppState reconnect 與 claim handoff；必須復用 quick / session / case 語義，native stream reconnect 的 release 級證據仍屬 M6 |
| 正式處理 | 已有 auth / pairing / case / judgment / reconciliation / execution 能力；formal case safety assertion 為 backend additive support | 已落地；正式案件安全聲明 create UX 未暴露 | 可治理與查看相關資料 | 部分承接；正式案件安全聲明 create UX 未暴露 | App M4 baseline 已承接 Case / Repair screen、formal evidence upload、repair replan stream、repair plan select / execution confirm 與 DB-backed replay；shared `CreateCaseDto` 尚未暴露 formal case safety assertion，由待辦追蹤；不得改 backend 狀態機，native selected-media、native reconnect 與 repair 全狀態 release 證據仍屬 M6 |
| 先聊再判 | Branch 已有 channel、context policy、capsule、exact approval、participant stream 與 `analysis_request_id` handoff；migration/backfill 未發布 | Branch 已有 private/shared lane、preference、capsule 與 exact review/approval | 可治理相關風險與成本 | Branch M3 已接 shared contracts、lane、capsule、approval 與 handoff | Web/App/Backend branch parity 已接線並有 focused tests；目標 DB migration/backfill、雙身份真服務 E2E、native lifecycle/replay、release gate 與 Production deploy 仍是 P0 parity gap |
| 讓系統更懂你 | 已有 interview / psych profile / profile 能力 | 已落地 | 可治理與查看必要平台資料 | 部分承接 | App M2 baseline 已承接 Profile / Interview / My Story、consent、AI stream replay/recovery、failed retry UI、feedback summary 與 My Story completion；schema 不分叉，native interruption / failed-session lifecycle release 證據仍屬 M6 |
| 通知與提醒 | 已有 notification / content / media provider 相關能力 | 已落地 | 部分承接；content / media / report 類治理入口已存在，admin notification governance 後端端點待 Frontend Admin 承接 | 部分承接 | App M5 baseline 已承接 in-app notification、read/snooze/act sync、Deep Link resolver、post-login resume、push token registration / revoke / logout cleanup、backend Expo sender / dispatch / receipt polling 與 upload/telemetry adapters；真 provider delivery、真機 cold-start notification response 與 native crash runtime 證據仍屬 M6 |
| 平台治理 | 已有 admin / health / metrics / version / release gate 能力 | 部分入口 | 已落地 | 不承接 | App 不做 Admin Web；只回傳必要 telemetry / error context |

## 2.1 完整 App Roadmap Parity

完整 App 版以 [../20-App端/02-App完整版本工程PRD.md](../20-App端/02-App完整版本工程PRD.md) 與 [../20-App端/03-App完整版本開發Roadmap.md](../20-App端/03-App完整版本開發Roadmap.md) 為主控。當前文件口徑是：M0-M5 普通用戶 App 工程 baseline 已能由 `mobile/app`、`mobile/src/platform`、`packages/api-client`、`packages/contracts` 與 backend route / schema 對應到實作；M6 release sign-off 仍是完整 App 完成條件。`release DB parity`、`telemetry runtime`、EAS Android production artifact、Android emulator / app / full-flow runtime evidence 與 native ImagePicker upload evidence 是 release audit 已具備的證據槽，但 backend schema、version、telemetry runtime 路徑、Android remote build identity 或 native package identity 變動後必須刷新。完整完成仍取決於 Apple / App Store Connect non-placeholder credentials、EAS iOS production artifact、TestFlight、Emorapy identity 下 iOS Release simulator evidence refresh、trusted physical device、provider delivery 與 native crash runtime evidence。

| Roadmap | 承接能力 | Web / Backend 對照 | Parity 狀態 |
| --- | --- | --- | --- |
| M0 Foundation | workspace、App shell、providers、API adapter、SecureStore、smoke | Web request / storage adapter、backend auth/session gate、shared transport | Baseline implemented；shell、provider、adapter、auth/session bootstrap、root error boundary 與 route / feature / platform gate 已具備；真機 side-effect evidence 歸入 M6 |
| M1 Quick + Auth | anonymous session、quick case、collaborative quick、result、claim、login/register | F01 / F02 / F09、session / case / judgment / auth routes | Baseline implemented / Auth recovery gap；Quick/Auth screen、shared domain client、collaborative quick、session recovery、result replay、claim handoff 已具備；Backend / shared client / Web reset-password 已存在，但 App forgot-password screen 尚未承接，見 [../07-待處理問題與治理/待處理/AppAuthRecoveryResetPassword未承接待辦-2026-05-31.md](../07-待處理問題與治理/待處理/AppAuthRecoveryResetPassword未承接待辦-2026-05-31.md)；真機 stream reconnect evidence 歸入 M6 |
| M2 Profile + Interview | profile shell、consent、SSE interview、result、my-story | F06 / F08 / F09、profile / interview / psych profile routes | Baseline implemented；Profile/Interview/My Story、AI stream replay/recovery、retry UI、feedback summary 與 My Story completion 已具備；真機 interruption / recovery evidence 歸入 M6 |
| M3 Chat | room、invite、private/shared channel、participant-scoped stream、capsule、versioned request approval、handoff | F07 / F04、chat / AI stream / judgment/repair context routes | Branch baseline implemented / release-blocked；Web/App 已接 channels、lanes、preference、capsule、exact source review、雙方 approval、submit 與 `analysis_request_id` handoff；migration/backfill、雙身份真服務、native replay/lifecycle、release DB parity 與 Production deploy 未完成 |
| M4 Formal Case + Repair | pairing、case、judgment、reconciliation、execution | F03 / F04 / F05 / F08、case / judgment / repair routes | Baseline implemented；Case/Repair、formal evidence upload、repair plan select / execution confirm、repair stream replay 與 DB-backed replay 已具備；真機 selected-media / reconnect / canonical dashboard evidence 歸入 M6 |
| M5 Push + Deep Link | device token、notification landing、read/snooze/act sync | notification routes、content、Deep Link target rules、push device token schema/API、App telemetry safe ingest / persistence / report | Baseline implemented；notification sync、Deep Link handlers、post-login resume、push token lifecycle、backend sender / dispatch / receipt polling、upload FormData 與 safe telemetry 已具備；provider delivery、真機 cold-start landing 與 native crash runtime evidence 歸入 M6 |
| M6 Release Hardening | iOS TestFlight、EAS Update、Android readiness、evidence | release gate、version、telemetry、App evidence | Release-blocked；release preflight、readiness、evidence verifier、handoff / prerequisite / workflow / env / redaction gates 可作工程基線，EAS project id、Expo token、Android native toolchain、EAS Android artifact、Android emulator / app / Maestro 與 native ImagePicker evidence 已具備；完整 sign-off 仍缺 Apple / ASC non-placeholder credentials、EAS iOS artifact、TestFlight、Emorapy identity 下 iOS Release simulator evidence refresh、physical device、push delivery 與 native crash runtime evidence |

## 3. API 與共享層映射

| 類型 | 當前狀態 | App 開發要求 |
| --- | --- | --- |
| `packages/contracts` | Web / Admin Web 局部消費，backend 使用 declaration artifact，App 透過 package resolution 消費型別 | App 正式功能不得手寫分叉 DTO，應逐步消費 contracts |
| `packages/api-client` | 已有 transport baseline；M1-M5 domain client 與 AI stream pure helper 已下沉，主站 Web 透過 `frontend/src/services/api/*` / `frontend/src/utils/aiStreamState.ts` 消費，App screen 透過 platform adapter 消費 | Web / App 新增 API shape 不得回到 screen 直寫 fetch；先更新 shared client / contracts，再接 Web adapter 或 App platform adapter |
| `backend/src/routes` | 是 API 事實來源 | App 不得建立繞過 backend 的業務資料通道 |
| `backend/prisma/schema.prisma` | 是 DB schema 事實來源 | App 新需求若要新增持久化欄位，必須先成為 schema / migration 待辦 |
| `frontend/src/router/index.tsx` | 是 Web 用戶端路由事實來源 | App route 只作對照，不直接複製 browser guard |
| `frontend-admin/src/router.tsx` | 是 Admin Web 路由事實來源 | App 普通版不承接 Admin Web |
| `mobile/app` | 已有 Emorapy App route group 與 M0-M5 普通用戶 screen，含 `(public)`、`(app)`、quick、quick/collaborative、auth、case、chat、profile、notifications、repair、modal | 可作 App 普通用戶主流程入口；完整完成仍以 M6 strict release sign-off 為準 |
| `mobile/src/platform` | 已有 API / SecureStore / SSE / upload / notifications / linking / lifecycle / telemetry adapter | 可作 App runtime adapter 基線；Push delivery、selected-media upload、SSE native runtime 與 production native crash runtime 的完整驗收仍需 M6 external evidence；長期 crash-free / external tracing baseline 屬 post-release / SLO baseline |

### 3.1 Web 配合要求

完整 App 版需要 Web 配合的是共享層收斂，不是改變 Web 對外行為：

| 配合項 | 來源 | 目標 |
| --- | --- | --- |
| Domain API client | `frontend/src/services/api/*`、`packages/api-client/src` | auth / session / quick / profile / interview / case / chat / judgment / reconciliation / execution / notification / media upload API shape 已下沉到 `packages/api-client`，主站 Web wrapper 保留 public exports 與平台 side effect seam |
| Error / response normalize | `frontend/src/services/request.ts`、`packages/contracts/src/common.ts` | 形成 Web / App 共用 error code、request id、retry 語義 |
| AI stream reducer | `frontend/src/services/aiStream.ts`、`frontend/src/utils/aiStreamState.ts`、`mobile/src/platform/sse/aiStreamState.ts`、`packages/api-client/src/aiStreamState.ts`、`packages/contracts/src/ai-stream.ts` | Web draft reducer、App snapshot selector、terminal status/event helper 與 phase append helper 已下沉到 `@emorapy/api-client`；平台各自處理 lifecycle / headers / token / locale / storage / AbortController；`npm --prefix packages/api-client run test:ai-stream-state` 防 Web / App pure-logic 分叉 |
| Upload handoff | Web evidence / profile upload service、`mobile/src/platform/upload` | 共用 API contract，平台各自處理 picker / FormData |
| Pure domain helper | 現有 Web utils 中平台無關部分 | 後續可進 packages/domain，需先建包與 ADR，不得引入 React DOM / React Native / router / storage |

Web shared API client 收斂的細節與一次性證據歸檔在 `07-待處理問題與治理/已處理/`。本文件只保留穩態裁決：Web 已消費 `@emorapy/api-client` 的 M1-M5 platform-neutral domain method 與 AI stream pure helper，但不得把 Web 的 toast、router、storage、quick session mutation、request cancel registry、SSE/fetch lifecycle 或 Admin redirect 下沉到 shared package。若後續新增 domain 暫不遷移，必須在對應待辦或 ADR 記錄原因、風險與下一次驗收 gate。

## 4. 必須主動記錄的差異

以下情況一律要新增待處理任務，並在本文件或後續子文件中回鏈：

1. App 需要新增或修改 DB schema。
2. App 需要新增 API 或修改既有 response shape。
3. App 對 auth/session/token refresh 的策略與 Web 不同。
4. App 對 Push、Deep Link、media、permission 的需求會影響 backend。
5. Web 凍結基線與跨端產品核心發生衝突。
6. 共享 contracts / api-client / domain logic 的消費狀態與文件描述不一致。
7. 某端已實作、另一端未實作，但產品目標要求一致。

## 5. 當前 App 缺口清單

| 缺口 | 分類 | 後續處理 |
| --- | --- | --- |
| App 已消費 `@emorapy/api-client`，M1-M5 domain client 已下沉；M6 release config、safe telemetry ingest / minimized persistence / Admin report / 30d cleanup、App-side OpenTelemetry provider baseline 與 native crash SDK configuration baseline 已接入 | 共享層 Parity | 補 Apple / ASC non-placeholder credentials、EAS iOS / TestFlight、Emorapy identity 下 iOS Release simulator evidence refresh、physical device、provider delivery / native crash runtime，並在 strict audit pass 後再宣稱 release 完成；release DB parity / telemetry runtime / Android local runtime evidence 在 backend schema、version、telemetry runtime 或 native package identity 變更後需刷新 |
| `mobile/app` 已替換模板 tabs，M0-M5 普通用戶 screen 與對應驗收入口已具備；native 主產品 flow 的 release 級驗收仍依賴 M6 evidence | 功能 Parity | 按 M6 補 EAS、TestFlight、physical device、provider delivery、native crash runtime 與 evidence，不用 placeholder、dry-run、partial run 或 mock-backed flow 宣稱完成 |
| `mobile/src/platform/storage` 已有 SecureStore runtime adapter、unit gate 與 auth/session bootstrap；cold start token / session restore 需由 physical device 或 TestFlight 補 release 級證據 | 平台差異 | 補 native auth/session restore smoke 或納入 physical device release evidence |
| `mobile/src/platform/notifications` 已有 permission / push token helper，Push token registration / revoke、logout cleanup、registration-time token rotation revoke 與 notification landing handler 已接 backend schema/API / App route resolver；backend Expo push sender、dispatch job 與 receipt polling job 已接線；仍缺真 provider delivery / APNs sandbox 與真機 cold-start 證據 | 平台差異 + backend 影響 | 補 Expo/APNs provider delivery evidence、真機 landing evidence 與 provider lifecycle evidence 任務 |
| `mobile/src/platform/upload` 已有 ImagePicker lazy load / picker status / evidence FormData adapter 與 web/native branch；真機 picker-selected asset / profile media 未驗收 | 平台差異 + backend 影響 | 補真機 selected-media picker、profile media upload native evidence 與 media provider authorization evidence |
| Deep Link 授權失敗回退已建立 notification landing、non-notification handler、auth-gate 與 auth-resume flow，但仍缺真機入口證據 | 平台差異 | 補 native cold-start / foreground Deep Link evidence 與 Maestro native execution 任務 |
| App native 測試與 smoke gate 已建立，但 release 級外部 evidence 未清零 | 工程治理 | `release:preflight`、Maestro、Android/iOS simulator/emulator、external status / handoff / prerequisite report gates 可作工程基線；仍需跑通 App strict release completion gates（`release:completion:audit:strict` / `goal:completion:audit:strict`） |
| 完整 App PRD / Roadmap 已裁決，M0-M5 runtime baseline 已具備，M6 strict release sign-off 未完成 | 文檔完成 / runtime 推進中 | 所有後續順序調整仍需同步 App / Parity / RTM / 待辦；完整 App release completion 只能在 strict audits pass 後宣稱 |

## 6. 關聯正文

1. App screen 分組到 Web / Backend / API / DB / shared packages 的細映射，見 [01-App首輪能力與工程落點Mapping.md](./01-App首輪能力與工程落點Mapping.md)。
2. App navigation 與 platform adapter 落點規則，見 [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md)。
3. App 測試、回歸、CI 與證據接入規則，見 [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md)。
4. App 尚未落地的治理任務，見 [../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md](../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md)。
