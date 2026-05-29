# App 首輪能力與工程落點 Mapping

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：跨端映射
**覆蓋範圍**：跨端能力到 Web / App / Backend / API / DB / 共享層的映射與缺口：01-App首輪能力與工程落點Mapping
**取證代碼入口**：`backend/src/routes`、`backend/prisma/schema.prisma`、`frontend/src/router/index.tsx`、`frontend-admin/src/router.tsx`、`mobile/app`、`mobile/tsconfig.json`、`mobile/src/platform`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`1295216`
**最後核驗日期**：`2026-05-06`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 定位

本文件承接 `20-App端/01-App導航與平台Adapter基線.md`，把 App 首輪 screen 分組映射回跨端產品能力、Web 凍結基線、Backend/API、DB / shared packages 與待處理缺口。

它不裁決 App UI 長相，也不重新定義產品能力。它只回答：App 已替換 Expo 模板後，每一組 screen 應對照哪些 Web/Backend 事實來源，哪些差異仍必須記成 Parity 或 M6 release evidence 缺口。

## 2. 狀態口徑

| 狀態 | 定義 |
| --- | --- |
| Template | 新增分組若仍是 Expo 模板或僅有 types-only 骨架時使用；當前 M0-M5 不再使用此狀態 |
| Candidate | 新增分組已有建議落點，但還沒有 CJ App screen / runtime adapter 時使用 |
| In progress | 已有可追溯 App screen / adapter skeleton，但尚未完成對應測試或業務 flow |
| Blocked | 必須先裁決 API / DB / shared contract / platform adapter |
| Ready for implementation | 文件、映射與待辦已閉環，可進入 App 代碼實作 |
| Implemented | App 端已有可追溯 screen / adapter / API 消費與驗收入口 |
| Release-blocked | 本地 App 工程與驗收入口已落地，但完整完成仍受 EAS / TestFlight / 真機 / provider / release DB 等外部 evidence 阻擋 |

當前 M0-M5 普通用戶 App 業務能力可標為 `Implemented`：`goal:completion:audit` 已對 M0 Foundation、M1 Quick/Auth、M2 Profile/Interview、M3 Chat、M4 Formal Case/Repair、M5 Push/Deep Link/Upload/Telemetry、UI/UX、測試 gate 與核心文件回寫給出 passed。完整 `/goal` 仍不得標記完成，因為 M6 `Release-blocked`：`release:completion:audit:strict` / `goal:completion:audit:strict` 仍缺 EAS project id、Expo / Apple / ASC credentials、EAS iOS/Android artifact、TestFlight、physical device、push provider delivery 與 native crash runtime evidence；release / production DB parity 與 telemetry runtime pass evidence 已有 structured JSON。

## 3. 首輪能力 Mapping

