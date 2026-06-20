# App 外部 Release Sign-off 待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App 外部 release sign-off 的 EAS / TestFlight / physical device / push provider / Sentry native crash / telemetry runtime / release DB parity 缺口
**取證代碼入口**：`mobile/package.json`、`mobile/app.json`、`mobile/scripts/check-release-external-signoff-input-status.mjs`、`backend/scripts/check-release-db-parity.ts`
**最後核驗 Commit**：`e7d2af5`
**最後核驗日期**：`2026-06-20`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：待外部輸入與 iOS / TestFlight / provider / native crash evidence 補齊（Emorapy identity 已落入 `mobile/app.json`；舊 `com.cj.motherbearcourt` structured evidence 已標記 stale）
**Owner**：Mobile / Ops / QA
**關聯核心文件**：`90-證據與盤點/環境與發版驗證/App-External-Signoff-Input-Checklist-2026-05-16.md`、`90-證據與盤點/環境與發版驗證/App-External-Release-Signoff-Runbook-2026-05-08.md`、`90-證據與盤點/環境與發版驗證/App-Release-Hardening-2026-05-08.md`、`90-證據與盤點/環境與發版驗證/App-Goal-Completion-Audit-2026-05-08.md`

---

## 問題

App 內部實作、文件、preflight 與 release audit contract 已就緒，但外部 release sign-off 尚未完成。不得把 non-strict `release:preflight`、dry-run orchestrator、prerequisite report、status / handoff snapshot 或 placeholder env file 視為正式 release 完成證據。

## 已排查且無結果

- 已查 `npx expo config --json`、`mobile/.expo`、`~/.expo/state.json`、`~/Library/Preferences/eas-cli-nodejs/user-settings.json`、git history 與本機 Expo / EAS cache，未找到可回收的真實 `extra.eas.projectId`。
- `mobile/scripts/lib/release-app-config.mjs` 只讀 `mobile/app.json` 裡的 `expo.extra.eas.projectId`，沒有其他 fallback。
- `eas whoami` 目前回覆 `Not logged in`，因此無法以本機 authenticated 狀態補出 project metadata。
- `mobile/release.env.local` 已由現有 production 配置回收 `DATABASE_URL` 與 `APP_TELEMETRY_RUNTIME_API_BASE_URL`，但其餘 release sign-off keys 仍為 placeholder，`release:external-evidence:input-status` 仍維持 `ready_for_validate=false`。2026-05-30 已把該 status helper 分層為 `current_completion_blocker_inputs` 與 `evidence_refresh_inputs`：前者對應當前尚未解除的外部 completion inputs，後者對應已產出 canonical pass evidence、但在後續 release / DB / telemetry / backend version drift 後仍需刷新取證的輸入。
- 2026-05-29 已確認 `telemetry:runtime:smoke -- --dry-run --release-env-file=release.env.local` 可安全讀取本機 release env；首輪正式 run 對 non-local release API 回 `CORS_ORIGIN_DENIED`，後端已補 App native telemetry originless CORS 合約。Railway backend `/version` 後續已回到 `3114ca0` 並與 runner 執行當下的本地 `HEAD` 對齊，runner / audit 已新增 backend version precheck；canonical `App-Telemetry-Runtime-2026-05-29T16-00-52-498Z.json` 已通過 `backend_version_passed=true`、event ingest 與 OTLP ingest，`telemetry_runtime_evidence` blocker 已解除。
- 已再查常見工作區的 `.p8` / `.ipa` / `.app` / release env 位置，只找到無關的安裝器 `.app` 與 `.vercel/.env.production.local`，未找到可直接填入 `APP_STORE_CONNECT_PRIVATE_KEY_PATH`、`APP_IOS_DEVICE_APP_PATH` 或其他 release 真值的資產。

## 當前本地證據

