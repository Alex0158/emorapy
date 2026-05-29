# App Native Crash Runtime Production Doc Needle Contract 待辦（2026-05-30）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App M6 native crash runtime release completion audit、production environment 文檔契約、release completion audit JSON contract 與核心文件 SSOT
**取證代碼入口**：`mobile/scripts/check-release-completion-audit.mjs`、`mobile/scripts/check-release-completion-audit-contract.mjs`、`docs/核心開發文件`
**最後核驗 Commit**：`0d17166`
**最後核驗日期**：`2026-05-30`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理  
**優先級**：P0  
**Owner**：Mobile / Ops / QA

## 1. 當前問題

上一輪已把 native crash runtime pass evidence 收緊為 `expected.environment=production` 且 `event.environment=production`，runner 預設也改為 production。但 `release:completion:audit` 的文檔覆蓋檢查仍只要求 `native crash runtime evidence` 或 `native-crash:runtime:smoke` 這類泛化 needle。

這表示如果後續核心文件退回「release / environment match」或只提 runner 名稱，audit 仍可能把 `native_crash_runtime_evidence.documented=true`，無法保證 production environment release contract 被文檔持續承載。

## 2. 目標狀態

1. `native_crash_runtime_evidence` completion check 的 `doc_needles` 必須是 production-specific phrase，例如 `production environment native crash runtime evidence` 或 `release / production environment match`。
2. `release:completion:audit:contract` 必須驗證 native crash runtime check 的 `doc_needles` 至少包含 production environment 約束，避免未來退回泛化文案。
3. release audit blocker / warning 應提示 pass evidence 需要 production environment native crash runtime，而不只說 native crash runtime smoke。
4. 本任務不改 strict completion 結果，也不解除任何外部 Sentry / EAS / physical device blocker。

## 3. 業務場景

| 場景 | 預期行為 |
| --- | --- |
| 核心文件誤刪 production environment 口徑 | `release:completion:audit` 或 contract gate 失敗，而不是繼續顯示 documented=true |
| 外部 owner 讀 release audit JSON | `doc_needles` 與 warning 能指出需要 production environment evidence |
| 仍缺 Sentry org/project/auth token/event id | completion audit 繼續 blocked，不因文檔契約強化而偽造 pass evidence |

## 4. 邊界與注意事項

1. 不新增任何 Sentry provider 查詢，不產生 `App-Native-Crash-Runtime-*.json` pass evidence。
2. 不要求 App runtime environment 預設改成 production；只收緊 release audit 與文件契約。
3. `production environment` doc needle 不能替代 release/build match、native runtime signal、crash-like event、provider query pass 或 redaction 檢查。

## 5. 驗證命令

- `node --check mobile/scripts/check-release-completion-audit.mjs`
- `node --check mobile/scripts/check-release-completion-audit-contract.mjs`
- `npm --prefix mobile run release:completion:audit -- --json`
- `npm --prefix mobile run release:completion:audit:contract`
- `npm --prefix mobile run goal:completion:audit:contract`
- `npm run docs:check`
- `npm run docs:audit:dry-run:current`
- `git diff --check`

## 6. 本輪處理結果

2026-05-30 已完成：

1. `native_crash_runtime_evidence` completion check 的 `doc_needles` 已改為 production-specific phrase：`production environment native crash runtime evidence` / `release / production environment match`。
2. `release:completion:audit` 的 blocker 與 warning 已明確要求 production environment native crash runtime evidence。
3. `release:completion:audit:contract` 已新增防回退檢查：native crash runtime doc needles、當前 blocker 與 warning 都必須包含 production environment 語義。
4. 本任務不解除外部 release blockers；`release_signoff` 仍需真實 EAS / TestFlight / physical device / push provider / Sentry runtime pass evidence。
