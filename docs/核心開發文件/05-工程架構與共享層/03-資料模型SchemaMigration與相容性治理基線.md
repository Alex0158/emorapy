# 資料模型 Schema Migration 與相容性治理基線

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：正式規格
**覆蓋範圍**：資料模型、Prisma schema、migration history、DB parity、向後/向前相容、棄用、backfill、release gate 與 Web / App / API / shared contract 協同治理
**取證代碼入口**：`backend/prisma/schema.prisma`、`backend/prisma/migrations`、`backend/prisma/migrations/migration_lock.toml`、`backend/scripts/check-release-db-parity.ts`、`backend/tests/unit/scripts/check-release-db-parity.test.ts`、`backend/src/config/database.ts`、`scripts/ops-db-status.sh`、`scripts/ops-release-gate.sh`、`backend/package.json`、`packages/contracts/src`、`packages/api-client/src`、`frontend/src/router/index.tsx`、`frontend-admin/src/router.tsx`、`mobile/app`、`mobile/src/platform`
**最後核驗 Commit**：`1c1d7e1`
**最後核驗日期**：`2026-07-13`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 定位

本文把 Emorapy 的資料模型、schema migration、版本相容與棄用治理提升為正式架構基線。頂級工程級 PRD / SRS 不會只寫「新增欄位」或「已生成 migration」，還會說明資料字典、相容期、backfill、讀寫雙路徑、發布順序、rollback / roll-forward 與舊 client 影響。

本文不宣稱 Emorapy 已具備完整 data dictionary、零停機 migration 能力或自動相容性檢查。當前倉庫已有 Prisma schema、migration history、release DB parity gate、部分 additive schema、deprecated 欄位註記與 release-blocking migration 清單；但缺少集中規則裁決「哪些 schema 變更可直接發、哪些必須 expand/contract、哪些不得在同一版本刪除」。

## 2. 外部基線參考

| 基線 | 採用原因 | Emorapy 採用方式 |
| --- | --- | --- |
| ISO/IEC 11179 Metadata Registries | 提供資料元素、名稱、定義與 metadata registry 的治理框架 | 用於要求核心資料欄位有語義、owner、敏感度、相容性與狀態，不把 Prisma 欄位名直接等同資料字典 |
| Prisma Migrate migration histories | Prisma 官方把 migrations folder 與 `_prisma_migrations` 作 migration history 與部署檢查基礎 | 用於校準 `backend/prisma/migrations`、`migration_lock.toml`、`_prisma_migrations` 與 release DB parity 的證據口徑 |
| Prisma expand-and-contract migrations | 官方資料遷移指南以 expand / contract 降低 production schema 變更風險 | 用於要求 rename、type change、required field、enum contraction、table split 等變更分階段進行 |
| PostgreSQL Data Definition | Emorapy 目標 DB 為 PostgreSQL；DDL、constraint、index、enum、foreign key 對 runtime 有直接影響 | 用於校準 DB-level constraint、index、FK、enum 與 raw SQL migration 的風險，不只看 Prisma schema |
| Google AIP-180 / AIP-181 / AIP-185 | API compatibility、stability level 與 versioning 的工程治理參考 | 用於把 DB/API/shared contract 視為跨端契約：舊 client、舊資料、舊 response shape 不得被 minor 變更破壞 |
| Semantic Versioning 2.0.0 | 用版本號表達 public API 相容性與 breaking change | 用於校準 `packages/contracts`、`packages/api-client`、Web/Admin/App 消費面與 release change impact，不用 patch/minor 掩蓋 breaking schema contract |

外部來源：

