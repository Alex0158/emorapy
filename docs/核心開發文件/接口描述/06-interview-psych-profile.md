# 接口描述：interview + psych-profile

**文檔版本**：v2.1  
**最後更新**：2026-03-05  
**代碼基準**：`backend/src/routes/interview.routes.ts`、`backend/src/services/interview.service.ts`、`frontend/src/store/interviewStore.ts`、`frontend/src/services/sseRequest.ts`

---

## 模組定位

- 訪談會話 + SSE 流式回覆 + 非同步心理畫像流水線。
- 以 consent 為入口閘門，並具回合與頻率雙重治理。

## 接口契約（字段級）

| API | Request（核心字段） | Success（前端實際用到） | 常見錯誤碼 | 副作用/狀態轉移 | 前端入口 |
|---|---|---|---|---|---|
| `POST /api/v1/interview/start` | `trigger?`（organic/pre_case/post_judgment/onboarding） | `data.session.id` `data.turns[0].ai_message` | `CONSENT_REQUIRED` `RATE_LIMIT_EXCEEDED` | 建立 session + 首輪問題 | `/profile/index` 等 |
| `POST /api/v1/interview/:id/respond`（SSE） | `message(1..2000)` | token stream + metadata + complete | `TURN_TOO_FAST` `MAX_TURNS_REACHED` `CONCURRENT_REQUEST` | 寫入 user turn + AI turn | `/interview/:sessionId` |
| `POST /api/v1/interview/:id/skip`（SSE） | 空 body | 同上（跳題分支） | 同 respond | 寫入 skipped turn | `/interview/:sessionId` |
| `POST /api/v1/interview/:id/end` | `id(uuid)` | 成功旗標 | `SESSION_COMPLETED` `NOT_FOUND` | `IN_PROGRESS -> COMPLETED/PROCESSING` | `/interview/:sessionId` |
| `GET /api/v1/interview/resume` | 無 | `has_pending` `session_id` `has_failed` | `UNAUTHORIZED` | 無 | profile / my-story |
| `GET /api/v1/interview/:id` | `id(uuid)` | `data.session` + `turns[]` | `NOT_FOUND` | 無 | 訪談頁恢復 |
| `POST /api/v1/interview/:id/retry` | `id(uuid)` | 成功旗標 | `VALIDATION_ERROR`（非 failed 狀態） | `PROCESSING_FAILED -> PROCESSING` | `/profile/my-story` |
| `GET /api/v1/psych-profile` | 無 | `data.profile` | `UNAUTHORIZED` | 無 | `/profile/my-story`、判決前置讀取 |
| `GET /api/v1/psych-profile/feedback` | 無 | `data.feedbacks[]` | `CONSENT_REQUIRED` | 無 | `/profile/my-story` |
| `POST /api/v1/psych-profile/consent` | 無 | 成功旗標 | `UNAUTHORIZED` | 設定 consent=true | Profile 入口 |
| `DELETE /api/v1/psych-profile` | 無 | 成功旗標 | `CONSENT_REQUIRED` | 清空心理資料 | `/profile/my-story` |

## 操作級規則（深水區）

- `start` 的限額採「實質 session」統計（至少 3 turns）以降低誤封鎖。
- `respond` 在後端以 lock 保護並發；前端 SSE 有首 token 與連線總超時雙保護。
- `end` 依內容充分度決定是否進 pipeline，非所有結束都會產生畫像更新。
- 安全協議（safety flag）會透過 metadata/safety_alert 事件回傳前端。

## 回歸測試最小集

1. consent=false 時 `start` 必須拒絕。  
2. `respond` 連續快速提交觸發 `TURN_TOO_FAST`。  
3. SSE 斷線後前端能進入可恢復態（resume）。  
4. `PROCESSING_FAILED` 可經 `retry` 回到處理中。  
5. delete psych-profile 後 profile 與 feedback 均清空。  

## 錯誤碼覆蓋矩陣（API -> code -> UI 行為）

| API | error.code | HTTP | UI 行為 | 重試策略 |
|---|---|---:|---|---|
| `POST /api/v1/interview/start` | `CONSENT_REQUIRED` | 403 | 顯示 consent 引導彈窗 | 完成 consent 後重試 |
| `POST /api/v1/interview/start` | `START_RATE_LIMIT` / `RATE_LIMIT_EXCEEDED` | 429 | 顯示啟動過頻提示 | 冷卻後重試 |
| `POST /api/v1/interview/:id/respond` | `TURN_TOO_FAST` | 429 | 顯示節流倒數，保留輸入內容 | 倒數後重送 |
| `POST /api/v1/interview/:id/respond` | `MAX_TURNS_REACHED` | 422 | 顯示達上限並引導結束訪談 | 改走 end 流程 |
| `POST /api/v1/interview/:id/respond` | `CONCURRENT_REQUEST` | 409 | 提示已有進行中請求 | 等待 SSE complete 後重送 |
| `POST /api/v1/interview/:id/end` | `SESSION_COMPLETED` | 409 | 顯示已結束並導向結果頁 | 不重試 end |
| `GET /api/v1/interview/:id` | `NOT_FOUND` | 404 | 顯示訪談不存在 | 返回 profile 入口 |
| `POST /api/v1/interview/:id/retry` | `VALIDATION_ERROR` | 400 | 提示目前狀態不可 retry | 先確認 session 狀態 |
| `GET /api/v1/psych-profile/feedback` | `CONSENT_REQUIRED` | 403 | 顯示需授權提示 | 完成 consent 後重拉 |
| `DELETE /api/v1/psych-profile` | `CONSENT_REQUIRED` | 403 | 提示未授權刪除 | 完成 consent 後重試 |
| `GET /api/v1/psych-profile` | `PROCESSING_NOT_DONE` | 409 | 顯示處理中狀態，不報致命錯誤 | 輪詢或手動刷新 |
| `GET /api/v1/psych-profile` | `PROCESSING_FAILED` | 500 | 顯示失敗狀態與 retry 入口 | 執行 interview retry |

## 狀態標記

- 本模組接口狀態：全部 `已使用`。
