# App GitHub secret sync contract 待辦（2026-05-30）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App M6 release GitHub Environment secret sync helper、redacted dry-run、CI secret 交接 contract
**取證代碼入口**：`mobile/scripts/sync-release-github-secrets.mjs`、`mobile/scripts/check-release-github-secret-sync-contract.mjs`、`mobile/package.json`、`mobile/scripts/check-release-completion-audit.mjs`、`mobile/scripts/check-app-goal-completion-audit.mjs`
**最後核驗 Commit**：`66b4258`
**最後核驗日期**：`2026-05-30`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理
**優先級**：P0
**Owner**：Mobile / Ops / QA
**關聯核心文件**：`90-證據與盤點/環境與發版驗證/App-External-Release-Signoff-Runbook-2026-05-08.md`、`90-證據與盤點/環境與發版驗證/App-External-Signoff-Input-Checklist-2026-05-16.md`、`90-證據與盤點/環境與發版驗證/App-Release-Hardening-2026-05-08.md`、`90-證據與盤點/環境與發版驗證/App-Goal-Completion-Audit-2026-05-08.md`、`08-測試規範與驗收/03-App測試與證據接入基線.md`

---

## 1. 當前狀態

App 外部 release sign-off 已具備 `release:external-evidence:github-secrets:check`、`:strict` 與 `:sync` 三個入口：

1. `github-secrets:check` / `:strict` 只讀 GitHub repository / Environment secret names，不讀 secret values。
2. `github-secrets:sync` 從 gitignored `mobile/release.env.local` 讀取本機 release inputs，預設 dry-run，`--apply` 才寫入 `Production` GitHub Environment secrets。
3. `github-secrets:sync -- --json` 已輸出 `secret_groups.current_completion_blocker_secret_names` 與 `secret_groups.evidence_refresh_secret_names`，可區分當前 completion blocker secrets 與 telemetry / DB refresh secrets。

但 `github-secrets:sync` 目前缺一個本地 contract gate，無法在不連 GitHub、不依賴 `gh` auth 的情況下證明：

1. dry-run 只做本機 env-file 解析與 redacted mapping，不應要求 `gh` 或網路。
2. full fake env-file 的 dry-run JSON schema、group readiness 與 `DATABASE_URL -> APP_RELEASE_DATABASE_URL`、ASC private key path -> `APP_STORE_CONNECT_PRIVATE_KEY` mapping 穩定。
3. placeholder env-file 能清楚顯示 current completion secrets 不 ready、evidence refresh secrets 可 ready。
4. stdout / stderr / JSON 不回洩 raw token、DB URL、push token、Sentry token、device id、private key 或 private key path。

這個缺口不會直接解除 EAS / TestFlight / 真機 / provider / native crash blockers，但會降低外部 owner 在填 secrets 前後的誤判與回歸風險。

## 2. 目標狀態

1. 新增 `release:external-evidence:github-secrets:sync:contract` 本地 contract gate。
2. contract gate 使用受控臨時 env-file 與 private key fixture，驗證 full dry-run 在 `PATH` 不含 `gh` 時仍通過，證明 dry-run 不連 GitHub。
3. contract gate 驗證 `--apply` 在沒有 `gh` 時不能靜默成功，且失敗輸出仍不洩漏 secret values。
4. contract gate 驗證 placeholder / partial env-file 會在 JSON 中保持 `ready_for_current_completion_sync_inputs=false`、`ready_for_evidence_refresh_sync_inputs=true`、`ready_for_sync_apply=false`。
5. `release:preflight`、`release:completion:audit`、`goal:completion:audit` 與核心文件同步納入此 contract，使後續改動不能把 dry-run 變回外部依賴或 secret-leaky 工具。

## 3. 涉及層