| 項目 | 狀態 | 證據 |
| --- | --- | --- |
| 本地 release preflight | 已通過 | `npm --prefix mobile run release:preflight`，30 Jest suites / 134 tests passed，且跑完 `release:external-evidence:input-status`、`release:completion:audit`、`goal:completion:audit`、`release:check` |
| 外部輸入狀態檢查 | 已建立 / 未 ready | 2026-06-20 `npm --prefix mobile run release:external-evidence:input-status -- --release-env-file=release.env.local --json` 顯示 `filled_count=4/17`、`placeholder_count=13`、`missing_count=0`、`ready_for_validate=false`；其中 `input_groups.current_completion_blocker_inputs` 顯示 current completion inputs `2/15`，已填 `APP_EAS_PROJECT_FULL_NAME` 與 `EXPO_TOKEN`，`ready_for_current_completion_inputs=false`，`input_groups.evidence_refresh_inputs` 顯示 DB / telemetry refresh inputs `2/2`、`ready_for_evidence_refresh_inputs=true`，`input_groups.app_store_record_prerequisites` 顯示 App Store record app id `0/1`、`APP_STORE_CONNECT_APP_ID` 仍為 placeholder、`ready_for_app_store_record_inputs=false`，且 App config name / iOS bundle id / Android package 仍匹配 locked Emorapy identity。目前已填入 `APP_EAS_PROJECT_FULL_NAME`、`EXPO_TOKEN`、`DATABASE_URL` 與 `APP_TELEMETRY_RUNTIME_API_BASE_URL`；另已建立 `npm --prefix mobile run release:external-evidence:fill-inputs` 作為本機互動補值入口，`--list-missing` 可只看缺口與分層 |
| Telemetry runtime env-file / CORS / backend version | 已閉環 | `telemetry:runtime:smoke -- --dry-run --release-env-file=release.env.local` 與正式 `--run` 已通過；runner 先查 release backend `/version` 並要求 `commitSha` 等於執行當下的本地 `HEAD`，再送 event / OTLP；audit 允許後續 docs / evidence 提交，但若 backend telemetry/version runtime 路徑在證據 commit 後改動，舊證據會失效；canonical `App-Telemetry-Runtime-2026-05-29T16-00-52-498Z.json` 已 `blocked=false`，`release:completion:audit -- --json` 顯示 `telemetry_runtime_evidence` passed |
| Backend version env precedence | 已修復 / 已驗證 | 2026-06-20 用 Emorapy identity 重跑 `telemetry:runtime:smoke -- --run --release-env-file=release.env.local --evidence-dir=/tmp/emorapy-telemetry-runtime-check` 時，runner 正確拒絕產出 pass evidence：Railway deployment metadata 已是 `0ace4b1`，但 live `/version.commitSha` 仍回 `49040d0`，原因是 stale manual `CJ_COMMIT_SHA` 優先於 Railway 平台注入的 deployment SHA。已調整 backend version manifest：Railway runtime 先讀 `RAILWAY_GIT_COMMIT_SHA`，再 fallback `EMORAPY_COMMIT_SHA` / legacy `CJ_COMMIT_SHA`；修復部署到 release backend `a1298b5` 後，`App-Telemetry-Runtime-2026-06-20T08-52-45-182Z.json` 已驗證 `/version.commitSha` 對齊、event ingest 與 OTLP ingest 均通過 |
| 外部 status / handoff 快照 | 已建立 / 未完成 | 最新 secret-safe 快照為 `App-External-Evidence-Status-2026-06-20T11-58-54-050Z.json` 與 `App-External-Evidence-Handoff-2026-06-20T11-58-57-287Z.json`；只作 owner 交接、env-file provenance 與 normalized blocker 索引，已確認 EAS project binding / Expo token / EAS Android production artifact 不再是當前 blocker；仍不解除 EAS iOS / TestFlight / physical device / provider delivery / production native crash runtime blocker |
| EAS project id / full name binding | 已完成 / Emorapy project 已建立 | 2026-06-20 已移除舊 `cj-mobile` projectId，使用 `EXPO_TOKEN` 執行 `npx eas-cli@20.3.0 project:init --non-interactive --force` 建立並綁定 `@alexdev518/emorapy-mobile`；`mobile/app.json` 現為 `expo.extra.eas.projectId=73ba39d3-6218-4748-ae36-8d3a93ba34ac`。`npx eas-cli@20.3.0 project:info --non-interactive` 回 `fullName @alexdev518/emorapy-mobile` / 同一 project id；`release:external-evidence:input-status -- --release-env-file=release.env.local --json` 顯示 `eas_project_binding_valid=true` |
| Expo token | 已完成 / 本機 secret | `EXPO_TOKEN` 已寫入 gitignored `mobile/release.env.local`，`release:external-evidence:status -- --release-env-file=release.env.local --json` 顯示 `expo_token_present=true`，`release:completion:audit` 顯示 `expo_token` passed；不得提交 token value，若同步到 CI 必須走 `release:external-evidence:github-secrets:sync -- --apply` |
| Release completion credential / env-file guard | 已修復 / 已納入 contract | 2026-06-20 發現若用一般 shell env 載入 `release.env.local`，`release:completion:audit` 會把 `REPLACE_WITH_*` placeholder 誤視為 credentials present；已改為只有 non-placeholder `EXPO_TOKEN`、`ASC_APPLE_ID`、`EXPO_APPLE_APP_SPECIFIC_PASSWORD`、App Store Connect issuer/key/private-key input 才能解除 `expo_token`、`apple_submission_credentials` / `app_store_connect_api_credentials` blocker。`release:completion:audit` 與 `goal:completion:audit` 現正式支援 `--release-env-file=release.env.local`，共用 allowlisted loader、拒絕 `--env-file` / unsupported key、不輸出 secret values，並以 `release:completion:audit:contract` fixture 固定 placeholder env-file 仍不得解除 blocker |
| EAS Android production artifact | 已完成 / Emorapy identity pass evidence | 2026-06-20 已在新 EAS project `@alexdev518/emorapy-mobile` 產生 Android store production build `56720475-d1fe-447e-adf0-455719b8683b`，pass evidence 為 [App-EAS-Android-Release-2026-06-20T09-25-12-330Z.json](../../90-證據與盤點/環境與發版驗證/App-EAS-Android-Release-2026-06-20T09-25-12-330Z.json)；舊 [App-EAS-Android-Release-2026-06-13T10-27-04-956Z.json](../../90-證據與盤點/環境與發版驗證/App-EAS-Android-Release-2026-06-13T10-27-04-956Z.json) 仍作 historical stale evidence，不再解除 current Emorapy release blocker |
| Sentry iOS native prebuild configuration | 已刷新 / 本機 generated output | 2026-06-20 已用 `SENTRY_DISABLE_AUTO_UPLOAD=true npx expo prebuild --platform ios --clean --no-install` 重新生成 gitignored `mobile/ios`，`Emorapy.xcodeproj` 內含 `PRODUCT_BUNDLE_IDENTIFIER=com.emorapy.app`、`sentry-xcode.sh` 與 `Upload Debug Symbols to Sentry` / `sentry-xcode-debug-files.sh` phases；證據為 [App-iOS-Sentry-Prebuild-2026-06-20T08-43-59Z.json](../../90-證據與盤點/環境與發版驗證/App-iOS-Sentry-Prebuild-2026-06-20T08-43-59Z.json)，`release:completion:audit` 中 `sentry_ios_native_prebuild_configuration` 已 passed。此證據不包含 Sentry DSN / org / project / token，也不替代 production native crash runtime evidence |
| GitHub Actions release secrets | 部分完成 / 未 ready | 2026-06-20 `npm --prefix mobile run release:external-evidence:github-secrets:check -- --json` 只讀 secret names 且 `values_redacted=true`；checker 與 `.github/workflows/app-release-external-signoff.yml` 以 `Production` GitHub Environment 作為預設 workflow secret scope。已同步 `APP_RELEASE_DATABASE_URL` 與 `APP_TELEMETRY_RUNTIME_API_BASE_URL` 到 `Production` environment，`present_secret_name_count=2`、`missing_secret_name_count=14`、`ready_for_workflow_validate=false`；其中 `secret_groups.current_completion_blocker_secret_names` 為 `0/14`、`secret_groups.evidence_refresh_secret_names` 為 `2/2`。尚缺 `EXPO_TOKEN`、Apple / ASC、push、Sentry、iOS / Android device 與 `APP_NATIVE_CRASH_SENTRY_EVENT_ID` 等外部 secrets，因此 workflow 目前不能進入有效 validate / run |
| GitHub Actions release variables | 已查 / 無可回收值 | `gh variable list --repo Alex0158/mother-bear-court --json name` 與 `gh variable list --repo Alex0158/mother-bear-court --env Production --json name` 均回空陣列；未找到可回收的 `EAS_PROJECT_ID`、Sentry org/project 或 release config 變數 |
| GitHub Actions secret sync helper | 已建立 / contract 已納入 preflight / 等待真值 | `npm --prefix mobile run release:external-evidence:github-secrets:sync -- --json` 會從 gitignored `mobile/release.env.local` 做 redacted dry-run；dry-run 只做本機 readiness，不要求 `gh` / GitHub auth / network，確認後才可加 `--apply` 檢查 `Production` GitHub Environment 並寫入 secrets。工具拒絕 placeholder，不輸出 secret values，並把 `DATABASE_URL` 映射成 `APP_RELEASE_DATABASE_URL`、把 `APP_STORE_CONNECT_PRIVATE_KEY_PATH` 指向的 `.p8` 內容映射成 `APP_STORE_CONNECT_PRIVATE_KEY`；GitHub repo 解析優先序為 `--repo`、`EMORAPY_GITHUB_REPO`、`GITHUB_REPOSITORY`、legacy default `Alex0158/mother-bear-court`；`release:external-evidence:github-secrets:sync:contract` 已用受控 fixture 固定 local-only dry-run、secret group 分層、mapping、repo alias、redaction 與 apply-only GitHub dependency |
| Release signoff report dir template | 已收斂 / gate 已加固 | `mobile/release.env.example` 的 `APP_RELEASE_EXTERNAL_SIGNOFF_REPORT_DIR` 預設值已改為 `/tmp/emorapy-app-signoff`，`release:external-evidence:env-template:check` 會拒絕回退到舊 `/tmp/cj-app-signoff`。此項只影響未來本機 report 輸出目錄，不改 `release.env.local`、GitHub runner temp path 或歷史 evidence artifact |
| Release completion audit | 未完成 / Android local evidence 已刷新 | 2026-06-20 帶本機 release env 的正式指令為 `npm --prefix mobile run release:completion:audit -- --release-env-file=release.env.local --json`；在 Emorapy identity 下 `failures=0`、`passed=15`、`blocked=8`；Android emulator/app/Maestro 與 native upload evidence 已用 `com.emorapy.app` 重新產出，舊 iOS simulator evidence 仍因 `com.cj.motherbearcourt` 被標記 stale ignored。`eas_project_id`、`expo_token`、`eas_android_build_artifact`、`android_emulator_runtime_evidence`、`android_app_runtime_evidence`、`android_full_flow_evidence`、`native_imagepicker_upload_evidence`、`sentry_ios_native_prebuild_configuration` 與 `telemetry_runtime_evidence` 已解除；剩餘需補 Apple / ASC 憑證、EAS iOS artifact、TestFlight、iOS Release simulator refresh、physical device、provider delivery 與 native crash runtime |
| iOS Release simulator refresh | Runner 已建立 / 本機 Xcode blocked | 2026-06-20 已新增 `npm --prefix mobile run ios:release-simulator:smoke` structured runner，並將 Expo SDK 55 patch dependencies 對齊到 `expo install --check` 通過；當前本機 `xcode-select -p` 指向 `/Library/Developer/CommandLineTools`，`xcrun simctl list devices available` 回 `unable to find utility "simctl"`，因此尚不能產生 Emorapy identity pass evidence。需安裝 / 選定完整 Xcode（例如 `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`）與可用 iOS simulator runtime 後重跑 |
| Goal completion audit | 未完成 | 2026-06-20 `npm --prefix mobile run goal:completion:audit -- --release-env-file=release.env.local --json` 顯示 `passed=11`、`missing_or_incomplete=1`，唯一未完成項仍為 `release_signoff` |

