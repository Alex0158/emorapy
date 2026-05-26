# App 外部 Release Sign-off 待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App 外部 release sign-off 的 EAS / TestFlight / physical device / push provider / Sentry native crash / telemetry runtime / release DB parity 缺口
**取證代碼入口**：`mobile/package.json`、`mobile/app.json`、`backend/scripts/check-release-db-parity.ts`
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-16`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：待外部輸入（已回收 2/16 項）
**Owner**：Mobile / Ops / QA
**關聯核心文件**：`90-證據與盤點/環境與發版驗證/App-External-Signoff-Input-Checklist-2026-05-16.md`、`90-證據與盤點/環境與發版驗證/App-External-Release-Signoff-Runbook-2026-05-08.md`、`90-證據與盤點/環境與發版驗證/App-Release-Hardening-2026-05-08.md`、`90-證據與盤點/環境與發版驗證/App-Goal-Completion-Audit-2026-05-08.md`

---

## 問題

App 內部實作、文件、preflight 與 release audit contract 已就緒，但外部 release sign-off 尚未完成。不得把 non-strict `release:preflight`、dry-run orchestrator、prerequisite report、status / handoff snapshot 或 placeholder env file 視為正式 release 完成證據。

## 已排查且無結果

- 已查 `npx expo config --json`、`mobile/.expo`、`~/.expo/state.json`、`~/Library/Preferences/eas-cli-nodejs/user-settings.json`、git history 與本機 Expo / EAS cache，未找到可回收的真實 `extra.eas.projectId`。
- `mobile/scripts/lib/release-app-config.mjs` 只讀 `mobile/app.json` 裡的 `expo.extra.eas.projectId`，沒有其他 fallback。
- `eas whoami` 目前回覆 `Not logged in`，因此無法以本機 authenticated 狀態補出 project metadata。
- `mobile/release.env.local` 已由現有 production 配置回收 `DATABASE_URL` 與 `APP_TELEMETRY_RUNTIME_API_BASE_URL`，但其餘 release sign-off keys 仍為 placeholder，`release:external-evidence:input-status` 仍維持 `ready_for_validate=false`。
- 已再查常見工作區的 `.p8` / `.ipa` / `.app` / release env 位置，只找到無關的安裝器 `.app` 與 `.vercel/.env.production.local`，未找到可直接填入 `APP_STORE_CONNECT_PRIVATE_KEY_PATH`、`APP_IOS_DEVICE_APP_PATH` 或其他 release 真值的資產。

## 當前本地證據

| 項目 | 狀態 | 證據 |
| --- | --- | --- |
| 本地 release preflight | 已通過 | `npm --prefix mobile run release:preflight`，30 Jest suites / 134 tests passed，且跑完 `release:external-evidence:input-status`、`release:completion:audit`、`goal:completion:audit`、`release:check` |
| 外部輸入狀態檢查 | 已建立 / 未 ready | `npm --prefix mobile run release:external-evidence:input-status -- --json` 顯示 `filled_count=2`、`placeholder_count=14`、`ready_for_validate=false`；目前已填入 `APP_RELEASE_DATABASE_URL` 與 `APP_TELEMETRY_RUNTIME_API_BASE_URL`；另已建立 `npm --prefix mobile run release:external-evidence:fill-inputs` 作為本機互動補值入口，`--list-missing` 可只看缺口 |
| EAS project id | 未完成 | `mobile/app.json` 尚無 UUID-shaped `expo.extra.eas.projectId` |
| EAS project id 本機追查 | 已完成 / 無可自動回收值 | 已查 `npx expo config --json`、`mobile/.expo`、`~/.expo/state.json`、`~/Library/Preferences/eas-cli-nodejs/user-settings.json`、`mobile/.expo` xcodebuild logs 與 git history；未找到真實 `extra.eas.projectId`。`mobile/scripts/lib/release-app-config.mjs` 只讀 `mobile/app.json` 的 `expo.extra.eas.projectId`，無其他 fallback，因此不得用 analytics/device UUID、fake UUID 或舊 cache 解除 blocker |
| GitHub Actions release secrets | 部分完成 / 未 ready | `npm --prefix mobile run release:external-evidence:github-secrets:check -- --json` 只讀 secret names 且 `values_redacted=true`；checker 與 `.github/workflows/app-release-external-signoff.yml` 以 `Production` GitHub Environment 作為預設 workflow secret scope。已同步 `APP_RELEASE_DATABASE_URL` 與 `APP_TELEMETRY_RUNTIME_API_BASE_URL` 到 `Production` environment，`present_secret_name_count=2`、`missing_secret_name_count=14`、`ready_for_workflow_validate=false`。另查 `--env='ingenious-commitment / production'`，該 environment 沒有 App release secret names。`release:external-evidence:github-secrets:strict -- --json` 在當前狀態仍會失敗，用於 secrets 配好後作 CI validate/run 前置 gate。尚缺 `EXPO_TOKEN`、Apple / ASC、push、Sentry、iOS/Android device 與 `APP_NATIVE_CRASH_SENTRY_EVENT_ID` 等外部 secrets，因此 workflow 目前不能進入有效 validate / run |
| GitHub Actions release variables | 已查 / 無可回收值 | `gh variable list --repo Alex0158/mother-bear-court --json name` 與 `gh variable list --repo Alex0158/mother-bear-court --env Production --json name` 均回空陣列；未找到可回收的 `EAS_PROJECT_ID`、Sentry org/project 或 release config 變數 |
| GitHub Actions secret sync helper | 已建立 / 等待真值 | `npm --prefix mobile run release:external-evidence:github-secrets:sync -- --json` 會從 gitignored `mobile/release.env.local` 做 redacted dry-run；確認後才可加 `--apply` 寫入 `Production` GitHub Environment secrets。工具拒絕 placeholder，不輸出 secret values，並把 `DATABASE_URL` 映射成 `APP_RELEASE_DATABASE_URL`、把 `APP_STORE_CONNECT_PRIVATE_KEY_PATH` 指向的 `.p8` 內容映射成 `APP_STORE_CONNECT_PRIVATE_KEY` |
| Release completion audit | 未完成 | `release:completion:audit` 明確列出 11 個 release blockers |
| Goal completion audit | 未完成 | `goal:completion:audit` 的 `release_signoff` 仍為 missing |

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
| Telemetry runtime | `APP_TELEMETRY_RUNTIME_API_BASE_URL` 指向 non-local release API | evidence 只保存 host hash / request ids / trace ids |
| Release DB parity | `DATABASE_URL` 指向 release / production PostgreSQL | evidence 不保存 DB URL 或 host 明文 |

## 解除條件

1. 填入真實 `mobile/app.json` `expo.extra.eas.projectId`。
2. 以 shell env、CI secrets 或 ignored `mobile/release.env.local` 提供上述外部輸入。
3. 若走 GitHub workflow，`npm --prefix mobile run release:external-evidence:github-secrets:sync -- --json` redacted dry-run 顯示 `secret_count=16`；確認後才用 `--apply` 寫入。
4. `npm --prefix mobile run release:external-evidence:input-status -- --json` 顯示 `ready_for_validate=true`。
5. `npm --prefix mobile run release:external-evidence:validate -- --release-env-file=release.env.local` 通過。
6. `npm --prefix mobile run release:external-evidence:run -- --release-env-file=release.env.local` 產出 structured pass evidence。
7. `npm --prefix mobile run release:completion:audit:strict` 通過。
8. `npm --prefix mobile run goal:completion:audit:strict` 通過。

## 相關文件

- `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-External-Signoff-Input-Checklist-2026-05-16.md`
- `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-External-Release-Signoff-Runbook-2026-05-08.md`
- `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Release-Hardening-2026-05-08.md`
- `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Goal-Completion-Audit-2026-05-08.md`
