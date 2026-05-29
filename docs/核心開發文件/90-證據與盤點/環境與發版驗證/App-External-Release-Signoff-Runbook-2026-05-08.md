# App External Release Signoff Runbook

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據文檔
**來源時間**：2026-05-08
**上下文**：App release sign-off 外部憑證、真機、EAS / TestFlight / provider / Sentry / release DB 證據交接
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-08`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v1.0
**最後更新**：2026-05-08
**對應範圍**：`mobile/scripts/run-release-external-evidence-signoff.mjs`、`mobile/scripts/check-release-external-evidence-status.mjs`、`mobile/scripts/check-release-completion-audit.mjs`、`mobile/scripts/check-app-goal-completion-audit.mjs`、`.github/workflows/app-release-external-signoff.yml`

---

## 1. 使用時機

本文件只處理 App 完整版最後 release sign-off 的外部證據交接。它不替代 App PRD、Roadmap、測試基線或本地 preflight。

當以下本地 gate 已通過，但 strict audit 仍因外部條件失敗時，使用本 runbook：

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer npm --prefix mobile run release:preflight
npm --prefix mobile run goal:completion:audit:strict
```

`goal:completion:audit:strict` 在以下項目全部清零前必須失敗：

- EAS project id / `EXPO_TOKEN`
- Apple submission credentials / App Store Connect API credentials
- EAS iOS production build + TestFlight evidence
- EAS Android production build evidence
- physical device smoke evidence
- Expo / APNs provider delivery evidence
- Sentry native crash runtime evidence
- App telemetry runtime ingest evidence
- release / production DB parity evidence

## 2. 不可接受的替代物

以下內容不能消除 blocker：

- 手寫 markdown、截圖、聊天記錄或 raw console output。
- 本機 simulator / emulator evidence 代替 physical device evidence。
- 本機 APK / `.app` build 代替 EAS production artifact。
- blocked JSON 代替 pass JSON。
- `--skip` 跳過任何外部步驟後的成功狀態。
- placeholder / fake UUID 代替真實 `mobile/app.json` `extra.eas.projectId`。
- local DB parity 代替 release / production PostgreSQL parity。

strict audit 只接受對應 runner 產出的 structured JSON，且每份 evidence 必須 `blocked=false` 並匹配當前 app id、version、build number。

## 3. 前置輸入

### 3.0 本地環境模板

先從模板建立本機私有 env 文件：

```bash
cp mobile/release.env.example mobile/release.env.local
npm --prefix mobile run release:external-evidence:env-template:check
```

`mobile/release.env.example` 只允許保存 placeholder；填好後的 `mobile/release.env.local` 不得提交。模板預設 `APP_RELEASE_EXTERNAL_SIGNOFF_RUN=false`，避免複製後直接進入正式 run。Do not commit real secrets。

外部 owner 填值清單見 [App-External-Signoff-Input-Checklist-2026-05-16.md](./App-External-Signoff-Input-Checklist-2026-05-16.md)。該清單只列 required env / config keys 與 safe validation signals，不保存任何 secret value。

填值後可先跑 `npm --prefix mobile run release:external-evidence:input-status -- --json` 檢查本機 `mobile/release.env.local` 與 `extra.eas.projectId` 的 redacted 狀態；該命令只輸出 key names、placeholder / missing counts 與 `ready_for_validate`，不輸出任何 value，也不連 EAS、Apple、Sentry、DB 或裝置。

若要在本機逐項補值，可直接跑 `npm --prefix mobile run release:external-evidence:fill-inputs`。它只會在互動終端讀取缺值、可選地更新 `mobile/app.json` 的 `extra.eas.projectId`，並在寫回後自動重跑 `release:external-evidence:input-status`，同樣不會把 secret value 寫進聊天或 log。若只想先看還缺什麼，可加 `--list-missing`。

若準備使用 GitHub workflow，先跑 `npm --prefix mobile run release:external-evidence:github-secrets:check -- --json` 盤點 repository / `Production` GitHub Environment secret names；workflow 會透過 `github_environment` input 綁定同一個 GitHub Environment，避免把其他 environment 的 secret 誤判為可用。這只讀 secret names，不讀 secret values。secrets 配置完成後，再跑 `npm --prefix mobile run release:external-evidence:github-secrets:strict -- --json`，缺任一 required release secret name 會 exit non-zero，應在 workflow `mode=validate` 前先清零。