## 2026-06-20 當前 owner-action matrix

本節是最新 audit 後的行動清單；只列仍會阻止 `release:completion:audit:strict` / `goal:completion:audit:strict` 通過的外部或本機條件。所有 secret value 只可放在 gitignored `mobile/release.env.local` 或 GitHub Environment secrets，不得寫入 repo。

| Blocker / 前置 | Owner action | 完成後我方可執行 |
| --- | --- | --- |
| Apple submission credentials | 在 Apple ID 建立 app-specific password，提供 `ASC_APPLE_ID` 與 `EXPO_APPLE_APP_SPECIFIC_PASSWORD` 到 ignored env / CI secret | 重跑 `release:external-evidence:input-status`、EAS iOS build smoke |
| App Store Connect API credentials | 在 App Store Connect 建立 API key，提供 issuer id、key id、`.p8` private key path 或 CI private key secret；同時維持 Bundle ID `com.emorapy.app` | 跑 `eas-ios-release:smoke -- --run --require-testflight` 產 EAS iOS / TestFlight evidence |
| App Store record prerequisite | 在 App Store Connect 建立 App：Name `Emorapy`、Primary Language `English (U.S.)`、Bundle ID `com.emorapy.app`、SKU `emorapy-ios-app`，再把 app id 回填 `APP_STORE_CONNECT_APP_ID` / `ASC_APP_ID` | 驗證 `ready_for_app_store_record_inputs=true`，並把 App Store record 狀態納入後續 release 交接 |
| iOS Release simulator evidence | 安裝 / 選定完整 Xcode 與可用 iOS simulator runtime；目前 CommandLineTools 無 `simctl` | 重跑 `ios:release-simulator:smoke` 產 Emorapy identity simulator pass JSON |
| Physical device evidence | 提供可信 iOS device UDID 與 signed app path，或 Android physical device serial；設備需可被 `xctrace` / `adb` 看到 | 跑 `release:external-evidence:validate/run --physical-platform=<ios|android>` 與 `physical-device:smoke` |
| Push provider delivery evidence | 提供可接收的 `APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN`，且 device / profile 可收 provider delivery | 跑 `push-delivery:smoke -- --run` 產 pass JSON |
| Native crash runtime evidence | 在 Sentry 建立 / 確認 project `emorapy-mobile`，提供 `APP_SENTRY_ORG`、`APP_SENTRY_PROJECT`、`APP_SENTRY_AUTH_TOKEN`，並在 controlled crash 後提供 `APP_NATIVE_CRASH_SENTRY_EVENT_ID` | 跑 `native-crash:runtime:smoke -- --run` 產 production environment pass JSON |
| GitHub workflow secrets | 若要由 GitHub Actions 執行 validate/run，把 14 個 current completion secret names 補到 `Production` Environment；目前只有 DB / telemetry refresh 2 個已存在 | 跑 `release:external-evidence:github-secrets:strict -- --json`，再啟動 workflow validate / run |

