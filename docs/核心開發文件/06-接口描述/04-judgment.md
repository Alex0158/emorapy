# 接口描述：judgment

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：接口詳規
**覆蓋範圍**：接口字段契約、錯誤碼、守衛與頁面對接：04-judgment
**取證代碼入口**：`backend/src/app.ts`、`backend/src/routes/judgment.routes.ts`、`backend/src/routes/ai-stream.routes.ts`、`backend/src/services/judgment.service.ts`、`backend/src/services/judgment-normalization.service.ts`、`backend/src/services/chat.service.ts`、`backend/src/utils/judgment.ts`、`backend/src/utils/case-classifier.ts`、`packages/api-client/src/m4.ts`、`frontend/src/services/api/judgment.ts`、`frontend/src/services/aiStream.ts`、`mobile/app/(app)/case/index.tsx`、`mobile/src/features/m4/api.ts`
**最後核驗 Commit**：`c78765b`
**最後核驗日期**：`2026-07-12`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v2.11
**最後更新**：2026-07-12
**代碼基準**：`backend/src/routes/judgment.routes.ts`、`backend/src/routes/ai-stream.routes.ts`、`backend/src/services/judgment.service.ts`、`backend/src/services/judgment-normalization.service.ts`、`backend/src/services/chat.service.ts`、`packages/api-client/src/m4.ts`、`frontend/src/services/api/judgment.ts`、`frontend/src/services/aiStream.ts`、`mobile/src/features/m4/api.ts`

---

## 模組定位

- 提供梳理結果核心能力：生成、讀取、接受。
- 保留兩條候選擴展：修復回饋、臨床評分回傳。

## 接口契約（字段級）


| API                                          | Request（核心字段）                                       | Success（前端實際用到）                                      | 常見錯誤碼                                                   | 副作用/狀態轉移                    | 前端入口                           |
| -------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------- | --------------------------- | ------------------------------ |
| `POST /api/v1/judgments/generate/:id`        | `id(uuid)` + optional `X-Session-Id`                | `data.judgment.id` `plaintiff_ratio/defendant_ratio` `judgment_route` `responsibility_ratio_visibility` `reconciliation_policy` | `RATE_LIMIT_EXCEEDED` `CASE_NOT_READY` `FORBIDDEN` `CONFLICT` `NOT_FOUND` `INVALID_SESSION_ID` `AI_SERVICE_ERROR` | case 進入判決生成流                | `/case/:id/review`             |
| `GET /api/v1/streams/case_judgment/:id`（SSE） | `after_seq?` + optional `X-Session-Id`              | `ready + stream.phase/completed/persisted/failed`    | `UNAUTHORIZED` `FORBIDDEN` `NOT_FOUND` `INVALID_SESSION_ID` `SESSION_EXPIRED`                                 | 暴露判決生成 phase 與 persisted 狀態 | `/quick-experience/result/:id` |
| `GET /api/v1/judgments/:id`                  | `id(uuid)`                                          | `data.judgment`；安全狀態查詢降級時 additive 回 `safety_state_status=degraded`、`safety_risk_level=unknown` | `NOT_FOUND` `UNAUTHORIZED` `JUDGMENT_PENDING` `JUDGMENT_FAILED` `INVALID_SESSION_ID` `SESSION_EXPIRED`                                 | 無                           | `/judgment/:id`                |
| `POST /api/v1/judgments/:id/accept`          | `accepted:boolean` `rating?:0..5`                   | `data.judgment.accepted`                             | `VALIDATION_ERROR` `UNAUTHORIZED` `FORBIDDEN` `NOT_FOUND`                       | 寫入接受/拒絕結果                   | `/judgment/:id`                |
| `POST /api/v1/judgments/:id/repair`          | `feedback(3..2000)`                                 | 修復後 judgment（若啟用）                                    | `VALIDATION_ERROR` `NOT_FOUND`                          | 觸發修復流程                      | （候選，未接線）                       |
| `POST /api/v1/judgments/:id/metrics`         | `felt_understood/felt_blamed/willing_to_try`（0..10） | 成功旗標或 metrics 記錄                                     | `VALIDATION_ERROR`                                      | 寫入品質分數                      | （候選，未接線）                       |


## 操作級規則（深水區）

