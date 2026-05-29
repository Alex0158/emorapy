# App release audit 狀態文件漂移待辦（2026-05-30）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App M6 release audit、release DB parity、telemetry runtime evidence、核心文件 SSOT、外部證據交接
**取證代碼入口**：`mobile/scripts/check-release-completion-audit.mjs`、`mobile/scripts/check-app-goal-completion-audit.mjs`、`mobile/scripts/check-app-goal-audit-contract.mjs`、`backend/scripts/check-release-db-parity.ts`、`docs/核心開發文件`
**最後核驗 Commit**：`3c2e042`
**最後核驗日期**：`2026-05-30`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理；核心文件已對齊當前 audit，release DB parity / telemetry runtime 不再列為 current completion blocker  
**優先級**：P0  
**Owner**：Mobile / Ops / Docs  
**覆蓋範圍**：App M6 release sign-off、release DB parity、telemetry runtime evidence、核心文件 SSOT、外部證據交接

## 1. 當前狀態

`npm --prefix mobile run release:completion:audit -- --json` 目前回報 `passed=13`、`blocked=10`、`failures=0`。其中 `release_production_db_parity` 已通過，證據為 `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Release-DB-Parity-2026-05-16T06-23-53-463Z.json`；`telemetry_runtime_evidence` 也已通過，證據為 `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Telemetry-Runtime-2026-05-29T16-00-52-498Z.json`。

仍阻擋完整 `/goal` completion 的 completion blockers 是 10 個外部輸入 / 外部證據項：EAS project id、Expo token、Apple submission credentials、App Store Connect API credentials、EAS iOS artifact、TestFlight evidence、physical device evidence、EAS Android artifact、push provider delivery evidence、native crash runtime evidence。

核心文件中仍有若干舊表述把 `release / production DB parity` 或 `release_db_parity_evidence` 寫成當前 blocker，並且部分 telemetry runtime 說法仍使用「當前 HEAD」而沒有明確 runner-time HEAD + backend runtime path freshness policy。這會讓下一輪 App 開發誤判 release sign-off 缺口。

## 2. 目標狀態

1. 全局工程、App、Parity、測試、release evidence 文件對齊當前 audit：release DB parity 和 telemetry runtime evidence 是 structured pass evidence，不再是當前 completion blocker。
2. 文件仍保留 release DB parity 的一般治理規則：local DB、dry-run、raw console output、手寫 markdown 不能替代 non-local structured evidence；若後續新增或修改 release-blocking migration，必須重新產生 fresh pass evidence。
3. Telemetry runtime 文件統一表述為：runner 正式 run 時先驗 release backend `/version.commitSha` 對齊執行當下本地 `HEAD`，audit 後續允許 docs/evidence 類 commit 漂移，但若 backend telemetry/version runtime 路徑在 evidence commit 後有改動，舊 evidence 必須失效。
4. 外部 sign-off 文件只把 10 個 current blockers 列為 completion blockers；Sentry query credentials、native crash event id、iOS / Android physical device visibility 等仍是 prerequisite-only blockers，不替代 completion evidence。

## 3. 涉及層

| 層 | 本輪裁決 |
| --- | --- |
| Web | 僅作產品/測試口徑對照，不改 Web route、guard、browser storage 或 DOM UI |
| App | 不改 runtime code；只校準 M6 release sign-off 狀態與 App 文件 |
| Backend/API | 不改 schema/API；只保留 release DB parity evidence freshness 規則 |
| DB | 不新增 migration；明確現有 non-local release DB parity evidence 已通過，後續 schema 變更需重新跑 evidence |
| Shared client/contracts | 不改 shared package；文件不得暗示 shared layer 已替代外部 release evidence |
| Ops/Release | 以 `release:completion:audit`、`goal:completion:audit`、external status / handoff 為當前狀態來源 |

## 4. 業務場景與邊界