## 2026-06-20 P0 App Store 建檔前置欄位包

本節只列外部 owner 在 Apple Developer / App Store Connect 需要填入或取得的欄位；它不替代 `release:external-evidence:validate/run`，也不代表 TestFlight evidence 已完成。欄位值的完整治理理由見 [Emorapy 命名收斂與外部識別符遷移待辦-2026-06-20.md](./Emorapy命名收斂與外部識別符遷移待辦-2026-06-20.md)。

| 頁面 / 系統 | 欄位 | 指定值 | 完成後回填 / 證據 |
| --- | --- | --- | --- |
| Apple Developer / Certificates, Identifiers & Profiles / Identifiers | Explicit App ID | `com.emorapy.app` | App Store Connect New App dialog 能選到此 Bundle ID；不要公開 Team ID / certificate material |
| Apple Developer / Capabilities | Push Notifications | Enabled | 後續 provider delivery evidence 仍需 `push-delivery:smoke -- --run` 產出 pass JSON |
| App Store Connect / New App | Name | `Emorapy` | App record status 應進入 Prepare for Submission |
| App Store Connect / New App | Primary Language | `English (U.S.)` | 若改主語系，先回寫命名待辦 |
| App Store Connect / New App | Bundle ID | `com.emorapy.app` | 必須與 `mobile/app.json` / Apple Developer explicit App ID 一致 |
| App Store Connect / New App | SKU | `emorapy-ios-app` | SKU 不可重用；不得使用 `CJ` / `com.cj.motherbearcourt` |
| App Store Connect / App Information | App Store Connect app id | 頁面建立後取得 | 只填入 ignored env 或 CI secret：`APP_STORE_CONNECT_APP_ID` / `ASC_APP_ID`；公開文件只記 key name |
| Sentry | Project | `emorapy-mobile` | 完成後把 `APP_SENTRY_PROJECT=emorapy-mobile` 放入 ignored env / CI secret；token / event id 不公開 |

