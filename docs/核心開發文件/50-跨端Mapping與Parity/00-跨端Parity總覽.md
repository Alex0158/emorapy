# 跨端 Parity 總覽

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：跨端映射
**覆蓋範圍**：跨端能力到 Web / App / Backend / API / DB / 共享層的映射與缺口總覽
**取證代碼入口**：`backend/src/routes`、`backend/prisma/schema.prisma`、`frontend/src/router/index.tsx`、`frontend-admin/src/router.tsx`、`mobile/app`、`mobile/tsconfig.json`、`mobile/src/platform`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`1295216`
**最後核驗日期**：`2026-05-25`
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
| 快速判斷 | 已有 quick session / case / judgment 相關接口與 schema | 已落地 | 不承接普通用戶入口 | 部分承接 | App 已接 quick、同機 collaborative quick、過期 anonymous session recovery / result access cleanup、result `case_judgment` stream replay、Quick result AppState reconnect gate、claim handoff 與 true-service smoke dry-run 入口；本機隔離 Postgres `--run --scope=all --bootstrap-local-users` 已通過 anonymous quick / judgment poll / claim-session，iOS simulator native quick/auth smoke 已通過。必須復用 quick/session/case 語義，native stream reconnect 真機證據待驗收 |
| 正式處理 | 已有 auth / pairing / case / judgment / reconciliation / execution 能力 | 已落地 | 可治理與查看相關資料 | 部分承接 | App 已接 Case / Repair screen、repair replan stream、Repair screen AppState reconnect gate、Case/Repair auth-gate Maestro flow artifact 與 M4 true-service smoke 入口；本機隔離 Postgres `--run --scope=m4 --bootstrap-local-users --request-ai` 已通過 pairing / case / formal evidence upload / judgment / execution / repair plan generation / plan select / execution confirm / live replan stream persisted，並已驗證 backend restart 後 `repair_track` DB-backed `after_seq` replay；iOS simulator native smoke 已通過，native evidence / native reconnect / repair 全狀態仍待補，不改 backend 狀態機 |
| 先聊再判 | 已有 chat / message / AI orchestration / handoff 能力 | 已落地 | 可治理相關風險與成本 | 部分承接 | App 已接 Chat Home / Room / Invite、room event stream、chat-room AI draft replay/recovery hook、Chat Room AppState reconnect gate、invite accept 未登入 auth resume、notification invite landing path 映射、Chat entry/auth-gate Maestro flow artifact 與 M3 smoke 入口；本機隔離 Postgres `--run --scope=m3 --bootstrap-local-users --request-ai` 已通過 room/message/invite/list/status、partner accept 與 request-judgment，iOS simulator native smoke 已通過；native reconnect / true push invite landing 待驗收，轉判決規則需保持一致 |
| 讓系統更懂你 | 已有 interview / psych profile / profile 能力 | 已落地 | 可治理與查看必要平台資料 | 部分承接 | App 已接 Profile / Interview / My Story、Interview AI stream replay/recovery hook、Interview screen AppState reconnect gate、Profile/Interview/Story protected auth-resume Maestro flow artifact 與 M2 smoke 入口；本機隔離 Postgres `--run --scope=m2 --bootstrap-local-users --deep` 已通過 profile / consent / 5-turn interview start/respond/background response/end / my-story completion（pipeline step、profile narratives、feedback history card），failed retry UI 與 feedback-card summary 已有 RNTL gate，iOS simulator native auth-resume smoke 已通過；native interruption / failed-session lifecycle 待驗收，schema 不分叉 |
| 通知與提醒 | 已有 notification / content / media provider 相關能力 | 已落地 | 已有治理入口 | 部分承接 | App in-app notification / read-snooze-act / Deep Link resolver / notification landing handler / non-notification Deep Link handler / post-login resume 與 notification / deep-link auth-resume Maestro flow artifact 已接線；Chat invite notification path 已可安全落到 invite landing 且不接受 direct accept path；Push token registration / revoke / logout cleanup 已有 backend/schema/API 與 App 接線，backend Expo push sender / dispatch / receipt polling job 已接線，M5 local true-service smoke 已通過 notification state sync / upload / telemetry probes，iOS simulator custom-scheme native smoke 已通過；真 provider delivery / 真機 cold-start notification response 證據待補 |
| 平台治理 | 已有 admin / health / metrics / version / release gate 能力 | 部分入口 | 已落地 | 不承接 | App 不做 Admin Web；只回傳必要 telemetry / error context |

## 2.1 完整 App Roadmap Parity

