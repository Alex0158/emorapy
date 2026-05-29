# App Native Crash Runtime Production Environment Contract 待辦（2026-05-30）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App M6 native crash runtime release evidence、Sentry environment、release completion audit、external evidence fixtures 與核心文件 SSOT
**取證代碼入口**：`mobile/scripts/run-native-crash-runtime-smoke.mjs`、`mobile/scripts/check-release-completion-audit.mjs`、`mobile/scripts/lib/release-evidence-policy.mjs`、`mobile/scripts/check-release-external-evidence-status-contract.mjs`、`docs/核心開發文件`
**最後核驗 Commit**：`b2da897`
**最後核驗日期**：`2026-05-30`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理  
**優先級**：P0  
**Owner**：Mobile / Ops / QA

## 1. 當前問題

M6 strict release sign-off 要求 native crash runtime evidence 來自 release / production App runtime。`mobile/release.env.example` 與 GitHub workflow 的 native crash environment 預設已是 `production`，但單項 runner `native-crash:runtime:smoke` 在未提供 `APP_NATIVE_CRASH_EXPECTED_ENVIRONMENT` / `EXPO_PUBLIC_SENTRY_ENVIRONMENT` / `APP_ENV` 時仍預設 `development`。

更關鍵的是，`release:completion:audit` 目前只驗證 `summary.environment_matches=true`，也就是事件 environment 和 runner expected environment 相等；它沒有要求該 environment 必須是 `production`。因此若有人用 standalone runner 查到 development Sentry event，理論上可能產出 `environment_matches=true` 的 pass JSON，並被 release audit 誤收為 native crash runtime release evidence。

## 2. 目標狀態

1. `native-crash:runtime:smoke` 作為 release evidence runner 時，預設 expected environment 必須是 `production`。
2. `release:completion:audit` 與 shared `release-evidence-policy` 必須要求 native crash runtime pass evidence 的 `expected.environment` 與 `event.environment` 都是 `production`。
3. `release:external-evidence:fixtures:check` 與 `release:external-evidence:status:contract` 必須用受控 fixture 固定 production environment；development fixture 必須不能通過。
4. Runbook / Release Hardening / App Roadmap / App 測試基線 / App 外部 sign-off 待辦要明確：native crash runtime completion evidence 不是任何 Sentry event，而是 production environment 的受控 native crash event。

## 3. 業務場景

| 場景 | 預期行為 |
| --- | --- |
| 外部 owner 走 `release.env.local` 或 GitHub workflow | 預設 `APP_NATIVE_CRASH_EXPECTED_ENVIRONMENT=production`，runner 查詢 production event |
| 外部 owner 直接跑 standalone runner 且忘記帶 expected env | dry-run / run 都顯示 expected environment 為 `production`，不再退回 development |
| development Sentry event 被誤作 release evidence | `release:completion:audit` / shared evidence policy 拒絕該 JSON，不能消除 `native_crash_runtime_evidence` blocker |
| 後續真的要測 staging / development crash capture | 可另用 runner 明確傳入 `--expected-environment=staging` 做診斷，但該 evidence 不得被 strict release completion 接受 |

## 4. 邊界與注意事項

1. 本任務不配置 Sentry DSN / org / project / auth token，不查真 Sentry，不產生 pass evidence。
2. 本任務不要求 App runtime 預設 environment 從 `development` 改成 `production`；runtime 仍由 build / env config 決定。這裡只收緊 release evidence runner 與 strict audit。
3. `production` environment contract 不能取代 release / build number match、native runtime signal、crash-like event、event id hash redaction 或 provider query pass。
4. 若後續產品決定使用其他 release Sentry environment 名稱，必須同步修改 env template、workflow default、audit policy、fixture contract 與核心文件；不能只改一處。

## 5. 驗證命令

- `node --check mobile/scripts/run-native-crash-runtime-smoke.mjs`
- `node --check mobile/scripts/check-release-completion-audit.mjs`
- `node --check mobile/scripts/check-release-external-evidence-status-contract.mjs`
- `npm --prefix mobile run native-crash:runtime:smoke -- --dry-run`
- `npm --prefix mobile run release:external-evidence:fixtures:check`
- `npm --prefix mobile run release:external-evidence:status:contract`
- `npm --prefix mobile run release:completion:audit:contract`
- `npm --prefix mobile run goal:completion:audit:contract`
- `npm run docs:check`
- `npm run docs:audit:dry-run:current`
- `git diff --check`

## 6. 本輪處理結果

2026-05-30 已完成：

1. `native-crash:runtime:smoke` release evidence runner 的未顯式指定 environment 預設值已改為 `production`，dry-run 會顯示 `Expected environment: production`。
2. `release:completion:audit` 與 shared `release-evidence-policy` 已要求 native crash runtime pass evidence 的 `expected.environment` 與 `event.environment` 均為 `production`。
3. `release:external-evidence:fixtures:check` 與 `release:external-evidence:status:contract` 已加入 production fixture；development event fixture 會被 strict validator 拒絕。
4. App release runbook、Release Hardening、App Roadmap 與 App 測試證據基線已回寫：development / staging Sentry event 只能作診斷，不能消除 `native_crash_runtime_evidence` release blocker。