| 層 | 本輪裁決 |
| --- | --- |
| Web | 不改 Web route、browser storage、DOM UI 或 Web guard；只借 Web release SSOT 的 CI / evidence 思路 |
| App | 不改 App runtime screen / navigation；只改 M6 release tooling 與 gate |
| Backend/API/DB | 不改 API、DB schema 或 migration；`DATABASE_URL` 只作 redacted secret mapping source |
| Shared | 不改 `@cj/api-client` / `@cj/contracts` |
| Ops/Release | 主要變更面；`github-secrets:sync` dry-run 與 contract gate 是外部 release owner 補 secret 前的安全自查 |

## 4. 業務場景與邊界

| 場景 | 預期行為 |
| --- | --- |
| 外部 owner 尚未登入 GitHub CLI，只想確認本機 env-file 是否填齊 | `github-secrets:sync -- --json` dry-run 可在無 `gh` 情況下輸出 redacted local readiness |
| 外部 owner 已填完整 16 個 workflow secret inputs | dry-run 顯示 current completion 與 evidence refresh 兩組 ready，仍不寫入 GitHub |
| 外部 owner 只填了 telemetry / DB refresh inputs | dry-run 顯示 refresh group ready，但 current completion group 不 ready，不得誤導為 release completion 可 validate |
| 外部 owner 執行 `--apply` | 必須檢查 GitHub Environment 並透過 `gh secret set --env <env>` 寫入；沒有 `gh` 或 Environment 不存在時 fail |
| env-file 含 secret values | contract 必須證明 stdout / stderr / JSON 只輸出 key / secret name / counters / booleans，不輸出 raw value |

## 5. 風險與注意事項

1. `github-secrets:sync:contract` 不能使用真 secrets 或真 GitHub 寫入。
2. dry-run ready 不是 GitHub Environment 已配置，也不是 workflow validate / run 通過；正式仍需 `github-secrets:strict`、workflow validate / run 與 strict release audits。
3. `--apply` 仍必須依賴 `gh`，不能因 dry-run 本地化而繞過 GitHub Environment 存在性與 secret 寫入失敗。
4. Contract 不應要求網路或 GitHub auth，否則會讓日常 `release:preflight` 受外部狀態干擾。

## 6. 驗證命令

- `node --check mobile/scripts/sync-release-github-secrets.mjs`
- `node --check mobile/scripts/check-release-github-secret-sync-contract.mjs`
- `npm --prefix mobile run release:external-evidence:github-secrets:sync:contract`
- `npm --prefix mobile run release:external-evidence:github-secrets:sync -- --json`
- `npm --prefix mobile run release:completion:audit:contract`
- `npm --prefix mobile run goal:completion:audit:contract`
- `npm run docs:check`
- `npm run docs:audit:dry-run:current`

## 7. 實作結果

2026-05-30 已完成：

1. `mobile/scripts/sync-release-github-secrets.mjs` 改為只有 `--apply` 才檢查 GitHub Environment；dry-run 在本機完成 redacted readiness，不依賴 `gh` / GitHub auth / network。
2. 新增 `mobile/scripts/check-release-github-secret-sync-contract.mjs`，用受控臨時 env-file 與 private key fixture 驗證 full dry-run、placeholder dry-run、redaction、`DATABASE_URL -> APP_RELEASE_DATABASE_URL`、private key path -> `APP_STORE_CONNECT_PRIVATE_KEY` 與 apply-only GitHub dependency。
3. `release:external-evidence:github-secrets:sync:contract` 已接入 `release:preflight`、`release:completion:audit`、`goal:completion:audit` 與 `goal:completion:audit:contract`。
4. Runbook、input checklist、release hardening、goal audit、Roadmap、測試基線、外部 ReleaseSignoff 待辦與核心文件逐文件台賬已同步。

## 8. Owner / Status Notes

本輪只處理本地 dry-run contract 與文件回寫；不填入 `EXPO_TOKEN`、Apple / ASC、Sentry、device id、push token 或 EAS project id，不產生任何 pass 狀態外部 release evidence。
