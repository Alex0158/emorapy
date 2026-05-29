# App Telemetry Observability Completion Boundary 待辦（2026-05-30）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App telemetry / release observability 的跨端總章、Roadmap、SLO / RTM、release completion audit 與核心文件防漂移 gate
**取證代碼入口**：`scripts/check-docs-structure.mjs`、`mobile/scripts/check-release-completion-audit.mjs`、`mobile/scripts/check-app-goal-completion-audit.mjs`、`docs/核心開發文件`
**最後核驗 Commit**：`a2206fc`
**最後核驗日期**：`2026-05-30`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理
**優先級**：P0
**Owner**：Mobile / Ops / Docs

## 1. 當前問題

`release:completion:audit` 已把 `telemetry_runtime_evidence` 判定為 passed，且 App telemetry 已有 safe ingest、CJ OTLP JSON trace ingest、minimized persistence、Admin report、30d cleanup、OpenTelemetry provider first pass、observability bootstrap 與 canonical release runtime evidence。

但核心文件仍存在兩類漂移：

1. `00-跨端產品核心/01-產品PRD總章.md` 的 App 平台需求表仍把 `CJ-PRD-APP-001` 到 `CJ-PRD-APP-011` 多數寫成 `待實作`，其中 `CJ-PRD-APP-011` 與當前 App telemetry 代碼 / evidence 明顯不一致。
2. `20-App端`、`08-測試規範與驗收`、`90-證據與盤點` 多處把 `external tracing backend`、`TestFlight crash-free sessions`、長期 SLO baseline 與 strict release completion blocker 混寫，容易讓後續 agent 誤以為 `release:completion:audit:strict` 應額外阻塞 external tracing backend，或相反地在 native crash runtime 未完成前誤稱 App observability 完成。

## 2. 目標狀態

1. 跨端總章的 App 平台需求狀態必須反映目前 M0-M5 / M6 事實：已落地、部分覆蓋、仍待外部 release evidence，而不是泛化 `待實作`。
2. 核心文件必須明確區分：
   - current strict release completion blockers：EAS project id、Expo / Apple / ASC credentials、EAS iOS / TestFlight、physical device、EAS Android、push provider delivery、production environment native crash runtime evidence。
   - current passed release observability evidence：App telemetry runtime event + OTLP ingest、OpenTelemetry provider first pass、safe telemetry / Admin report / 30d cleanup。
   - post-release / long-term SLO baseline：external tracing backend、TestFlight crash-free sessions、長期 crash-free ratio、正式 SLO / error budget / incident drill。
3. `docs:check` 必須阻止 App 平台需求表回退到 `待實作` 口徑，尤其是 `CJ-PRD-APP-011`。
4. 本任務不新增或移除任何外部 release blocker，不偽造 native crash、TestFlight、physical device、provider delivery 或 external tracing evidence。

## 3. 業務場景

| 場景 | 預期行為 |
| --- | --- |
| Agent 讀總章後選下一輪任務 | 能看到 App 主流程已落地，剩餘是 release sign-off 與長期基線，不會重複做已完成的 M0-M5 |
| 外部 owner 讀 release docs | 能辨別 telemetry runtime 已 passed，但 native crash runtime / EAS / TestFlight / 真機 / provider delivery 仍 blocked |
| Ops 要建立長期 SLO | external tracing backend / crash-free sessions 仍保留為 post-release / baseline pending，不被 release strict audit 偽裝成已完成 |
| 後續文件回寫 | 若 App 平台需求表再出現 `待實作`，`npm run docs:check` 直接失敗 |

## 4. 邊界與注意事項

1. 不新增 external tracing backend vendor integration，也不把 external tracing backend 加進當前 strict completion blocker。
2. 不把 current telemetry runtime pass evidence 升級成長期 crash-free baseline、SLO、SLA、incident response maturity 或 external tracing 完整完成。
3. 不把 native crash SDK configuration / OpenTelemetry provider first pass 視為 native crash runtime evidence。
4. 不修改 release evidence JSON，不補 placeholder evidence，不讀取或輸出 secrets。

## 5. 驗證命令

- `node --check scripts/check-docs-structure.mjs`
- `npm run docs:check`
- `npm run docs:audit:dry-run:current`
- `npm --prefix mobile run release:completion:audit -- --json`
- `npm --prefix mobile run goal:completion:audit -- --json`
- `npm --prefix mobile run release:completion:audit:contract`
- `npm --prefix mobile run goal:completion:audit:contract`
- `git diff --check`

## 6. 本輪處理結果

2026-05-30 已完成：

1. `00-跨端產品核心/01-產品PRD總章.md` 的 App 平台需求表已由泛化 `待實作` 改為逐項反映 M0-M5 / M6 現狀，並把 `CJ-PRD-APP-011` 明確拆成 telemetry runtime pass evidence 已完成、production native crash runtime / external tracing / long-term SLO 不得宣稱完成。
2. `20-App端`、`08-測試規範與驗收`、`03-管理端與平台治理`、`90-證據與盤點` 已對齊 completion 邊界：telemetry runtime pass evidence 是 current release evidence；production native crash runtime 仍是 strict release blocker；external tracing backend / TestFlight crash-free sessions / 長期 crash-free ratio 是 post-release SLO baseline pending。
3. `scripts/check-docs-structure.mjs` 已新增 App platform requirement status guard，禁止 `CJ-PRD-APP-001` 到 `CJ-PRD-APP-011` 回退為 `待實作`，並要求 `CJ-PRD-APP-011` 狀態同時區分 telemetry runtime pass evidence 與 native crash runtime blocker。
4. 本任務不新增、移除或偽造任何 release pass evidence；`release_signoff` 仍需 EAS / TestFlight / physical device / provider delivery / production native crash runtime 外部證據。
