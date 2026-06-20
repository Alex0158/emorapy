# App 導航與平台 Adapter 基線

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：App端規格
**覆蓋範圍**：Expo App 基線、原生能力邊界與 App 開發投影：01-App導航與平台Adapter基線
**取證代碼入口**：`mobile/package.json`、`mobile/tsconfig.json`、`mobile/app/_layout.tsx`、`mobile/app/modal.tsx`、`mobile/src/platform`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`4796829`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 定位

本文件承接 App 端從 Expo 模板骨架走向 Emorapy App 普通用戶主流程的工程落點規則。它不重新定義產品能力，只回答兩件事：

1. `mobile/app` 的 navigation / screen 如何從模板狀態替換成 Emorapy App M0-M5 baseline route 與普通用戶 flow。
2. `mobile/src/platform` 的 adapter 邊界如何收斂 SecureStore、Push notification、upload / ImagePicker、SSE、Deep Link、lifecycle 與 telemetry 等平台實作。

產品能力、角色、流程與狀態仍以 `00-跨端產品核心/` 為準；Web 已落地狀態與 App 缺口仍以 `50-跨端Mapping與Parity/` 為準。

## 2. 現碼基線

| 區域 | 現碼狀態 | 裁決 |
| --- | --- | --- |
| `mobile/app/_layout.tsx` | Expo Router root stack，接入 `AppProviders`、navigation theme、root error boundary、`(public)`、`(app)` 與 `modal` | M0 root shell、auth/session bootstrap、root error boundary 與 route topology gate 已成基線 |
| public route group | public stack，包含 landing、quick、quick collaborative、quick result、auth | 可作 Quick + Auth M1 入口；baseline screen 與 anonymous quick / judgment / claim-session 接線已具備，但不代表 native quick/auth flow 完整驗收 |
| authenticated route group | authenticated tab shell，包含 case、chat、profile、notifications、repair route；M2-M5 baseline screen 已接入 shared client / App adapter | 可作 M0 authenticated shell 與後續 milestone 入口；profile / chat / case / repair / notification / upload / telemetry baseline flow 已具備，native gate 前不得視為登入後能力完整完成 |
| `mobile/app/modal.tsx` | App 狀態 modal，以用戶語義顯示服務連線、本機保存與圖片選擇狀態，不顯示 raw API URL | 可作 M0 inspection 入口；不是業務 modal 完成 |
| provider layer | SafeArea、Paper、QueryClient provider、auth/session bootstrap | M0 provider、auth/session cache preload 與 root shell 已具備；physical device gate 待補 |
| storage adapter | token / session / device metadata SecureStore adapter | runtime adapter 與 auth/session bootstrap 已具備；physical device SecureStore evidence 待補 |
| API adapter | Axios adapter，支援 JWT、`X-Session-Id`、`X-Locale`、request id、FormData、typed error normalize | runtime adapter、typed error normalize 與 M1-M5 shared domain client 接線已具備；release DB parity 是可刷新證據槽，不替代外部服務證據 |
| SSE adapter | `after_seq` SSE reconnect wrapper、typed open error、close callback、AI stream subscription hook | transport / hook 已接 M1 Quick result、M2 Interview、M3 Chat AI draft 與 M4 Repair replan；backend persistence / replay / compression 邊界已由 schema 與 route 承接；React Native 真機 foreground/background runtime 證據待補 |
| notifications adapter | Expo notification permission / push token payload helper | backend device token registration / revoke、通知列表與 push render payload locale baseline、Expo push sender / dispatch / receipt polling job、App token sync、logout cleanup、registration-time token rotation revoke 與 notification response landing handler 已接線；真 provider delivery / 真機 cold-start landing 證據待補 |
| upload adapter | ImagePicker lazy load、picker result status 與 backend-compatible evidence FormData helper | baseline runtime 與 web/native branch 已具備；真機 picker-selected asset、授權與 profile media evidence 待補 |
| linking / lifecycle / telemetry adapters | Deep Link、AppState、safe telemetry helper | Deep Link target resolver、notification response handoff、post-login resume、lifecycle subscription、telemetry redaction、safe telemetry ingest、Emorapy OTLP JSON trace ingest、最小化 persistence、Admin 聚合報表、30d cleanup、OpenTelemetry provider 與 native crash SDK configuration 已具備；device evidence、production native crash runtime evidence 待補，external tracing backend 屬 post-release SLO baseline pending |

因此，當前 App 端可以稱為「Emorapy App M0-M5 普通用戶工程 baseline 已具備」。但在 M6 strict release sign-off 前，仍不能稱為可發布完成版、TestFlight 完成、physical-device 完整驗收、真 Push delivery 完成或 native crash runtime 完成。

完整 App 版的開發前裁決由 [02-App完整版本工程PRD.md](./02-App完整版本工程PRD.md) 與 [03-App完整版本開發Roadmap.md](./03-App完整版本開發Roadmap.md) 承接，範圍包括技術路線、需求 ID、完整 scope 與 M0-M6 Roadmap。本文以下規則仍是後續代碼實作的 navigation / adapter gate。

## 3. Navigation 替換規則