若 Apple Developer 或 App Store Connect 顯示 agreement、trader status、developer name、name unavailable、bundle id unavailable、SKU conflict 或帳號權限問題，先記錄具體訊息並停止；不得臨時改用舊品牌或舊 bundle id 取得通過。

## 2026-05-30 本輪子任務：外部輸入狀態分層

### 目標

`release:external-evidence:input-status` 與 `release:external-evidence:fill-inputs -- --list-missing` 必須同時服務三個場景：外部 owner 看到當前還要補的 release completion inputs，工程 owner 在 release / DB / telemetry / backend version drift 後知道哪些 refresh inputs 需要重跑取證，以及 App Store 建檔後能確認 `APP_STORE_CONNECT_APP_ID` / `ASC_APP_ID` 已以 redacted 方式回填。工具不能把已通過的 DB parity / telemetry runtime evidence 誤報成當前 completion blocker，也不能把它們從正式 validate / run 的 freshness 檢查中移除；App Store record prerequisite group 也不能被誤解為 TestFlight 或 App Store Connect API credentials evidence。

### 業務場景

| 場景 | 預期行為 |
| --- | --- |
| 外部 owner 要補 release secrets / inputs | 先看 `input_groups.current_completion_blocker_inputs`：15 個 env keys（其中 `APP_EAS_PROJECT_FULL_NAME` 非 secret）加上 `mobile/app.json` 的真實 EAS project id 齊備後，`ready_for_current_completion_inputs=true` |
| Ops 要跑完整 sign-off validate / run | 仍看 `summary.ready_for_validate=true`；該值要求 current completion inputs、telemetry refresh input、DB refresh input、EAS project id 與 EAS full name binding 全部齊備 |
| GitHub workflow secret 交接 | `release:external-evidence:github-secrets:check -- --json` 仍以 16 個 names 判定 `ready_for_workflow_validate`，但會另列 `secret_groups.current_completion_blocker_secret_names` 與 `secret_groups.evidence_refresh_secret_names`，避免把 workflow refresh readiness 誤讀成當前 blocker count；repo 可由 `--repo`、`EMORAPY_GITHUB_REPO` 或 `GITHUB_REPOSITORY` 指定，保留 legacy default 只作兼容 |
| 後續 backend telemetry / version runtime 或 release-blocking migration 有 drift | 先看 `input_groups.evidence_refresh_inputs`，再重跑 telemetry runtime 或 release DB parity structured evidence；不得延用舊 pass artifact |
| Apple Developer / App Store Connect 建檔後回填 | 先看 `input_groups.app_store_record_prerequisites`：locked values 必須是 App Store name `Emorapy`、primary language `English (U.S.)`、SKU `emorapy-ios-app`、bundle id `com.emorapy.app`，且建檔後回填 `APP_STORE_CONNECT_APP_ID` 或 `ASC_APP_ID` 才能讓 `ready_for_app_store_record_inputs=true` |
| 只做安全盤點 | `input-status` 只輸出 key names / counters / booleans，不連 EAS、Apple、Sentry、DB、provider 或 device，不輸出 secret values |

### 邊界與注意事項

1. `ready_for_current_completion_inputs` 不是 release 完成，也不是 validate/run 通過；它只代表當前 release completion blocker 對應的本機 env keys 已齊備。
2. `ready_for_validate` 語義保持不變但 required input 數已因 Emorapy EAS binding 增至 17 個：全量 required keys、有效 EAS project id、有效 `APP_EAS_PROJECT_FULL_NAME` binding、無 invalid line、無 unsupported key。
3. `APP_TELEMETRY_RUNTIME_API_BASE_URL` 與 `DATABASE_URL` 屬於 `evidence_refresh_inputs`，因 canonical pass evidence 已存在而不再是 current completion blocker；但正式 release drift 後仍必須重跑。
4. GitHub secrets checker / sync helper 可以維持全量 16 secret names，因 workflow validate/run 需要完整 refresh 能力；文件必須明確區分 secret readiness 與當前 completion blocker count。
5. `input_groups.app_store_record_prerequisites` 的 `APP_STORE_CONNECT_APP_ID` / `ASC_APP_ID` 不是 current completion blocker env key，也不是 secret value evidence；它只讓 App Store Connect app record id 的回填狀態可被本機 redacted checker 盤點。

### 驗證命令

- `node --check mobile/scripts/check-release-external-signoff-input-status.mjs`
- `node --check mobile/scripts/fill-release-external-signoff-inputs.mjs`
- `npm --prefix mobile run release:external-evidence:input-status -- --json`
- `npm --prefix mobile run release:external-evidence:fill-inputs -- --list-missing`
- `npm --prefix mobile run release:external-evidence:env-template:check`
- `npm --prefix mobile run release:external-evidence:github-secrets:sync:contract`
- `npm --prefix mobile run release:completion:audit -- --release-env-file=release.env.local --json`
- `npm --prefix mobile run goal:completion:audit -- --release-env-file=release.env.local --json`
- `npm run docs:check`
- `npm run docs:audit:dry-run:current`

