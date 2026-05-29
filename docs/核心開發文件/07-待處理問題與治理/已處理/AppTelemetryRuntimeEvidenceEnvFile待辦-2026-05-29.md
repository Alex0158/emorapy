# App Telemetry Runtime Evidence Env File 待辦（2026-05-29）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App M6 telemetry runtime release evidence 的本機 / CI env-file 執行路徑、release backend version precheck、證據產生與 completion audit 收斂
**取證代碼入口**：`mobile/scripts/run-telemetry-runtime-smoke.mjs`、`mobile/scripts/lib/release-evidence-policy.mjs`、`mobile/scripts/check-release-completion-audit.mjs`、`mobile/release.env.example`
**最後核驗 Commit**：`3114ca0`
**最後核驗日期**：`2026-05-29`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已閉環；telemetry runtime pass evidence 已落盤並解除 release blocker
**Owner**：Mobile / Ops / QA
**關聯核心文件**：`20-App端/03-App完整版本開發Roadmap.md`、`50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`、`90-證據與盤點/環境與發版驗證/App-External-Release-Signoff-Runbook-2026-05-08.md`、`07-待處理問題與治理/待處理/App外部ReleaseSignoff待辦-2026-05-16.md`

---

## 1. 問題

`mobile/release.env.local` 已可由 `release:external-evidence:input-status` 安全讀取，且當前本機狀態顯示 `APP_TELEMETRY_RUNTIME_API_BASE_URL` 已填入、`ready_for_validate=false` 主要仍被其他外部 placeholder 阻擋。

但單項 runner `npm --prefix mobile run telemetry:runtime:smoke` 原本只讀 shell env 或 `--api-base-url=<release-api-base-url>`。這導致 external owner 已把 telemetry runtime API base URL 放入 gitignored `mobile/release.env.local` 後，仍需要手動 export 或把 URL 放到命令列才能產生 `App-Telemetry-Runtime-*.json`。命令列形式不利於統一 redaction / handoff 操作，也容易讓不同 release evidence runner 的使用方式分裂。

2026-05-29 首輪實跑 `npm --prefix mobile run telemetry:runtime:smoke -- --run --release-env-file=release.env.local` 對 non-local release API 的 event 與 OTLP ingest 都回 `403 CORS_ORIGIN_DENIED`。根因是 backend production CORS 前置檢查會拒絕無 `Origin` 的非 public API 請求；React Native / Node 類 native runtime telemetry 不應被瀏覽器 Origin 模型擋住。該次 blocked JSON 只作診斷，不能保留在 canonical evidence pack，否則 `release:completion:audit` 會把它視為 invalid candidate 並失敗。

同日重新查 release 狀態後，Railway production backend `/version` 已回到 `3114ca0`，與本地 `HEAD` 對齊；這暴露出第二個需要固化的證據邊界：telemetry runtime pass evidence 不只要證明 event / OTLP ingest accepted，也必須先證明正在驗的 release backend 是執行當下的目標 commit。否則未來可能在舊 backend 上產生看似 pass 的 `App-Telemetry-Runtime-*.json`，與 AGENTS.md 的 release version alignment 規則衝突。

## 2. 目標狀態

1. `telemetry:runtime:smoke` 支援 `--release-env-file=release.env.local`，解析方式與 external sign-off orchestrator 保持一致：只接受 `KEY=value` / `export KEY=value`，不 eval，不做 shell expansion，不輸出 raw value。
2. env-file 可包含完整 release sign-off template 的其他 key；runner 只使用 telemetry runtime 相關 key，其他已知 release key 不應阻塞單項 telemetry evidence。
3. 若 `APP_TELEMETRY_RUNTIME_API_BASE_URL` 是 placeholder、缺失、非法 URL 或 local host，run mode 必須失敗並產生可理解錯誤；不得生成 pass evidence。
4. 正式 evidence 仍只能接受 non-local release API，並只保存 host hash、request / session / trace / span hash、狀態碼與安全摘要，不保存 raw URL、token、DB URL 或 payload 明文。
5. 正式 run 必須先查 `GET /version`，要求 response ok、`service=backend` 且 `commitSha` 等於執行當下的本地 `git rev-parse HEAD`；不通過時不得送 event / OTLP，也不得產生 pass evidence。證據進入 audit 後，後續只允許 docs / evidence 類提交漂移；若該 backend commit 之後改過 telemetry ingest 或 `/version` 相關後端路徑，舊證據必須失效。
6. 若 release API 版本對齊且接受 `POST /telemetry/events` 與 `POST /telemetry/otlp/v1/traces`，產出 `App-Telemetry-Runtime-*.json` 後，`release:completion:audit` 應能把 `telemetry_runtime_evidence` 從 blocker 移除。

## 3. 涉及層面

| 層面 | 影響 |
| --- | --- |
| App | `mobile/scripts/run-telemetry-runtime-smoke.mjs` 增加安全 env-file 入口；不改 App screen 或 runtime adapter |
| Backend/API | 不新增 API；沿用 `GET /version`、`POST /api/v1/telemetry/events` 與 `POST /api/v1/telemetry/otlp/v1/traces`；production CORS 只對這兩個 App native telemetry ingest 端點允許無 `Origin` 請求，非白名單瀏覽器 `Origin` 仍 403 |
| DB | 不新增 schema；只依賴現有 telemetry minimized persistence / cleanup |
| Shared | 不改 `@cj/api-client` / `@cj/contracts` |
| Web | 不改 Web UI；只以 Web / Admin release governance 文件作對照 |
| Release evidence | 影響 `App-Telemetry-Runtime-*.json` 的產生方式與 M6 completion audit |

