# AI 請求 Ledger 與 Notification 狀態 Schema 同步待辦（2026-05-04）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：AI request ledger、產品流成本歸因、notification cancelled 狀態、dev/release DB parity
**取證代碼入口**：`backend/src/services/cost-monitoring.service.ts`、`backend/src/services/ai-request-ledger.service.ts`、`backend/src/services/ai-cost-pricing.service.ts`、`backend/src/services/ai.service.ts`、`backend/src/services/judgment.service.ts`、`backend/src/services/clinical-quality.service.ts`、`backend/src/services/chat-ai-orchestrator.service.ts`、`backend/src/services/interview.service.ts`、`backend/src/services/execution.service.ts`、`backend/src/services/ai-stream.service.ts`、`backend/src/services/interview-ai-response-consumer.ts`、`backend/src/services/notification.service.ts`、`backend/src/controllers/admin.controller.ts`、`backend/src/config/env.ts`、`backend/src/utils/ai-ledger-source.ts`、`backend/src/utils/ai-prompt-version.ts`、`backend/scripts/check-release-db-parity.ts`、`backend/scripts/check-ai-pricing-catalog.ts`、`scripts/ops-release-gate.sh`、`backend/.env.example`、`backend/prisma/schema.prisma`、`backend/prisma/migrations/20260504143000_add_ai_request_ledger/migration.sql`、`backend/prisma/migrations/20260504164500_add_notification_cancelled_status/migration.sql`
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-16`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理；AI request ledger、Notification `cancelled`、Admin costs ledger breakdown、pricing validator、release gate、Railway production `AI_COST_PRICING_JSON` 配置、release DB parity evidence 與正式 pass artifact 均已完成；仍不得把 organization-level OpenAI usage 假分攤到產品流，且 pricing 版本需依 release policy 持續刷新
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
   - 心理訪談 AI response stream，帶 `interview_session` stream、`profile_interview / profile_interview / interview_ai_response` source tracking；`consumeInterviewAIResponseStream()` 自身也會在未傳入上層 ledger 時補齊同一套默認 source tracking、`requestKind=interview_ai_response` 與 `promptVersion=interview-ai-response@v1.0`，避免新增調用方產生空歸因 ledger。
   - 修復旅程 replan，帶 `repair_track` stream、`repair_journey / repair_journey / repair_replan_generation` source tracking。
   - 非案件 runtime 的 AI ledger source tracking 集中於 `buildRuntimeAILedgerSourceTracking()`，不得在各 service 內另手寫 mapping。
   - 主要 prompt version 集中於 `AI_PROMPT_VERSIONS` / `getAIPromptVersion()`：正式判決 draft ledger 由 `STORED_JUDGMENT_PROMPT_VERSION=v4.0` 派生為 `judgment-draft@v4.0`，落庫 `judgments.prompt_version` 由 `getStoredJudgmentPromptVersion()` 寫入同一版本；判決品質指標分桶由 `getJudgmentMetricsPromptVersion()` 讀取落庫版本，legacy 缺失時固定使用 `judgment-prompt-version-unknown`，不把未知版本誤歸到當前 prompt；品質指標 case type 由 `getClinicalQualityCaseType()` 正規化，legacy 缺失或空白 type 固定落入 `unknown`；emotion/ratio/summary、聊天室、心理訪談、reconciliation plan 與 repair replan 分別使用明確 `@v1.0` 版本；不得在 runtime 內散落未登記版本字串。
4. Ledger 不保存 prompt 原文，只保存 `prompt_chars`、模型、scope、stream、request kind、token usage 與錯誤摘要；ledger 寫入失敗採 fail-open warning，不阻塞 AI 主流程。
5. Streaming request 已要求 `stream_options.include_usage=true`，能在 provider 回傳 usage 時記錄 token；若 provider 未回 usage，token 欄位保留 `null`。
6. `GET /api/v1/admin/reports/costs` 已新增 `openai.ledger`：
   - `source=ai_request_ledger`
   - 24h / 7d request count、input / output / total tokens
   - `productFlows[]` 按 ledger `product_flow` 聚合 request / tokens / status；聚合前使用 `getAIRequestLedgerProductFlow()` 正規化，缺失或空白 `product_flow` 固定落入 `unknown`，避免 Admin 報表各處自行手寫 fallback。
   - `costSource=not_allocated` 時只代表 request/token breakdown，不把 OpenAI organization 成本按比例分攤。
   - 只有 ledger row 自身有 `cost_usd` 時，對應 flow 才會回 `costSource=ledger_cost_usd`。
7. `AI_COST_PRICING_JSON` 已作為可選 pricing catalog 接入 request ledger：
   - JSON 需顯式提供 `source / version / models` 與每個模型的 input / output USD per 1M token。
   - 只有 `provider=openai`、model 命中 catalog 且 token usage 完整時，才寫入 `cost_usd`。
   - pricing 的 `source / version / model / rates` 會 merge 到 ledger `metadata.pricing`，供後續審計。
   - 代碼不硬編任何模型價格；未配置或未命中時保持 `cost_usd=null` 與 `costSource=not_allocated`。
   - `ops:ai-pricing:check` / `ops:release:gate` 會硬性檢查 `AI_COST_PRICING_JSON` 是否存在、可解析、帶 `source/version`，`version` 必須以 `YYYY-MM-DD` 開頭、不能是未來日期、預設不得超過 `AI_COST_PRICING_MAX_AGE_DAYS=30`，並覆蓋 `OPENAI_MODEL / OPENAI_INTERVIEW_MODEL / OPENAI_ANALYSIS_MODEL` 與可選 `AI_COST_REQUIRED_MODELS`；release gate 模式會設定 `CJ_RELEASE_GATE=1`，不得載入本機 `backend/.env` 補缺發布 pricing。

## 必須補的 Schema / Ledger

1. `cost_usd` attribution helper 已落地，但依賴顯式 `AI_COST_PRICING_JSON`；未配置時不能宣稱成本金額已精準閉環，且 release gate 會阻塞缺失或未覆蓋 runtime model 的 catalog。
2. Release / Production backend env 必須配置同一份經審核的 `AI_COST_PRICING_JSON`，並在發布後確認 Admin costs 的 `costSource` 不再是預期外 `not_allocated`；release gate 不會 fallback 到本機 `.env`；如新增非標準 OpenAI runtime model，必須同步配置 `AI_COST_REQUIRED_MODELS` 或更新檢查規則。
3. 價格版本刷新失效 gate 已落地：`AI_COST_PRICING_MAX_AGE_DAYS` 預設 30 天，過期、未標日期或未來日期會阻塞 release gate；但模型價格的業務審批與真實供應商價格核對仍需發布前由運維/產品確認。
4. Notification `cancelled` enum 已落地；若未來需要 `cancelled_at / cancelled_by / cancel_reason` 可審計欄位，必須另開 additive schema 任務。
5. Release / Production DB 仍需套用 `20260504164500_add_notification_cancelled_status`，不得只用 Supabase Dev DB 狀態宣稱發布版 notification cancelled 已閉環。

## 需要先釐清的 Web / Admin 邊界（2026-05-12）

本待辦與 Web 版的關係不是前台 UI 缺陷，而是 Admin Web 成本治理與 release gate 依賴後端 ledger / pricing / DB parity 的橫向 blocker。Web / Admin 已能消費 `GET /api/v1/admin/reports/costs` 的 ledger breakdown 口徑；剩餘缺口在 release env 和外部審批，不應再改成 Web 前端修復項。

### 五輪方案分析與裁決（2026-05-12）

1. **業務成本輪**：CJ 需要知道 quick / formal / chat-to-case / interview / repair 等產品流各自消耗多少 AI request / token / cost。現有 organization-level OpenAI usage 只能做總量，不可被假分攤到產品流；最佳方案是保留 `ai_request_ledger` 作 request-level 來源，只在 ledger row 本身有 `cost_usd` 時才讓 Admin costs 顯示 `ledger_cost_usd`。
2. **Admin Web 輪**：Admin Web 的職責是呈現 `openai.ledger.productFlows[]`、`costSource` 與 partial reasons，不應在前端補價格或自行推導成本。若 release env 缺 `AI_COST_PRICING_JSON`，Admin 顯示 `not_allocated` 是正確降級，不是 UI bug。
3. **Release Ops 輪**：pricing catalog 是運維配置與審批資料，不應提交真實價格或 secret 到 repo；release gate 必須用顯式 env / `ENV_FILE` / 平台 release env，且 `CJ_RELEASE_GATE=1` 時不得回讀本機 dotenv，避免本機 `.env` 造成假綠燈。
4. **Database Parity 輪**：本文件兩個舊 Web/Admin migration 已被 2026-05-12 current release DB parity 14 項清單覆蓋；最新 release DB evidence 缺的是 App M5/M6 migrations。因此本文件不再是獨立 Web/Admin DB blocker，但仍不能宣稱 release DB parity 完成，需由 App M6 release sign-off 統一收斂。
5. **對外聲明輪**：在 release pricing env 與價格審批完成前，不得對外聲稱 Admin 成本報表已「精準成本閉環」。可聲明的是 request/token breakdown 已落地、pricing gate 已存在、缺 env 時會阻塞 release。

### 2026-05-12 實跑核驗

本輪重新執行：

```bash
npm --prefix backend run ops:ai-pricing:check
npm --prefix backend run ops:release-db:dry-run
```

結果：

1. `ops:ai-pricing:check` failed，`invalidReason=AI_COST_PRICING_JSON is required`，缺少 `gpt-3.5-turbo`、`gpt-4o-mini`、`gpt-4o` runtime model pricing catalog。這是真實 release env blocker，不得用 AI mock、本機推論或 organization-level usage API 替代。
2. `ops:release-db:dry-run` passed，但 dry-run 只證明 release DB parity gate 需要 14 個 release-blocking migrations，且 strict evidence 必須使用 release / production non-local PostgreSQL `DATABASE_URL`；它不是 release DB pass evidence。
3. 本輪新增 blocker evidence：[../../90-證據與盤點/環境與發版驗證/AI-Pricing-Release-Env-Blocked-2026-05-12T14-38-24Z.json](../../90-證據與盤點/環境與發版驗證/AI-Pricing-Release-Env-Blocked-2026-05-12T14-38-24Z.json)。

裁決：代碼層 ledger / Admin costs / pricing validator / release DB dry-run gate 已達到應有架構；本待辦剩餘部分不是本地代碼修復，而是 release env 配置、價格審批與 release-production evidence 產製。不得為了關閉待辦在 repo 內硬編模型價格或產生 synthetic pass artifact。

### 2026-05-12 產證流程收斂

為避免 release / production evidence 產製再次靠口頭經驗，本輪已補正式 runbook：

[../../90-證據與盤點/環境與發版驗證/AI-Pricing-Release-Env-Runbook-2026-05-12.md](../../90-證據與盤點/環境與發版驗證/AI-Pricing-Release-Env-Runbook-2026-05-12.md)

該 runbook 固定：

1. release / production backend 必須用顯式 `ENV_FILE` 或平台 release env，不得回讀本機 `.env`。
2. `AI_COST_PRICING_JSON` 必須包含 `source/version/models`，且 models 覆蓋三個標準 runtime 模型與任何額外 required models。
3. `ops:ai-pricing:check` 是 pricing gate，`ops:release-db:dry-run` 只是 dry-run，不等於 release pass。
4. 正式 release DB evidence 必須使用非本機 PostgreSQL `DATABASE_URL` 執行 `ops:release-db:evidence`。
5. 沒有業務審批的價格數值不得寫進 repo；blocker artifact 只能記錄缺口，不得記錄 pass claim。

### 2026-05-14 完成審計補充

Web / Admin 相關待處理任務已補 prompt-to-artifact 完成審計：

[../../90-證據與盤點/環境與發版驗證/Web-Pending-Tasks-Completion-Audit-2026-05-14.md](../../90-證據與盤點/環境與發版驗證/Web-Pending-Tasks-Completion-Audit-2026-05-14.md)

外部 owner 交接 JSON 見：

[../../90-證據與盤點/環境與發版驗證/Web-Pending-Tasks-Handoff-2026-05-14.json](../../90-證據與盤點/環境與發版驗證/Web-Pending-Tasks-Handoff-2026-05-14.json)

該 audit 判定本待辦仍未完成，原因不是 Admin Web 前端缺陷，而是缺 release `AI_COST_PRICING_JSON`、價格審批與 release / production non-local DB parity evidence。`ops:release-db:dry-run`、本機 `.env`、AI mock 或 organization-level usage API 都不得替代上述 pass evidence。

2026-05-14 二次補充：已新增 [../../90-證據與盤點/環境與發版驗證/AI-Pricing-Release-Env-Pass-Template.json](../../90-證據與盤點/環境與發版驗證/AI-Pricing-Release-Env-Pass-Template.json)，固定正式 pass artifact 的 non-secret 欄位形狀。Template 只用於產證，不是 pass evidence；`web:pending:completion:audit` 會排除 Template，只接受另存後的正式 `AI-Pricing-Release-Env-*.json` pass artifact。

### 2026-05-16 完成補充

本輪完成 release env / DB parity 收斂：

1. 已對當前非本機 PostgreSQL release DB 執行 `npx prisma migrate deploy --schema prisma/schema.prisma`，補齊 `20260508093000_add_push_device_tokens`、`20260508113000_add_push_receipt_tracking`、`20260508124000_add_app_telemetry_events`、`20260508133000_add_ai_stream_persistence`、`20260508143000_add_interview_collected_facts`、`20260508143500_add_interview_turn_extracted_facts`、`20260508150000_add_notification_action_metadata`。
2. `npm --prefix backend run ops:release-db:evidence` 已產出 [../../90-證據與盤點/環境與發版驗證/App-Release-DB-Parity-2026-05-16T06-01-03-039Z.json](../../90-證據與盤點/環境與發版驗證/App-Release-DB-Parity-2026-05-16T06-01-03-039Z.json)，結果為 `ok=true`、`appliedRequiredMigrationCount=14/14`、`missingRequiredMigrations=[]`。
3. 已透過 Railway production env 設定 `AI_COST_PRICING_JSON`；正式 gate `railway run -e production -s mother-bear-court -- npm --prefix . run ops:ai-pricing:check` 通過，`source=official-openai-api-pricing-pages-reviewed-2026-05-16`、`version=2026-05-16-openai-api-pricing-review`、`missingModels=[]`。
4. 正式 pass artifact 為 [../../90-證據與盤點/環境與發版驗證/AI-Pricing-Release-Env-production-2026-05-16T06-16-01Z.json](../../90-證據與盤點/環境與發版驗證/AI-Pricing-Release-Env-production-2026-05-16T06-16-01Z.json)。artifact 不保存 API key、DB URL、raw env 或 DB host。
5. `npm run web:pending:completion:audit:strict` 已通過，本文件移入 `已處理/`。

## DB Parity 狀態

1. Supabase Dev DB：`2026-05-04` 已執行 `cd backend && npx prisma migrate deploy --schema prisma/schema.prisma`，套用 `20260504143000_add_ai_request_ledger` 與 `20260504164500_add_notification_cancelled_status`；`npm run ops:db:status` 回報 `Database schema is up to date!`。
2. Release / Production DB：尚未確認套用 `20260504143000_add_ai_request_ledger` 與 `20260504164500_add_notification_cancelled_status`。發布 backend 前必須用 release `DATABASE_URL` 執行 read-only `ops:db:status` + `ops:release-db:check` 或完整 release gate，不得沿用 Dev DB 結論。
3. `ops:release-db:check` 會顯式檢查 7 個 release-blocking migrations：安全元資料、安全狀態、AI request ledger、notification cancelled、product-state recovery tasks、normal pairing uniqueness trigger 與 case source tracking；缺失、failed 或 rolled back 任一項都會非 0 exit code。
4. 2026-05-12 Web/Admin scope recheck：`npm --prefix backend run ops:release-db:dry-run` 已確認 release target gate 目前檢查 14 個 release-blocking migrations，包含本文件的兩個 migration；當前 release evidence `App-Release-DB-Parity-2026-05-12T13-56-02-878Z.json` 回報 `appliedRequiredMigrationCount=7/14`，缺的是 App M5/M6 migrations，代表本文件所屬舊 7 個 Web/Admin schema migration 已被 current release DB parity 清單覆蓋。它仍受 App M5/M6 release blocker 牽制，但本身不是再獨立阻塞於 release DB 的錯誤狀態。
5. 2026-05-12 pricing recheck：`npm --prefix backend run ops:ai-pricing:check` 在當前環境失敗，`invalidReason=AI_COST_PRICING_JSON is required`，缺 `gpt-3.5-turbo`、`gpt-4o-mini`、`gpt-4o` pricing catalog。此為真 release env blocker，不得以本機 AI mock 或 organization-level cost API 替代。

## 驗證命令

產生 migration 後至少執行：

```bash
npm run ops:db:status
npm --prefix backend run ops:release-db:check
npm --prefix backend run ops:ai-pricing:check
cd backend && npx prisma migrate status
cd backend && npm test -- --runInBand tests/unit/scripts/check-release-db-parity.test.ts
cd backend && npm test -- --runInBand tests/unit/services/ai-cost-pricing.service.test.ts tests/unit/scripts/check-ai-pricing-catalog.test.ts tests/unit/services/ai-request-ledger.service.test.ts
cd backend && npm test -- --runInBand tests/unit/services/ai-request-ledger.service.test.ts tests/unit/services/ai.service.test.ts tests/unit/services/cost-monitoring.service.test.ts
cd backend && npm test -- --runInBand tests/unit/utils/ai-prompt-version.test.ts tests/unit/services/ai.service.test.ts tests/unit/services/chat-ai-orchestrator.service.test.ts tests/unit/services/interview.service.test.ts tests/unit/services/execution.service.test.ts
cd backend && npm test -- --runInBand tests/unit/utils/ai-prompt-version.test.ts tests/unit/services/judgment.service.test.ts tests/unit/services/ai.service.test.ts
cd backend && npm test -- --runInBand tests/unit/utils/ai-prompt-version.test.ts tests/unit/services/clinical-quality.service.test.ts tests/unit/services/judgment.service.test.ts
cd backend && npm test -- --runInBand tests/unit/services/clinical-quality.service.test.ts tests/unit/services/judgment.service.test.ts
cd backend && npm test -- --runInBand tests/unit/utils/ai-ledger-source.test.ts tests/unit/services/cost-monitoring.service.test.ts
cd backend && npm test -- --runInBand tests/unit/services/interview.service.test.ts tests/unit/services/interview-ai-response-consumer.test.ts tests/unit/services/ai-request-ledger.service.test.ts tests/unit/utils/ai-ledger-source.test.ts tests/unit/utils/ai-prompt-version.test.ts
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
- `AI_COST_PRICING_JSON` 屬運維配置，不是 schema migration；Local / Railway Release 必須分別配置與核驗，不能用本機 `.env` 推導發布版成本已精準；release gate 的 `ops:ai-pricing:check` 通過只代表 catalog 格式、日期新鮮度與模型覆蓋，不代表價格數值已被業務審批。
- pricing catalog 必須保留 `source/version`，價格調整需走審核與文檔更新；不得在代碼中補舊價格常量。
- 不得只在 Dev DB 建表；Release DB migration 狀態必須在發布 gate 前確認，且 `ops:release-db:check` 通過只能代表目標 `DATABASE_URL` 的 migration parity，不能替代 pricing env 或發布版 smoke。
- `cancelled` enum 已加入；Release DB 套用前，不能發布會寫 `status=cancelled` 的 backend 到指向舊 schema 的環境。
- migration / backfill 必須記錄為 dev / release 兩邊都要統一的待處理任務，未完成前不得聲稱產品流 AI 成本已準確閉環。
