# Case Source Tracking Schema 同步待辦（2026-05-04）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：case product flow source tracking、dev/release DB parity、產品流 analytics backfill
**取證代碼入口**：`backend/prisma/schema.prisma`、`backend/prisma/migrations/20260504193000_add_case_source_tracking/migration.sql`、`backend/src/utils/case-classifier.ts`、`backend/src/services/case.service.ts`、`backend/src/services/chat.service.ts`、`backend/src/services/judgment.service.ts`、`backend/tests/unit/utils/case-classifier.test.ts`、`backend/tests/unit/services/case.service.test.ts`、`backend/tests/unit/services/judgment.service.test.ts`、`packages/contracts/src/case.ts`
**最後核驗 Commit**：`659232c`
**最後核驗日期**：`2026-05-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理；case source tracking migration 已生成並套用 Supabase Dev DB，且 2026-05-12 current release DB parity evidence 已確認本 migration 被 release-blocking 清單覆蓋；剩餘 App M5/M6 release-production DB parity blocker 改由 `App跨端Parity落地待辦-2026-05-05.md` 統一追蹤
**優先級**：P0，涉及四主線產品流統計、建案來源審計與 dev/release DB schema parity
**責任範圍**：Backend / Database / Admin Analytics / Release Ops

## 背景

四主線收斂後，`Case.mode` 不能再單獨承載產品入口語義。特別是：

1. `collaborative + session_id 有值` 是快速雙人協作填寫。
2. `collaborative + session_id = null` 是正式雙方處理。
3. `chat-to-case` 需要由 `ChatToCaseLink` 優先識別，不能被 `mode=quick` 或 `mode=collaborative` 誤歸類。

Runtime 已有 `case-classifier` 作兼容分類，但 Admin analytics、成本歸因、漏斗報表與後續審計需要穩定落庫欄位，避免每個查詢重新推斷。

## 已落地

1. 新增 migration：

```text
backend/prisma/migrations/20260504193000_add_case_source_tracking/migration.sql
```

2. `cases` 新增 additive nullable 欄位：
   - `product_flow VARCHAR(50)`
   - `source_channel VARCHAR(50)`
   - `entry_point VARCHAR(50)`
3. 既有 `cases` 已按以下規則 backfill：
   - 存在 `chat_to_case_links`：`chat_to_case / chat_room / chat_request_judgment`
   - `mode=quick`：`quick_single / quick_experience / quick_single_case_create`
   - `mode=collaborative AND session_id IS NOT NULL`：`quick_collaborative / quick_experience / quick_collaborative_case_create`
   - `mode=collaborative AND session_id IS NULL`：`formal_collaborative / formal_case / formal_collaborative_case_create`
   - 其他：`formal_remote / formal_case / formal_remote_case_create`
4. 新增 indexes：
   - `idx_cases_product_flow_created`
   - `idx_cases_source_channel_created`
   - `idx_cases_entry_point_created`
5. `CaseService` 與 `ChatService` 建案時透過 `buildCaseSourceTracking()` 寫入欄位。
6. `getCaseProductFlow()` 仍保持 compatibility fallback：先看 `ChatToCaseLink`，其次看已落庫的 `product_flow`，最後才用 `mode/session_id` 推斷。
7. `GET /cases`、`GET /cases/:id` 與 `GET /cases/by-session` 已透過 `buildCaseSourceTrackingForRead()` additive 回傳 `product_flow / source_channel / entry_point`，並在 `packages/contracts/src/case.ts` 補齊型別。
8. `buildCaseProductFlowWhere()`、Admin overview/funnel、修復提醒與 stale draft cleanup 已改為優先使用 persisted `cases.product_flow`，同時保留 `mode/session_id/chat_to_case_links` fallback；非 chat flow 仍必須排除 `chat_to_case_links`，保持 chat link 優先。
9. `JudgmentService` 正式判決 emotion/draft/ratio/summary AI ledger 已改用 `buildCaseSourceTrackingForRead()`，寫入 `product_flow / source_channel / entry_point`；若 case 已被 chat-to-case link 關聯，ledger 同樣以 link 優先，不被舊 `cases.product_flow` 覆蓋。

## 必須同步的兩邊

1. Supabase Dev DB：`2026-05-04` 已執行 `cd backend && npx prisma migrate deploy --schema prisma/schema.prisma`，並套用 `20260504193000_add_case_source_tracking`；`npm run ops:db:status` 回報 18 個 Prisma migrations 且 `Database schema is up to date!`。
2. Release / Production DB：尚未確認套用 `20260504193000_add_case_source_tracking`。發布 backend 前必須用 release `DATABASE_URL` 執行 migration status 或 release gate，不得沿用 Dev DB 結論。
3. 2026-05-12 Web/Admin scope recheck：`npm --prefix backend run ops:release-db:dry-run` 已確認 release target gate 目前檢查 14 個 release-blocking migrations，包含 `20260504193000_add_case_source_tracking`；當前 release evidence `App-Release-DB-Parity-2026-05-12T13-56-02-878Z.json` 回報 `appliedRequiredMigrationCount=7/14`，缺的是 App M5/M6 migrations，代表本文件所屬舊 7 個 Web/Admin schema migration 已被 current release DB parity 清單覆蓋。它仍受 App M5/M6 release blocker 牽制，但本身不是再獨立阻塞於 release DB 的錯誤狀態。

## 驗證命令

```bash
cd backend && npm test -- --runInBand tests/unit/utils/case-classifier.test.ts tests/unit/services/case.service.test.ts tests/unit/services/chat.service.test.ts
cd backend && npm test -- --runInBand tests/unit/services/judgment.service.test.ts tests/unit/services/ai-request-ledger.service.test.ts tests/unit/services/ai.service.test.ts tests/unit/services/cost-monitoring.service.test.ts
cd backend && npx prisma migrate deploy --schema prisma/schema.prisma
npm run ops:db:status
cd backend && npm run build
cd backend && npm run lint
npm run docs:check
```

## Release 注意事項

- Release DB 套用前，仍只能把落庫 source tracking 視為 Dev DB 已完成，不能聲稱發布版 analytics 已完全閉環。
- Migration 是 additive nullable 欄位，runtime classifier 保留 fallback；但新 backend 若部署到舊 release schema，建案寫入會因未知欄位失敗，因此發布前必須先完成 release DB migration parity。
- Chat-to-case 仍以 `ChatToCaseLink` 作最高優先級；不得只讀 `cases.product_flow` 取代 link 關係校驗。
- 後續若要新增 `claim_status / retention_until` 等生命週期欄位，必須另開 schema 同步待辦。
- 2026-05-12 裁決：本文件不再作為獨立 Web/Admin release DB blocker 保留於待處理。當前 release DB parity gate 已把 `20260504193000_add_case_source_tracking` 納入 14 個 release-blocking migrations；最新 evidence 的失敗點是 App M5/M6 migrations，非本 migration 本身。後續 release-production DB parity 統一由 App M6 release sign-off 追蹤。
