# App 外部 Release Sign-off 待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App 外部 release sign-off 的 EAS / TestFlight / physical device / push provider / Sentry native crash / telemetry runtime / release DB parity 缺口
**取證代碼入口**：`mobile/package.json`、`mobile/app.json`、`mobile/scripts/check-release-external-signoff-input-status.mjs`、`backend/scripts/check-release-db-parity.ts`
**最後核驗 Commit**：`fcd8a64`
**最後核驗日期**：`2026-05-30`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：待外部輸入（current completion inputs 0/14；evidence refresh inputs 2/2；telemetry runtime / release DB parity pass evidence 已完成）
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
| 外部輸入狀態檢查 | 已建立 / 未 ready | `npm --prefix mobile run release:external-evidence:input-status -- --json` 顯示 `filled_count=2`、`placeholder_count=14`、`ready_for_validate=false`；其中 `input_groups.current_completion_blocker_inputs` 顯示 current completion inputs `0/14`、`ready_for_current_completion_inputs=false`，`input_groups.evidence_refresh_inputs` 顯示 DB / telemetry refresh inputs `2/2`、`ready_for_evidence_refresh_inputs=true`。目前已填入 `DATABASE_URL` 與 `APP_TELEMETRY_RUNTIME_API_BASE_URL`；另已建立 `npm --prefix mobile run release:external-evidence:fill-inputs` 作為本機互動補值入口，`--list-missing` 可只看缺口與分層 |
| Telemetry runtime env-file / CORS / backend version | 已閉環 | `telemetry:runtime:smoke -- --dry-run --release-env-file=release.env.local` 與正式 `--run` 已通過；runner 先查 release backend `/version` 並要求 `commitSha` 等於執行當下的本地 `HEAD`，再送 event / OTLP；audit 允許後續 docs / evidence 提交，但若 backend telemetry/version runtime 路徑在證據 commit 後改動，舊證據會失效；canonical `App-Telemetry-Runtime-2026-05-29T16-00-52-498Z.json` 已 `blocked=false`，`release:completion:audit -- --json` 顯示 `telemetry_runtime_evidence` passed |
| EAS project id | 未完成 | `mobile/app.json` 尚無 UUID-shaped `expo.extra.eas.projectId` |
| EAS project id 本機追查 | 已完成 / 無可自動回收值 | 已查 `npx expo config --json`、`mobile/.expo`、`~/.expo/state.json`、`~/Library/Preferences/eas-cli-nodejs/user-settings.json`、`mobile/.expo` xcodebuild logs 與 git history；未找到真實 `extra.eas.projectId`。`mobile/scripts/lib/release-app-config.mjs` 只讀 `mobile/app.json` 的 `expo.extra.eas.projectId`，無其他 fallback，因此不得用 analytics/device UUID、fake UUID 或舊 cache 解除 blocker |
| GitHub Actions release secrets | 部分完成 / 未 ready | `npm --prefix mobile run release:external-evidence:github-secrets:check -- --json` 只讀 secret names 且 `values_redacted=true`；checker 與 `.github/workflows/app-release-external-signoff.yml` 以 `Production` GitHub Environment 作為預設 workflow secret scope。已同步 `APP_RELEASE_DATABASE_URL` 與 `APP_TELEMETRY_RUNTIME_API_BASE_URL` 到 `Production` environment，`present_secret_name_count=2`、`missing_secret_name_count=14`、`ready_for_workflow_validate=false`；其中 `secret_groups.current_completion_blocker_secret_names` 為 `0/14`、`secret_groups.evidence_refresh_secret_names` 為 `2/2`。另查 `--env='ingenious-commitment / production'`，該 environment 沒有 App release secret names。`release:external-evidence:github-secrets:strict -- --json` 在當前狀態仍會失敗，用於 secrets 配好後作 CI validate/run 前置 gate。尚缺 `EXPO_TOKEN`、Apple / ASC、push、Sentry、iOS/Android device 與 `APP_NATIVE_CRASH_SENTRY_EVENT_ID` 等外部 secrets，因此 workflow 目前不能進入有效 validate / run |
| GitHub Actions release variables | 已查 / 無可回收值 | `gh variable list --repo Alex0158/mother-bear-court --json name` 與 `gh variable list --repo Alex0158/mother-bear-court --env Production --json name` 均回空陣列；未找到可回收的 `EAS_PROJECT_ID`、Sentry org/project 或 release config 變數 |
| GitHub Actions secret sync helper | 已建立 / 等待真值 | `npm --prefix mobile run release:external-evidence:github-secrets:sync -- --json` 會從 gitignored `mobile/release.env.local` 做 redacted dry-run；確認後才可加 `--apply` 寫入 `Production` GitHub Environment secrets。工具拒絕 placeholder，不輸出 secret values，並把 `DATABASE_URL` 映射成 `APP_RELEASE_DATABASE_URL`、把 `APP_STORE_CONNECT_PRIVATE_KEY_PATH` 指向的 `.p8` 內容映射成 `APP_STORE_CONNECT_PRIVATE_KEY` |
| Release completion audit | 未完成 | `release:completion:audit` 明確列出 10 個 release blockers；`telemetry_runtime_evidence` 已通過，剩餘為 EAS project id、Expo token、Apple / ASC credentials、EAS iOS / TestFlight、physical device、EAS Android、push provider delivery 與 native crash runtime |
| Goal completion audit | 未完成 | `goal:completion:audit` 的 `release_signoff` 仍為 missing |

