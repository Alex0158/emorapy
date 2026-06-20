# App 完整版本開發 Roadmap

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：App端規格
**覆蓋範圍**：完整 App 版從開發前規格到 iOS TestFlight / Android readiness 的里程碑、完成定義、依賴與測試 gate
**取證代碼入口**：`mobile/package.json`、`mobile/app`、`mobile/src/platform`、`packages/contracts/src`、`packages/api-client/src`、`backend/src/routes`、`mobile/scripts/check-release-completion-audit.mjs`
**最後核驗 Commit**：`e7d2af5`
**最後核驗日期**：`2026-06-20`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 定位

本文是完整 App 版開發 Roadmap。它把 [02-App完整版本工程PRD.md](./02-App完整版本工程PRD.md) 的需求拆成可實作、可驗收、可留證的工程里程碑，並裁決每個 milestone 的完成語氣、最小 gate、不得宣稱事項與 evidence 回鏈。

本文不把「M0-M5 工程 baseline」與「外部 release sign-off」混為一談。當前穩定狀態如下：

| 範圍 | 現行裁決 |
| --- | --- |
| 基礎工程裁決 | 已具備 App 工程 PRD、Roadmap、navigation / platform adapter 與 parity mapping 的 baseline 裁決 |
| M0-M5 普通用戶 App 工程 | 已具備 M0-M5 baseline 接線，涵蓋 Quick / Auth / Profile / Interview / Chat / Formal Case / Repair / Notification / Deep Link / Upload / Telemetry 的 screen、platform adapter、shared API client 消費與穩定 gate |
| M6 release hardening | 部分落地；release DB parity、telemetry runtime、EAS Android production artifact、iOS Release simulator、Android emulator / app / full-flow runtime evidence 與 native ImagePicker upload evidence 是 release audit 已具備證據槽；Apple / ASC non-placeholder credentials、EAS iOS / TestFlight / physical device / provider delivery / native crash runtime 仍受 strict release blocker 約束 |
| 完成判定 | 以 `npm --prefix mobile run release:completion:audit` 和 `release:completion:audit:strict` 為 release sign-off 裁決入口；非 strict 或本地 evidence 不能外推為 release complete |

細節證據與歷史操作不在本文展開。單次命令、特定 simulator / emulator 型號、blocked 診斷與外部 owner handoff，統一回鏈到 [../90-證據與盤點/環境與發版驗證/README.md](../90-證據與盤點/環境與發版驗證/README.md)、[../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md) 與對應待辦；release evidence gate 要求的 canonical artifact 檔名只在 9.1 作證據索引，不作完成日誌。

跨里程碑 true-service 裁決由 `npm --prefix mobile run true-service:check` 守護；該 gate 固定檢查 `true-service smoke harness contract` 與 M1-M5 true-service smoke scope。Roadmap 只保留能力完成語氣、最小 gate 與不得宣稱邊界，具體 runner id 由 App 測試基線承接。

## 2. 里程碑總表

| Milestone | 名稱 | 目標 | 現行狀態 |
| --- | --- | --- | --- |
| M0 | Foundation | workspace / shell / provider / API adapter / SecureStore / smoke | M0 baseline 已具備；physical-device native side-effect evidence 仍由 M6 承接 |
| M1 | Quick + Auth | anonymous session、quick case、collaborative quick、result、claim、login/register | M1 baseline 已具備；native stream reconnect physical-device evidence 待補 |
| M2 | Profile + Interview | profile shell、consent、SSE interview、result、my-story | M2 baseline 已具備；native lifecycle interruption physical-device evidence 待補 |
| M3 | Chat | room、invite、message stream、chat-room AI draft、request judgment、handoff | M3 baseline 已具備；native stream reconnect 與 true push invite landing evidence 待補 |
| M4 | Formal Case + Repair | pairing、case、judgment、reconciliation、execution | M4 baseline 已具備；native selected-media picker、canonical dashboard native evidence 與 lifecycle reconnect evidence 待補 |
| M5 | Push + Deep Link | device token、notification landing、read/snooze/act sync、upload、telemetry | M5 baseline 已具備；provider delivery、APNs sandbox、真機 notification lifecycle 與 production native crash runtime evidence 待補 |
| M6 | Release Hardening | EAS / TestFlight、Android readiness、physical device、provider delivery、native crash runtime、evidence pack | 部分落地；release completion blockers 未清零，不得宣稱 App release sign-off complete |

## 3. M0 Foundation

