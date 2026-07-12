# Emorapy Governance ID Namespace Migration Evidence - 2026-06-21

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：命名治理遷移證據
**覆蓋範圍**：T2 current SSOT governance / PRD ID namespace migration from `CJ-*` to `EMO-*`
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**取證代碼入口**：`git grep -ohE "CJ-[A-Z0-9]+(-[A-Z0-9]+)+" -- docs/核心開發文件`、`scripts/check-docs-structure.mjs`、`scripts/check-docs-truth.mjs`、`scripts/check-emorapy-naming-governance.mjs`
**最後核驗 Commit**：`e178cea`
**最後核驗日期**：`2026-06-21`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## Purpose

This evidence freezes the pre-migration unique `CJ-*` governance ID inventory and the deterministic `CJ-*` -> `EMO-*` mapping used by the T2 migration. It is evidence only; current policy lives in the root PRD, terminology, and governance pending issue.

## Scope Boundary

Current SSOT migration scope:

- Root flagship docs: 7 unique pre-migration `CJ-*` IDs
- `docs/核心開發文件/00-跨端產品核心`: 73 unique pre-migration `CJ-*` IDs
- `docs/核心開發文件/03-管理端與平台治理`: 19 unique pre-migration `CJ-*` IDs
- `docs/核心開發文件/04-共用機制`: 102 unique pre-migration `CJ-*` IDs
- `docs/核心開發文件/05-工程架構與共享層`: 30 unique pre-migration `CJ-*` IDs
- `docs/核心開發文件/06-接口描述`: 21 unique pre-migration `CJ-*` IDs
- `docs/核心開發文件/08-測試規範與驗收`: 122 unique pre-migration `CJ-*` IDs
- `docs/核心開發文件/20-App端`: 18 unique pre-migration `CJ-*` IDs
- `docs/核心開發文件/50-跨端Mapping與Parity`: 0 unique pre-migration `CJ-*` IDs
- Active governance pending docs migrated as current references: 6 unique pre-migration `CJ-*` IDs

Excluded historical/provenance layers are not mechanically rewritten: `07-待處理問題與治理/已處理`、`90-證據與盤點` existing historical evidence, `99-歷史降級索引`、`文件收斂`. The two active naming-migration handoff docs keep legacy `CJ-*` references only as mapping/provenance text.

## Inventory Summary

- Unique pre-migration `CJ-*` tokens under `docs/核心開發文件`: 291
- Mapping rule: replace only the leading namespace prefix `CJ-` with `EMO-`; preserve suffix, number, category, and ordering exactly.
- Mapping count: 291

## Mapping