若本機 `mobile/release.env.local` 已填好，可用 `npm --prefix mobile run release:external-evidence:github-secrets:sync -- --json` 先做 redacted dry-run；確認 `secret_count=16` 後，再用 `npm --prefix mobile run release:external-evidence:github-secrets:sync -- --apply --json` 寫入 `Production` GitHub Environment secrets。該工具預設不寫入、拒絕 placeholder、不輸出 secret values，並會把本機 `DATABASE_URL` 對應到 workflow 使用的 `APP_RELEASE_DATABASE_URL`，把 `APP_STORE_CONNECT_PRIVATE_KEY_PATH` 指向的 `.p8` 內容寫入 `APP_STORE_CONNECT_PRIVATE_KEY`。

模板也固定 `APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR`、`APP_PHYSICAL_DEVICE_PLATFORM` 與 `APP_EAS_IOS_REQUIRE_TESTFLIGHT` 作為本機交接開關：前者控制 status / handoff / prerequisite report 落盤位置，後兩者控制預設真機平台與 iOS TestFlight 查詢是否必跑。這些開關只能改變編排方式，不能替代任何 pass evidence。

正式 sign-off orchestrator 支援 `--release-env-file=release.env.local`，會在讀取 release mode / platform / credentials 前載入該檔案。這個專用參數名刻意避開 Node / npm 內建的 `--env-file` 行為。loader 只解析白名單內的 release sign-off `KEY=value` / `export KEY=value`，不執行 shell expansion，不輸出任何 value，且不覆蓋已存在的 process env；`REPLACE_WITH_...` placeholder 會被視為未配置，不會讓 validate 誤判通過。`NODE_OPTIONS`、`PATH` 這類非 release sign-off key 會在 validation 前被拒絕。

`mobile/.gitignore` 必須覆蓋 `mobile/release.env.local` 與 `mobile/release.env.*.local`；`release:external-evidence:env-template:check` 會同時檢查模板、runbook 與 ignore contract。

### 3.1 Project / EAS

- 在 `mobile/` 下完成真實 EAS project 初始化。
- `mobile/app.json` 必須包含 UUID 形狀的 `expo.extra.eas.projectId`。
- EAS CLI 必須在 runner PATH 上可用；`release:check` 與 `release:external-evidence:status` 都會只以 warning / info / boolean 顯示可用 / authenticated 狀態，不輸出 Expo 帳號。
- `EXPO_TOKEN` 必須可非交互查詢 EAS build metadata。

建議先跑：

```bash
npm --prefix mobile run release:external-evidence:status
npm --prefix mobile run release:external-evidence:handoff:check
npm --prefix mobile run release:external-evidence:handoff:contract
```

`EAS project id valid UUID` 必須為 `yes`。
`EAS CLI available` 必須為 `yes`。`EAS CLI authenticated` 可以協助人工診斷，但正式 runner 仍以 `EXPO_TOKEN` 作非交互 EAS 查詢憑證。

`release:external-evidence:handoff:check` 會把當前 normalized blockers 轉成 owner surface、required env keys、正式命令、接受的 evidence 文件與 final strict gates；physical device owner action 會同時列出 iOS / Android `release:external-evidence:validate/run -- --physical-platform=...` 編排命令與底層 `physical-device:smoke` 命令，避免只跑底層 smoke 而跳過 prerequisite validation、status / handoff report、redaction 與 strict audit 編排。若加 `--report-dir=<path>`，會輸出 `App-External-Evidence-Handoff-*.json`。`release:external-evidence:handoff:contract` 會驗證 handoff JSON schema、known blocker catalog、platform-specific validate / run command、controlled secret redaction 與 report artifact 可被 generated evidence redaction 掃描。該 handoff report 只用於交接，不是 pass evidence。

### 3.2 iOS / TestFlight

需要：

- `ASC_APPLE_ID`
- `EXPO_APPLE_APP_SPECIFIC_PASSWORD`
- `APP_STORE_CONNECT_ISSUER_ID` 或 `ASC_ISSUER_ID`
- `APP_STORE_CONNECT_KEY_ID` 或 `ASC_KEY_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY` / `ASC_PRIVATE_KEY`，或 `APP_STORE_CONNECT_PRIVATE_KEY_PATH` / `ASC_PRIVATE_KEY_PATH`
- 可選：`APP_STORE_CONNECT_APP_ID` / `ASC_APP_ID`