## 2026-05-30 本輪子任務：external status env-file 診斷一致性

### 目標

Standalone `release:external-evidence:status` 必須能安全讀取和正式 orchestrator 相同的 `--release-env-file=release.env.local`，讓外部 owner 在不進入 validate/run、不觸碰 EAS、Apple、Sentry、DB、provider 或 device 的前提下，看到同一份本機 env file 對 credential presence 的影響。這只提升診斷一致性；不得讓 status report 變成 pass evidence，也不得繞過 `release:external-evidence:validate/run` 或 strict audits。

### 業務場景

| 場景 | 預期行為 |
| --- | --- |
| 外部 owner 補完 `mobile/release.env.local` 後想先盤點 | 跑 `npm --prefix mobile run release:external-evidence:status -- --release-env-file=release.env.local --json`，只看到 presence booleans、loaded key counters、evidence candidate state 與 blockers |
| 本地 preflight / CI 不帶 env file | `release:external-evidence:status` 保持既有無 env 預設，不自動讀取 gitignored secrets，不把本機 release env 意外帶入 preflight |
| env file 含 placeholder | placeholder 視為未配置；status 不能因 `REPLACE_WITH_...` 誤把 credential presence 標 true |
| env file 含非白名單 key 或 shell 語法 | status 必須在診斷階段拒絕，避免 `NODE_OPTIONS`、`PATH` 或 shell expansion 混入 release evidence 流程 |

### 邊界與注意事項

1. Status JSON 只能新增 `env_files.values_redacted=true` 與 loaded file / key counters，不保存 raw values。
2. 若 process env 已有同名 key，env file 不覆蓋；status 只回報 `kept_existing_keys` counter。
3. `credentials.*_present=true` 只代表輸入存在，不代表外部服務查詢成功，也不是 release completion。
4. `release:external-evidence:status -- --release-env-file=release.env.local` 與 `release:external-evidence:input-status -- --json` 必須互補：前者看整體 release evidence 診斷，後者看 env key 分層與 placeholder / unsupported key。

### 驗證命令

- `node --check mobile/scripts/check-release-external-evidence-status.mjs`
- `npm --prefix mobile run release:external-evidence:status:contract`
- `npm --prefix mobile run release:external-evidence:status -- --release-env-file=release.env.local --json`
- `npm --prefix mobile run release:external-evidence:env-template:check`
- `npm run docs:check`
- `npm run docs:audit:dry-run:current`

## 2026-05-30 本輪子任務：orchestrator status env-file provenance

### 目標

`release:external-evidence:signoff -- --release-env-file=release.env.local --report-dir=<dir>` 產出的 `App-External-Evidence-Status-*.json` 必須和 standalone status 一樣留下 redacted env-file provenance。否則 orchestrator 已把 env-file 載入父進程後，status report 只會顯示 credential presence，卻看不到該 presence 來自哪個 redacted env-file counter，外部 owner 交接時容易誤判為 shell env 或 CI secret。

### 業務場景

| 場景 | 預期行為 |
| --- | --- |
| 本機 release owner 用 `--release-env-file` 跑 dry-run / validate 產 report | status report 記錄 `env_files.values_redacted=true` 與 loaded file / key counters；credential booleans 反映同一份 env file |
| 父進程已載入 env-file 後再啟動 status step | status step 會重新讀取 env-file 並移除父進程剛載入的同名 key，避免 report 出現 `credentials.*=true` 但 `env_files.loaded=[]` |
| CI / GitHub workflow 用 secret env 而非 env-file | status report 可保持 `env_files.loaded=[]`，不偽造 env-file 來源 |
| env-file 有 secret / URL / DB URL | stdout、stderr、status report 只能留下 booleans 與 counters，不保存 raw value |

### 邊界與注意事項

1. 這是交接可追溯性修正，不解除 EAS project id、Expo token、Apple / ASC、EAS/TestFlight、真機、push provider 或 production environment native crash runtime blocker。
2. `env_files.loaded_keys` 只代表 status 診斷讀到幾個白名單 key；不代表外部服務驗證成功。
3. Orchestrator 仍保留父進程 env-file 載入行為，後續 EAS / provider / telemetry / DB runner 才能收到相同輸入。
4. GitHub workflow secret env 不應被標成 env-file provenance；只有顯式 `--release-env-file` 才記錄 `env_files.loaded`。

### 驗證命令

- `node --check mobile/scripts/run-release-external-evidence-signoff.mjs`
- `node --check mobile/scripts/check-release-external-signoff-prerequisite-report.mjs`
- `npm --prefix mobile run release:external-evidence:prereq-report:check`
- `npm --prefix mobile run release:external-evidence:signoff -- --dry-run --release-env-file=<controlled-env-file> --report-dir=<tmp-report-dir> ...`
- `npm run docs:check`
- `npm run docs:audit:dry-run:current`

## 2026-05-30 本輪子任務：external status persisted schema 對齊

### 目標

`release:external-evidence:status` 已把 `env_files.values_redacted` 與 `env_files.loaded[]` 納入當前 JSON schema；最新持久化的 `App-External-Evidence-Status-*.json` 也必須符合這個 schema，且 `release:evidence:check` 必須直接校驗這一點。否則 preflight 可能繼續引用舊 status 快照，讓外部 owner 看到的 evidence pack 與當前 status / orchestrator 契約不一致。

