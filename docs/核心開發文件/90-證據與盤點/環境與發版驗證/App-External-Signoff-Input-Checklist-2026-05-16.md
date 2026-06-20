# App External Sign-off Input Checklist - 2026-05-16

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據產製清單
**來源時間**：2026-05-16
**上下文**：App external release sign-off 前置輸入、secret-safe validate 與 owner 交接
**SSOT 屬性**：非現行 SSOT（僅作證據產製流程與發版前驗收操作指引）
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-16`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本文件只列正式 App external release sign-off 前需要由本機或 CI secret 提供的輸入，不保存任何 secret value。實際值只能放在 shell env、CI secrets，或 gitignored 的 `mobile/release.env.local`。

## 安全規則

- 不要把 `mobile/release.env.local`、private key、token、database URL、push token、UDID、serial、Sentry event id 提交到 repo。
- 不要把 secret value 貼到 issue、PR、聊天或 markdown。
- `mobile/release.env.local` 只接受 release sign-off 白名單 key；不要放 `NODE_OPTIONS`、`PATH` 或任何 shell command。
- 填值後可先跑 `npm --prefix mobile run release:external-evidence:input-status -- --json`；該命令只輸出 key 狀態、placeholder / missing counts、`ready_for_current_completion_inputs`、`ready_for_validate` 與 `app.eas_project_binding_valid`，不輸出 value，也不連 EAS、Apple、Sentry、DB 或裝置。JSON 內的 `current_completion_blocker_inputs` 對應當前尚未解除的 release completion inputs；`evidence_refresh_inputs` 對應 telemetry runtime / release DB parity 的 refresh keys，這兩項已有 canonical pass evidence，但在後續 release / DB / telemetry / backend version drift 後仍需要重跑取證。
- 若需要同時看 evidence candidate、device counters 與 credential presence，可跑 `npm --prefix mobile run release:external-evidence:status -- --release-env-file=release.env.local --json`；status 只保存 `env_files` loaded key counters 與 booleans，不保存任何 value，也不替代 validate / run。
- 若用 `release:external-evidence:signoff -- --release-env-file=release.env.local --report-dir=<report-dir>` 產交接報告，`App-External-Evidence-Status-*.json` 也會保存同樣的 redacted `env_files` counters；CI / GitHub secret env 來源則會保持 `env_files.loaded=[]`。
- 若想直接補值，可跑 `npm --prefix mobile run release:external-evidence:fill-inputs`；它會在互動終端詢問缺值，必要時先補 `mobile/app.json` 的 `extra.eas.projectId`，再寫回 `mobile/release.env.local` 並重跑 `release:external-evidence:input-status`。若只想先看缺口，跑 `npm --prefix mobile run release:external-evidence:fill-inputs -- --list-missing`。
- 若要走 GitHub workflow，先跑 `npm --prefix mobile run release:external-evidence:github-secrets:check -- --json` 盤點 repo / `Production` GitHub Environment secret names；workflow 會透過 `github_environment` input 綁定同一個 GitHub Environment，避免把其他 environment 的 secret 誤判為可用。配置完成後跑 `npm --prefix mobile run release:external-evidence:github-secrets:strict -- --json`，缺任一 required release secret name 會 exit non-zero。這兩個命令只讀 secret names，不讀 secret values。
- 若本機 `mobile/release.env.local` 已填好，可以先跑 `npm --prefix mobile run release:external-evidence:github-secrets:sync -- --json` 做 redacted dry-run；確認 `summary.ready_for_current_completion_sync_inputs=true`、`summary.ready_for_evidence_refresh_sync_inputs=true`、`summary.ready_for_sync_apply=true` 後，再用 `npm --prefix mobile run release:external-evidence:github-secrets:sync -- --apply --json` 寫入 `Production` GitHub Environment secrets。該同步工具預設不寫入、拒絕 placeholder，且不輸出 secret values；JSON 會用 `secret_groups.current_completion_blocker_secret_names` 與 `secret_groups.evidence_refresh_secret_names` 分開 current completion blocker secrets 與 telemetry / DB refresh secrets。`release:external-evidence:github-secrets:sync:contract` 已納入 preflight，用受控 fixture 證明 dry-run 是 local-only、不要求 `gh` / GitHub auth / network，且只有 `--apply` 會檢查 GitHub Environment。
- 用 `npm --prefix mobile run release:external-evidence:validate -- --release-env-file=release.env.local --report-dir=<report-dir>` 先驗證 prerequisite report；報告只能顯示 presence boolean / counters / missing ids。
- validate 通過後才允許跑正式 `release:external-evidence:run` 或 workflow run mode。

## 必填輸入

| Release blocker | Required input | Where to provide | Safe validation signal |
|---|---|---|---|
| `eas_project_id` | 真實 UUID-shaped `extra.eas.projectId`，以及非 secret `APP_EAS_PROJECT_FULL_NAME=@alexdev518/emorapy-mobile` | `mobile/app.json` / Expo project config；shell env / CI env / `mobile/release.env.local` | prerequisite report `app.eas_project_id_valid=true` 且 `app.eas_project_binding_valid=true` |
| `expo_token` | `EXPO_TOKEN` | shell env / CI secret / `mobile/release.env.local` | `credentials.expo_token_present=true` |
| `apple_submission_credentials` | `ASC_APPLE_ID` + `EXPO_APPLE_APP_SPECIFIC_PASSWORD` | shell env / CI secret / `mobile/release.env.local` | `credentials.apple_submission_credentials_present=true` |
| `app_store_connect_api_credentials` | `APP_STORE_CONNECT_ISSUER_ID` or `ASC_ISSUER_ID`; `APP_STORE_CONNECT_KEY_ID` or `ASC_KEY_ID`; `APP_STORE_CONNECT_PRIVATE_KEY` / `ASC_PRIVATE_KEY` or `APP_STORE_CONNECT_PRIVATE_KEY_PATH` pointing at a private key file | shell env / CI secret / `mobile/release.env.local`; private key file outside repo preferred | `credentials.app_store_connect_api_credentials_present=true` |
| `physical_device_evidence` iOS branch | `APP_IOS_DEVICE_UDID` or `APP_PHYSICAL_DEVICE_ID`; `APP_IOS_DEVICE_APP_PATH` pointing at signed `.app` | shell env / CI secret / `mobile/release.env.local`; signed app path local to runner | `credentials.physical_device_input_present=true`, `credentials.signed_app_input_present=true`, `device_visibility.ios.requested_device_visible=true` |
| `physical_device_evidence` Android branch | `APP_ANDROID_DEVICE_SERIAL` or `APP_PHYSICAL_DEVICE_ID` | shell env / CI secret / `mobile/release.env.local` | `credentials.physical_device_input_present=true`, `device_visibility.android.requested_device_visible=true` |
| `apns_or_provider_delivery_evidence` | `APP_PUSH_DELIVERY_EXPO_PUSH_TOKEN` | shell env / CI secret / `mobile/release.env.local` | `credentials.push_delivery_token_present=true` |
| `native_crash_runtime_evidence` | `APP_SENTRY_ORG` / `SENTRY_ORG`; `APP_SENTRY_PROJECT` / `SENTRY_PROJECT`; `APP_SENTRY_AUTH_TOKEN` / `SENTRY_AUTH_TOKEN`; `APP_NATIVE_CRASH_SENTRY_EVENT_ID` / `SENTRY_EVENT_ID` | shell env / CI secret / `mobile/release.env.local` | `credentials.sentry_runtime_query_credentials_present=true`, `credentials.native_crash_event_id_present=true` |

以上 rows 加上 `mobile/app.json` 的真實 `extra.eas.projectId` 構成 current completion blocker inputs。`APP_EAS_PROJECT_FULL_NAME` 不是 secret；它必須等於 `mobile/app.json` 的 `owner/slug` 推導值 `@alexdev518/emorapy-mobile`，用於防止本地 Emorapy slug 仍綁到 legacy `@alexdev518/cj-mobile` EAS project。`release:external-evidence:input-status` 會在 `input_groups.current_completion_blocker_inputs`、`summary.ready_for_current_completion_inputs` 與 `app.eas_project_binding_valid` 中單獨呈現這組狀態；這不是 release 完成訊號，仍需正式 evidence 與 strict audits。

## Evidence refresh inputs

| Evidence refresh target | Required input | Where to provide | Safe validation signal |
|---|---|---|---|
| `telemetry_runtime_evidence` | `APP_TELEMETRY_RUNTIME_API_BASE_URL` pointing at non-local release API | shell env / CI secret / `mobile/release.env.local` | `credentials.telemetry_runtime_api_base_url_present=true` |
| release DB parity | `DATABASE_URL` pointing at release / production non-local PostgreSQL target | shell env / CI secret / `mobile/release.env.local` | `credentials.release_database_url_present=true` |

`release:completion:audit` currently treats telemetry runtime and release DB parity as passed because structured canonical evidence exists. These inputs remain in `release.env.example`, GitHub secret sync, and `summary.ready_for_validate` so Ops can refresh evidence after release, DB, telemetry, or backend version drift without inventing a second handoff path.

## Current blocker evidence

Latest local validate-only reports:

- iOS branch: [App-External-Signoff-Prerequisites-2026-05-16T07-29-51-655Z.json](./App-External-Signoff-Prerequisites-2026-05-16T07-29-51-655Z.json), `summary.missing_count=16`, `summary.report_contains_secrets=false`.
- Android branch: [App-External-Signoff-Prerequisites-2026-05-16T07-29-50-317Z.json](./App-External-Signoff-Prerequisites-2026-05-16T07-29-50-317Z.json), `summary.missing_count=15`, `summary.report_contains_secrets=false`.
- GitHub secret-name status: `npm --prefix mobile run release:external-evidence:github-secrets:check -- --json` currently reports `present_secret_name_count=2`, `missing_secret_name_count=14`, `values_redacted=true`, `ready_for_workflow_validate=false`; `release:external-evidence:github-secrets:strict -- --json` exits non-zero until the required names are configured. The GitHub workflow readiness count remains 16 because workflow validate/run requires both current completion inputs and evidence refresh inputs; use `secret_groups.current_completion_blocker_secret_names` and `secret_groups.evidence_refresh_secret_names` when separating current blockers from refresh readiness. The local sync dry-run mirrors the same split through `summary.ready_for_current_completion_sync_inputs`, `summary.ready_for_evidence_refresh_sync_inputs`, and `summary.ready_for_sync_apply`; `release:external-evidence:github-secrets:sync:contract` locks that split, `DATABASE_URL -> APP_RELEASE_DATABASE_URL`, `APP_STORE_CONNECT_PRIVATE_KEY_PATH -> APP_STORE_CONNECT_PRIVATE_KEY`, controlled secret redaction, and apply-only GitHub dependency.

Strict completion remains blocked until structured pass evidence exists for EAS iOS + TestFlight, EAS Android, physical device, provider delivery, native crash runtime, and release completion audit strict. Telemetry runtime and release DB parity already have canonical pass evidence, but must be refreshed if their freshness policy is invalidated by later code or release drift.