- `generate` 是判決域唯一 `aiLimiter` 接口，回歸需優先覆蓋超頻與重試。
- `generate` 的 AI 失敗/超時在現碼統一為 `AI_SERVICE_ERROR(503)`；文檔與前端錯誤分支不可再使用舊碼 `AI_CALL_FAILED`。
- 前端在 quick 流程多透過 `/cases/:id/judgment` 查判決；`/judgments/:id` 主要用於正式流程詳情頁。
- quick result 頁現以 `GET /streams/case_judgment/:id` 先顯示 AI phase，再於 `stream.persisted` 後拉正式判決內容。
- `repair` / `metrics` 目前為「保留能力」，需維持接口可用但不作前台回歸主路徑；兩者授權也必須走 `case-classifier` 的 session-bound 判斷，不能只用 `case.mode === quick`。
- `GET /api/v1/judgments/:id` 的權限檢查實際委派到 `getJudgmentByCaseId(case_id)`；`FORBIDDEN` 會在 controller 層轉為 `NOT_FOUND`，用於避免暴露資源存在性。
- `POST /api/v1/judgments/:id/accept` 的 `rating` 保留為 optional backward-compatible API 字段；Consumer Web 接受／不接受流程不再收集星級評分，避免在情緒高壓的結果頁加入無法改變下一步的量表。既有 client 仍可省略該字段，後端不得把它升為必填。
- case 維度判斷規則與 case 模組一致：`quick`/`collaborative(session_id 有值)` 走 session 校驗；`remote`/`collaborative(session_id=null)` 走當事人 JWT 校驗。此規則覆蓋 `generate`、`getJudgmentByCaseId`、`repairJudgmentResponse` 與 `recordClinicalMetrics`，並必須使用 `canAccessSessionBoundCase()` 支持 quick case 的 `case.session_id` 或 `quick_sessions.id` 恢復，避免快速雙人協作在候選接口退回 JWT 當事人授權，也避免只裸比對 `case.session_id` 漏掉 legacy quick session 關聯。
- `generate` 成功後的 session 生命周期也必須走同一 `case-classifier` 口徑：`quick` 與 `collaborative(session_id 有值)` 都要 best-effort 呼叫 `sessionService.markSessionCompleted(session_id)`；若 quick case 經 `quick_sessions.id` 恢復，應完成該請求提供的 session；正式 `remote` / `collaborative(session_id=null)` 不應標記匿名 session 完成。
- 判決生成的 `profileContext / caseContext` 注入不得只用 `case.mode === quick` 排除；必須透過 `backend/src/utils/case-classifier.ts` 的產品流口徑判斷。純 quick/session-bound 流程不注入個人/關係上下文；`ChatToCaseLink` 優先於 `case.mode`，chat-to-case 可在有登入當事人與 consent 時走 user-bound context governance。
- `judgment_content`、`summary` 與 `emotional_analysis` 內可見描述欄位屬 backend-owned stored visible content：新生成時必須使用 request locale 控制 AI prompt / mock / fallback 的用戶可見自然語言；JSON 欄位名、枚舉值、責任比例與 route contract 不因語言切換而變更。Web / App 只顯示後端已生成內容，不端側二次翻譯；既有歷史判決內容不做批量重寫。
- normalized judgment 會 additive 回傳 `responsibility_ratio_visibility`（`can_show/reason`）。同步純工具 `normalizeJudgment` 只按 stored route fallback；對外 read path 必須使用 `backend/src/services/judgment-normalization.service.ts`，優先讀 case scope active `RelationshipRiskState`。確認沒有 active state 時才可使用 stored route；lookup timeout、權限、migration drift 或其他讀取錯誤必須 fail closed：`can_show=false`、`reconciliation_policy.allowedReconciliationIntents=[]`、禁止 invite/co-repair、強制 solo，並 additive 回 `safety_state_status=degraded`、`safety_risk_level=unknown`。`safety_support / crisis_support` 不應展示責任比例，前端只能做降級呈現；後端暫保留 `plaintiff_ratio/defendant_ratio` 以維持既有契約，不能把字段存在視為可展示。
- normalized judgment 必須同時 additive 回傳 `judgment_route` 與 `reconciliation_policy{defaultReconciliationIntent,allowedReconciliationIntents,canInvitePartner,canUseCoRepair,forceSoloRepair}`。缺 stored route 時以 `standard` 為兼容基線；active case safety state 更嚴格時，normalization service 必須以 effective route 重算 visibility 與 reconciliation policy，不能只覆蓋比例顯示。
- 判決主讀取鏈路已接入 active safety state：`JudgmentService.generateJudgment/getJudgmentByCaseId/acceptJudgment`、case detail/list/session judgment normalization，以及 `ChatService.getJudgmentStatus.latestLink.judgment`。新增 read path 若會暴露 ratio 字段，必須接同一 normalization service。