| Legacy ID | Current ID |
|---|---|
| `CJ-A11Y-001` | `EMO-A11Y-001` |
| `CJ-A11Y-002` | `EMO-A11Y-002` |
| `CJ-A11Y-003` | `EMO-A11Y-003` |
| `CJ-A11Y-004` | `EMO-A11Y-004` |
| `CJ-A11Y-GAP-001` | `EMO-A11Y-GAP-001` |
| `CJ-A11Y-GAP-002` | `EMO-A11Y-GAP-002` |
| `CJ-A11Y-GAP-003` | `EMO-A11Y-GAP-003` |
| `CJ-A11Y-T-001` | `EMO-A11Y-T-001` |
| `CJ-A11Y-T-002` | `EMO-A11Y-T-002` |
| `CJ-A11Y-T-003` | `EMO-A11Y-T-003` |
| `CJ-A11Y-T-004` | `EMO-A11Y-T-004` |
| `CJ-ADR-001` | `EMO-ADR-001` |
| `CJ-ADR-002` | `EMO-ADR-002` |
| `CJ-ADR-003` | `EMO-ADR-003` |
| `CJ-ADR-004` | `EMO-ADR-004` |
| `CJ-ADR-005` | `EMO-ADR-005` |
| `CJ-ADR-006` | `EMO-ADR-006` |
| `CJ-ADR-007` | `EMO-ADR-007` |
| `CJ-ADR-008` | `EMO-ADR-008` |
| `CJ-ADR-009` | `EMO-ADR-009` |
| `CJ-ADR-GAP-001` | `EMO-ADR-GAP-001` |
| `CJ-ADR-GAP-002` | `EMO-ADR-GAP-002` |
| `CJ-ADR-GAP-003` | `EMO-ADR-GAP-003` |
| `CJ-ADR-GAP-004` | `EMO-ADR-GAP-004` |
| `CJ-ADR-GAP-005` | `EMO-ADR-GAP-005` |
| `CJ-AI-ASSET` | `EMO-AI-ASSET` |
| `CJ-AI-ASSET-001` | `EMO-AI-ASSET-001` |
| `CJ-AI-ASSET-002` | `EMO-AI-ASSET-002` |
| `CJ-AI-ASSET-003` | `EMO-AI-ASSET-003` |
| `CJ-AI-ASSET-004` | `EMO-AI-ASSET-004` |
| `CJ-AI-ASSET-005` | `EMO-AI-ASSET-005` |
| `CJ-AI-ASSET-006` | `EMO-AI-ASSET-006` |
| `CJ-AI-GAP-001` | `EMO-AI-GAP-001` |
| `CJ-AI-GAP-002` | `EMO-AI-GAP-002` |
| `CJ-AI-GAP-003` | `EMO-AI-GAP-003` |
| `CJ-AI-GAP-004` | `EMO-AI-GAP-004` |
| `CJ-AI-GAP-005` | `EMO-AI-GAP-005` |
| `CJ-AI-GAP-006` | `EMO-AI-GAP-006` |
| `CJ-AI-RISK` | `EMO-AI-RISK` |
| `CJ-AI-RISK-001` | `EMO-AI-RISK-001` |
| `CJ-AI-RISK-002` | `EMO-AI-RISK-002` |
| `CJ-AI-RISK-003` | `EMO-AI-RISK-003` |
| `CJ-AI-RISK-004` | `EMO-AI-RISK-004` |
| `CJ-AI-RISK-005` | `EMO-AI-RISK-005` |
| `CJ-AI-RISK-006` | `EMO-AI-RISK-006` |
| `CJ-AI-RISK-007` | `EMO-AI-RISK-007` |
| `CJ-AI-RISK-008` | `EMO-AI-RISK-008` |
| `CJ-AI-RISK-009` | `EMO-AI-RISK-009` |
| `CJ-API-GAP-001` | `EMO-API-GAP-001` |
| `CJ-API-GAP-002` | `EMO-API-GAP-002` |
| `CJ-API-GAP-003` | `EMO-API-GAP-003` |
| `CJ-API-GAP-004` | `EMO-API-GAP-004` |
| `CJ-API-GAP-005` | `EMO-API-GAP-005` |
| `CJ-API-GAP-006` | `EMO-API-GAP-006` |
| `CJ-API-GAP-007` | `EMO-API-GAP-007` |
| `CJ-CONTENT-001` | `EMO-CONTENT-001` |
| `CJ-CONTENT-002` | `EMO-CONTENT-002` |
| `CJ-CONTENT-GAP-001` | `EMO-CONTENT-GAP-001` |
| `CJ-CONTENT-T-001` | `EMO-CONTENT-T-001` |
| `CJ-CONTENT-T-002` | `EMO-CONTENT-T-002` |
| `CJ-DATA-0` | `EMO-DATA-0` |
| `CJ-DATA-1` | `EMO-DATA-1` |
| `CJ-DATA-2` | `EMO-DATA-2` |
| `CJ-DATA-3` | `EMO-DATA-3` |
| `CJ-DATA-4` | `EMO-DATA-4` |
| `CJ-DATA-5` | `EMO-DATA-5` |
| `CJ-DATA-GAP-001` | `EMO-DATA-GAP-001` |
| `CJ-DATA-GAP-002` | `EMO-DATA-GAP-002` |
| `CJ-DATA-GAP-003` | `EMO-DATA-GAP-003` |
| `CJ-DATA-GAP-004` | `EMO-DATA-GAP-004` |
| `CJ-DATA-GAP-005` | `EMO-DATA-GAP-005` |
| `CJ-DATA-GAP-006` | `EMO-DATA-GAP-006` |
| `CJ-DATA-GAP-007` | `EMO-DATA-GAP-007` |
| `CJ-DATA-GAP-008` | `EMO-DATA-GAP-008` |
| `CJ-ERR-001` | `EMO-ERR-001` |
| `CJ-ERR-002` | `EMO-ERR-002` |
| `CJ-ERR-003` | `EMO-ERR-003` |
| `CJ-ERR-004` | `EMO-ERR-004` |
| `CJ-ERR-005` | `EMO-ERR-005` |
| `CJ-ERR-006` | `EMO-ERR-006` |
| `CJ-ERR-007` | `EMO-ERR-007` |
| `CJ-ERR-GAP-001` | `EMO-ERR-GAP-001` |
| `CJ-ERR-GAP-002` | `EMO-ERR-GAP-002` |
| `CJ-ERR-GAP-003` | `EMO-ERR-GAP-003` |
| `CJ-ERR-GAP-004` | `EMO-ERR-GAP-004` |
| `CJ-ERR-GAP-005` | `EMO-ERR-GAP-005` |
| `CJ-GAP-A11Y-001` | `EMO-GAP-A11Y-001` |
| `CJ-GAP-ADR-001` | `EMO-GAP-ADR-001` |
| `CJ-GAP-AI-001` | `EMO-GAP-AI-001` |
| `CJ-GAP-API-001` | `EMO-GAP-API-001` |
| `CJ-GAP-APP-001` | `EMO-GAP-APP-001` |
| `CJ-GAP-APP-002` | `EMO-GAP-APP-002` |
| `CJ-GAP-DATA-001` | `EMO-GAP-DATA-001` |
| `CJ-GAP-ERR-001` | `EMO-GAP-ERR-001` |
| `CJ-GAP-GOV-001` | `EMO-GAP-GOV-001` |
| `CJ-GAP-MET-001` | `EMO-GAP-MET-001` |
| `CJ-GAP-NFR-001` | `EMO-GAP-NFR-001` |
| `CJ-GAP-OPS-001` | `EMO-GAP-OPS-001` |
| `CJ-GAP-OPS-002` | `EMO-GAP-OPS-002` |
| `CJ-GAP-PRD-001` | `EMO-GAP-PRD-001` |
| `CJ-GAP-PRD-002` | `EMO-GAP-PRD-002` |
| `CJ-GAP-RTM-001` | `EMO-GAP-RTM-001` |
| `CJ-GAP-SCHEMA-001` | `EMO-GAP-SCHEMA-001` |
| `CJ-GAP-SEC-001` | `EMO-GAP-SEC-001` |
| `CJ-GAP-STATE-001` | `EMO-GAP-STATE-001` |
| `CJ-HYP-001` | `EMO-HYP-001` |
| `CJ-HYP-002` | `EMO-HYP-002` |
| `CJ-HYP-003` | `EMO-HYP-003` |
| `CJ-HYP-004` | `EMO-HYP-004` |
| `CJ-HYP-005` | `EMO-HYP-005` |
| `CJ-HYP-006` | `EMO-HYP-006` |
| `CJ-INC-YYYYMMDD` | `EMO-INC-YYYYMMDD` |
| `CJ-L10N-001` | `EMO-L10N-001` |
| `CJ-L10N-002` | `EMO-L10N-002` |
| `CJ-L10N-003` | `EMO-L10N-003` |
| `CJ-L10N-004` | `EMO-L10N-004` |
| `CJ-L10N-GAP-001` | `EMO-L10N-GAP-001` |
| `CJ-L10N-T-001` | `EMO-L10N-T-001` |
| `CJ-L10N-T-002` | `EMO-L10N-T-002` |
| `CJ-L10N-T-003` | `EMO-L10N-T-003` |
| `CJ-MET-001` | `EMO-MET-001` |
| `CJ-MET-002` | `EMO-MET-002` |
| `CJ-MET-003` | `EMO-MET-003` |
| `CJ-MET-004` | `EMO-MET-004` |
| `CJ-MET-005` | `EMO-MET-005` |
| `CJ-MET-006` | `EMO-MET-006` |
| `CJ-MET-007` | `EMO-MET-007` |
| `CJ-MET-008` | `EMO-MET-008` |
| `CJ-MET-009` | `EMO-MET-009` |
| `CJ-MET-010` | `EMO-MET-010` |
| `CJ-MET-APP-001` | `EMO-MET-APP-001` |
| `CJ-MET-APP-002` | `EMO-MET-APP-002` |
| `CJ-MET-APP-003` | `EMO-MET-APP-003` |
| `CJ-MET-APP-004` | `EMO-MET-APP-004` |
| `CJ-MET-APP-005` | `EMO-MET-APP-005` |
| `CJ-MET-APP-006` | `EMO-MET-APP-006` |
| `CJ-NFR-001` | `EMO-NFR-001` |
| `CJ-NFR-002` | `EMO-NFR-002` |
| `CJ-NFR-003` | `EMO-NFR-003` |
| `CJ-NFR-004` | `EMO-NFR-004` |
| `CJ-NFR-005` | `EMO-NFR-005` |
| `CJ-NFR-006` | `EMO-NFR-006` |
| `CJ-NFR-007` | `EMO-NFR-007` |
| `CJ-NFR-008` | `EMO-NFR-008` |
| `CJ-NFR-009` | `EMO-NFR-009` |
| `CJ-NFR-010` | `EMO-NFR-010` |
| `CJ-NFR-011` | `EMO-NFR-011` |
| `CJ-NFR-012` | `EMO-NFR-012` |
| `CJ-NFR-013` | `EMO-NFR-013` |
| `CJ-NFR-014` | `EMO-NFR-014` |
| `CJ-NFR-015` | `EMO-NFR-015` |
| `CJ-NFR-016` | `EMO-NFR-016` |
| `CJ-NFR-017` | `EMO-NFR-017` |
| `CJ-NFR-018` | `EMO-NFR-018` |
| `CJ-NFR-019` | `EMO-NFR-019` |
| `CJ-NOGO-001` | `EMO-NOGO-001` |
| `CJ-NOGO-002` | `EMO-NOGO-002` |
| `CJ-NOGO-003` | `EMO-NOGO-003` |
| `CJ-NOGO-004` | `EMO-NOGO-004` |
| `CJ-NOGO-005` | `EMO-NOGO-005` |
| `CJ-NOGO-006` | `EMO-NOGO-006` |
| `CJ-OPS-GAP` | `EMO-OPS-GAP` |
| `CJ-OPS-GAP-001` | `EMO-OPS-GAP-001` |
| `CJ-OPS-GAP-002` | `EMO-OPS-GAP-002` |
| `CJ-OPS-GAP-003` | `EMO-OPS-GAP-003` |
| `CJ-OPS-GAP-004` | `EMO-OPS-GAP-004` |
| `CJ-OPS-GAP-005` | `EMO-OPS-GAP-005` |
| `CJ-OPS-GAP-006` | `EMO-OPS-GAP-006` |
| `CJ-OPS-GAP-007` | `EMO-OPS-GAP-007` |
| `CJ-OPS-GAP-008` | `EMO-OPS-GAP-008` |
| `CJ-OPS-T-001` | `EMO-OPS-T-001` |
| `CJ-OPS-T-002` | `EMO-OPS-T-002` |
| `CJ-OPS-T-003` | `EMO-OPS-T-003` |
| `CJ-OPS-T-004` | `EMO-OPS-T-004` |
| `CJ-OPS-T-005` | `EMO-OPS-T-005` |
| `CJ-OPS-T-006` | `EMO-OPS-T-006` |
| `CJ-OPS-T-007` | `EMO-OPS-T-007` |
| `CJ-OPS-T-008` | `EMO-OPS-T-008` |
| `CJ-PRD-APP` | `EMO-PRD-APP` |
| `CJ-PRD-APP-001` | `EMO-PRD-APP-001` |
| `CJ-PRD-APP-002` | `EMO-PRD-APP-002` |
| `CJ-PRD-APP-003` | `EMO-PRD-APP-003` |
| `CJ-PRD-APP-004` | `EMO-PRD-APP-004` |
| `CJ-PRD-APP-005` | `EMO-PRD-APP-005` |
| `CJ-PRD-APP-006` | `EMO-PRD-APP-006` |
| `CJ-PRD-APP-007` | `EMO-PRD-APP-007` |
| `CJ-PRD-APP-008` | `EMO-PRD-APP-008` |
| `CJ-PRD-APP-009` | `EMO-PRD-APP-009` |
| `CJ-PRD-APP-010` | `EMO-PRD-APP-010` |
| `CJ-PRD-APP-011` | `EMO-PRD-APP-011` |
| `CJ-PRD-APP-012` | `EMO-PRD-APP-012` |
| `CJ-PRD-COM` | `EMO-PRD-COM` |
| `CJ-PRD-COM-001` | `EMO-PRD-COM-001` |
| `CJ-PRD-COM-002` | `EMO-PRD-COM-002` |
| `CJ-PRD-COM-003` | `EMO-PRD-COM-003` |
| `CJ-PRD-COM-004` | `EMO-PRD-COM-004` |
| `CJ-PRD-COM-005` | `EMO-PRD-COM-005` |
| `CJ-PRD-WEB` | `EMO-PRD-WEB` |
| `CJ-RTM-001` | `EMO-RTM-001` |
| `CJ-RTM-002` | `EMO-RTM-002` |
| `CJ-RTM-003` | `EMO-RTM-003` |
| `CJ-RTM-004` | `EMO-RTM-004` |
| `CJ-RTM-005` | `EMO-RTM-005` |
| `CJ-RTM-006` | `EMO-RTM-006` |
| `CJ-RTM-007` | `EMO-RTM-007` |
| `CJ-RTM-008` | `EMO-RTM-008` |
| `CJ-RTM-009` | `EMO-RTM-009` |
| `CJ-RTM-010` | `EMO-RTM-010` |
| `CJ-RTM-011` | `EMO-RTM-011` |
| `CJ-RTM-012` | `EMO-RTM-012` |
| `CJ-RTM-013` | `EMO-RTM-013` |
| `CJ-RTM-014` | `EMO-RTM-014` |
| `CJ-RTM-015` | `EMO-RTM-015` |
| `CJ-RTM-016` | `EMO-RTM-016` |
| `CJ-RTM-017` | `EMO-RTM-017` |
| `CJ-RTM-018` | `EMO-RTM-018` |
| `CJ-RTM-019` | `EMO-RTM-019` |
| `CJ-RTM-020` | `EMO-RTM-020` |
| `CJ-RTM-021` | `EMO-RTM-021` |
| `CJ-RTM-022` | `EMO-RTM-022` |
| `CJ-RTM-023` | `EMO-RTM-023` |
| `CJ-RTM-024` | `EMO-RTM-024` |
| `CJ-SCENE-001` | `EMO-SCENE-001` |
| `CJ-SCENE-002` | `EMO-SCENE-002` |
| `CJ-SCENE-003` | `EMO-SCENE-003` |
| `CJ-SCENE-004` | `EMO-SCENE-004` |
| `CJ-SCENE-005` | `EMO-SCENE-005` |
| `CJ-SCENE-006` | `EMO-SCENE-006` |
| `CJ-SCENE-007` | `EMO-SCENE-007` |
| `CJ-SCHEMA-001` | `EMO-SCHEMA-001` |
| `CJ-SCHEMA-002` | `EMO-SCHEMA-002` |
| `CJ-SCHEMA-003` | `EMO-SCHEMA-003` |
| `CJ-SCHEMA-004` | `EMO-SCHEMA-004` |
| `CJ-SCHEMA-005` | `EMO-SCHEMA-005` |
| `CJ-SCHEMA-006` | `EMO-SCHEMA-006` |
| `CJ-SCHEMA-007` | `EMO-SCHEMA-007` |
| `CJ-SCHEMA-GAP-001` | `EMO-SCHEMA-GAP-001` |
| `CJ-SCHEMA-GAP-002` | `EMO-SCHEMA-GAP-002` |
| `CJ-SCHEMA-GAP-003` | `EMO-SCHEMA-GAP-003` |
| `CJ-SCHEMA-GAP-004` | `EMO-SCHEMA-GAP-004` |
| `CJ-SCHEMA-GAP-005` | `EMO-SCHEMA-GAP-005` |
| `CJ-SCHEMA-T-001` | `EMO-SCHEMA-T-001` |
| `CJ-SCHEMA-T-002` | `EMO-SCHEMA-T-002` |
| `CJ-SCHEMA-T-003` | `EMO-SCHEMA-T-003` |
| `CJ-SCHEMA-T-004` | `EMO-SCHEMA-T-004` |
| `CJ-SCHEMA-T-005` | `EMO-SCHEMA-T-005` |
| `CJ-SCHEMA-T-006` | `EMO-SCHEMA-T-006` |
| `CJ-SCHEMA-T-007` | `EMO-SCHEMA-T-007` |
| `CJ-SCHEMA-T-008` | `EMO-SCHEMA-T-008` |
| `CJ-SEC-001` | `EMO-SEC-001` |
| `CJ-SEC-002` | `EMO-SEC-002` |
| `CJ-SEC-003` | `EMO-SEC-003` |
| `CJ-SEC-004` | `EMO-SEC-004` |
| `CJ-SEC-005` | `EMO-SEC-005` |
| `CJ-SEC-006` | `EMO-SEC-006` |
| `CJ-SEC-007` | `EMO-SEC-007` |
| `CJ-SEC-008` | `EMO-SEC-008` |
| `CJ-SEC-009` | `EMO-SEC-009` |
| `CJ-SEC-010` | `EMO-SEC-010` |
| `CJ-SEC-011` | `EMO-SEC-011` |
| `CJ-SEC-012` | `EMO-SEC-012` |
| `CJ-SEC-013` | `EMO-SEC-013` |
| `CJ-SEC-014` | `EMO-SEC-014` |
| `CJ-SEC-GAP-001` | `EMO-SEC-GAP-001` |
| `CJ-SEC-GAP-002` | `EMO-SEC-GAP-002` |
| `CJ-SEC-GAP-003` | `EMO-SEC-GAP-003` |
| `CJ-SEC-GAP-004` | `EMO-SEC-GAP-004` |
| `CJ-SEC-GAP-005` | `EMO-SEC-GAP-005` |
| `CJ-SLI-001` | `EMO-SLI-001` |
| `CJ-SLI-002` | `EMO-SLI-002` |
| `CJ-SLI-003` | `EMO-SLI-003` |
| `CJ-SLI-004` | `EMO-SLI-004` |
| `CJ-SLI-005` | `EMO-SLI-005` |
| `CJ-SLI-006` | `EMO-SLI-006` |
| `CJ-SLI-007` | `EMO-SLI-007` |
| `CJ-SLI-008` | `EMO-SLI-008` |
| `CJ-SLI-009` | `EMO-SLI-009` |
| `CJ-SLI-010` | `EMO-SLI-010` |
| `CJ-STATE-GAP-001` | `EMO-STATE-GAP-001` |
| `CJ-STATE-GAP-002` | `EMO-STATE-GAP-002` |
| `CJ-STATE-GAP-003` | `EMO-STATE-GAP-003` |
| `CJ-STATE-GAP-004` | `EMO-STATE-GAP-004` |
| `CJ-TB-001` | `EMO-TB-001` |
| `CJ-TB-002` | `EMO-TB-002` |
| `CJ-TB-003` | `EMO-TB-003` |
| `CJ-TB-004` | `EMO-TB-004` |
| `CJ-TB-005` | `EMO-TB-005` |
| `CJ-TB-006` | `EMO-TB-006` |
| `CJ-TB-007` | `EMO-TB-007` |
| `CJ-TB-008` | `EMO-TB-008` |
| `CJ-TB-009` | `EMO-TB-009` |