TestFlight evidence 必須由 `mobile/scripts/run-eas-ios-release-smoke.mjs` 查詢 App Store Connect，並證明 matching build 存在、processing state 為 `VALID` 且未過期。

### 3.3 Physical Device

iOS physical smoke 需要：

- connected / unlocked / trusted iPhone
- `APP_IOS_DEVICE_UDID` 或 `APP_PHYSICAL_DEVICE_ID`
- `APP_IOS_DEVICE_APP_PATH` 指向 signed `.app`

Android physical smoke 需要：

- adb 可見的 booted physical Android device
- `APP_ANDROID_DEVICE_SERIAL` 或 `APP_PHYSICAL_DEVICE_ID`

runner 會拒絕 simulator / emulator / offline device。

### 3.4 Push Delivery

需要：

- `APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN`
- 可選：`APP_PUSH_DELIVERY_ACCESS_TOKEN` 或 `EXPO_PUSH_ACCESS_TOKEN`

pass evidence 必須包含 provider accepted ticket 與 `ok` receipt。

### 3.5 Native Crash Runtime

需要：

- `APP_SENTRY_ORG` 或 `SENTRY_ORG`
- `APP_SENTRY_PROJECT` 或 `SENTRY_PROJECT`
- `APP_SENTRY_AUTH_TOKEN` 或 `SENTRY_AUTH_TOKEN`
- `APP_NATIVE_CRASH_SENTRY_EVENT_ID` 或 `SENTRY_EVENT_ID`
- 可選：`APP_NATIVE_CRASH_EXPECTED_ENVIRONMENT`

controlled native crash event 必須匹配 `cj-mobile@<version>+<build>` release、expected environment、native runtime signal 與 crash-like exception。

### 3.6 App Telemetry Runtime Ingest

需要：

- `APP_TELEMETRY_RUNTIME_API_BASE_URL` 指向 release API base URL，例如 `https://<release-api>/api/v1`。

該 URL 不能是 localhost / 127.0.0.1 / ::1。evidence 必須由 `mobile/scripts/run-telemetry-runtime-smoke.mjs` 產出，並先證明 release backend `GET /version` 的 `service=backend` 且 `commitSha` 等於 runner 執行當下的本地 `git rev-parse HEAD`，再證明 `POST /telemetry/events` 與 `POST /telemetry/otlp/v1/traces` 都接受受控 safe payload。正式證據只保存 API host、request id、session id、trace id、span id 的 SHA-256、backend version summary 與 safe counts，不保存原始 URL 或任何 token。runner 支援 `--release-env-file=release.env.local`，只從白名單 key 讀取 `APP_TELEMETRY_RUNTIME_*`，不 eval、不輸出 raw value；production backend 只允許這兩個 App native telemetry ingest 端點接受無 `Origin` 請求，非白名單瀏覽器 `Origin` 仍必須返回 `CORS_ORIGIN_DENIED`。若 `/version.commitSha` 缺失、為 `unknown`、不等於 runner 執行當下的本地 `HEAD`，或 runner 不能解析本地 `HEAD`，runner 必須輸出 blocked evidence 並停止在 event / OTLP POST 之前；進入 release audit 後，若 evidence backend commit 不是目前 `HEAD` 的祖先，或該 commit 後改過 backend telemetry/version runtime 路徑，舊 evidence 也必須失效。

dry-run：

```bash
npm --prefix mobile run telemetry:runtime:smoke -- --dry-run --release-env-file=release.env.local
```

正式 run：

```bash
npm --prefix mobile run telemetry:runtime:smoke -- --run --release-env-file=release.env.local
```

### 3.7 Release DB Parity

需要：

- `DATABASE_URL` 指向 release 或 production PostgreSQL。

該 URL 不能是 local target。evidence 必須由 `backend/scripts/check-release-db-parity.ts` 產出，並證明 required release-blocking migrations 全部 applied、無 missing / incomplete / failed。

## 4. 本地安全驗證