| 項目 | 裁決 |
| --- | --- |
| 目標 | 讓 `mobile/` 從 Expo template 變成 Emorapy App 可開發骨架 |
| 已成為基線 | `mobile/app` Emorapy route group、provider / UI foundation、runtime config、auth/session bootstrap、root error boundary、API / storage / upload / notification / lifecycle adapter、route / copy / accessibility / platform static gate |
| 最小 gate | `npm --prefix mobile run routes:check`、`platform:check`、`accessibility:check`、`copy:check`、`typecheck`、`smoke:web`、`web:routes:smoke`、`maestro:check` |
| 不得宣稱 | App shell、web export 或 simulator smoke 不能替代 physical-device native side-effect evidence |

## 4. M1 Quick + Auth

| 項目 | 裁決 |
| --- | --- |
| 目標 | App 低門檻 quick flow、匿名 session restore、result replay 與登入後 claim |
| 已成為基線 | Quick / Auth screen、shared M1 client、collaborative quick、expired anonymous session recovery、claim-session handoff、result pending polling、`case_judgment` replay / reconnect semantics |
| 仍需閉環 | Backend / shared M1 client / Web 已有 reset-password 能力，但 App Auth screen 尚未承接 forgot-password / reset-password UX；由 [../07-待處理問題與治理/待處理/AppAuthRecoveryResetPassword未承接待辦-2026-05-31.md](../07-待處理問題與治理/待處理/AppAuthRecoveryResetPassword未承接待辦-2026-05-31.md) 追蹤 |
| 最小 gate | `features:check`、`true-service:check`、M1 screen / adapter tests、local true-service smoke evidence、Maestro selector / native simulator smoke |
| 不得宣稱 | Local true-service replay 或 RNTL AppState gate 不能替代 physical-device foreground/background stream reconnect evidence |

## 5. M2 Profile + Interview

| 項目 | 裁決 |
| --- | --- |
| 目標 | Profile、consent、Interview streaming、My Story 與 profile context reuse |
| 已成為基線 | Profile / Interview / My Story screen、shared M2 client、interview ready snapshot / `after_seq` replay、failed retry / partial-success UI、PsychDomain label helper 與 protected deep-link auth resume |
| 最小 gate | `features:check`、`true-service:check`、M2 screen / stream tests、local true-service deep probe、Maestro selector / native simulator smoke |
| 不得宣稱 | 5-turn local synthetic flow 不能替代真機 interruption recovery、native lifecycle 或完整 App SSE runtime evidence |

## 6. M3 Chat

| 項目 | 裁決 |
| --- | --- |
| 目標 | Chat room、invite、message stream、request judgment 與 judgment handoff |
| 已成為基線 | Chat Home / Room / Invite screen、shared M3 client、room event parser、chat-room AI draft replay / recovery hook、invite auth resume、notification invite landing path mapping |
| 最小 gate | `features:check`、`true-service:check`、M3 screen / parser / stream tests、local true-service chat probe、Maestro selector / native simulator smoke |
| 不得宣稱 | Chat local run、mock-backed tests 或 simulator smoke 不能替代 native reconnect 或 true provider push invite landing evidence |

## 7. M4 Formal Case + Repair

| 項目 | 裁決 |
| --- | --- |
| 目標 | Formal case、pairing、judgment、evidence upload、repair journey、execution check-in / replan |
| 已成為基線 | Case / Repair screen、shared M4 client、evidence upload explicit safety assertion handoff、formal evidence upload path、repair plan select、execution confirm、`repair_track` replay / recovery semantics |
| 仍需閉環 | Formal case create 的 backend safety assertion support 尚未反映到 shared `CreateCaseDto` 與 Web / App typed create UX；由 [../07-待處理問題與治理/待處理/正式案件安全聲明SharedDto未暴露待辦-2026-05-31.md](../07-待處理問題與治理/待處理/正式案件安全聲明SharedDto未暴露待辦-2026-05-31.md) 追蹤 |
| 最小 gate | `features:check`、`true-service:check`、M4 screen / upload / repair tests、local true-service formal case / replan probe、Maestro selector / native simulator smoke |
| 不得宣稱 | Local backend upload 或 Android picker-cancel evidence 不能替代真機 selected-media upload、canonical native dashboard 或 physical-device lifecycle evidence |

## 8. M5 Push + Deep Link + Upload + Telemetry

| 項目 | 裁決 |
| --- | --- |
| 目標 | Push device token、notification landing、read / snooze / act sync、safe upload、safe telemetry |
| 已成為基線 | Notification screen、Deep Link resolver、post-login resume、push token registration / revoke / rotation cleanup、backend push sender / dispatch / receipt polling, upload adapter, safe telemetry ingest, Emorapy OTLP JSON trace ingest, minimized telemetry persistence and Admin report |
| 最小 gate | `features:check`、`platform:check`、M5 notification / linking / upload / telemetry tests、local true-service M5 probe、release telemetry runtime evidence |
| 不得宣稱 | Push runner existence、local token sync、telemetry runtime pass 或 upload synthetic fixture 不能替代 provider delivery、APNs sandbox、真機 notification response、真機 selected asset 或 production native crash runtime evidence |

