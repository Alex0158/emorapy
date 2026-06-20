# App 端總覽

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：App端規格
**覆蓋範圍**：Expo App 基線、原生能力邊界與 App 開發投影總覽
**取證代碼入口**：`mobile/package.json`、`mobile/app`、`mobile/src/platform`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`e7d2af5`
**最後核驗日期**：`2026-06-20`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 當前 App 基線

App 版正式承載目錄為 `mobile/`。目前它是 Expo / React Native 專案，M0-M5 普通用戶 App 工程 baseline 已具備，並進入 M6 外部發版證據與 strict sign-off 階段。

現行 App 基線包含：

1. `mobile/package.json`：Expo、Expo Router、React Native、React Native Paper、React Query、Zustand、Axios、SecureStore、Notifications、ImagePicker 等依賴。
2. `mobile/app`：已替換 Expo template tabs，建立 Emorapy public / authenticated route group、Quick / Auth / Result / Collaborative screen、Case / Chat / Profile / Notifications / Repair screen 與 App 狀態 modal。
3. provider / UI foundation：已建立 React Query、React Native Paper、safe area、auth/session bootstrap、root error boundary、shared UI accessibility contract、TextInput label / hint static gate 與 copy contract。
4. runtime config：已建立 App runtime config，讀取 API base URL、locale、app version / build number 與 request timeout。
5. shared package resolution：App 端以 package resolution 消費 `@emorapy/api-client` 與 `@emorapy/contracts`，Metro 與 typecheck 使用同一 shared layer 入口。
6. `mobile/src/platform`：已建立 API client、SecureStore、SSE、upload、notifications、linking、lifecycle、telemetry 的 runtime adapter，並保留 storage / notifications / upload 型別邊界。

現行狀態分層如下：

| 層級 | 可依賴結論 | 不得外推 |
| --- | --- | --- |
| M0-M5 普通用戶 App 工程 | Quick / Auth / Profile / Interview / Chat / Formal Case / Repair / Notification / Deep Link / Upload / Telemetry 已有 baseline screen、platform adapter、shared API client 消費與 gate | 不等於完整 native runtime、provider side-effect 或 release sign-off 完成 |
| Stream / lifecycle | Quick result、Interview、Chat AI draft 與 Repair replan 使用共用 App AI stream subscription hook，並以 `after_seq` replay / reconnect 作 App 層恢復語義 | Screen-level 或本地 gate 不等於 physical device foreground-background runtime 全覆蓋 |
| Push / Deep Link / Upload / Telemetry | Push token sync、notification landing、Deep Link auth resume、upload adapter、safe telemetry ingest、Emorapy OTLP JSON trace ingest 與 Admin telemetry report 已有 backend / App baseline 接線 | 不等於 APNs / provider delivery、真機 selected asset、真機 notification response 或 production native crash runtime 完成 |
| M6 release evidence | release / production DB parity、telemetry runtime、EAS Android production artifact、Android emulator / app / full-flow runtime evidence 與 native ImagePicker upload evidence 是已具備且可被 audit 接受的證據槽；EAS iOS / TestFlight / physical device / provider / native crash runner 與 handoff gate 已建立 | 只有 `release:completion:audit:strict` 接受的 pass JSON 能解除對應 release blocker |

當前 App 完成語氣必須以 `mobile/scripts/check-release-completion-audit.mjs` 與 `npm --prefix mobile run release:completion:audit` 為準。現行 strict release sign-off 仍至少受以下 blocker 約束：

| Blocker | 意義 |
| --- | --- |
| `apple_submission_credentials`、`app_store_connect_api_credentials` | iOS submit / TestFlight 查詢 credential 尚未以 non-placeholder 真值完成；`REPLACE_WITH_*` 不得解除 blocker |
| `eas_ios_build_artifact`、`testflight_evidence` | iOS EAS production store build 與 TestFlight structured pass evidence 尚未完成 |
| `physical_device_evidence` | iOS / Android physical device structured evidence 尚未完成 |
| `ios_release_simulator_evidence` | Emorapy identity 下的 iOS Release simulator build / install / launch evidence 尚未刷新 |
| `apns_or_provider_delivery_evidence` | Push provider delivery structured pass evidence 尚未完成 |
| `native_crash_runtime_evidence` | production environment native crash runtime structured pass evidence 尚未完成 |

細節命令、單次 artifact、機型與歷史修復過程不在本總覽展開；需要追溯時看 [03-App完整版本開發Roadmap.md](./03-App完整版本開發Roadmap.md)、[../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md) 與 [../90-證據與盤點/環境與發版驗證/README.md](../90-證據與盤點/環境與發版驗證/README.md)。

## 2. App 版本產品定位

App 不是 Web 的截圖式重做，而是同一產品核心與同一組 `CJ-PRD-*` 通用級需求在移動端的承載：

| 能力組 | App baseline 承接原則 |
| --- | --- |
| 快速判斷 | 優先承接低門檻 quick flow，保留匿名 session / claim / quick case 語義 |
| 正式處理 | 承接登入、配對、案件、判決、修復旅程，但避免在普通 App 中塞入完整 Admin 能力 |
| 先聊再判 | 可作為 App 高頻入口，但 chat -> judgment / case 的後端歸屬與授權不能改寫 |
| 讓系統更懂你 | 適合承接心理訪談、個人檔案與關係檔案，但 schema 必須與 backend 保持一致 |
| 通知與提醒 | App 可使用 Push / Deep Link 提升到達率，但 notification 狀態與業務副作用仍由 backend 裁決 |

完整 App 版 scope 固定為：Quick、Auth / Session、Profile / Interview、Chat、Formal Case / Judgment / Repair Journey、Notification / Push / Deep Link、Media Upload、Telemetry。普通 App 不承接 Admin Web，只允許回傳必要 error / telemetry context。

