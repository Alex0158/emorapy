# 正式配對唯一性 DB Constraint 同步待辦（2026-05-04）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：normal pairing pending/active participant uniqueness、dev/release DB parity、並發配對資料保護
**取證代碼入口**：`backend/prisma/migrations/20260504182000_add_normal_pairing_uniqueness_trigger/migration.sql`、`backend/scripts/precheck-pairing-normal-uniqueness.ts`、`backend/tests/unit/scripts/precheck-pairing-normal-uniqueness.test.ts`、`backend/src/utils/pairing-invariant.ts`、`backend/src/services/pairing.service.ts`、`backend/package.json`
**最後核驗 Commit**：`8d1526b`
**最後核驗日期**：`2026-05-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理；DB trigger migration 已生成並套用 Supabase Dev DB，且 2026-05-12 current release DB parity evidence 已確認本 migration 被 release-blocking 清單覆蓋；剩餘 App M5/M6 release-production DB parity blocker 改由 `App跨端Parity落地待辦-2026-05-05.md` 統一追蹤
**優先級**：P0，涉及正式配對唯一性、並發寫入與 dev/release DB schema parity
**責任範圍**：Backend / Database / Release Ops

## 背景

服務層已透過 `buildActiveNormalPairingWhere()` 與 `precheck:pairing:normal-uniqueness` 固定「一個 user 同時最多一個 normal pending/active pairing」口徑，但只靠 service 仍無法覆蓋：

1. 並發寫入 race condition。
2. 手動 SQL / ops script 繞過 service。
3. 同一 user 跨 `user1_id` / `user2_id` 出現在不同 pairing 的 cross-role duplicate。

## 已落地

1. 新增 migration：

```text
backend/prisma/migrations/20260504182000_add_normal_pairing_uniqueness_trigger/migration.sql
```

2. Migration 新增 `enforce_normal_pairing_unique_participants()` trigger：
   - 僅作用於 `pairing_type='normal' AND status IN ('pending','active')`。
   - 使用 `pg_advisory_xact_lock(20260504, hashtext(participant_id))` 對參與者做 transaction-level serialization。
   - 檢查同一 participant 是否已存在於任何其他 normal pending/active pairing 的 `user1_id` 或 `user2_id`。
   - 拒絕 normal pending/active pairing 無 participant。
   - 拒絕 `user1_id = user2_id` 的自配對。
3. `precheck-pairing-normal-uniqueness` 單元測試已補 cross-role duplicate regression。

## 必須同步的兩邊

1. Supabase Dev DB：`2026-05-04` 已執行 `cd backend && npx prisma migrate deploy --schema prisma/schema.prisma`，並套用 `20260504182000_add_normal_pairing_uniqueness_trigger`；`npm run ops:db:status` 回報 `Database schema is up to date!`。
2. Release / Production DB：尚未確認套用 `20260504182000_add_normal_pairing_uniqueness_trigger`。發布 backend 前必須用 release `DATABASE_URL` 執行 migration status 或 release gate，不得沿用 Dev DB 結論。
3. 2026-05-12 Web/Admin scope recheck：`npm --prefix backend run ops:release-db:dry-run` 已確認 release target gate 目前檢查 14 個 release-blocking migrations，包含 `20260504182000_add_normal_pairing_uniqueness_trigger`；當前 release evidence `App-Release-DB-Parity-2026-05-12T13-56-02-878Z.json` 回報 `appliedRequiredMigrationCount=7/14`，缺的是 App M5/M6 migrations，代表本文件所屬舊 7 個 Web/Admin schema migration 已被 current release DB parity 清單覆蓋。它仍受 App M5/M6 release blocker 牽制，但本身不是再獨立阻塞於 release DB 的錯誤狀態。

## 驗證命令

```bash
cd backend && npm run precheck:pairing:normal-uniqueness
cd backend && npm test -- --runInBand tests/unit/scripts/precheck-pairing-normal-uniqueness.test.ts
cd backend && npx prisma migrate deploy --schema prisma/schema.prisma
npm run ops:db:status
cd backend && npm run build
cd backend && npm run lint
npm run docs:check
```

## Release 注意事項

- Release DB 套用前，仍只能把正式配對唯一性視為 service-level guard + precheck，不能聲稱 DB-level parity 已完成。
- 若 release precheck 發現衝突，必須先人工處理重複 pairing，再套用 trigger migration。
- 此 trigger 不影響 quick/temp pairing；quick temp scope 仍由 `buildSessionBoundQuickPairingWhere()` 與相關清理 invariant 控制。
- 2026-05-12 裁決：本文件不再作為獨立 Web/Admin release DB blocker 保留於待處理。當前 release DB parity gate 已把 `20260504182000_add_normal_pairing_uniqueness_trigger` 納入 14 個 release-blocking migrations；最新 evidence 的失敗點是 App M5/M6 migrations，非本 migration 本身。後續 release-production DB parity 統一由 App M6 release sign-off 追蹤。
