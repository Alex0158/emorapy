# Schema Migration 與相容性驗收基線

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：測試規範
**覆蓋範圍**：Prisma migration、DB parity、backfill、expand / contract、schema drift、release gate、API / shared contract 相容性與 App parity 驗收證據
**取證代碼入口**：`backend/prisma/schema.prisma`、`backend/prisma/migrations`、`backend/scripts/check-release-db-parity.ts`、`backend/tests/unit/scripts/check-release-db-parity.test.ts`、`backend/src/config/database.ts`、`scripts/ops-db-status.sh`、`scripts/ops-release-gate.sh`、`backend/tests`、`packages/contracts/src`、`packages/api-client/src`、`frontend/src/**/*.test.tsx`、`frontend-admin/src`、`mobile/app`、`mobile/src/platform`
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-07`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 定位

本文定義 CJ schema migration、DB parity、相容性與棄用的驗收口徑。它不替代 `05-工程架構與共享層/03-資料模型SchemaMigration與相容性治理基線.md`，而是把架構治理要求落到測試、precheck、release gate、manual evidence 與不得宣稱事項。

當前現碼已有 Prisma migrations、`ops:db:status`、`ops:release-db:check`、release gate、release-blocking migration unit tests、部分 additive schema 與 fallback；App 相關 release-blocking migration 已覆蓋 Push device token、Push receipt tracking、Notification action metadata、App telemetry events、AI stream persistence 與 M2 Interview facts schema，且 AI stream persistence 已在本機隔離 Postgres `prisma migrate deploy` + M1 true-service judgment smoke 中驗證可寫入 `ai_stream_sessions` / `ai_stream_events`，Interview facts schema 已在 M2 `--deep` true-service smoke 中驗證 background response 可落庫，Notification action metadata 已在 M5 true-service smoke 中驗證 read / snooze / dismiss / act state sync。2026-05-08 已補 release-blocking 清單檔案覆蓋單測，且本機隔離 Postgres 上 `prisma migrate status` 顯示 25 migrations up to date、`ops:release-db:check` 回報 14/14 required migrations applied。仍沒有完整資料字典、schema diff 分級、expand / contract 自動檢查、backfill completeness 證據或 release / production DB parity 證據。

## 2. 驗收分層

| 驗收層 | 適用範圍 | 最小證據 |
| --- | --- | --- |
| Migration History | `backend/prisma/migrations`、`migration_lock.toml` | migration folder source control、`prisma migrate status`、不得修改已套用 migration |
| Release DB Parity | release / production-like DB | `_prisma_migrations` 查詢、`ops:release-db:check` JSON、release gate evidence |
| Schema Compatibility | API response、shared contract、enum、persisted state | compatibility matrix、old client fallback、unknown enum handling、DTO optionality tests |
| Backfill / Dual Read | 新欄位從舊資料推導、source tracking、version group | backfill script / query / service fallback、before/after counts、idempotency |
| Operational Risk | index、trigger、constraint、NOT NULL、FK、large table rewrite | precheck、lock / timeout assessment、rollback / roll-forward plan |
| Deprecation | deprecated field、old API field、legacy enum / route | deprecated reason、replacement、read/write strategy、removal condition |
| App Parity | App screen、native storage、Push、Deep Link、offline cache、App telemetry schema | App adapter smoke、backend/schema task、Parity entry、release DB parity entry；Web evidence 不可替代 |

## 3. 最小驗收矩陣

| 驗收 ID | 對應需求 | 驗收方法 | 當前狀態 |
| --- | --- | --- | --- |
| CJ-SCHEMA-T-001 | CJ-SCHEMA-001 | `prisma migrate status`、migration folder source control、`_prisma_migrations` release check | 部分覆蓋 |
| CJ-SCHEMA-T-002 | CJ-SCHEMA-002 | 每個 P0 migration 有 migration name、model/field、敏感度、相容性分類、release gate、待辦或證據 | 部分覆蓋 |
| CJ-SCHEMA-T-003 | CJ-SCHEMA-003 | breaking schema diff 必須有 expand / backfill / dual-write or dual-read / contract 四階段證據 | 待建立 |
| CJ-SCHEMA-T-004 | CJ-SCHEMA-004 | 新 enum / DTO / response field 以舊 Web/Admin/API client 與 App parity inspection 驗證 | 部分覆蓋 |
| CJ-SCHEMA-T-005 | CJ-SCHEMA-005 | deprecated field 有替代來源、讀寫策略、保留窗口與移除條件 | 待建立 |
| CJ-SCHEMA-T-006 | CJ-SCHEMA-006 | release-blocking migration 清單與 unit tests、待辦台賬、release gate 一致 | 部分覆蓋；unit test 已覆蓋清單引用的 migration 目錄存在、App release-sensitive migrations 均進清單、missing / failed / rolled back 會阻塞，且 release evidence writer 只輸出 target / provider / local classification / migration report，不輸出 `DATABASE_URL` 或 host |
| CJ-SCHEMA-T-007 | CJ-SCHEMA-007 | production hotfix / manual DB patch 有 migration history reconciliation 或 drift resolution record | 待建立 |
| CJ-SCHEMA-T-008 | CJ-SCHEMA-002 / CJ-SCHEMA-006 | App stream / telemetry / push / notification action / interview facts schema migration 必須在 local migration status、release-blocking 清單、App smoke 與 Parity 文件中同時可追溯 | 部分覆蓋；App release-sensitive migrations 已加入 release-blocking 清單並有檔案覆蓋單測，local Postgres `prisma migrate status` 已顯示 25 migrations up to date，`ops:release-db:check` 已在 local DB 回報 14/14 required migrations applied，M1/M2/M4/M5 smoke 已觀察到對應 runtime 寫入；release / production DB parity 需由 `npm --prefix backend run ops:release-db:evidence` 對 non-local release / production DB 產出 `App-Release-DB-Parity-*.json`，raw console output、local DB evidence 或手寫 markdown 不可替代；Redis-backed replay runtime evidence 待補 |

## 4. 發布驗收規則

| 變更類型 | 發布前最低 gate |
| --- | --- |
| 無 schema 變更 | release 記錄明確標「本次無 migration」 |
| Additive Safe | migration committed、local/dev status pass、release DB status / parity pass、API / UI smoke |
| Additive With Backfill | additive gate + backfill idempotency + old data read fallback + count evidence |
| Contract-Sensitive | additive/backfill gate + old client / unknown enum / optional field inspection + shared package build |
| Breaking / Destructive | expand release、runtime compatibility release、backfill evidence、contract release 分批；單次 PR 不得宣稱完成 |
| Operational Risk | additive/breaking gate + precheck + lock / timeout assessment + rollback or roll-forward command |
| Privacy / Safety Sensitive | schema gate + data governance / threat model / retention / evidence minimization review |

## 5. 不得宣稱

1. `schema.prisma` 已更新不代表 migration 已建立。
2. migration 檔案已 commit 不代表 dev / release / production DB 已套用。
3. Dev DB `migrate deploy` 成功不代表 release DB parity 完成。
4. Local DB `ops:release-db:check` 成功不代表 release / production DB parity 完成；App release sign-off 只接受 structured non-local `App-Release-DB-Parity-*.json`。
5. `db push` 成功不代表 migration history 完整，也不代表 production-safe。
6. additive 欄位存在不代表舊資料已 backfill 或舊 client 已相容。
7. deprecated 註記存在不代表可刪除；刪除需有棄用窗口、讀寫停止、資料遷移與 release evidence。
8. release gate 通過只代表該 gate 定義的 migration parity，不代表完整資料字典、完整 rollback 或零停機能力。

## 6. 維護規則

1. 新增 migration 時，必須同步本文、RTM 與對應待辦；若屬 release-blocking，還要同步 `backend/scripts/check-release-db-parity.ts` 與 unit test。
2. 新增或修改 enum、shared contract、API response shape 時，必須加入 compatibility inspection，不得只跑 backend unit tests。
3. 涉及 App storage、Push、Deep Link、upload 或 offline cache 的 schema 變更，必須同步 `20-App端/`、`50-跨端Mapping與Parity/` 與 App 測試缺口。
4. 若後續新增 schema diff checker、Prisma drift detector、backfill script、migration drill 或 compatibility test，必須回寫本文、NFR、RTM 與文檔治理規則。
