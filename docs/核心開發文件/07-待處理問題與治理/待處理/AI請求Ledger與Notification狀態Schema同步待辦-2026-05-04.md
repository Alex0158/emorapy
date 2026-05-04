# AI 請求 Ledger 與 Notification 狀態 Schema 同步待辦（2026-05-04）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：AI request ledger、產品流成本歸因、notification cancelled 狀態、dev/release DB parity
**取證代碼入口**：`backend/src/services/cost-monitoring.service.ts`、`backend/src/services/ai-request-ledger.service.ts`、`backend/src/services/ai-cost-pricing.service.ts`、`backend/src/services/ai.service.ts`、`backend/src/services/judgment.service.ts`、`backend/src/services/chat-ai-orchestrator.service.ts`、`backend/src/services/interview.service.ts`、`backend/src/services/execution.service.ts`、`backend/src/services/ai-stream.service.ts`、`backend/src/services/interview-ai-response-consumer.ts`、`backend/src/services/notification.service.ts`、`backend/src/controllers/admin.controller.ts`、`backend/src/config/env.ts`、`backend/src/utils/ai-ledger-source.ts`、`backend/src/utils/ai-prompt-version.ts`、`backend/.env.example`、`backend/prisma/schema.prisma`、`backend/prisma/migrations/20260504143000_add_ai_request_ledger/migration.sql`、`backend/prisma/migrations/20260504164500_add_notification_cancelled_status/migration.sql`
**最後核驗 Commit**：`22639a5`
**最後核驗日期**：`2026-05-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：部分落地；AI request ledger migration 與 Notification `cancelled` enum migration 已生成並套用 Supabase Dev DB，Admin costs 已接入 ledger product-flow token/request breakdown，主要 AI runtime 已寫入集中 `prompt_version`，且已新增可配置 `AI_COST_PRICING_JSON` 的 request-level `cost_usd` 歸因；Release / Production DB、Release / Production pricing env 與價格版本維護流程仍待發布前確認
**優先級**：P0，涉及 Admin 成本歸因、通知召回治理與 dev/release DB schema parity
**責任範圍**：Backend / Database / Admin / Release Ops

## 背景

Admin 成本報表目前由 `CostMonitoringService` 讀取 OpenAI organization costs / usage API，能返回 24h / 7d 總成本與 token 總量，但該 API 回傳的是 organization 聚合，不包含 CJ 內部的 `case/chat/interview/replan` scope、產品流、prompt version、retry 與失敗原因。因此不能用現有資料準確回答「quick / formal / chat-to-case 分別花了多少 AI 成本」。

本輪已先落地通知管理能力：

- `GET /api/v1/admin/notifications`：按 status/template/user/dedup 查通知，並沿用 `NotificationService.normalize()` 的 `render_payload.product_flow`。
- `POST /api/v1/admin/notifications/:notificationId/cancel`：只取消 pending 通知，寫 audit log。
- `POST /api/v1/admin/notifications/bulk-cancel`：按 template/user/dedup/group 篩選最多 100 條 pending 通知做批量召回，寫 batch audit。
- `POST /api/v1/admin/notifications/:notificationId/retry`：只允許真正 failed 通知重送；`admin_cancelled:*` 人工取消通知不可 retry。

`NotificationStatus` 已新增正式 `cancelled`。取消 pending 會寫 `status=cancelled + error_message=admin_cancelled:*` 退出發送隊列；retry 只允許真正 `failed`，且仍保留對歷史 `failed + admin_cancelled:*` 資料的重送禁止，避免 migration 前的人工取消通知被錯誤重送。

## 已落地的 AI Request Ledger（2026-05-04）

1. `20260504143000_add_ai_request_ledger` 已新增：
   - `AIRequestLedgerStatus`：`started / succeeded / failed / cancelled`
   - `ai_request_ledger`：`request_id / stream_id / scope_type / scope_id / product_flow / source_channel / entry_point / provider / model / request_kind / prompt_version / tokens / cost_usd / status / retry_count / failure_reason / metadata / timestamps`
2. `AIRequestLedgerService` 是唯一寫入 helper；AI 入口不得各自拼 ledger JSON。
3. 已接入主要 runtime：
   - `AIService.generateText`
   - `AIService.generateTextStream`
   - 正式判決：emotion analysis、draft、responsibility ratio、summary，帶 `case_judgment` stream、product flow、`source_channel` 與 `entry_point`；ledger base 由 `buildCaseSourceTrackingForRead()` 生成，chat-to-case link 優先於落庫 `product_flow`。
   - 聊天室 AI response，帶 `chat_room` stream、`chat_first / chat_room / chat_room_ai_response` source tracking。
   - 心理訪談 AI response stream，帶 `interview_session` stream、`profile_interview / profile_interview / interview_ai_response` source tracking。
   - 修復旅程 replan，帶 `repair_track` stream、`repair_journey / repair_journey / repair_replan_generation` source tracking。
   - 非案件 runtime 的 AI ledger source tracking 集中於 `buildRuntimeAILedgerSourceTracking()`，不得在各 service 內另手寫 mapping。
   - 主要 prompt version 集中於 `AI_PROMPT_VERSIONS` / `getAIPromptVersion()`：正式判決 draft ledger 由 `STORED_JUDGMENT_PROMPT_VERSION=v4.0` 派生為 `judgment-draft@v4.0`，落庫 `judgments.prompt_version` 由 `getStoredJudgmentPromptVersion()` 寫入同一版本；emotion/ratio/summary、聊天室、心理訪談、reconciliation plan 與 repair replan 分別使用明確 `@v1.0` 版本；不得在 runtime 內散落未登記版本字串。
4. Ledger 不保存 prompt 原文，只保存 `prompt_chars`、模型、scope、stream、request kind、token usage 與錯誤摘要；ledger 寫入失敗採 fail-open warning，不阻塞 AI 主流程。
5. Streaming request 已要求 `stream_options.include_usage=true`，能在 provider 回傳 usage 時記錄 token；若 provider 未回 usage，token 欄位保留 `null`。
6. `GET /api/v1/admin/reports/costs` 已新增 `openai.ledger`：
   - `source=ai_request_ledger`
   - 24h / 7d request count、input / output / total tokens
   - `productFlows[]` 按 ledger `product_flow` 聚合 request / tokens / status
   - `costSource=not_allocated` 時只代表 request/token breakdown，不把 OpenAI organization 成本按比例分攤。
   - 只有 ledger row 自身有 `cost_usd` 時，對應 flow 才會回 `costSource=ledger_cost_usd`。
7. `AI_COST_PRICING_JSON` 已作為可選 pricing catalog 接入 request ledger：
   - JSON 需顯式提供 `source / version / models` 與每個模型的 input / output USD per 1M token。
   - 只有 `provider=openai`、model 命中 catalog 且 token usage 完整時，才寫入 `cost_usd`。
   - pricing 的 `source / version / model / rates` 會 merge 到 ledger `metadata.pricing`，供後續審計。
   - 代碼不硬編任何模型價格；未配置或未命中時保持 `cost_usd=null` 與 `costSource=not_allocated`。

## 必須補的 Schema / Ledger

1. `cost_usd` attribution helper 已落地，但依賴顯式 `AI_COST_PRICING_JSON`；未配置時不能宣稱成本金額已精準閉環。
2. Release / Production backend env 必須配置同一份經審核的 `AI_COST_PRICING_JSON`，並在發布後確認 Admin costs 的 `costSource` 不再是預期外 `not_allocated`。
3. 仍需定義價格版本刷新 / 審核 / 失效提醒流程；模型價格不得硬編到代碼，也不得長期沿用未審核的舊版本。
4. Notification `cancelled` enum 已落地；若未來需要 `cancelled_at / cancelled_by / cancel_reason` 可審計欄位，必須另開 additive schema 任務。
5. Release / Production DB 仍需套用 `20260504164500_add_notification_cancelled_status`，不得只用 Supabase Dev DB 狀態宣稱發布版 notification cancelled 已閉環。

## DB Parity 狀態

1. Supabase Dev DB：`2026-05-04` 已執行 `cd backend && npx prisma migrate deploy --schema prisma/schema.prisma`，套用 `20260504143000_add_ai_request_ledger` 與 `20260504164500_add_notification_cancelled_status`；`npm run ops:db:status` 回報 `Database schema is up to date!`。
2. Release / Production DB：尚未確認套用 `20260504143000_add_ai_request_ledger` 與 `20260504164500_add_notification_cancelled_status`。發布 backend 前必須用 release `DATABASE_URL` 執行 read-only migration status 或 release gate，不得沿用 Dev DB 結論。

## 驗證命令

產生 migration 後至少執行：

```bash
npm run ops:db:status
cd backend && npx prisma migrate status
cd backend && npm test -- --runInBand tests/unit/services/ai-request-ledger.service.test.ts tests/unit/services/ai.service.test.ts tests/unit/services/cost-monitoring.service.test.ts
cd backend && npm test -- --runInBand tests/unit/utils/ai-prompt-version.test.ts tests/unit/services/ai.service.test.ts tests/unit/services/chat-ai-orchestrator.service.test.ts tests/unit/services/interview.service.test.ts tests/unit/services/execution.service.test.ts
cd backend && npm test -- --runInBand tests/unit/utils/ai-prompt-version.test.ts tests/unit/services/judgment.service.test.ts tests/unit/services/ai.service.test.ts
cd backend && npm test -- --runInBand tests/unit/services/ai-request-ledger.service.test.ts tests/unit/services/ai.service.test.ts tests/unit/services/chat-ai-orchestrator.service.test.ts
cd backend && npm test -- --runInBand tests/unit/services/cost-monitoring.service.test.ts tests/unit/controllers/admin.controller.test.ts tests/unit/routes/admin.routes.test.ts
cd backend && npm test -- --runInBand tests/unit/controllers/admin.controller.test.ts tests/unit/routes/admin.routes.test.ts tests/unit/services/notification.service.test.ts tests/unit/controllers/notification.controller.test.ts
cd backend && npm test -- --runInBand tests/unit/services/ai-stream.service.persistence.test.ts
cd backend && npm run build
cd backend && npm run lint
npm run docs:check
```

## Release 注意事項

- 不得把 OpenAI organization usage 直接假分攤到產品流，除非 ledger 已有可追溯的 request/scope/token/cost。
- `AI_COST_PRICING_JSON` 屬運維配置，不是 schema migration；Local / Railway Release 必須分別配置與核驗，不能用本機 `.env` 推導發布版成本已精準。
- pricing catalog 必須保留 `source/version`，價格調整需走審核與文檔更新；不得在代碼中補舊價格常量。
- 不得只在 Dev DB 建表；Release DB migration 狀態必須在發布 gate 前確認。
- `cancelled` enum 已加入；Release DB 套用前，不能發布會寫 `status=cancelled` 的 backend 到指向舊 schema 的環境。
- migration / backfill 必須記錄為 dev / release 兩邊都要統一的待處理任務，未完成前不得聲稱產品流 AI 成本已準確閉環。