## 回歸測試最小集

1. submitted case 觸發 generate 成功進入 judgment detail。
2. accept 流程支持 `accepted=true/false` 兩分支。
3. `generate` 在限流與 AI 異常時返回可識別錯誤碼。
4. 候選接口基本健康檢查（schema + auth + 404）保持可用。
5. `repair` / `metrics` 對 `collaborative + session_id 有值` 必須接受匹配 `X-Session-Id`，且不得因存在 `plaintiff_id/defendant_id` 就退回 JWT 當事人授權。
6. active `RelationshipRiskState` 比 stored judgment route 更嚴格時，judgment/case/chat status read path 必須返回 `responsibility_ratio_visibility.can_show=false`。
7. `generate` 對 `collaborative + session_id 有值` 成功生成判決後必須呼叫 `markSessionCompleted(session_id)`；此行為不得只覆蓋 `mode=quick`。
8. `generate` / `getJudgmentByCaseId` / `repair` / `metrics` 對 legacy quick case 必須支持 `quick_sessions.id` 關聯恢復，同時不得讓 formal remote 或 collaborative 非匹配 session 因殘留關聯越權。
9. route 缺失時 normalized judgment 必須固定回傳 `judgment_route=standard` 與 standard reconciliation policy；active safety/crisis state 必須覆蓋 stored route，並同步禁用 ratio、invite/co-repair 及強制 solo。
10. active safety state lookup 失敗時，不得回退 stored standard route 放寬能力；必須隱藏 ratio、清空 allowed intents、禁止 invite/co-repair、強制 solo，並回傳 degraded/unknown additive 狀態。

## 錯誤碼覆蓋矩陣（API -> code -> UI 行為）


| API                                   | error.code            | HTTP | UI 行為                   | 重試策略          |
| ------------------------------------- | --------------------- | ---- | ----------------------- | ------------- |
| `POST /api/v1/judgments/generate/:id` | `CASE_NOT_READY`      | 422  | 提示案件尚未可判決               | 補足前置資料後重試     |
| `POST /api/v1/judgments/generate/:id` | `RATE_LIMIT_EXCEEDED` | 429  | 顯示 AI 生成過頻              | 冷卻後重試         |
| `POST /api/v1/judgments/generate/:id` | `AI_SERVICE_ERROR`    | 503  | 顯示「可重試」並保留頁面狀態          | 人工重試 generate |
| `POST /api/v1/judgments/generate/:id` | `FORBIDDEN`           | 403  | 顯示無權生成判決               | 切換正確身份/會話後重試 |
| `POST /api/v1/judgments/generate/:id` | `CONFLICT`            | 409  | 顯示正在處理或冷卻中            | 稍後重試           |
| `GET /api/v1/judgments/:id`           | `NOT_FOUND`           | 404  | 顯示判決不存在/已移除             | 返回來源頁         |
| `GET /api/v1/judgments/:id`           | `UNAUTHORIZED`        | 401  | 觸發登入恢復流程                 | 登入後重試         |
| `GET /api/v1/judgments/:id`           | `JUDGMENT_PENDING`    | 202  | 顯示判決生成中                 | 輪詢或手動刷新       |
| `GET /api/v1/judgments/:id`           | `JUDGMENT_FAILED`     | 409  | 顯示判決失敗並提供重試            | 觸發重新生成         |
| `POST /api/v1/judgments/:id/accept`   | `VALIDATION_ERROR`    | 400  | 高亮 `accepted/rating` 字段 | 修正後重送         |
| `POST /api/v1/judgments/:id/accept`   | `UNAUTHORIZED`        | 401  | 觸發登入恢復流程                | 登入後重送         |
| `POST /api/v1/judgments/:id/accept`   | `FORBIDDEN`           | 403  | 提示非案件當事人不可操作         | 切換正確身份後重試 |
| `POST /api/v1/judgments/:id/repair`   | `NOT_FOUND`           | 404  | 提示目標判決不存在               | 不重試           |
| `POST /api/v1/judgments/:id/metrics`  | `VALIDATION_ERROR`    | 400  | 提示評分範圍錯誤                | 修正後重送         |


## 狀態標記

- 已使用：3
- 候選廢棄：2