### 業務場景

| 場景 | 預期行為 |
| --- | --- |
| 本地 App preflight 檢查 repo evidence pack | `release:evidence:check` 要求最新 `App-External-Evidence-Status-*.json` 含 `env_files.values_redacted=true` 與 array 型 `env_files.loaded` |
| 外部 owner 查看 repo 內最新 status/handoff 快照 | status/handoff 仍只列 blocker / owner action / final gates，不替代 pass evidence；status 額外明確表示是否有 env-file provenance |
| 無 `--release-env-file` 的 baseline 快照 | `env_files.loaded=[]` 是合法狀態；表示來源是 shell/CI/default env 或完全無 env-file，不代表缺 schema |
| 後續 status schema 再改動 | 必須同步 `release:evidence:check`、status contract、持久化 artifact 與核心文件引用，避免舊 artifact 悄悄通過 |

### 邊界與注意事項

1. 重新落盤 status/handoff 只刷新交接快照，不解除任何 EAS/TestFlight/真機/provider/native crash blocker。
2. 不改歷史 evidence JSON；歷史檔保留當時快照，只有最新指向更新到當前 schema。
3. `env_files.loaded=[]` 不代表 owner 沒有 secret，只代表本次快照沒有顯式 env-file provenance；GitHub secret env 仍不應被寫成 env-file。
4. 文件引用必須同步到最新 status/handoff 檔名，讓 `release:evidence:check` 的 docs-reference gate 有明確 SSOT。

### 驗證命令

- `npm --prefix mobile run release:external-evidence:status -- --report-dir=docs/核心開發文件/90-證據與盤點/環境與發版驗證`
- `npm --prefix mobile run release:external-evidence:handoff:check -- --report-dir=docs/核心開發文件/90-證據與盤點/環境與發版驗證`
- `npm --prefix mobile run release:evidence:check`
- `npm --prefix mobile run release:evidence-redaction:check`
- `npm --prefix mobile run release:external-evidence:status:contract`
- `npm run docs:check`
- `npm run docs:audit:dry-run:current`

## 2026-05-30 本輪子任務：GitHub secret sync dry-run 分層

### 結果

`release:external-evidence:github-secrets:sync -- --json` dry-run 已輸出與 `github-secrets:check -- --json` 對齊的 `current_completion_blocker_secret_names` / `evidence_refresh_secret_names` group summary，外部 owner 可直接看到哪 14 個仍是當前 completion blocker secrets、哪 2 個是 telemetry / DB refresh secrets。2026-05-30 已再新增 `release:external-evidence:github-secrets:sync:contract`，固定 dry-run local-only、redacted grouping、`DATABASE_URL -> APP_RELEASE_DATABASE_URL`、ASC private key path -> `APP_STORE_CONNECT_PRIVATE_KEY` 與 apply-only GitHub dependency，讓本機 env-file 到 GitHub secrets 的交接不再依賴聊天或人工對照。2026-06-20 追加 repo alias：`--repo` 優先，其次 `EMORAPY_GITHUB_REPO`、`GITHUB_REPOSITORY`，最後才使用 legacy default `Alex0158/mother-bear-court`，避免 GitHub repo rename 後工具 source 被硬編舊名卡住。

### 業務場景

| 場景 | 預期行為 |
| --- | --- |
| 外部 owner 用 `mobile/release.env.local` 做 GitHub secrets dry-run | JSON 直接顯示 `ready_for_current_completion_sync_inputs`、`ready_for_evidence_refresh_sync_inputs` 與 `ready_for_sync_apply` |
| 只填了 telemetry / DB refresh keys | `evidence_refresh_secret_names` 顯示 ready，`current_completion_blocker_secret_names` 顯示 14 個缺口；不得誤讀為 release completion 可 validate |
| 填完全部 16 個 workflow secrets | dry-run 顯示 `secret_count=16`、兩組 ready，仍需人工確認後才可 `--apply` |
| 使用 ASC private key path 或 inline private key | 兩者都只映射到 GitHub secret `APP_STORE_CONNECT_PRIVATE_KEY`；JSON 只顯示 source key / secret name，不輸出 private key value |
| env-file 含 placeholder / unsupported key | helper 繼續拒絕 apply，並用 group summary 指出 placeholder 位於 current completion 還是 refresh group |

### 邊界與注意事項

1. 這是 CI secret 交接工具可讀性修正，不會寫入 GitHub secrets，除非顯式加 `--apply`。
2. `ready_for_current_completion_sync_inputs=true` 只代表本機 env-file 已足以寫入當前 completion blocker 所需 secret names；不代表 GitHub environment 已配置，也不代表 validate/run 通過。
3. `ready_for_evidence_refresh_sync_inputs=true` 只代表 telemetry runtime / release DB parity refresh secrets 可同步；由於這兩類已有 canonical pass evidence，它們不是當前 completion blocker，但後續 drift 後仍需刷新。
4. `ready_for_sync_apply=true` 仍要求全量 current completion + refresh secret values 都非 placeholder；缺任何 secret 時不得執行 apply。

### 驗證命令