先跑兩個 dry-run 分支，確認 orchestrator 的 iOS 預設 branch 與 Android physical-platform branch 都能展開 runner，不觸碰 EAS / provider / 真機 / release DB：

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer npm --prefix mobile run release:external-evidence:signoff
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer npm --prefix mobile run release:external-evidence:signoff:android-dry-run
```

拿到外部輸入後先只跑 validate，不觸碰 EAS / provider / 真機 / release DB：

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer npm --prefix mobile run release:external-evidence:validate -- --release-env-file=release.env.local --report-dir=/tmp/cj-app-signoff-prereq
```

Android physical device 作為本輪 physical gate 時，validate 也必須顯式走 Android branch：

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer npm --prefix mobile run release:external-evidence:validate -- --release-env-file=release.env.local --physical-platform=android --report-dir=/tmp/cj-app-signoff-prereq
```

如果失敗，查看 `/tmp/cj-app-signoff-prereq/App-External-Signoff-Prerequisites-*.json`。該報告只應包含 missing ids、EAS CLI availability、credential / device / signed app / push / Sentry / DB input presence booleans、iOS / Android 真機可見性 counters、requested-device match boolean，以及 secret-safe `resolution_hints`（owner surface、required env keys、placeholder command、docs）；不應包含 token、UDID、serial、DB URL、push token 或 Sentry event id 原文。

當前本機 iOS validate-only 交接報告見 [App-External-Signoff-Prerequisites-2026-05-16T07-29-51-655Z.json](./App-External-Signoff-Prerequisites-2026-05-16T07-29-51-655Z.json)。該報告 `mode=validate`、`summary.blocked=true`、`summary.missing_count=16`、`summary.report_contains_secrets=false`，並在觸碰 EAS、provider APIs、physical devices、Sentry、telemetry backend 或 release DB 前停止；缺項包括真實 EAS project id、Expo token、Apple / ASC credentials、iOS physical device id + signed app path、push token、Sentry org/project/auth token、controlled native crash event id、telemetry runtime API base URL 與 release database URL。

Android physical branch 的 validate-only 交接報告見 [App-External-Signoff-Prerequisites-2026-05-16T07-29-50-317Z.json](./App-External-Signoff-Prerequisites-2026-05-16T07-29-50-317Z.json)。該報告同樣 `mode=validate`、`summary.blocked=true`、`summary.missing_count=15`、`summary.report_contains_secrets=false`，並在外部步驟前停止；與 iOS branch 的差異是 physical device 缺項改為 `APP_ANDROID_DEVICE_SERIAL` / Android authorized physical device visibility。

## 5. 正式一鍵編排

所有前置輸入齊備後，執行：

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer npm --prefix mobile run release:external-evidence:run -- --release-env-file=release.env.local --physical-platform=ios --report-dir=/tmp/cj-app-signoff
```

