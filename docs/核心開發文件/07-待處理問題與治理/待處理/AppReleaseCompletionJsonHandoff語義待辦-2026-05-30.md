# App release completion JSON handoff 語義待辦（2026-05-30）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App M6 release completion audit JSON、external handoff catalog、CI / dashboard / agent 交接語義
**取證代碼入口**：`mobile/scripts/check-release-completion-audit.mjs`、`mobile/scripts/check-release-completion-audit-contract.mjs`、`mobile/scripts/check-app-goal-completion-audit.mjs`、`mobile/scripts/check-app-goal-audit-contract.mjs`
**最後核驗 Commit**：`fd0ad0d`
**最後核驗日期**：`2026-05-30`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理  
**優先級**：P0  
**Owner**：Mobile / Ops / Docs  
**關聯核心文件**：`90-證據與盤點/環境與發版驗證/App-Goal-Completion-Audit-2026-05-08.md`、`90-證據與盤點/環境與發版驗證/App-Release-Hardening-2026-05-08.md`、`20-App端/03-App完整版本開發Roadmap.md`、`08-測試規範與驗收/03-App測試與證據接入基線.md`

---

## 1. 當前狀態

`release:completion:audit -- --json` 的頂層 `handoff_blocker_ids` 已只包含當前 blocked completion checks 對應的 10 個 external handoff owner action；`release_db_parity_evidence` 與 `telemetry_runtime_evidence` 在 release DB parity / telemetry runtime 已通過後不再出現在頂層 blocker 清單。

但單個 `checks[]` 仍把 `handoff_blocker_ids` 當成靜態 completion-to-handoff mapping。當 `telemetry_runtime_evidence` 或 `release_production_db_parity` 已 `passed` 時，它們的 check-level `handoff_blocker_ids` 仍會列出 `telemetry_runtime_evidence` / `release_db_parity_evidence`。這和頂層「current blockers only」語義不同，對 CI / dashboard / agent 消費方容易造成誤讀。

## 2. 目標狀態

1. `checks[].handoff_blocker_ids` 只代表該 release completion check 在當前 audit 中仍 blocked 時需要交接的 owner action；passed checks 必須為空陣列。
2. 若仍需要保留靜態 mapping，新增 `checks[].handoff_catalog_ids` 表示該 completion check 對應的 external handoff catalog id，不把它混入 current blocker 語義。
3. 頂層 `handoff_blocker_ids` 維持由 blocked checks 的 `handoff_blocker_ids` 去重得出。
4. `release:completion:audit:contract` 必須同時驗證 check-level status-scoped blocker ids、catalog ids、頂層 handoff coverage 與 strict exit-code。
5. `/goal` audit 與核心文件要明確說明：`release_signoff.details.handoff_blocker_ids` 是當前 completion blockers，`release_completion_handoff_blocker_ids` 來自 external handoff snapshot，telemetry / DB refresh ids 只有在重新 blocked 時才會進入 current blocker list。

## 3. 涉及層

| 層 | 本輪裁決 |
| --- | --- |
| Web | 不改 Web route、storage、guard 或 UI；只作 release dashboard / agent 消費口徑對照 |
| App | 不改 App runtime screen；只改 M6 release audit JSON 與 contract |
| Backend/API/DB | 不改 schema / route；release DB parity pass evidence 仍保持有效，後續 migration drift 需重跑 |
| Shared | 不改 `@cj/api-client` / `@cj/contracts` |
| Ops/Release | `release:completion:audit -- --json`、`goal:completion:audit -- --json`、external handoff artifact 是主要消費面 |

## 4. 業務場景與邊界

| 場景 | 預期行為 |
| --- | --- |
| CI 讀取 release completion JSON | 只用頂層 `blocker_ids` / `handoff_blocker_ids` 判斷當前阻塞項，不會因 passed check 的 mapping 誤報 |
| Dashboard 顯示單項 check | `handoff_blocker_ids=[]` 表示該項當前已過；`handoff_catalog_ids` 仍可顯示它原本對應哪個 external evidence 類型 |
| telemetry runtime 或 release DB parity 後續因 drift 失效 | 對應 check 轉回 blocked，`handoff_blocker_ids` 重新列入 `telemetry_runtime_evidence` 或 `release_db_parity_evidence` |
| `/goal` audit 彙總 release signoff | 仍只列 10 個 current completion handoff blockers；不把 refresh catalog id 當成當前 blocker |

## 5. 風險與注意事項

1. 不能刪除 telemetry runtime / release DB parity 的 external handoff catalog，因為後續 drift 仍需要 owner action。
2. 不能把 passed check 的 `handoff_catalog_ids` 視為 release 未完成；它只是靜態 mapping。
3. 不能用這個 JSON 語義修正替代 EAS/TestFlight/真機/provider/native crash pass evidence。
4. 若改 JSON schema，必須同步 contract gate 與核心文件，避免下游消費方依賴舊語義。

## 6. 驗證命令

- `npm --prefix mobile run release:completion:audit -- --json`
- `npm --prefix mobile run goal:completion:audit -- --json`
- `npm --prefix mobile run release:completion:audit:contract`
- `npm --prefix mobile run goal:completion:audit:contract`
- `npm --prefix mobile run release:evidence:check`
- `npm run docs:check`
- `npm run docs:audit:dry-run:current`
- `git diff --check`

## 7. 本輪處理結果

已將 `release:completion:audit -- --json` 的 check-level handoff 欄位拆成兩層：

1. `checks[].handoff_catalog_ids`：靜態 completion-to-external-handoff catalog mapping；passed / blocked checks 都可保留。
2. `checks[].handoff_blocker_ids`：當前狀態化 blocker handoff ids；只有 blocked checks 才非空。

當前 `telemetry_runtime_evidence` 與 `release_production_db_parity` 皆為 `passed`，因此它們的 `handoff_blocker_ids=[]`，但 `handoff_catalog_ids` 分別保留 `telemetry_runtime_evidence` 與 `release_db_parity_evidence`，供後續 drift 後重新 blocked 時追溯 owner action。頂層 `handoff_blocker_ids` 仍由 blocked checks 去重得出，維持 10 個 current release completion handoff blockers。