- `node --check mobile/scripts/sync-release-github-secrets.mjs`
- `node --check mobile/scripts/check-release-github-secret-sync-contract.mjs`
- `npm --prefix mobile run release:external-evidence:github-secrets:sync -- --json`
- `npm --prefix mobile run release:external-evidence:github-secrets:sync:contract`
- `npm --prefix mobile run release:completion:audit:contract`
- `npm --prefix mobile run goal:completion:audit:contract`
- `npm run docs:check`
- `npm run docs:audit:dry-run:current`

## 必須補齊的外部輸入

| 類別 | 必要輸入 / 證據 | 安全要求 |
| --- | --- | --- |
| EAS project | 已綁定 `expo.extra.eas.projectId=73ba39d3-6218-4748-ae36-8d3a93ba34ac` | 不得回退到 legacy `cj-mobile` project id |
| EAS project full name | 已在 ignored `mobile/release.env.local` 設定 `APP_EAS_PROJECT_FULL_NAME=@alexdev518/emorapy-mobile`，且 EAS project link 已完成 Emorapy slug 對齊 | 非 secret；不得用 legacy `@alexdev518/cj-mobile` 作 release binding |
| Expo / EAS | `EXPO_TOKEN` 已在 ignored `mobile/release.env.local` 可用 | 不得提交 token value；若同步到 CI 必須走 GitHub secret |
| Apple submission | `ASC_APPLE_ID`、`EXPO_APPLE_APP_SPECIFIC_PASSWORD` | 不得提交到 repo |
| App Store Connect API | `APP_STORE_CONNECT_ISSUER_ID`、`APP_STORE_CONNECT_KEY_ID`、`APP_STORE_CONNECT_PRIVATE_KEY_PATH` 或等價 private key input | private key 優先放 repo 外絕對路徑 |
| iOS physical device | `APP_IOS_DEVICE_UDID`、`APP_IOS_DEVICE_APP_PATH` | UDID / signed app path 不寫入公開文件 |
| Android physical device | `APP_ANDROID_DEVICE_SERIAL` | serial 不寫入公開文件 |
| Push provider | `APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN` | evidence 只允許 token hash / safe summary |
| Native crash runtime | `APP_SENTRY_ORG`、`APP_SENTRY_PROJECT`、`APP_SENTRY_AUTH_TOKEN`、`APP_NATIVE_CRASH_SENTRY_EVENT_ID` | token / event id 不得出現在 evidence 明文 |
| Telemetry runtime refresh | 已有 `APP_TELEMETRY_RUNTIME_API_BASE_URL`，且 canonical pass evidence 已產出 | 不是當前 completion blocker；evidence 只保存 host hash / request ids / trace ids / backend version summary；後續新 backend telemetry/version runtime commit 發版時需重新跑，確保 `/version.commitSha` 對齊新的目標 commit |
| Release DB parity refresh | 已有 `DATABASE_URL` 指向 release / production PostgreSQL，且 canonical pass evidence 已產出 | 不是當前 completion blocker；evidence 不保存 DB URL 或 host 明文；後續新增 / 修改 release-blocking migration 時必須重新跑 |

## 解除條件

1. 已完成 `mobile/app.json` `expo.extra.eas.projectId` 與 EAS project full name 對齊：`APP_EAS_PROJECT_FULL_NAME=@alexdev518/emorapy-mobile`，且 `npx eas-cli@20.3.0 project:info --non-interactive` 不再因 `cj-mobile` / `emorapy-mobile` slug mismatch 失敗。注意：只有在移除舊 `cj-mobile` projectId 後，`project:init --non-interactive --force` 才是建立 Emorapy project 的安全路徑；不得在舊 projectId 存在時用它作 rename workaround。
2. 以 shell env、CI secrets 或 ignored `mobile/release.env.local` 提供上述外部輸入。
3. 若走 GitHub workflow，`npm --prefix mobile run release:external-evidence:github-secrets:sync -- --json` redacted dry-run 顯示 `summary.ready_for_current_completion_sync_inputs=true`、`summary.ready_for_evidence_refresh_sync_inputs=true` 與 `summary.ready_for_sync_apply=true`；`release:external-evidence:github-secrets:sync:contract` 通過；確認後才用 `--apply` 寫入。
4. `npm --prefix mobile run release:external-evidence:input-status -- --json` 顯示 `ready_for_current_completion_inputs=true` 且 `ready_for_validate=true`。前者只代表當前 completion blocker inputs 齊備；後者仍要求全量 17 個 sign-off / refresh keys、EAS project id 與 EAS full name binding 齊備，因為正式 validate / run 仍會重新確認 DB parity 與 telemetry runtime freshness。
5. `npm --prefix mobile run release:external-evidence:validate -- --release-env-file=release.env.local` 通過。
6. `npm --prefix mobile run release:external-evidence:run -- --release-env-file=release.env.local` 產出 structured pass evidence。
7. `npm --prefix mobile run release:completion:audit:strict` 通過。
8. `npm --prefix mobile run goal:completion:audit:strict` 通過。

## 相關文件

- `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-External-Signoff-Input-Checklist-2026-05-16.md`
- `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-External-Release-Signoff-Runbook-2026-05-08.md`
- `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Release-Hardening-2026-05-08.md`
- `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Goal-Completion-Audit-2026-05-08.md`