Android physical device 作為本輪 physical gate 時：

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer npm --prefix mobile run release:external-evidence:run -- --release-env-file=release.env.local --physical-platform=android --report-dir=/tmp/cj-app-signoff
```

正式 run 不允許 `--skip`。編排順序固定為：

1. external evidence status
2. external evidence handoff
3. EAS iOS production build + TestFlight evidence
4. EAS Android production build evidence
5. physical device smoke evidence
6. Expo push provider delivery evidence
7. Sentry native crash runtime evidence
8. App telemetry event + OTLP runtime ingest evidence
9. release / production DB parity evidence
10. `release:completion:audit:strict`
11. `goal:completion:audit:strict`

## 6. CI 入口

手動 workflow：

```text
.github/workflows/app-release-external-signoff.yml
```

本地 contract gate：

```bash
npm --prefix mobile run release:external-evidence:workflow:check
```

該 gate 只驗證 workflow text 仍保留 mode / runner / run-mode secret probe（iOS 時要求 `APP_IOS_DEVICE_UDID` + `APP_IOS_DEVICE_APP_PATH`，Android 時要求 `APP_ANDROID_DEVICE_SERIAL`）/ App `release:preflight` 在外部 sign-off 前執行 / preflight step-level `APP_RELEASE_EXTERNAL_SIGNOFF_RUN=false` / generated handoff report / `App-Goal-Completion-Audit-*.json` / generated redaction / artifact upload / status report artifact / handoff report artifact / prerequisite report artifact contract，不連 GitHub，也不替代任何 external pass evidence。

workflow 的 App `release:preflight` step 必須顯式覆蓋 `APP_RELEASE_EXTERNAL_SIGNOFF_RUN=false`。這是為了避免 `mode=run` 的 job-level env 讓 preflight 內的 dry-run signoff 入口提前觸碰 EAS、provider、真機或 release DB；正式外部動作只能由後續 `release:external-evidence:run` step 觸發。

workflow / orchestrator 會把當次 `release:external-evidence:status` 落為 `App-External-Evidence-Status-*.json`，其中包含 credential presence（含 Sentry runtime query credentials 與 native crash event id presence）、device counters、type-aware / identity-bound structured evidence candidate state、normalized blockers 與 next commands；status 與 strict completion audit 共用 `mobile/scripts/lib/release-evidence-policy.mjs` 做外部 evidence 判定；該 status report 是交接診斷 artifact，不是 pass evidence。

orchestrator 在 `--report-dir=...` 下也會執行 `release:external-evidence:handoff:check` 並輸出 `App-External-Evidence-Handoff-*.json`，把當前 normalized blockers 對應到 owner action / env / command / evidence / strict gate；physical device action 會固定 iOS / Android platform-specific validate / run command，方便本地與 CI 使用同一種交接 artifact。workflow 仍會在 signoff 後再生成一份 handoff report，讓失敗或成功後的當前 blocker 清單也被 artifact 收集。handoff artifact 同樣必須通過 generated evidence redaction gate，且不能替代任何 structured pass evidence。

推薦順序：

1. `mode=dry-run`：確認 workflow / dependencies / local gates；本地至少跑 `release:external-evidence:signoff` 與 `release:external-evidence:signoff:android-dry-run`。
2. `release:external-evidence:github-secrets:sync -- --json`：若要由本機 env 檔寫入 GitHub Environment secrets，先做 redacted dry-run；確認後才加 `--apply`。
3. `release:external-evidence:github-secrets:strict -- --json`：確認 GitHub repository / `Production` GitHub Environment secret names 齊備；該命令不讀 secret value，只在缺 required name 時失敗。
4. `mode=validate`：確認 GitHub repository secrets / runner inputs 齊備，並用 `xcrun xctrace` / `adb devices -l` 做 secret-safe 真機可見性前置檢查；iOS runner input 需提供 `APP_IOS_DEVICE_UDID` + `APP_IOS_DEVICE_APP_PATH`，Android runner input 需提供 `APP_ANDROID_DEVICE_SERIAL`；仍不觸碰外部 provider、不安裝 App、不連 release DB。
5. `mode=run`：只在可信 runner、真機、release DB 與所有 secrets 齊備後執行。

iOS physical evidence 需要可接真機的 trusted macOS runner。GitHub-hosted `macos-15` 不應被視為 iOS physical-device runner。

## 7. Strict Audit 接受的 Evidence

| Blocker | 接受文件 | 產生入口 |
| --- | --- | --- |
| EAS iOS production build | `App-EAS-iOS-Release-*.json` | `npm --prefix mobile run eas-ios-release:smoke -- --run` |
| TestFlight | `App-EAS-iOS-Release-*.json` | `npm --prefix mobile run eas-ios-release:smoke -- --run --require-testflight` |
| EAS Android production build | `App-EAS-Android-Release-*.json` | `npm --prefix mobile run eas-android-release:smoke -- --run` |
| Physical device | `App-Physical-Device-*.json` | `npm --prefix mobile run physical-device:smoke -- --platform=ios --app-path=<signed-app>` 或 Android physical 模式 |
| Push provider delivery | `App-Push-Delivery-*.json` | `npm --prefix mobile run push-delivery:smoke -- --run` |
| Native crash runtime | `App-Native-Crash-Runtime-*.json` | `npm --prefix mobile run native-crash:runtime:smoke -- --run` |
| App telemetry runtime ingest | `App-Telemetry-Runtime-*.json` | `npm --prefix mobile run telemetry:runtime:smoke -- --run --release-env-file=release.env.local` |
| Release DB parity | `App-Release-DB-Parity-*.json` | `DATABASE_URL=<release-or-production-postgresql-url> npm --prefix backend run ops:release-db:evidence` |

最後完成判定只看：

```bash
npm --prefix mobile run release:completion:audit:strict
npm --prefix mobile run goal:completion:audit:strict
```

兩者都通過後，才允許考慮 `/goal` complete。