## 2026-05-30 本輪子任務：外部輸入狀態分層

### 目標

`release:external-evidence:input-status` 與 `release:external-evidence:fill-inputs -- --list-missing` 必須同時服務兩個場景：外部 owner 看到當前還要補的 release completion inputs，以及工程 owner 在 release / DB / telemetry / backend version drift 後知道哪些 refresh inputs 需要重跑取證。工具不能把已通過的 DB parity / telemetry runtime evidence 誤報成當前 completion blocker，也不能把它們從正式 validate / run 的 freshness 檢查中移除。

### 業務場景

| 場景 | 預期行為 |
| --- | --- |
| 外部 owner 要補 release secrets | 先看 `input_groups.current_completion_blocker_inputs`：14 個 env keys 加上 `mobile/app.json` 的真實 EAS project id 齊備後，`ready_for_current_completion_inputs=true` |
| Ops 要跑完整 sign-off validate / run | 仍看 `summary.ready_for_validate=true`；該值要求 current completion inputs、telemetry refresh input、DB refresh input 與 EAS project id 全部齊備 |
| GitHub workflow secret 交接 | `release:external-evidence:github-secrets:check -- --json` 仍以 16 個 names 判定 `ready_for_workflow_validate`，但會另列 `secret_groups.current_completion_blocker_secret_names` 與 `secret_groups.evidence_refresh_secret_names`，避免把 workflow refresh readiness 誤讀成當前 blocker count |
| 後續 backend telemetry / version runtime 或 release-blocking migration 有 drift | 先看 `input_groups.evidence_refresh_inputs`，再重跑 telemetry runtime 或 release DB parity structured evidence；不得延用舊 pass artifact |
| 只做安全盤點 | `input-status` 只輸出 key names / counters / booleans，不連 EAS、Apple、Sentry、DB、provider 或 device，不輸出 secret values |

### 邊界與注意事項

1. `ready_for_current_completion_inputs` 不是 release 完成，也不是 validate/run 通過；它只代表當前 release completion blocker 對應的本機 env keys 已齊備。
2. `ready_for_validate` 語義保持不變：全量 16 個 required keys、有效 EAS project id、無 invalid line、無 unsupported key。
3. `APP_TELEMETRY_RUNTIME_API_BASE_URL` 與 `DATABASE_URL` 屬於 `evidence_refresh_inputs`，因 canonical pass evidence 已存在而不再是 current completion blocker；但正式 release drift 後仍必須重跑。
4. GitHub secrets checker / sync helper 可以維持全量 16 secret names，因 workflow validate/run 需要完整 refresh 能力；文件必須明確區分 secret readiness 與當前 completion blocker count。

### 驗證命令

