# AI 請求 Ledger 與 Notification 狀態 Schema 同步待辦（2026-05-04）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：AI request ledger、產品流成本歸因、notification cancelled 狀態、dev/release DB parity
**取證代碼入口**：`backend/src/services/cost-monitoring.service.ts`、`backend/src/services/ai-stream.service.ts`、`backend/src/services/notification.service.ts`、`backend/src/controllers/admin.controller.ts`、`backend/prisma/schema.prisma`
**最後核驗 Commit**：`6aed23f`
**最後核驗日期**：`2026-05-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：待處理；尚未產生 migration
**優先級**：P0，涉及 Admin 成本歸因、通知召回治理與 dev/release DB schema parity
**責任範圍**：Backend / Database / Admin / Release Ops

## 背景

Admin 成本報表目前由 `CostMonitoringService` 讀取 OpenAI organization costs / usage API，能返回 24h / 7d 總成本與 token 總量，但該 API 回傳的是 organization 聚合，不包含 CJ 內部的 `case/chat/interview/replan` scope、產品流、prompt version、retry 與失敗原因。因此不能用現有資料準確回答「quick / formal / chat-to-case 分別花了多少 AI 成本」。

本輪已先落地不需 schema 的通知管理能力：

- `GET /api/v1/admin/notifications`：按 status/template/user/dedup 查通知，並沿用 `NotificationService.normalize()` 的 `render_payload.product_flow`。
- `POST /api/v1/admin/notifications/:notificationId/cancel`：只取消 pending 通知，寫 audit log。

但目前 `NotificationStatus` 只有 `pending/sent/failed`，沒有 `cancelled`。為了不在未建 migration 的情況下製造 schema drift，取消 pending 暫用 `status=failed + error_message=admin_cancelled:*` 退出發送隊列。

## 必須補的 Schema / Ledger

1. 新增 AI request ledger，例如 `ai_request_ledger`：
   - `id`
   - `request_id / stream_id`
   - `scope_type / scope_id`
   - `product_flow`
   - `source_channel / entry_point`
   - `model / provider / prompt_version`
   - `input_tokens / output_tokens / total_tokens`
   - `cost_usd`
   - `status / retry_count / failure_reason`
   - `started_at / completed_at / created_at`
2. AI 生成入口必須在同一 helper / service 寫 ledger，不得各 service 自行拼 JSON。
3. Admin costs 應在 ledger 存在後新增 product-flow breakdown，並清楚標記 window / source。
4. `NotificationStatus` 需評估是否新增 `cancelled` enum 或新增獨立 `cancelled_at / cancelled_by / cancel_reason` 欄位。
5. 若新增 enum / 欄位，必須產生 Prisma migration，並同步 Supabase Dev DB 與 Release / Production DB。

## 驗證命令

產生 migration 後至少執行：

```bash
npm run ops:db:status
cd backend && npx prisma migrate status
cd backend && npm test -- --runInBand tests/unit/controllers/admin.controller.test.ts tests/unit/routes/admin.routes.test.ts
cd backend && npm test -- --runInBand tests/unit/services/ai-stream.service.persistence.test.ts
cd backend && npm run build
npm run docs:check
```

## Release 注意事項

- 不得把 OpenAI organization usage 直接假分攤到產品流，除非 ledger 已有可追溯的 request/scope/token/cost。
- 不得只在 Dev DB 建表；Release DB migration 狀態必須在發布 gate 前確認。
- 若新增 `cancelled` enum，所有讀寫 `NotificationStatus` 的 validation、sender、Admin、前台通知列表都要同步處理。
- migration / backfill 必須記錄為 dev / release 兩邊都要統一的待處理任務，未完成前不得聲稱產品流 AI 成本已準確閉環。