## 9. M6 Release Hardening

| 項目 | 裁決 |
| --- | --- |
| 目標 | 讓 App 具備可內測、可回滾、可留證的發布能力 |
| 已成為基線 | App identity / runtimeVersion / EAS profiles、release readiness script、native readiness gates、Android readiness gates、simulator / emulator / APK / Maestro evidence verifier、EAS iOS / Android structured runner、physical-device runner、push delivery runner、native crash runtime runner、release DB parity runner、telemetry runtime runner、release completion audit |
| 可用證據槽 | release / production DB parity、telemetry runtime、EAS Android production artifact、iOS Release simulator evidence、Android emulator / app / full-flow runtime evidence、native ImagePicker upload evidence、native readiness、upload、OTel 與 native crash SDK configuration 可作 release-hardening 證據槽；外部 sign-off 仍以 strict audit 接受的 evidence 為準 |
| 仍是 blocker | Apple submission credentials / App Store Connect API credentials 的 non-placeholder 真值、EAS iOS build artifact、TestFlight evidence、physical device evidence、push provider delivery evidence、production native crash runtime evidence |
| 完成定義 | `release:completion:audit:strict` 通過，且所有 current blocker 清零 |
| 不得宣稱 | 不能用 Expo Go、本機 true-service、simulator / emulator、dry-run runner、blocked JSON、手寫 markdown 或 local DB evidence 替代 EAS / TestFlight / physical device / provider / production native crash runtime evidence |

### 9.1 Release Blocker 與 Evidence 回鏈

| 類型 | 現行裁決 | 回鏈 |
| --- | --- | --- |
| Current blocker | `release:completion:audit` 是 App release sign-off 的 current blocker SSOT | [../07-待處理問題與治理/待處理/App外部ReleaseSignoff待辦-2026-05-16.md](../07-待處理問題與治理/待處理/App外部ReleaseSignoff待辦-2026-05-16.md) |
| App release evidence pack | pass / blocked JSON、manual runbook、external status / handoff 只作證據與交接，不直接改寫完成語氣 | [../90-證據與盤點/環境與發版驗證/README.md](../90-證據與盤點/環境與發版驗證/README.md) |
| Native local evidence index | 當前本地 native evidence 回鏈釘住 `App-Native-Maestro-2026-05-08T16-03-15-803Z.json`、`App-iOS-Release-Simulator-2026-06-20T14-04-07-291Z.json` 與 Android config readiness gate；它們只證明 local native / simulator / emulator readiness，不解除 M6 external sign-off blocker | [../90-證據與盤點/環境與發版驗證/App-Release-Hardening-2026-05-08.md](../90-證據與盤點/環境與發版驗證/App-Release-Hardening-2026-05-08.md) |
| External handoff artifact class | 外部 owner 交接由 `App-External-Evidence-Handoff-*.json` 承接；handoff 固定 owner / env / command / accepted evidence / final gates，但不替代 `release:completion:audit:strict` | [../90-證據與盤點/環境與發版驗證/README.md](../90-證據與盤點/環境與發版驗證/README.md) |
| App 測試分層 | 測試分層、進場條件、不得替代規則與 stable gate 由測試基線承接 | [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md) |
| App completion audit | App completion audit 只在 strict release sign-off 完成後才能作完成判定；non-strict audit 是進度盤點 | [../90-證據與盤點/環境與發版驗證/App-Goal-Completion-Audit-2026-05-08.md](../90-證據與盤點/環境與發版驗證/App-Goal-Completion-Audit-2026-05-08.md) |

## 10. 跨里程碑 Gate

每個 milestone 進入實作前，必須核對：

1. 對應需求是否在 [02-App完整版本工程PRD.md](./02-App完整版本工程PRD.md) 有 `CJ-PRD-APP-*`。
2. 對應能力是否在 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md) 有 Web / Backend / API / DB / shared 對照。
3. 若牽動 API / DB / shared / Push / Deep Link / upload / telemetry，是否已更新待辦與 ADR。
4. 測試是否符合 [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md)。
5. 證據是否能落到 `90-證據與盤點/` 或測試回歸包，而不是只留在口頭結論。

## 11. 推進順序裁決

App 完整版按 M0 -> M1 -> M2 -> M3 -> M4 -> M5 -> M6 推進。不得先做 Push / Deep Link 或完整 repair journey 來繞過 M0 / M1，因為 storage、API adapter、session restore 與 Quick + Auth 是後續所有鏈路的共同風險面。

若需要縮短第一個可測版本，允許交付 M0 + M1 作為 iOS internal alpha，但該版本只能宣稱「Quick + Auth alpha」，不能宣稱完整 App MVP。