完整 App 版以 [../20-App端/02-App完整版本工程PRD.md](../20-App端/02-App完整版本工程PRD.md) 與 [../20-App端/03-App完整版本開發Roadmap.md](../20-App端/03-App完整版本開發Roadmap.md) 為主控。當前狀態是「Expo + React Native + TypeScript 技術路線已裁決，M0-M5 普通用戶 App 工程已落地，`goal:completion:audit` 對 stack、iOS-first / Android-compatible、M0 Foundation、M1 Quick/Auth、M2 Profile/Interview、M3 Chat、M4 Formal Case/Repair、M5 Push/Deep Link/Upload/Telemetry、UI/UX accessibility、測試 gate 與核心文件回寫均為 passed；M6 本地 release hardening 已建立 release preflight、EAS/TestFlight/Android/physical device/push/native crash/release DB structured evidence runner、external status / handoff / prerequisite report / redaction / sanitization / workflow contract 與 current blocker snapshot。完整 `/goal` completion 仍被 `release_signoff` 阻擋，strict audit 只接受真實 EAS project id、Expo / Apple / App Store Connect credentials、EAS iOS/Android production artifact、TestFlight、trusted physical device、provider delivery、native crash runtime 與 release / production DB parity pass evidence」。

| Roadmap | 承接能力 | Web / Backend 對照 | Parity 狀態 |
| --- | --- | --- | --- |
| M0 Foundation | workspace、App shell、providers、API adapter、SecureStore、smoke | Web request / storage adapter、backend auth/session gate、shared transport | 本地完成；shell / adapter / web smoke / storage+API adapter unit / provider render / auth-session bootstrap / root error boundary / upload+notifications+lifecycle adapter branch tests、iOS simulator native launch smoke 與 route / feature / platform gate 已通過；真機 side-effect evidence 歸入 M6 release sign-off |
| M1 Quick + Auth | anonymous session、quick case、collaborative quick、result、claim、login/register | F01 / F02 / F09、session / case / judgment / auth routes | 本地完成；shared domain client、Quick/Auth screen、同機 collaborative quick、session recovery、expired cleanup、pending polling、`case_judgment` stream replay、Quick result AppState reconnect、claim failure handoff、RNTL、mock backend smoke、true-service bootstrap probes 與 iOS simulator native quick/auth smoke 已通過；真機 stream reconnect evidence 歸入 M6 |
| M2 Profile + Interview | profile shell、consent、SSE interview、result、my-story | F06 / F08 / F09、profile / interview / psych profile routes | 本地完成；Profile/Interview/My Story screen、AI stream subscription hook、auth-resume Maestro artifact、failed retry UI、feedback-card summary、5-turn true-service deep interview / my-story completion 與 iOS simulator native smoke 已通過；真機 recovery evidence 歸入 M6 |
| M3 Chat | room、invite、message stream、chat-room AI draft、request judgment、handoff | F07 / F04、chat / AI stream / judgment handoff routes | 本地完成；Chat Home / Room / Invite screen、room event stream parser、AI draft replay/recovery、AppState reconnect、invite accept auth resume、notification invite landing、Chat Maestro artifact、本機 true-service request-judgment probe 與 iOS simulator native smoke 已通過；true push invite landing / 真機 stream reconnect evidence 歸入 M6；不得改 chat visibility / handoff 規則 |
| M4 Formal Case + Repair | pairing、case、judgment、reconciliation、execution | F03 / F04 / F05 / F08、case / judgment / repair routes | 本地完成；Case/Repair screen、safety assertion handoff、formal evidence upload true-service smoke、repair plan select / execution confirm、`repair_track` stream persisted / backend restart DB-backed replay、auth-gate Maestro artifact 與 iOS simulator native smoke 已通過；真機 selected-media / reconnect / canonical dashboard evidence 歸入 M6 |
| M5 Push + Deep Link | device token、notification landing、read/snooze/act sync | notification routes、content、Deep Link target rules、push device token schema/API、App telemetry safe ingest / persistence / report | 本地完成；Notifications screen、target resolver、notification / non-notification Deep Link handlers、post-login resume、read/snooze/act sync、upload FormData、safe telemetry、OTLP JSON ingest、Admin report、30d cleanup、device token registration / revoke / logout cleanup、backend Expo sender / dispatch / receipt polling、M5 true-service smoke、custom-scheme simulator smoke、OpenTelemetry provider first pass 與 native crash SDK configuration evidence 已通過；provider delivery、真機 cold-start landing 與 native crash runtime evidence 歸入 M6 |
| M6 Release Hardening | iOS TestFlight、EAS Update、Android readiness、evidence | release gate、version、telemetry、App evidence | 本地 hardening 完成但 strict sign-off 未完成；app identity、runtimeVersion、EAS profiles、release readiness、iOS simulator Release build、native Maestro 7/7、Android toolchain / emulator / APK / Maestro evidence、release evidence verifier、external status / handoff / prerequisite / workflow / env / redaction gates 已通過；仍缺真實 EAS project id、Expo / Apple / ASC credentials、EAS iOS/Android artifact、TestFlight、physical device、push delivery、native crash runtime 與 release / production DB parity pass evidence |