| App 分組 | 跨端能力 | Web / Admin 對照 | Backend / API 對照 | DB / Shared 對照 | Roadmap | App 現況 | 裁決 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Foundation / Shell | App root、provider、navigation skeleton、error boundary | Web app providers / route guard 作對照但不複製 | auth/session gate、health/version 可作 smoke 輔助 | `@cj/api-client` transport、`mobile/src/platform` runtime adapter | M0 | Implemented | Shell / providers / adapter 已落地；SecureStore / API adapter unit、provider render、auth/session bootstrap、root error boundary、upload / notifications / lifecycle branch tests、iOS simulator Release launch、native Maestro 7/7、route / feature / platform gate 已通過；physical device evidence 歸入 M6，不單獨阻擋 M0 本地完成 |
| Auth / Session | 認證、會話、匿名 session 升格 | Web login / register / route guard | auth routes、session routes | user / session schema、`@cj/contracts` auth/session DTO | M0 / M1 | Implemented | login/register/claim-session 已接 shared domain client；quick submit session recovery、result access expired cleanup、claim failure 不阻斷登入、過期 session 清理、safe telemetry、RNTL、true-service claim-session 與 iOS simulator smoke 已通過；release 級 token restore / cold-start evidence 歸入 M6 |
| Quick | 快速判斷、匿名 quick flow、同機 collaborative quick、claim | Web quick experience / collaborative quick | quick session、case、judgment、AI stream routes | quick session / case mode / judgment schema、case DTO、AI stream DTO、`ai_stream_sessions` / `ai_stream_events` persistence schema | M1 | Implemented | quick session、quick case、同機 collaborative quick、session recovery、result access cleanup、result fetch、pending polling、`case_judgment` stream replay、Quick result AppState reconnect、RNTL、collaborative A/B handoff、stream persisted refetch、Maestro artifact、mock backend smoke、true-service anonymous quick / judgment poll / claim-session 與 iOS simulator native quick/auth smoke 已通過；native reconnect 真機證據歸入 M6 |
| Profile | 心理訪談、個人/關係檔案 | Web interview / profile / pairing profile | interview、psych profile、profile routes、SSE respond / skip / end | interview session / psych profile / profile schema、AI stream event / snapshot DTO、`interview_sessions.collected_facts` / `interview_turns.extracted_facts` | M2 | Implemented | Profile / Interview / My Story screen、M2 shared client、auth-resume Maestro artifact、AI stream subscription hook、ready snapshot、`after_seq` replay、close/error retry、AppState reconnect、5-turn true-service deep interview / my-story completion、failed retry UI、feedback-card summary 與 iOS simulator auth-resume smoke 已通過；native interruption evidence 歸入 M6 |
| Chat | 先聊再判、chat handoff | Web chat room / chat-to-judgment | chat、message、room event stream、chat-room AI stream、judgment handoff routes | chat room / message / judgment source tracking、AI stream event / snapshot DTO、`ai_stream_sessions` / `ai_stream_events` persistence schema | M3 | Implemented | shared chat domain client、Chat Home / Room / Invite screen、message send、invite、invite accept auth resume、notification invite landing、explicit request-judgment、room event stream parser、chat-room AI draft replay/recovery、AppState reconnect、Maestro artifact、true-service room/message/invite/list/status/partner accept/request-judgment 與 iOS simulator native smoke 已通過；true push invite landing / native reconnect 歸入 M6 |
| Case / Repair | 正式處理、配對、提交案件、判決、修復旅程 | Web case / pairing / judgment / reconciliation / execution | pairing、case、judgment、reconciliation、execution、repair-track stream routes | case / pairing / judgment / repair schema、contracts case DTO、AI stream event / snapshot DTO、`ai_stream_sessions` / `ai_stream_events` persistence schema | M4 | Implemented | shared case/repair domain client、Case / Repair screen、pairing/case/judgment/plans/execution、repair replan trigger、auth-gate Maestro artifact、`repair_track` stream replay/recovery hook、AppState reconnect、true-service formal evidence upload/judgment/execution/repair plan select/execution confirm/live replan persisted、backend restart DB-backed replay 與 iOS simulator native smoke 已通過；native selected-media / reconnect / canonical dashboard evidence 歸入 M6 |
| Notification / Deep Link | in-app notification、Push entry、Deep Link landing | Web notification / Admin notification governance | notification/content routes、deep-link target rules、device token registration / revoke API | notification schema、content/media provider、platform push token lifecycle | M5 | Implemented | shared notification client、Notifications screen、read / snooze / dismiss / act sync、target resolver、Quick child route preservation、Chat invite landing、notification landing handler、non-notification Deep Link handler、post-login resume、Maestro artifact、device token registration / revoke / logout cleanup、registration-time token rotation revoke、backend Expo sender / dispatch / receipt polling、local true-service notification state sync 與 iOS simulator custom-scheme smoke 已通過；true provider delivery / 真機 cold-start response evidence 歸入 M6 |
| Media / Upload | evidence / profile media | Web browser upload / media provider | evidence / media provider routes | evidence schema、media provider contract | M1 / M4 / M5 | Implemented | ImagePicker lazy load / picker status / evidence FormData adapter、shared upload client、Case safety assertion、picker cancel 非成功上傳、web/native picker unit、Android release APK picker-cancel side-effect smoke、local true-service quick-session evidence upload/delete 與 selected-media backend synthetic fixture upload/delete evidence 已通過；真機 picker-selected asset、profile media authorization 與 physical device evidence 歸入 M6 |
| Telemetry / Error Context | App error / runtime observability | Admin health / audit / metrics | health / metrics / audit / logs；`GET /version`；`POST /api/v1/telemetry/events` safe ingest；`POST /api/v1/telemetry/otlp/v1/traces` CJ OTLP ingest；`GET /api/v1/admin/reports/app-telemetry` | release/version metadata、structured log、最小化 `app_telemetry_events` summary | M5 / M6 | Release-blocked | safe telemetry、token/session redaction、non-blocking endpoint submit、backend 二次清洗、minimized persistence、30d cleanup、Admin report、route/service/smoke gate、local true-service ingest、OpenTelemetry provider first pass 與 native crash SDK configuration evidence 已通過；`telemetry:runtime:smoke` 已支援 `--release-env-file=release.env.local`，run mode 先查 release backend `/version` 並要求 `commitSha` 等於當前 `HEAD`，再送 App event / OTLP；2026-05-29 canonical `App-Telemetry-Runtime-2026-05-29T16-00-52-498Z.json` 已通過 backend version、event ingest 與 OTLP ingest，`telemetry_runtime_evidence` blocker 已解除。Sentry runtime crash evidence、長期 crash-free baseline 與其他 external release evidence 仍受 M6 阻擋 |