1. Agent / 開發者查看 App 進度時，應能從 App README、App overview、Roadmap、Parity、測試基線直接讀到「M0-M5 已落地；M6 仍外部 release-blocked；DB parity / telemetry runtime 已過」。
2. 外部 owner 準備 release inputs 時，應只看到當前 10 個 completion blockers，不應再次把已通過 DB parity 當成待補項。
3. 新增 backend migration、telemetry ingest 或 `/version` runtime 改動時，舊 DB parity / telemetry evidence 不能被延用；文件必須提示 fresh evidence 要求。
4. 不修改歷史 JSON evidence snapshot；歷史 JSON 代表當時狀態，不作本輪源碼式改寫。

## 5. 風險與注意事項

1. 不得把 release DB parity pass 解讀為完整 App release sign-off pass。
2. 不得刪除 release DB parity runner / fixture / contract 的說明，因為後續 schema 變更仍依賴這些 gate。
3. 不得把 telemetry runtime pass 解讀為 native crash runtime、external tracing backend 或長期 crash-free baseline 完成。
4. 文件更新後必須跑 docs gate 與 audit contract，避免 core-doc SSOT 和 scripts 再次分叉。

## 6. 驗證命令

本輪最小驗證：

- `rg -n "release / production DB parity.*blocker|release DB parity blockers|release_db_parity_evidence" docs/核心開發文件/20-App端 docs/核心開發文件/50-跨端Mapping與Parity docs/核心開發文件/08-測試規範與驗收 docs/核心開發文件/90-證據與盤點/環境與發版驗證`
- `npm --prefix mobile run release:completion:audit -- --json`
- `npm --prefix mobile run goal:completion:audit -- --json`
- `npm --prefix mobile run release:completion:audit:contract`
- `npm --prefix mobile run goal:completion:audit:contract`
- `npm run docs:check`
- `npm run docs:audit:dry-run:current`
- `git diff --check`

## 7. 需同步文件

- `docs/核心開發文件/05-工程架構與共享層/00-工程架構與共享層總覽.md`
- `docs/核心開發文件/05-工程架構與共享層/Repo平台分層與共享規範.md`
- `docs/核心開發文件/20-App端/README.md`
- `docs/核心開發文件/20-App端/00-App端總覽.md`
- `docs/核心開發文件/20-App端/01-App導航與平台Adapter基線.md`
- `docs/核心開發文件/20-App端/03-App完整版本開發Roadmap.md`
- `docs/核心開發文件/50-跨端Mapping與Parity/00-跨端Parity總覽.md`
- `docs/核心開發文件/50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`
- `docs/核心開發文件/08-測試規範與驗收/03-App測試與證據接入基線.md`
- `docs/核心開發文件/08-測試規範與驗收/06-SchemaMigration與相容性驗收基線.md`
- `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Goal-Completion-Audit-2026-05-08.md`
- `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Release-Hardening-2026-05-08.md`
- `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-OTel-Provider-2026-05-08.md`

## 8. 本輪處理結果

已更新全局工程、App overview / README / Roadmap、navigation adapter baseline、Parity、測試基線、Schema migration 驗收基線與 release evidence Markdown 文件，統一為以下口徑：

1. `release_production_db_parity` 目前是 passed，證據為 `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Release-DB-Parity-2026-05-16T06-23-53-463Z.json`。
2. `telemetry_runtime_evidence` 目前是 passed，證據為 `docs/核心開發文件/90-證據與盤點/環境與發版驗證/App-Telemetry-Runtime-2026-05-29T16-00-52-498Z.json`。
3. current completion blockers 維持 10 個外部項：EAS project id、Expo token、Apple submission credentials、App Store Connect API credentials、EAS iOS artifact、TestFlight evidence、physical device evidence、EAS Android artifact、push provider delivery evidence、native crash runtime evidence。
4. 後續新增 release-blocking migration 或修改 backend telemetry/version runtime path 時，必須刷新對應 evidence，不能延用舊 pass artifact。
