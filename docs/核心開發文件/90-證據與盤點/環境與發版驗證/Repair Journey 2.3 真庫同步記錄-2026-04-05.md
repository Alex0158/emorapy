# Repair Journey 2.3 真庫同步記錄

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據文檔
**來源時間**：2026-04-05
**上下文**：環境配置、發版前後驗證與 smoke 證據
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`bd66c2d`
**最後核驗日期**：`2026-04-18`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v1.0
**最後更新**：2026-04-05
**對應發佈**：v1.3.4
**操作範圍**：`backend/.env` 當前指向 PostgreSQL 資料庫

---

## 目的

把 Repair Journey 2.3 涉及的真庫 schema 收口到與當前 `backend/prisma/schema.prisma` 一致，避免「代碼已落地、真庫還停在舊結構」。

## 本次實際發現

初始檢查時：
- `npm run ops:migration:report` 為 `status=ok`
- 但真庫仍缺：
  - `repair_tracks / repair_participant_states / repair_step_progresses / repair_checkins / repair_track_events`
  - `ai_stream_sessions / ai_stream_events / archives`
  - `notifications` 的 `read_at / dismissed_at / acted_at / action_key / priority / group_key / snoozed_until`
  - `reconciliation_plans.intent / version_group_id / superseded_*`

這說明：
- Prisma migration baseline 正常
- 但真庫與當前 `schema.prisma` 仍有實際差異
- 單看 `migrate status` 或 `ops:migration:report` 不足以證明 schema 已對齊

## 實際執行

### 1. Baseline 報告

```bash
cd backend
MIGRATION_REPORT_PATH=./tmp/bench-reports/prisma-migration-baseline-report.json npm run ops:migration:report
```

結果：
- `missingInDb=[]`
- `missingInCode=[]`
- `failedMigrations=[]`
- `status=ok`

### 2. 真庫差異檢查

```bash
cd backend
export DATABASE_URL="..."
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
```

結果：
- 發現 Repair Journey / AI Stream / Notification interaction 相關表、欄位與 enum 尚未在真庫落地

### 3. 同步真庫 schema

```bash
cd backend
npx prisma db push
```

結果：
- Prisma 回覆：`Your database is now in sync with your Prisma schema.`

### 4. 補齊殘差外鍵

`db push` 後再次檢查，剩餘差異只在 7 條外鍵：
- `repair_participant_states -> repair_tracks`
- `repair_participant_states -> users`
- `repair_step_progresses -> repair_tracks`
- `repair_checkins -> repair_tracks`
- `repair_checkins -> users`
- `repair_track_events -> repair_tracks`
- `repair_track_events -> users`

已使用 idempotent SQL 補齊。

### 5. 最終核驗

```bash
cd backend
export DATABASE_URL="..."
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
```

結果：
- `No difference detected.`

## 關鍵結論

- 當前 `.env` 指向真庫已與 `schema.prisma` 對齊。
- Repair Journey 2.3 所需 schema 已全部落地。
- staging / production 若指向不同 DB，仍需各自獨立執行同一套 `baseline -> diff -> apply -> diff=0` 流程，不能用本地真庫結果代替。
- 這次也再次驗證：在本 repo 的現況下，**`ops:migration:report=status=ok` 不等於真庫已和當前 schema 對齊**。
- 後續凡是 schema 類改動，應至少同時執行：
  - migration baseline 報告
  - `prisma migrate diff --from-url ... --to-schema-datamodel ... --exit-code`

## 建議後續流程

1. 若要同步 staging / production，沿用同一套 `baseline -> diff -> apply -> diff=0` 流程。
2. 若未來要把 `supabase/migrations`、`db push` 與 Prisma migration 歷史完全正規化，需另開專項，不在本次收口範圍。