- `node --check mobile/scripts/check-release-external-signoff-input-status.mjs`
- `node --check mobile/scripts/fill-release-external-signoff-inputs.mjs`
- `npm --prefix mobile run release:external-evidence:input-status -- --json`
- `npm --prefix mobile run release:external-evidence:fill-inputs -- --list-missing`
- `npm --prefix mobile run release:external-evidence:env-template:check`
- `npm --prefix mobile run release:completion:audit -- --json`
- `npm --prefix mobile run goal:completion:audit -- --json`
- `npm run docs:check`
- `npm run docs:audit:dry-run:current`

## 必須補齊的外部輸入

| 類別 | 必要輸入 / 證據 | 安全要求 |
| --- | --- | --- |
| EAS project | 真實 UUID-shaped `expo.extra.eas.projectId` | 不得使用 placeholder / fake UUID |
| Expo / EAS | `EXPO_TOKEN` | 只放在 shell、CI secret 或 ignored `mobile/release.env.local` |
| Apple submission | `ASC_APPLE_ID`、`EXPO_APPLE_APP_SPECIFIC_PASSWORD` | 不得提交到 repo |
| App Store Connect API | `APP_STORE_CONNECT_ISSUER_ID`、`APP_STORE_CONNECT_KEY_ID`、`APP_STORE_CONNECT_PRIVATE_KEY_PATH` 或等價 private key input | private key 優先放 repo 外絕對路徑 |
| iOS physical device | `APP_IOS_DEVICE_UDID`、`APP_IOS_DEVICE_APP_PATH` | UDID / signed app path 不寫入公開文件 |
| Android physical device | `APP_ANDROID_DEVICE_SERIAL` | serial 不寫入公開文件 |
| Push provider | `APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN` | evidence 只允許 token hash / safe summary |
| Native crash runtime | `APP_SENTRY_ORG`、`APP_SENTRY_PROJECT`、`APP_SENTRY_AUTH_TOKEN`、`APP_NATIVE_CRASH_SENTRY_EVENT_ID` | token / event id 不得出現在 evidence 明文 |
| Telemetry runtime refresh | 已有 `APP_TELEMETRY_RUNTIME_API_BASE_URL`，且 canonical pass evidence 已產出 | 不是當前 completion blocker；evidence 只保存 host hash / request ids / trace ids / backend version summary；後續新 backend telemetry/version runtime commit 發版時需重新跑，確保 `/version.commitSha` 對齊新的目標 commit |
| Release DB parity refresh | 已有 `DATABASE_URL` 指向 release / production PostgreSQL，且 canonical pass evidence 已產出 | 不是當前 completion blocker；evidence 不保存 DB URL 或 host 明文；後續新增 / 修改 release-blocking migration 時必須重新跑 |

## 解除條件

1. 填入真實 `mobile/app.json` `expo.extra.eas.projectId`。
2. 以 shell env、CI secrets 或 ignored `mobile/release.env.local` 提供上述外部輸入。
3. 若走 GitHub workflow，`npm --prefix mobile run release:external-evidence:github-secrets:sync -- --json` redacted dry-run 顯示 `secret_count=16`；確認後才用 `--apply` 寫入。
4. `npm --prefix mobile run release:external-evidence:input-status -- --json` 顯示 `ready_for_current_completion_inputs=true` 且 `ready_for_validate=true`。前者只代表當前 completion blocker inputs 齊備；後者仍要求全量 16 個 sign-off / refresh keys 齊備，因為正式 validate / run 仍會重新確認 DB parity 與 telemetry runtime freshness。
5. `npm --prefix mobile run release:external-evidence:validate -- --release-env-file=release.env.local` 通過。
6. `npm --prefix mobile run release:external-evidence:run -- --release-env-file=release.env.local` 產出 structured pass evidence。
7. `npm --prefix mobile run release:completion:audit:strict` 通過。
8. `npm --prefix mobile run goal:completion:audit:strict` 通過。

## 相關文件

- `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-External-Signoff-Input-Checklist-2026-05-16.md`
- `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-External-Release-Signoff-Runbook-2026-05-08.md`
- `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Release-Hardening-2026-05-08.md`
- `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Goal-Completion-Audit-2026-05-08.md`
