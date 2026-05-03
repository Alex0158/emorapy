# 接口描述：judgment

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：接口詳規
**覆蓋範圍**：接口字段契約、錯誤碼、守衛與頁面對接：04-judgment
**取證代碼入口**：`backend/src/app.ts`、`backend/src/routes`、`frontend/src/services/api`、`frontend-admin/src/services/api`
**最後核驗 Commit**：`45d4897`
**最後核驗日期**：`2026-04-19`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v2.4  
**最後更新**：2026-04-19  
**代碼基準**：`backend/src/routes/judgment.routes.ts`、`backend/src/routes/ai-stream.routes.ts`、`backend/src/services/judgment.service.ts`、`frontend/src/services/api/judgment.ts`、`frontend/src/services/aiStream.ts`

---

## 模組定位

- 提供判決核心能力：生成、讀取、接受。
- 保留兩條候選擴展：修復回饋、臨床評分回傳。

## 接口契約（字段級）


| API                                          | Request（核心字段）                                       | Success（前端實際用到）                                      | 常見錯誤碼                                                   | 副作用/狀態轉移                    | 前端入口                           |
| -------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------- | --------------------------- | ------------------------------ |
| `POST /api/v1/judgments/generate/:id`        | `id(uuid)` + optional `X-Session-Id`                | `data.judgment.id` `plaintiff_ratio/defendant_ratio` `judgment_route?` `responsibility_ratio_visibility?` | `RATE_LIMIT_EXCEEDED` `CASE_NOT_READY` `FORBIDDEN` `CONFLICT` `NOT_FOUND` `INVALID_SESSION_ID` `AI_SERVICE_ERROR` | case 進入判決生成流                | `/case/:id/review`             |
| `GET /api/v1/streams/case_judgment/:id`（SSE） | `after_seq?` + optional `X-Session-Id`              | `ready + stream.phase/completed/persisted/failed`    | `UNAUTHORIZED` `FORBIDDEN` `NOT_FOUND` `INVALID_SESSION_ID` `SESSION_EXPIRED`                                 | 暴露判決生成 phase 與 persisted 狀態 | `/quick-experience/result/:id` |
| `GET /api/v1/judgments/:id`                  | `id(uuid)`                                          | `data.judgment`                                      | `NOT_FOUND` `UNAUTHORIZED` `JUDGMENT_PENDING` `JUDGMENT_FAILED` `INVALID_SESSION_ID` `SESSION_EXPIRED`                                 | 無                           | `/judgment/:id`                |
| `POST /api/v1/judgments/:id/accept`          | `accepted:boolean` `rating?:0..5`                   | `data.judgment.accepted`                             | `VALIDATION_ERROR` `UNAUTHORIZED` `FORBIDDEN` `NOT_FOUND`                       | 寫入接受/拒絕結果                   | `/judgment/:id`                |
| `POST /api/v1/judgments/:id/repair`          | `feedback(3..2000)`                                 | 修復後 judgment（若啟用）                                    | `VALIDATION_ERROR` `NOT_FOUND`                          | 觸發修復流程                      | （候選，未接線）                       |
| `POST /api/v1/judgments/:id/metrics`         | `felt_understood/felt_blamed/willing_to_try`（0..10） | 成功旗標或 metrics 記錄                                     | `VALIDATION_ERROR`                                      | 寫入品質分數                      | （候選，未接線）                       |


## 操作級規則（深水區）

- `generate` 是判決域唯一 `aiLimiter` 接口，回歸需優先覆蓋超頻與重試。
- `generate` 的 AI 失敗/超時在現碼統一為 `AI_SERVICE_ERROR(503)`；文檔與前端錯誤分支不可再使用舊碼 `AI_CALL_FAILED`。
- 前端在 quick 流程多透過 `/cases/:id/judgment` 查判決；`/judgments/:id` 主要用於正式流程詳情頁。
- quick result 頁現以 `GET /streams/case_judgment/:id` 先顯示 AI phase，再於 `stream.persisted` 後拉正式判決內容。
- `repair` / `metrics` 目前為「保留能力」，需維持接口可用但不作前台回歸主路徑。
- `GET /api/v1/judgments/:id` 的權限檢查實際委派到 `getJudgmentByCaseId(case_id)`；`FORBIDDEN` 會在 controller 層轉為 `NOT_FOUND`，用於避免暴露資源存在性。
- case 維度判斷規則與 case 模組一致：`quick`/`collaborative(session_id 有值)` 走 session 校驗；`remote`/`collaborative(session_id=null)` 走當事人 JWT 校驗。
- 判決生成的 `profileContext / caseContext` 注入不得只用 `case.mode === quick` 排除；必須透過 `backend/src/utils/case-classifier.ts` 的產品流口徑判斷。純 quick/session-bound 流程不注入個人/關係上下文；`ChatToCaseLink` 優先於 `case.mode`，chat-to-case 可在有登入當事人與 consent 時走 user-bound context governance。
- normalized judgment 會 additive 回傳 `responsibility_ratio_visibility`（`can_show/reason`），語義來源是 `backend/src/utils/product-safety-policy.ts`。`safety_support / crisis_support` 不應展示責任比例，前端只能做降級呈現；後端暫保留 `plaintiff_ratio/defendant_ratio` 以維持既有契約，不能把字段存在視為可展示。

## 回歸測試最小集

1. submitted case 觸發 generate 成功進入 judgment detail。
2. accept 流程支持 `accepted=true/false` 兩分支。
3. `generate` 在限流與 AI 異常時返回可識別錯誤碼。
4. 候選接口基本健康檢查（schema + auth + 404）保持可用。

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