## 3. API 與共享層映射

| 類型 | 當前狀態 | App 開發要求 |
| --- | --- | --- |
| `packages/contracts` | Web / Admin Web 局部消費，backend 使用 declaration artifact，App 透過 package resolution 消費型別 | App 正式功能不得手寫分叉 DTO，應逐步消費 contracts |
| `packages/api-client` | 已有 transport baseline；M1-M5 domain client 與 AI stream pure helper 已下沉，主站 Web 已透過 `frontend/src/services/api/*` / `frontend/src/utils/aiStreamState.ts` 消費，App screen / true-service probes 也已消費 | Web / App 新增 API shape 不得回到 screen 直寫 fetch；先更新 shared client / contracts，再接 Web adapter 或 App platform adapter |
| `backend/src/routes` | 是 API 事實來源 | App 不得建立繞過 backend 的業務資料通道 |
| `backend/prisma/schema.prisma` | 是 DB schema 事實來源 | App 新需求若要新增持久化欄位，必須先成為 schema / migration 待辦 |
| `frontend/src/router/index.tsx` | 是 Web 用戶端路由事實來源 | App route 只作對照，不直接複製 browser guard |
| `frontend-admin/src/router.tsx` | 是 Admin Web 路由事實來源 | App 普通版不承接 Admin Web |
| `mobile/app` | 已有 CJ App route group 與 M0-M5 普通用戶 screen，含 `(public)`、`(app)`、quick、quick/collaborative、auth、case、chat、profile、notifications、repair、modal | 可作 App 普通用戶主流程入口；完整完成仍以 M6 strict release sign-off pass evidence 為準 |
| `mobile/src/platform` | 已有 API / SecureStore / SSE / upload / notifications / linking / lifecycle / telemetry adapter，且 SecureStore / API / SSE transport / AI stream subscription / upload / notifications / linking / lifecycle / telemetry 已有 unit / simulator / emulator / true-service gate | 可作 App runtime adapter 基線；Push delivery、selected-media upload、SSE native runtime、native crash 與 crash-free telemetry 的完整驗收仍需 M6 external evidence |

### 3.1 Web 配合要求

完整 App 版需要 Web 配合的是共享層收斂，不是改變 Web 對外行為：

| 配合項 | 來源 | 目標 |
| --- | --- | --- |
| Domain API client | `frontend/src/services/api/*`、`packages/api-client/src` | auth / session / quick / profile / interview / case / chat / judgment / reconciliation / execution / notification / media upload API shape 已下沉到 `packages/api-client`，主站 Web wrapper 保留 public exports 與平台 side effect seam |
| Error / response normalize | `frontend/src/services/request.ts`、`packages/contracts/src/common.ts` | 形成 Web / App 共用 error code、request id、retry 語義 |
| AI stream reducer | `frontend/src/services/aiStream.ts`、`frontend/src/utils/aiStreamState.ts`、`mobile/src/platform/sse/aiStreamState.ts`、`packages/api-client/src/aiStreamState.ts`、`packages/contracts/src/ai-stream.ts` | Web draft reducer、App snapshot selector、terminal status/event helper 與 phase append helper 已下沉到 `@cj/api-client`；平台各自處理 lifecycle / headers / token / locale / storage / AbortController；`npm --prefix packages/api-client run test:ai-stream-state` 防 Web / App pure-logic 分叉 |
| Upload handoff | Web evidence / profile upload service、`mobile/src/platform/upload` | 共用 API contract，平台各自處理 picker / FormData |
| Pure domain helper | 現有 Web utils 中平台無關部分 | 後續可進 packages/domain，需先建包與 ADR，不得引入 React DOM / React Native / router / storage |