替換 `mobile/app` 模板時，必須遵守以下規則：

1. 不在 `Tab One` / `Tab Two` 命名下堆 Emorapy 功能；開始 App 功能前應先裁決 route group 與 screen 名稱。
2. App route 不直接複製 Web URL。Web route 是對照來源，App route 要按 mobile navigation、Deep Link 與 session restore 重新投影。
3. 所有進入 case、chat、judgment、repair journey、profile、notification 的 App screen，都只能提交上下文；最終授權仍由 backend gate 裁決。
4. baseline navigation 應先建立可追溯骨架，再逐步接功能，不應讓單頁臨時 navigation 成為事實標準。
5. Admin Web 不進普通 App navigation；若需要運營事件回傳，只能走 telemetry / error context，不做 App admin console。

`npm --prefix mobile run routes:check` 是 App route topology contract gate，負責固定 `mobile/app` 的 `(public)`、`(app)`、Quick、Auth、Case、Chat、Profile、Notifications、Repair、`modal` 與 root support route 文件。該 gate 同時禁止 Expo template `(tabs)` / `Tab One` / `Tab Two` 回流，要求 root stack 註冊 `(public)` / `(app)` / `modal`，要求 authenticated deep routes 以 `href: null` 從 tab bar 隱藏，並以 i18n-aware contract 固定 authenticated tab 使用 `appTabs.*` key 與 zh-TW / en-US catalog 文案；它只能證明路由拓撲與 tab label contract 沒有漂移，不替代 native navigation、Deep Link、auth resume 或 Maestro runtime evidence。

## 4. Baseline Screen 分組建議

Emorapy App navigation 固定按以下平台投影分組；M0-M5 baseline screen / adapter 接線已具備，各分組能否宣稱完整完成仍按 Roadmap 的 native / external evidence gate 裁決：

| 分組 | 承接能力 | 最低後端依賴 | Roadmap |
| --- | --- | --- | --- |
| `(public)` / Auth / Session | login、register、anonymous session restore、logout、claim handoff | auth / session routes | M0 / M1 |
| Quick | 快速判斷、同機協作聽證、結果回訪、claim | quick session / case / judgment / stream | M1 |
| `(app)` shell | 登入後主 shell、provider、tab / stack 結構 | auth / notification unread count | M0 |
| Case | 配對、正式案件、判決、修復旅程；chat-to-case 自動標題與 judgment content / summary / emotional analysis 由 backend 依 request locale 寫入，App 只顯示後端內容；backend `Case.type` 資料值必須經 App catalog 顯示 | pairing / case / judgment / reconciliation / execution | M4 |
| Chat | 聊天室、邀請、先聊再判、chat handoff；backend safety notice 依 request locale 寫入 `message.content`，App 只顯示該訊息 | chat / message / stream / judgment handoff | M3 |
| Profile | 心理訪談、個人檔案、關係檔案；interview seed question 與 feedback card 由 backend 依 request locale 寫入，App 只顯示後端內容 | interview / psych profile / profile | M2 |
| Notifications | in-app notification、Push entry、Deep Link landing | notification / content / deep-link target / device token registration / revoke | M5 |
| Repair | repair journey、today step、checkin、replan、dashboard；backend-owned respond / invite / pause / replan / resume success message 依 request locale 由 backend i18n 輸出；journey_context title/body/CTA、repair plan content 與 step title/content 由 backend 依 request locale 生成，App 不端側重建翻譯表 | reconciliation / execution / repair-track stream | M4 |
| `modal` | safety notice、upload picker handoff、destructive confirm | 按觸發功能繼承 backend gate | M0-M6 |

任何分組如果需要新增 API response、DB 欄位、shared enum 或 backend side effect，必須先更新 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md) 並建立或更新待處理任務。若該分組要進入 smoke / regression / CI 或證據留存，還必須符合 [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md)。

## 5. Platform Adapter 推進規則

`mobile/src/platform` 應作為平台副作用的唯一收斂層。後續實作時，業務 screen 不應直接散落調用 Expo API。

`npm --prefix mobile run platform:check` 是靜態邊界 gate，掃描 `mobile/app` 與 `mobile/src`。除 `mobile/src/platform` 外，任何 static / dynamic import 或 require `expo-secure-store`、`expo-image-picker`、`expo-notifications`、`expo-linking`，或直接使用 `AppState` 都會 fail。它只能證明副作用入口未散落，不替代真機 SecureStore / Push / selected-media ImagePicker / Deep Link / lifecycle evidence。