## 4. 業務與邊界

1. 用戶不直接觸發此流程；它是 release owner / CI runner 的外部 evidence 流程。
2. 此任務不解除 EAS project id、Expo token、Apple / ASC、EAS iOS / Android artifact、TestFlight、physical device、push provider delivery 或 native crash runtime blocker。
3. telemetry runtime evidence 只證明 release backend `/version` 與證據目標 commit 對齊，且該 commit 後沒有 backend telemetry/version runtime 路徑漂移，並證明 release API 可接受 App safe telemetry event 與 CJ OTLP JSON trace ingest；不證明 native crash、push delivery、真機 cold start 或 TestFlight readiness。
4. 若 release API 無法連線、回 404/401/403/5xx、或 accepted count 為 0，應保留 blocked evidence / stderr 診斷，不得改成假成功。
5. 若 env-file 中存在未知 key，應沿用 release sign-off 的保守口徑拒絕，避免把拼錯或不受控 key 靜默忽略。
6. CORS 修正只允許 native 無 `Origin` 的 telemetry ingest 通過；不得把 production 無 `Origin` 全站放開，也不得讓 `Origin: https://evil.example.com` 進入 telemetry endpoint。
7. 若 release backend `/version.commitSha` 缺失、為 `unknown`、不等於 runner 執行當下的本地 `HEAD`，或 runner 無法解析本地 `HEAD`，必須輸出 `blocked=true` evidence 並停止在 event / OTLP POST 之前。若後續 audit 發現該 backend commit 後改過 telemetry ingest 或 `/version` 相關後端路徑，也必須重新產生 evidence。

## 5. 已完成工程落點

1. `mobile/scripts/run-telemetry-runtime-smoke.mjs` 已支援 `--release-env-file=release.env.local`，只解析白名單內 `KEY=value` / `export KEY=value`，不 eval、不輸出 raw value，且只把 `APP_TELEMETRY_RUNTIME_*` keys 載入 runner。
2. `backend/src/app.ts` 已把 `/api/v1/telemetry/events` 與 `/api/v1/telemetry/otlp/v1/traces` 納入 App native runtime originless 白名單；`backend/tests/integration/smoke.test.ts` 已覆蓋 production 下 native 無 `Origin` 成功、非白名單瀏覽器 `Origin` 仍 403、其他 API 無 `Origin` 仍被 production CORS 擋住。
3. `release:external-evidence:status` / handoff 建議命令與 external sign-off prerequisite hints 已改用 `--release-env-file=release.env.local` 的 telemetry runtime 路徑。
4. `mobile/scripts/run-telemetry-runtime-smoke.mjs` 已在 run mode 先查 release backend `/version`，只在 `commitSha` 等於 runner 執行當下 `HEAD` 時才送 telemetry event / OTLP trace；evidence 新增 `backend_version` 與 `summary.backend_version_passed`，只保存 host hash、commit SHA 與狀態摘要。
5. `mobile/scripts/lib/release-evidence-policy.mjs`、`check-release-completion-audit.mjs` 與 `release:external-evidence:status` 共用的 candidate policy 已要求 telemetry evidence 的 backend version precheck pass，且 `expected_commit_sha` / `commit_sha` 必須彼此匹配；audit 另驗證該 commit 是目前 `HEAD` 的祖先，且其後未改動 backend telemetry/version runtime 路徑。
6. canonical pass evidence 已產出：`docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Telemetry-Runtime-2026-05-29T16-00-52-498Z.json`；`release:completion:audit -- --json` 已顯示 `telemetry_runtime_evidence` passed，當前 release blockers 從 11 降為 10。

## 6. 驗證命令

```bash
npm --prefix mobile run telemetry:runtime:smoke -- --dry-run --release-env-file=release.env.local
npm --prefix mobile run telemetry:runtime:smoke -- --run --release-env-file=release.env.local
npm --prefix mobile run release:evidence-redaction:check
npm --prefix mobile run release:completion:audit -- --json
npm --prefix mobile run release:evidence:check
npm run docs:check
npm run docs:audit:dry-run:current
```

`--run` 只有在 `APP_TELEMETRY_RUNTIME_API_BASE_URL` 指向 non-local release API 時才可通過；若 release API 當前不可用，應把失敗狀態回寫本文件，而不是把 dry-run 當完成。

2026-05-29 本地已通過：

```bash
node --check mobile/scripts/run-telemetry-runtime-smoke.mjs
npm --prefix mobile run telemetry:runtime:smoke -- --dry-run --release-env-file=release.env.local
npm --prefix backend test -- --runInBand tests/integration/smoke.test.ts
```

2026-05-29 已完成正式 release API run：

```bash
npm --prefix mobile run telemetry:runtime:smoke -- --run --release-env-file=release.env.local
npm --prefix mobile run release:completion:audit -- --json
```

結果：`App-Telemetry-Runtime-2026-05-29T16-00-52-498Z.json` 為 `blocked=false`，`backend_version_passed=true`，`event_ingest_passed=true`，`otlp_ingest_passed=true`；`release:completion:audit` 顯示 `telemetry_runtime_evidence` passed。後續仍需補齊 EAS project id、Expo / Apple / ASC credentials、EAS iOS / TestFlight、physical device、EAS Android、push provider delivery 與 native crash runtime。