Web shared API client 收斂已按 [../07-待處理問題與治理/已處理/Web十項問題總體修復方案-2026-05-10.md](../07-待處理問題與治理/已處理/Web十項問題總體修復方案-2026-05-10.md) 的 P2-1 階段完成歸檔；[../07-待處理問題與治理/已處理/Web五項修復主控方案-2026-05-10.md](../07-待處理問題與治理/已處理/Web五項修復主控方案-2026-05-10.md) 與 [../07-待處理問題與治理/已處理/Web共享ApiClient消費收斂待辦-2026-05-10.md](../07-待處理問題與治理/已處理/Web共享ApiClient消費收斂待辦-2026-05-10.md) 保留子方案細節與完成證據。Parity 裁決是：Web 已消費 `@cj/api-client` 的 M1-M5 platform-neutral domain method 與 AI stream pure helper，但不得把 Web 的 toast、router、storage、quick session mutation、request cancel registry、SSE/fetch lifecycle 或 Admin redirect 下沉到 shared package。若後續新增 domain 暫不遷移，必須在對應待辦或 ADR 記錄原因、風險與下一次驗收 gate。

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
| App 已消費 `@cj/api-client`，M1-M5 domain client 已下沉；M6 release config、safe telemetry ingest / minimized persistence / Admin report / 30d cleanup、App-side OpenTelemetry provider first pass 與 native crash SDK configuration first pass 已接入 | 共享層 Parity | 補 EAS project id / credentials / production artifacts / physical device / provider delivery / native crash runtime / release DB parity evidence，並在 strict audit pass 後再宣稱 release 完成 |
| `mobile/app` 已替換模板 tabs，M0-M5 普通用戶 screen、true-service probes、simulator / emulator smoke 與 completion audit passed；native 主產品 flow 的 release 級驗收仍依賴 M6 evidence | 功能 Parity | 按 M6 補 EAS、TestFlight、physical device、provider delivery、native crash runtime、release DB parity 與 evidence，不用 placeholder、dry-run、partial run 或 mock-backed flow 宣稱完成 |
| `mobile/src/platform/storage` 已有 SecureStore runtime adapter、unit gate 與 auth/session bootstrap；cold start token / session restore 需由 physical device smoke 或 TestFlight evidence 補 release 級證據 | 平台差異 | 補 native auth/session restore smoke 或納入 physical device release smoke artifact |
| `mobile/src/platform/notifications` 已有 permission / push token helper，Push token registration / revoke、logout cleanup、registration-time token rotation revoke 與 notification landing handler 已接 backend schema/API / App route resolver；backend Expo push sender、dispatch job 與 receipt polling job 已接線；Quick child route preservation 已有 unit gate；仍缺真 provider delivery / APNs sandbox 與真機 cold-start 證據 | 平台差異 + backend 影響 | 補 Expo/APNs provider delivery evidence、真機 landing evidence 與 provider lifecycle evidence 任務 |
| `mobile/src/platform/upload` 已有 ImagePicker lazy load / picker status / evidence FormData adapter、web/native branch unit、Android release APK picker-cancel smoke 與 selected-media backend upload/delete evidence；真機 picker-selected asset / profile media 未驗收 | 平台差異 + backend 影響 | 補真機 selected-media picker、profile media upload native evidence 與 media provider authorization evidence |
| Deep Link 授權失敗回退已建立 notification landing、non-notification handler、auth-gate 與 auth-resume Maestro flow artifact，但仍缺真機入口證據 | 平台差異 | 補 native cold-start / foreground Deep Link evidence 與 Maestro native execution 任務 |
| App native 測試與 smoke gate 已建立，但 release 級外部 evidence 未清零 | 工程治理 | `release:preflight`、Maestro、Android/iOS simulator/emulator、external status / handoff / prerequisite report gates 已通過；仍需跑通 `release:completion:audit:strict` / `goal:completion:audit:strict` |
| 完整 App PRD / Roadmap 已裁決，M0-M5 runtime 已完成本地驗證，M6 strict release sign-off 未完成 | 文檔完成 / runtime 推進中 | 所有後續順序調整仍需同步 App / Parity / RTM / 待辦；`/goal` 只能在 strict audits pass 後完成 |

## 6. 關聯正文

1. App 首輪 screen 分組到 Web / Backend / API / DB / shared packages 的細映射，見 [01-App首輪能力與工程落點Mapping.md](./01-App首輪能力與工程落點Mapping.md)。
2. App navigation 與 platform adapter 落點規則，見 [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md)。
3. App 測試、回歸、CI 與證據接入規則，見 [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md)。
4. App 尚未落地的治理任務，見 [../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md](../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md)。