## 3. 原生能力邊界

App 端可新增以下平台適配層：

1. SecureStore：保存 token / session 相關本地憑證，但不得替代 backend 授權。
2. Push notification：承接提醒與召回，但 notification 狀態以 backend 為準。
3. Deep Link：進入 case、chat、judgment、repair journey 等目標，但進入後仍需 backend gate。
4. Camera / ImagePicker：承接 evidence 或 profile media，但上傳授權與 media provider 仍以 backend 為準。
5. App lifecycle：處理冷啟動、恢復、前後台切換與 token refresh。
6. Telemetry：回傳 app version、platform、safe error context 與 request id，但不得上傳敏感 relationship / psych / prompt payload。

現行平台邊界：

1. App screen / feature 層不得直接調用 SecureStore、Notifications、ImagePicker、Linking 或 AppState；native side effect 必須經 `mobile/src/platform/*` adapter，並由 `npm --prefix mobile run platform:check` 防回退。
2. SSE / AI stream 恢復語義以 `after_seq`、ready snapshot、replay / reconnect 與 screen-level lifecycle gate 表達；若需要宣稱 native interruption 完整驗收，必須補 physical device evidence。
3. Push / Deep Link / Upload / Telemetry 的 backend route、schema、shared client 與 App adapter 已有 baseline 接線；provider delivery、真機 upload selected asset、cold-start native landing 與 production native crash runtime 仍是 M6 / release evidence 範圍。
4. TestFlight crash-free sessions、external tracing backend 與長期 crash-free baseline 屬 post-release / SLO baseline，不替代當前 strict release evidence。

若新增 API、DB 欄位或共享 enum，必須同步回寫跨端核心、Parity 或待辦；不得只在 App 端文件中描述。

## 4. 與 Web 的差異

| 類型 | Web 基線 | App 投影 |
| --- | --- | --- |
| 路由 | React Router / browser URL | Expo Router / Deep Link；M0-M5 已有 Emorapy route group，M6 仍等待外部發版證據 |
| 本地儲存 | localStorage / sessionStorage 類 adapter | SecureStore / native storage adapter |
| 通知 | Web notification / in-app notification | Push notification + in-app notification |
| 媒體 | Browser upload / media provider | ImagePicker / camera + media provider |
| 認證恢復 | Browser refresh / route guard | cold start restore / app lifecycle refresh |
| UI | Web responsive layout | native navigation / touch-first layout |

## 5. 待閉環事項

M0-M5 App 工程 baseline 已具備。後續閉環應按以下穩定邊界追蹤，不以單次本地命令替代 release evidence：

| 範圍 | 已成為基線 | 仍需閉環 |
| --- | --- | --- |
| M0 Foundation | Emorapy route group、provider / UI foundation、auth/session bootstrap、root error boundary、platform adapter 與 static / unit / web export gate | physical-device runtime 風險仍由 M6 / native evidence 承接 |
| M1 Quick + Auth | anonymous quick、collaborative quick、claim-session handoff、expired session recovery、result polling / stream replay 與 shared Quick/Auth client | native stream reconnect 真機證據與真機錯誤狀態 UX |
| M2 Profile + Interview | profile / consent / interview / my-story screen 與 Interview stream replay/recovery baseline | 真機 interruption recovery 與完整 native branch evidence |
| M3 Chat | room / invite / message / request judgment / auth resume、AI draft stream replay/recovery 與 shared Chat client | native reconnect 與真 push invite landing evidence |
| M4 Formal Case + Repair | pairing / case / evidence upload / judgment / execution / repair replan App flow 與 DB-backed replay baseline | canonical dashboard native evidence、真機 selected-media upload 與 repair journey 全狀態 evidence |
| M5 Push + Deep Link + Upload + Telemetry | Push token registration / revoke、notification state sync、Deep Link auth resume、safe telemetry ingest、Emorapy OTLP JSON trace ingest 與 telemetry runtime evidence slot | provider delivery、真機 notification response landing、真機 selected asset / profile media 與 production native crash runtime evidence |
| M6 Release Hardening | release readiness、EAS / physical device / push / native crash structured runners、release DB parity / telemetry runtime / EAS Android artifact / Android local runtime / native ImagePicker evidence slots 與 release audit contract | Apple / ASC non-placeholder credentials、EAS iOS artifact、TestFlight、iOS Release simulator refresh、physical device、push delivery 與 native crash runtime blocker 清零 |

以上若影響 backend 或 Web，一律同步記錄到 `50-跨端Mapping與Parity/` 與 `07-待處理問題與治理/待處理/`。

## 6. 關聯正文

1. App navigation 與 platform adapter 的具體落點規則，見 [01-App導航與平台Adapter基線.md](./01-App導航與平台Adapter基線.md)。
2. 完整 App 版工程 PRD，見 [02-App完整版本工程PRD.md](./02-App完整版本工程PRD.md)。
3. 完整 App 版開發 Roadmap，見 [03-App完整版本開發Roadmap.md](./03-App完整版本開發Roadmap.md)。
4. App 與 Web / Backend / API / DB / shared packages 的一致性缺口總覽，見 [../50-跨端Mapping與Parity/00-跨端Parity總覽.md](../50-跨端Mapping與Parity/00-跨端Parity總覽.md)。
5. App screen 到 Backend / API / DB / shared package 的工程落點，見 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)。
6. App 測試、回歸、CI 與證據接入規則，見 [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md)。
7. App 活躍 parity 與 release blocker，見 [../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md](../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md) 與 [../07-待處理問題與治理/待處理/App外部ReleaseSignoff待辦-2026-05-16.md](../07-待處理問題與治理/待處理/App外部ReleaseSignoff待辦-2026-05-16.md)。
