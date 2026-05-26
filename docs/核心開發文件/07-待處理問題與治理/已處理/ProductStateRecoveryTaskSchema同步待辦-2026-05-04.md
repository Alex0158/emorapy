# ProductStateRecoveryTask Schema 同步待辦（2026-05-04）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：product-state recovery task schema、dev/release DB parity、人工恢復任務持久化與 Admin 後端人工狀態 workflow
**取證代碼入口**：`backend/prisma/schema.prisma`、`backend/prisma/migrations/20260504173000_add_product_state_recovery_tasks/migration.sql`、`backend/scripts/audit-product-state-consistency.ts`、`backend/tests/unit/scripts/audit-product-state-consistency.test.ts`、`backend/src/services/product-state-recovery-task.service.ts`、`backend/src/controllers/admin.controller.ts`、`backend/src/routes/admin.routes.ts`、`backend/src/utils/validation.ts`、`backend/tests/unit/services/product-state-recovery-task.service.test.ts`、`backend/tests/unit/controllers/admin.controller.test.ts`、`backend/package.json`
**最後核驗 Commit**：`a2dea6b`
**最後核驗日期**：`2026-05-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理；`product_state_recovery_tasks` migration 已生成並套用 Supabase Dev DB，Admin 後端列表與人工狀態流轉已落地，且 2026-05-12 current release DB parity evidence 已確認本 migration 被 release-blocking 清單覆蓋；剩餘 App M5/M6 release-production DB parity blocker 改由 `App跨端Parity落地待辦-2026-05-05.md` 統一追蹤
**優先級**：P0，涉及 crash recovery 人工任務、dev/release DB schema parity 與 production data 寫入治理
**責任範圍**：Backend / Database / Admin / Release Ops

## 背景

`ops:product-state:audit` 已能只讀檢查以下卡住狀態，並輸出人工 `recoveryTasks` 候選：

1. case 長時間停在 `in_progress`。
2. chat room 長時間停在 `judgment_requested`。
3. `chat_to_case_links` 在 case completed 後缺 `judgment_id`。
4. repair track 長時間停在 `replanning`。

本輪新增第一層 DB-backed recovery task，不做自動修資料，只把候選任務在顯式 persist 模式下 upsert 到 `product_state_recovery_tasks`。後端已提供 Admin 查詢與狀態流轉接口，方便後續 Admin timeline / UI 承接。

## 已落地

1. 新增 enum：
   - `RecoveryTaskStatus`：`manual_review_required / in_review / resolved / dismissed`
   - `RecoveryTaskSeverity`：`warning / critical`
2. 新增表 `product_state_recovery_tasks`：
   - `source / source_task_id / proposal_id`
   - `status / severity`
   - `entity_type / entity_id / product_flow`
   - `linked_entity_ids / recommended_action / verification_commands / guardrails`
   - `automatic_fix_available=false / requires_human_approval=true`
   - `occurrence_count / first_detected_at / last_detected_at / resolved_at / dismissed_at`
3. 新增命令：

```bash
cd backend && npm run ops:product-state:audit:persist
```

此命令只在 audit 發現 `recoveryTasks` 時 upsert 任務；不會修改 case、chat、judgment、repair track 等業務資料。

4. 新增 Admin 後端 API：
   - `GET /api/v1/admin/product-state/recovery-tasks`：`ops:read`，可按 status / severity / entity / product_flow / source / proposal 查詢，返回列表與狀態/嚴重度摘要。
   - `PATCH /api/v1/admin/product-state/recovery-tasks/:taskId/status`：`ops:execute`，只允許標記 `manual_review_required / in_review / resolved / dismissed`，並寫入 `audit_logs(entity_type=product_state_recovery_task, action=update_status)`。
5. 狀態流轉只修改 `product_state_recovery_tasks.status / resolved_at / dismissed_at`；不修改 case、chat、judgment、repair track 等業務資料。

## 必須同步的兩邊

1. Supabase Dev DB：`2026-05-04` 已執行 `cd backend && npx prisma migrate deploy --schema prisma/schema.prisma`，`npm run ops:db:status` 回報 `Database schema is up to date!`。
2. Release / Production DB：尚未確認套用 `20260504173000_add_product_state_recovery_tasks`。發布 backend 前必須用 release `DATABASE_URL` 執行 migration status 或 release gate，不得沿用 Dev DB 結論。
3. 2026-05-12 Web/Admin scope recheck：`npm --prefix backend run ops:release-db:dry-run` 已確認 release target gate 目前檢查 14 個 release-blocking migrations，包含 `20260504173000_add_product_state_recovery_tasks`；當前 release evidence `App-Release-DB-Parity-2026-05-12T13-56-02-878Z.json` 回報 `appliedRequiredMigrationCount=7/14`，缺的是 App M5/M6 migrations，代表本文件所屬舊 7 個 Web/Admin schema migration 已被 current release DB parity 清單覆蓋。它仍受 App M5/M6 release blocker 牽制，但本身不是再獨立阻塞於 release DB 的錯誤狀態。

## 驗證命令

```bash
npm run ops:db:status
cd backend && npm test -- --runInBand tests/unit/scripts/audit-product-state-consistency.test.ts
cd backend && npm test -- --runInBand tests/unit/services/product-state-recovery-task.service.test.ts tests/unit/controllers/admin.controller.test.ts
cd backend && npm run ops:product-state:audit
cd backend && npm run ops:product-state:audit:persist
cd backend && npm run build
cd backend && npm run lint
npm run docs:check
```

## Release 注意事項

- Release DB 套用前，不得在發布版執行 `ops:product-state:audit:persist`。
- recovery task 是人工 review 任務，不是自動修復機制；任何 production data 寫入仍需獨立人工確認、審計與回滾方案。
- Admin 後端 API 已有 RBAC、validation、audit log 與單元測試；後續 Admin UI / timeline 呈現仍需補前端與端到端驗證。
- 2026-05-12 裁決：本文件不再作為獨立 Web/Admin release DB blocker 保留於待處理。當前 release DB parity gate 已把 `20260504173000_add_product_state_recovery_tasks` 納入 14 個 release-blocking migrations；最新 evidence 的失敗點是 App M5/M6 migrations，非本 migration 本身。後續 release-production DB parity 統一由 App M6 release sign-off 追蹤。