1. [ISO/IEC 11179-1:2023](https://www.iso.org/standard/78914.html)
2. [Prisma Migrate: migration histories](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories)
3. [Prisma expand-and-contract migrations](https://docs.prisma.io/docs/guides/database/data-migration)
4. [PostgreSQL Data Definition](https://www.postgresql.org/docs/current/ddl.html)
5. [Google AIP-180 Backwards compatibility](https://google.aip.dev/180)
6. [Google AIP-181 Stability levels](https://google.aip.dev/181)
7. [Google AIP-185 API Versioning](https://google.aip.dev/185)
8. [Semantic Versioning 2.0.0](https://semver.org/)

## 3. 當前現況矩陣

| 面向 | 現有證據 | 狀態 |
| --- | --- | --- |
| Prisma schema | `backend/prisma/schema.prisma` 有 enum、model、index、deprecated 註記與高敏模型 | 已有事實來源；缺資料字典級 owner / sensitivity / compatibility 屬性 |
| Migration history | `backend/prisma/migrations/*/migration.sql` 與 `migration_lock.toml` 已存在；expand-only `20260712210000_add_chat_context_domain_foundation` 建立 Chat channel/context/analysis models，但刻意不在 migration 內 backfill legacy messages | migration source 已納入 release-blocking catalog；2026-07-13 首次 Production deploy attempt 已套用兩個 chat-context migrations，但 runtime 未切流；正式發布仍必須由 workflow 重驗 parity 並保存 artifact |
| Release DB parity | `backend/scripts/check-release-db-parity.ts` 查 `_prisma_migrations`，`scripts/ops-release-gate.sh` 要求 `DATABASE_URL` 並跑 `ops:release-db:check` | 已有 release-blocking gate；清單需持續同步 |
| Runtime auto migration | `backend/src/config/database.ts` dev 默認 `db push`，production 只有 `RUN_MIGRATIONS=true` 才 `migrate deploy` | 有保護；但 dev `db push` 不等於 migration history 完整 |
| Backfill / compatibility | `20260504193000_add_case_source_tracking` 註明 runtime classifier 作 compatibility source；部分服務有 fallback | 局部覆蓋；未集中定義 expand / backfill / contract gate |
| Deprecated fields | `UserProfile` 多個欄位有 `@deprecated` 註記，仍保留以維持向後相容 | 局部覆蓋；缺棄用窗口、讀寫策略與移除條件 |
| Cross-client impact | `packages/contracts`、`packages/api-client`、Web/Admin、App parity 文件承接部分影響 | 部分覆蓋；缺 DB/API/shared contract 的相容性矩陣 |

## 4. 變更分類

| 分類 | 例子 | 治理要求 |
| --- | --- | --- |
| Additive Safe | 新 nullable 欄位、新表、新非唯一 index、新 response optional field | 可先 schema，再 runtime；仍需 migration、RTM、release parity |
| Additive With Backfill | 新欄位需從舊資料推導，如 product flow、source channel、version group | 必須有 backfill / fallback / reconciliation strategy；不得只靠新寫入 |
| Contract-Sensitive | 新 enum value、response resource field、shared contract DTO 改動 | 必須檢查舊 Web/Admin/App/API client 對未知值、缺欄位與 fallback 的處理 |
| Breaking / Destructive | rename / drop 欄位、改 required、改 type、收窄 enum、改 unique/FK、收緊 string length | 必須 expand/contract、ADR、release sequence、rollback / roll-forward plan；不得單版本直接改 |
| Operational Risk | 大表 index、trigger、constraint、NOT NULL、data rewrite、long lock | 必須有 precheck、migration runtime 風險、lock / timeout / rollback 計畫與 release window |
| Privacy / Safety Sensitive | 新心理推斷、安全風險、AI ledger、evidence、notification payload 欄位 | 必須同步資料治理、隱私、威脅建模與 retention 口徑 |

## 5. 最小治理要求

| 要求 ID | 要求 | 現有證據 | 狀態 |
| --- | --- | --- | --- |
| EMO-SCHEMA-001 | Prisma schema、migration history 與 release DB parity 必須分開陳述；migration 檔案存在不等於 DB 已套用 | `backend/prisma/migrations`、`ops:db:status`、`ops:release-db:check` | 部分覆蓋 |
| EMO-SCHEMA-002 | 所有 P0 schema 變更必須有 migration name、影響模型、資料敏感度、相容性分類、release gate 與回滾/前滾口徑 | release-blocking migrations、待辦台賬 | 部分覆蓋 |
| EMO-SCHEMA-003 | rename、drop、type change、required field、enum contraction、unique/FK 收緊不得單步發布，必須 expand / backfill / dual-read / contract | 部分 additive migration、case source fallback | 待建立基線 |
| EMO-SCHEMA-004 | 新 enum value、shared DTO、API response field、DB persisted state 必須檢查舊 client、App template、Admin report 與 typed package 消費面 | `packages/contracts`、`packages/api-client`、Parity 文件 | 部分覆蓋 |
| EMO-SCHEMA-005 | 棄用欄位必須有 deprecated reason、替代來源、讀寫策略、保留窗口與移除條件 | `UserProfile` deprecated 註記 | 部分覆蓋 |
| EMO-SCHEMA-006 | release gate 的 required migration 清單必須與活躍 P0 待辦一致；新增 release-blocking migration 時需更新腳本、測試、NFR、RTM 與待辦 | `check-release-db-parity.ts`、unit test | 部分覆蓋 |
| EMO-SCHEMA-007 | production hotfix / manual DB patch 必須回補 migration history 或有 `migrate resolve` / reconciliation 記錄，不得讓 schema drift 成為常態 | Prisma migration history、ops runbook | 待建立 |

## 6. 當前缺口

| 缺口 ID | 對標基線 | 現狀 | 風險 | 處置 |
| --- | --- | --- | --- | --- |
| EMO-SCHEMA-GAP-001 | ISO 11179 / 29148 | 沒有集中 data dictionary：model / field 的 owner、敏感度、來源、相容性狀態分散在 schema、資料治理和接口文檔 | 高敏資料、App telemetry、AI ledger 或 Admin report 欄位可能只按技術欄位處理 | 本文建立最低屬性，後續可生成資料字典 |
| EMO-SCHEMA-GAP-002 | Prisma migration histories | `backend/prisma/migrations` 與 release DB parity 已有，但 release-blocking 清單人工維護 | 新 P0 migration 可能沒有進 release gate | 將清單更新納入 NFR / RTM / governance gate |
| EMO-SCHEMA-GAP-003 | Prisma expand / contract | 部分 additive schema 有 fallback，但沒有正式 expand/contract stage | rename、drop 或 NOT NULL 變更可能破壞舊 runtime 或舊 client | 新增驗收基線與不得宣稱事項 |
| EMO-SCHEMA-GAP-004 | AIP-180 / SemVer | DB schema、API response、shared contracts 的相容性未集中評估 | Web/Admin/App/API client 可能在 minor/patch 變更中被破壞 | 要求 compatibility matrix 與版本語義 |
| EMO-SCHEMA-GAP-005 | PostgreSQL DDL | raw SQL index / trigger / constraint 已存在，但缺 lock、data rewrite、precheck、rollback / roll-forward 分級 | release migration 可能阻塞、失敗或造成資料不一致 | 將 operational risk 接入 release gate 與 migration drill |

## 6.1 App Push Token Schema 基線

| Migration | 分類 | 影響模型 | 相容性與 gate |
| --- | --- | --- | --- |
| `20260508093000_add_push_device_tokens` | Additive Safe + Privacy / Safety Sensitive | 新增 `PushPlatform` enum、`PushDeviceToken` model、`push_device_tokens` table；`User` 增加 `push_device_tokens` relation | 不改既有 Web/Admin response；App token registration/revoke 經 `POST /api/v1/notifications/device-tokens*`；token 原文不可回傳或寫入 log；已加入 `RELEASE_BLOCKING_MIGRATIONS`，production release 必須確認目標 DB 已套用 |
| `20260508113000_add_push_receipt_tracking` | Additive Safe + Operational / Privacy Sensitive | `Notification` 新增 `push_provider`、`push_ticket_id`、`push_ticket_status`、`push_receipt_status`、`push_receipt_checked_at`、`push_receipt_error` 與查詢 index | 不改既有 Web/Admin response；只記錄 provider ticket / receipt 狀態，不保存 raw push token；支援 `dispatch_pending_push_notifications` / `poll_push_notification_receipts` job 回寫；已加入 `RELEASE_BLOCKING_MIGRATIONS`，production release 必須確認目標 DB 已套用 |

## 6.2 App Telemetry Schema 基線

| Migration | 分類 | 影響模型 | 相容性與 gate |
| --- | --- | --- | --- |
| `20260508124000_add_app_telemetry_events` | Additive Safe + Privacy / Ops Sensitive | 新增 `AppTelemetryEvent` model、`app_telemetry_events` table；`User` 增加 `app_telemetry_events` relation；保存 event name / severity / route / request id / app version / platform / build number / redacted scalar context / optional `user_id` / HMAC `session_hash` / `created_at` | 不改既有 Web/Admin response；App ingest failure 不阻塞主流程；Admin report 不返回 raw context、user_id、session_hash；`cleanup_app_telemetry` 30d 清理；已加入 `RELEASE_BLOCKING_MIGRATIONS`，production release 必須確認目標 DB 已套用 |

## 6.3 AI Stream Persistence Schema 基線

| Migration | 分類 | 影響模型 | 相容性與 gate |
| --- | --- | --- | --- |
| `20260508133000_add_ai_stream_persistence` | Additive Safe + Operational / Privacy Sensitive | 新增 `AIStreamPersistenceStatus` enum、`ai_stream_sessions`、`ai_stream_events`、`ai_stream_session_archives`、`ai_stream_event_archives` tables 與 scope / seq / status indexes；支撐 `case_judgment`、`chat_room_draft`、`repair_track` 等 App stream replay / persisted fallback | 不改既有 Web/Admin response；事件與 session 只保存 stream replay 所需 metadata / redacted error；已加入 `RELEASE_BLOCKING_MIGRATIONS`，production release 必須確認目標 DB 已套用，且 Redis-backed replay / cleanup parity 需另有 runtime 證據 |

## 6.4 Interview Facts Schema 基線

| Migration | 分類 | 影響模型 | 相容性與 gate |
| --- | --- | --- | --- |
| `20260508143000_add_interview_collected_facts` | Additive Safe + Privacy Sensitive | `interview_sessions` 新增 `collected_facts TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`；支撐 M2 Profile / Interview 背景回覆把已收集 facts 合併到 session | 不改既有 Web/Admin response；空陣列 default 維持舊 session 可讀；已加入 `RELEASE_BLOCKING_MIGRATIONS`，production release 必須確認目標 DB 已套用 |
| `20260508143500_add_interview_turn_extracted_facts` | Additive Safe + Privacy Sensitive | `interview_turns` 新增 `extracted_facts TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`；支撐 M2 Profile / Interview 每輪 AI response 保存新萃取 facts | 不改既有 Web/Admin response；空陣列 default 維持舊 turn 可讀；已加入 `RELEASE_BLOCKING_MIGRATIONS`，production release 必須確認目標 DB 已套用 |

## 6.5 Notification Action Metadata Schema 基線

| Migration | 分類 | 影響模型 | 相容性與 gate |
| --- | --- | --- | --- |
| `20260508150000_add_notification_action_metadata` | Additive Safe + Operational / App Contract Sensitive | `notifications` 新增 `action_key`、`priority`、`group_key`、`read_at`、`dismissed_at`、`acted_at`、`snoozed_until` 與 user/state 查詢 index；補齊 M5 notification read / snooze / dismiss / act runtime 依賴 | 不改既有 Web/Admin response；舊 notification row 欄位可為 null，service 保持 fallback；已加入 `RELEASE_BLOCKING_MIGRATIONS`，production release 必須確認目標 DB 已套用 |

## 6.6 Chat Context Isolation Schema 基線

| Migration | 分類 | 影響模型 | 相容性與 gate |
| --- | --- | --- | --- |
| `20260712210000_add_chat_context_domain_foundation` | Additive With Backfill + Contract / Privacy / Safety Sensitive | 新增 `ChatChannel`、participant private-context preference、nullable `ChatMessage.channel_id`、deny-by-default `ChatMessage.ai_context_eligible`、Context Capsule/Authorization、Analysis Request/Participant Approval、Context Use Audit 及 exact hash/policy FK/unique constraints；DB partial unique index 保證每 room 只有一個 active Analysis request；新 room history default 收窄為 `share_from_join_time` | migration 不重新詮釋 legacy rows，`channel_id` 在 expand 期保持 nullable，legacy eligibility 預設 false。`backfill-chat-context-channels.ts` 預設 dry-run；只有分類為 shared 的 legacy human `user_text` 可明確標記 reusable，legacy private / summary / AI / system 全部 display-only；legacy `summary_only` 保持 private + review-required，不自動建 capsule；`audit-private-context-legacy-data.ts` 只讀並核對 eligibility 分組。2026-07-13 Production migration 已成功，首次 apply 已建立 11 shared + 18 private channel，但 message bulk assignment 因 interactive transaction timeout 未提交；hotfix 採 bounded parameterized bulk write 從 partial state roll-forward，不 down-migrate。完成 50 row assignment、idempotency、orphan/audit 與正式 release artifact 前，只能說 schema 已擴充，不能說整體 Production 已發布 |
| `20260713090000_add_context_authorization_active_unique` | Constraint Hardening + Privacy Sensitive + Operational Risk | `ContextAuthorization` 以 capsule、subject、purpose、audience、target type、target ID 作 unrevoked exact grant identity；partial unique index 補上跨 process idempotency。既有 `roleA` / `roleB` / `aiMediator` active singleton 已由 2026-02 partial unique migrations保護，不重複建 index | migration 先 aggregate preflight；任何 duplicate exact grant 直接失敗且不更新／刪除資料。index build 設 5 秒 lock timeout、60 秒 statement timeout並有 catalog postcondition；runtime P2002 只可回讀同一 exact、未撤銷、未過期 grant。2026-07-13 Production migration 已成功；正式 workflow 仍須重驗 migration status、legacy duplicate audit、fresh release parity 與 runtime readiness，不能把 failed deployment 的 migration log單獨寫成發布閉環 |

## 7. 維護規則

1. 新增或修改 `backend/prisma/schema.prisma`、`backend/prisma/migrations/*`、`packages/contracts`、`packages/api-client` 中持久化或跨端欄位時，必須判定 additive、contract-sensitive、breaking 或 operational risk。
2. P0 / safety / privacy / AI ledger / notification / product state recovery / source tracking 類 migration 必須同步 `backend/scripts/check-release-db-parity.ts`、對應測試與待辦；否則不得標記 release gate 完整。
3. 開發環境 `db push` 成功不得替代 migration history；發布與 production-like 環境以 `prisma migrate deploy`、`prisma migrate status`、`_prisma_migrations` 或平台紀錄為準。
4. 任何破壞性 schema 變更都必須先有 expand 階段和 compatibility runtime，再進 backfill，最後 contract；不得把同一 PR 的 drop / rename 寫成已安全。
5. schema hotfix、手動 DB patch 或平台直接修改必須回補 migration history 與 evidence；不得讓 DB drift 只停留在口頭說明。
6. 若 schema 變更會影響 App screen、Deep Link、Push、upload、offline storage 或 native cache，必須同步 `20-App端/`、`50-跨端Mapping與Parity/` 與 App 測試基線。