## 3.1 Shared Layer 落點

| 共用層 | 應下沉內容 | 不應下沉內容 | 觸發 Roadmap |
| --- | --- | --- | --- |
| `packages/api-client` | auth/session/quick/profile/interview/case/chat/notification/upload domain client、error normalize、SSE contract helper、AI stream draft reducer / snapshot selector / terminal helper / phase append pure logic | localStorage、SecureStore、router、toast、React component、platform lifecycle / AbortController wiring | M0-M5 |
| `packages/contracts` | DTO、enum、response shape、AI stream event / snapshot、notification render payload | 平台 picker result、native permission result | M0-M5 |
| packages/domain（待建立） | query key、status normalize、permission predicate、跨能力 state transition helper；AI stream pure reducer 已先落在 `packages/api-client/src/aiStreamState.ts`，避免為單一 helper 提前建立新包 | React DOM、React Native UI、Expo API、browser API、SSE transport / lifecycle side effect | M1-M5 |
| `mobile/src/platform` | storage、api adapter binding、SSE transport、AI stream subscription lifecycle、upload、notifications、linking、telemetry | 業務 DTO 與 backend authorization logic；AI stream persistence DB schema 仍由 backend / migration 管 | M0-M6 |

## 4. 必須同步的差異類型

以下任何一項發生時，必須同步更新本文件並建立或更新待辦：

1. App 新增 screen 分組或改變首輪分組優先級。
2. App 需要新增 API、修改 response shape、修改 shared enum 或新增 App-only DTO。
3. App 需要新增 DB 欄位、migration、Push token 儲存、device identity 或 media metadata。
4. App route / Deep Link 引入 Web 沒有的授權失敗回退或 session restore 行為。
5. App runtime adapter 新增平台能力、改變副作用邊界或改變既有 release evidence 口徑。
6. App smoke / regression / CI / evidence 入口建立或變更；此時必須同步符合 [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md)。

## 5. 與 App 端文件的分工

| 問題 | 文件來源 |
| --- | --- |
| App 端目錄、route group 現況、platform adapter 規則 | `20-App端/01-App導航與平台Adapter基線.md` |
| App screen 分組對應哪個跨端能力、Web/Backend/DB/shared 來源 | 本文件 |
| Web / Admin 已落地基線 | `10-Web端/00-Web端凍結基線總覽.md` |
| 產品能力與狀態機最高裁決 | `00-跨端產品核心/00-跨端產品核心總覽.md` |
| 尚未完成 release evidence 或必須閉環的後續任務 | `07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md` |
| App smoke / regression / CI / evidence 接入規則 | `08-測試規範與驗收/03-App測試與證據接入基線.md` |

## 6. 新增或變更 Gate

任一 App 分組新增能力、改變 API / DB / shared contract、或調整 release evidence 口徑前，至少要完成：

1. 在本文件中標明對應跨端能力、Web 對照、Backend/API 對照與 shared contract 狀態。
2. 在 `20-App端/01-App導航與平台Adapter基線.md` 中確認 navigation / adapter 落點。
3. 若 API / DB / shared contract 不足，建立待辦，不以 App local workaround 作長期方案。
4. 若涉及 Push、Deep Link、Upload、SecureStore，確認 platform adapter 路徑與 backend 副作用。
5. 實作後按 `08-測試規範與驗收/03-App測試與證據接入基線.md` 補回測試 / 證據入口，或明確記錄測試缺口。
6. 若實作順序偏離 `20-App端/03-App完整版本開發Roadmap.md` 的 M0-M6，必須同步更新本文件、Roadmap、RTM 與待辦。