| Adapter | 現有狀態 | Runtime 目標 | 不得做的事 |
| --- | --- | --- | --- |
| Storage | SecureStore adapter、auth/session bootstrap 與 unit gate 已建立 | 封裝 Expo SecureStore，支援 token / session restore / clear / device metadata | 不得在 screen 中直接讀寫 SecureStore，不得長期保存 case / psych 正文 |
| API | Axios adapter、typed error normalize、FormData 與 M1-M5 domain client 接線已建立 | 封裝 JWT、`X-Session-Id`、`X-Locale`、request id、FormData、typed error normalization | 不得繞過 `@emorapy/contracts` / `@emorapy/api-client` 長期手寫 DTO |
| SSE | `after_seq` wrapper、typed open error、close callback 與 AI stream subscription hook 已建立；backend SSE 已禁用 compression，並由 persistence / replay 支撐 terminal event 恢復 | foreground streaming、`after_seq` reconnect、snapshot / replay fallback、background interruption recovery；M1-M4 baseline screen 已接 App stream hook | 不得假設 App 背景仍持續讀 stream；無真機 lifecycle 證據前不得宣稱 SSE 完整驗收 |
| Notifications | permission / push token helper、in-app notification screen、notification landing handler 已建立 | 封裝 permission、push token 取得、登出清理、token sync、registration-time rotation revoke、notification response route handoff；backend 以 request `X-Locale` render 通知列表，並在 notification payload 記錄 target locale 供背景 push 重放 | 不得讓 Push 狀態繞過 backend notification 狀態；不得在 Web/App 各自重建 backend notification template；registration / revoke / logout cleanup / rotation revoke / landing handler、backend Expo push dispatch / receipt polling 與 render payload locale baseline 已接線，但真 provider delivery、APNs sandbox 與真機 cold-start landing 證據尚未驗收 |
| Upload | ImagePicker lazy load / picker status / backend-compatible evidence FormData adapter 已建立 | 封裝 ImagePicker / file metadata normalize / upload provider handoff | 不得在 App 本地裁決 evidence / media 授權；Web branch 不載入 ImagePicker，picker cancel 不記成功，仍需真機 picker-selected asset、profile media 與 media provider authorization evidence |
| Linking | Deep Link helper、notification target resolver、Quick child route preservation、notification response handoff、non-notification Deep Link handoff 與 pending target resume 已建立 | Deep Link parse、auth failure fallback、target action handoff | 不得把 Deep Link parse 成功視為 backend 授權成功；真機 cold-start / foreground 證據待補 |
| Lifecycle | AppState helper、AI stream foreground/background recovery hook 與 lifecycle unit gate 已建立 | cold start restore、foreground refresh、network regain、logout clear | 不得讓 stale token / stale session 靜默覆蓋 backend gate；真機 lifecycle runtime evidence 未完成前不得宣稱完整驗收 |
| Telemetry | safe console telemetry、token/session key redaction、backend safe ingest、Emorapy OTLP JSON trace ingest、最小化 persistence、Admin 聚合報表與 30d cleanup、App observability bootstrap、OpenTelemetry provider、release backend version precheck 與 native crash SDK configuration 已建立 | app version、build number、platform、screen、request id、safe error context、JS fatal / unhandled promise 口徑、OpenTelemetry provider span export、native crash provider status | 不得上傳敏感 relationship / psych / prompt payload；safe telemetry ingest、OTLP ingest、Admin telemetry report 與 Sentry SDK configuration 只代表 safe observability baseline；telemetry runtime evidence 必須與被驗證 backend version 對齊，且 backend telemetry/version runtime 路徑變動後必須刷新；production CORS 只允許 telemetry ingest endpoint 接受 App native 無 `Origin` 請求，不代表其他 API 可繞過 Origin 白名單；不代表 production native crash runtime evidence、external tracing backend 或長期 crash-free sessions 已完成 |

若新增 Deep Link、App lifecycle、device info、background task 等 adapter，也應先落在 `mobile/src/platform/<domain>/`，再由 screen 或 service adapter 消費。

## 6. 與共享層的接線規則

App 正式功能不得手寫第二套 DTO。接線順序固定如下：

1. 先確認 `packages/contracts` 是否已有對應 enum / DTO / response shape。
2. 再確認 `packages/api-client` 是否已有可重用 transport 或 domain client。
3. App 端只補 platform adapter、query/cache adapter、navigation handoff，不在 screen 裡硬編 API shape。
4. 若 contracts / api-client 不足，先補共享層或建立待辦，不以 App local type 長期替代。

## 7. 驗收口徑

以下條件用於區分「M0-M5 工程 baseline 已具備」與「完整 App / release-ready 主流程已完成」。M0-M5 screen、adapter 與 gate 已可作普通用戶 App 工程 baseline；但在 M6 strict release sign-off 清零前，不得宣稱完整 App 主流程已完成或 release-ready。

1. `mobile/app` 不再保留 `Tab One` / `Tab Two` / template modal 作為主入口，且 `routes:check` 固定 `(public)` / `(app)` / `modal` route topology。
2. M0-M5 Emorapy App screen 已能對應到 `50-跨端Mapping與Parity/` 的能力矩陣；native flow 完整驗收仍歸 M6。
3. App API adapter 正式消費 `@emorapy/contracts` 或 `@emorapy/api-client`，沒有新增長期 App-only DTO 分叉。
4. Storage / Notifications / Upload / Linking / AppState 若被功能使用，必須經 `mobile/src/platform` runtime adapter，不直接散落 Expo API。
5. App smoke / regression / CI / evidence 入口已按 [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md) 進入 `08-測試規範與驗收/`、`測試/` 或 `90-證據與盤點/`；physical device / EAS / provider / native crash evidence 仍由 M6 sign-off 裁決。
