# 接口描述：case

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：接口詳規
**覆蓋範圍**：接口字段契約、錯誤碼、守衛與頁面對接：03-case
**取證代碼入口**：`backend/src/app.ts`、`backend/src/routes`、`backend/src/utils/case-classifier.ts`、`frontend/src/services/api`、`frontend-admin/src/services/api`
**最後核驗 Commit**：`a081936`
**最後核驗日期**：`2026-05-03`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v2.4
**最後更新**：2026-05-03
**代碼基準**：`backend/src/routes/case.routes.ts`、`backend/src/controllers/case.controller.ts`、`backend/src/services/case.service.ts`、`backend/src/utils/case-classifier.ts`、`backend/src/utils/validation.ts`

---

## 模組定位

- 管理三種案件模式：`quick`、`collaborative`、正式 `remote`。
- 管理案件核心生命週期與證據檔案。
- 提供 case -> judgment 的查詢橋接接口。

## 接口契約（字段級）


| API                                             | Request（核心字段）                                                           | Success（前端實際用到）                  | 常見錯誤碼                                                  | 副作用/狀態轉移             | 前端入口                              |
| ----------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------ | -------------------- | --------------------------------- |
| `GET /api/v1/cases/by-session`                  | `X-Session-Id`                                                          | `data.case`                      | `SESSION_ID_REQUIRED` `INVALID_SESSION_ID` `SESSION_EXPIRED` `NOT_FOUND` | 無                    | 快速體驗恢復                            |
| `POST /api/v1/cases/quick`                      | `plaintiff_statement(>=30)` `defendant_statement?` `evidence_urls?<=3`  | `data.case` `data.session_id?`   | `VALIDATION_ERROR`                                     | 建立 quick case        | `/quick-experience/create`        |
| `POST /api/v1/cases/collaborative`              | `case_id?` `plaintiff_statement?` `defendant_statement?`                | `data.case` `data.phase`         | `VALIDATION_ERROR` `INVALID_SESSION_ID` `NOT_FOUND` `FORBIDDEN` `SESSION_EXPIRED` `CASE_NOT_EDITABLE` | A/B 輪流續寫同案           | `/quick-experience/collaborative` |
| `POST /api/v1/cases`                            | `pairing_id(uuid)` `plaintiff_statement` `defendant_statement?` `mode?` | `data.case`                      | `VALIDATION_ERROR` `FORBIDDEN`                         | 建立 draft case        | `/case/create`                    |
| `GET /api/v1/cases`                             | query: `status/type/page/page_size/sort/search`                         | `data.cases[]`（含 `product_flow`） `data.pagination` | `UNAUTHORIZED`                                         | 無                    | `/case/list`                      |
| `POST /api/v1/cases/:id/evidence`               | path `id(uuid)` + multipart `files[]`                                   | `data.evidences[]`               | `FILE_TOO_LARGE` `TOO_MANY_FILES` `INVALID_FILE_TYPE` `INVALID_FILE_FIELD` `NOT_FOUND` `UNAUTHORIZED` `FORBIDDEN` `INVALID_SESSION_ID` `SESSION_EXPIRED` `CASE_NOT_EDITABLE` | 寫入 evidence 記錄與文件    | FileUpload、快速結果頁                  |
| `DELETE /api/v1/cases/:id/evidence/:evidenceId` | `id(uuid)` `evidenceId(uuid)`                                           | 成功旗標                             | `NOT_FOUND` `FORBIDDEN` `INVALID_SESSION_ID` `SESSION_EXPIRED`                                | 刪除 evidence 關聯       | FileUpload                        |
| `GET /api/v1/cases/:id/judgment`                | `id(uuid)` + optional `X-Session-Id`                                    | `data.judgment`                  | `JUDGMENT_PENDING` `JUDGMENT_FAILED` `NOT_FOUND` `UNAUTHORIZED` `FORBIDDEN` `INVALID_SESSION_ID` `SESSION_EXPIRED`                | 無                    | 快速結果、判決快捷查詢                       |
| `POST /api/v1/cases/:id/submit`                 | `id(uuid)`                                                              | `data.case.status=submitted`     | `CASE_NOT_EDITABLE` `UNAUTHORIZED`                     | `draft -> submitted` | `/case/:id`                       |
| `PUT /api/v1/cases/:id`                         | `id(uuid)` + 至少 1 字段（title/plaintiff/defendant）                         | `data.case`                      | `CASE_NOT_EDITABLE` `VALIDATION_ERROR`                 | 更新 draft 欄位          | `/case/:id/review`                |
| `GET /api/v1/cases/:id`                         | `id(uuid)` + optional `X-Session-Id`                                    | `data.case`（含 `product_flow`）  | `NOT_FOUND` `UNAUTHORIZED` `FORBIDDEN` `INVALID_SESSION_ID` `SESSION_EXPIRED`                                | 無                    | `/case/:id`、快速結果                  |


## 操作級規則（深水區）

- 路由順序強依賴：具體路由必須先於 `/:id`，否則會發生錯配。
- `validateUuidParam` 用於提前 `next('route')`，避免 `/quick`、`/by-session` 被 UUID 路由吸收。
- 證據接口授權模型為 `optionalAuthenticate + session`，是「匿名與登入共用」高風險鏈路。
- `createQuickCase` / `createCollaborativeCase(phase=submitted)` / `submitCase` 的判決生成均由 controller 以 `setImmediate` 非阻塞觸發；HTTP 成功僅代表提交成功，不等於判決已生成。
- `/cases/:id/judgment` 在前端語義是「可能尚未生成」，`404/特定 code` 需被當成可恢復狀態而非致命錯誤。
- `GET /cases/:id`、`GET /cases/:id/judgment` 的授權判定使用同一條規則：
  - `quick` 與 `collaborative(session_id 有值)`：必須提供匹配的 `session_id`。
  - `remote` 與 `collaborative(session_id=null)`：必須是案件當事人 JWT（`plaintiff_id`/`defendant_id`）。
- `collaborative full-mode` 不再是「一律 session-only」；當 `session_id=null` 時按正式案件權限處理。
- 產品流分類必須使用 `backend/src/utils/case-classifier.ts`，不得只用 `case.mode` 推斷：
  - `quick_single`：`mode=quick` 且沒有 chat-to-case link。
  - `quick_collaborative`：`mode=collaborative` 且 `session_id` 有值。
  - `formal_remote`：`mode=remote`。
  - `formal_collaborative`：`mode=collaborative` 且 `session_id=null`。
  - `chat_to_case`：存在 `ChatToCaseLink` 時優先於 mode。
- User-bound case 查詢範圍固定為 `remote` 或 `collaborative(session_id=null)`；後續 notification、analytics、repair reminder 不得只掃 `mode=remote`。
- `GET /cases` 與 `GET /cases/:id` 已 additive 回傳 `product_flow`，前端、Admin、analytics 若需要產品來源，應優先讀此字段；不得在 UI 端重寫一份 mode 推斷。

## 回歸測試最小集

1. quick case 與正式 case 各建一筆，確認狀態與可見性隔離。
2. draft 允許 `PUT`，submitted 後 `PUT` 必須拒絕。
3. 匿名 session 上傳證據 + 登入上傳證據都可成功。
4. `/cases/:id/judgment` 在 pending 與 ready 兩種狀態下前端行為正確。
5. `collaborative + session_id=null` 案件下，當事人 JWT 讀 `GET /cases/:id` 與 `GET /cases/:id/judgment` 必須通過；匿名或非當事人必須拒絕。
6. notification / repair reminder 應覆蓋 `formal_remote`、`formal_collaborative`、`chat_to_case`，並排除 session-bound quick。
7. `GET /cases` 與 `GET /cases/:id` 對 chat-to-case case 必須返回 `product_flow=chat_to_case`。

## 錯誤碼覆蓋矩陣（API -> code -> UI 行為）


| API                                             | error.code            | HTTP | UI 行為           | 重試策略           |
| ----------------------------------------------- | --------------------- | ---- | --------------- | -------------- |
| `GET /api/v1/cases/by-session`                  | `SESSION_ID_REQUIRED` | 400  | 觸發 session 補建流程 | 建立 session 後重拉 |
| `GET /api/v1/cases/by-session`                  | `INVALID_SESSION_ID`  | 400  | 清理壞 session 並提示 | 刷新 session 後重拉 |
| `GET /api/v1/cases/by-session`                  | `NOT_FOUND`           | 404  | 顯示尚無案件          | 不需自動重試         |
| `POST /api/v1/cases/quick`                      | `VALIDATION_ERROR`    | 400  | 表單字段提示          | 修正後重送          |
| `POST /api/v1/cases/collaborative`              | `SESSION_EXPIRED`     | 401  | 提示匿名會話失效         | 刷新 session 後重送 |
| `POST /api/v1/cases/collaborative`              | `CASE_NOT_EDITABLE`   | 422  | 提示案件已提交不可再續寫      | 返回協作頁刷新狀態      |
| `POST /api/v1/cases`                            | `FORBIDDEN`           | 403  | 顯示配對/權限不足       | 先補前置條件再重送      |
| `POST /api/v1/cases/:id/evidence`               | `FILE_TOO_LARGE`      | 413  | 提示檔案過大          | 更換檔案後重傳        |
| `POST /api/v1/cases/:id/evidence`               | `TOO_MANY_FILES`      | 400  | 提示最多 3 份證據       | 刪減檔案後重傳        |
| `POST /api/v1/cases/:id/evidence`               | `INVALID_FILE_TYPE`   | 400  | 提示格式不支持         | 轉換格式後重傳        |
| `POST /api/v1/cases/:id/evidence`               | `CASE_NOT_EDITABLE`   | 422  | 提示當前狀態不可再上傳       | 回案件頁查看狀態       |
| `DELETE /api/v1/cases/:id/evidence/:evidenceId` | `FORBIDDEN`           | 403  | 顯示無刪除權限         | 切換正確身份/資源      |
| `DELETE /api/v1/cases/:id/evidence/:evidenceId` | `SESSION_EXPIRED`     | 401  | 提示匿名會話已失效        | 刷新 session 後重試   |
| `GET /api/v1/cases/:id/judgment`                | `JUDGMENT_PENDING`    | 202  | 顯示生成中狀態         | 輪詢或手動刷新        |
| `GET /api/v1/cases/:id/judgment`                | `JUDGMENT_FAILED`     | 409  | 顯示生成失敗並提供重試入口     | 觸發重新生成/返回聊天鏈路 |
| `GET /api/v1/cases/:id/judgment`                | `NOT_FOUND`           | 404  | 顯示案件不存在或已移除     | 返回來源頁        |
| `GET /api/v1/cases/:id/judgment`                | `UNAUTHORIZED`        | 401  | 觸發登入流程         | 登入後重試        |
| `GET /api/v1/cases/:id/judgment`                | `FORBIDDEN`           | 403  | 顯示無權訪問該案件判決     | 返回列表頁        |
| `POST /api/v1/cases/:id/submit`                 | `CASE_NOT_EDITABLE`   | 422  | 顯示當前狀態不可提交      | 回案件頁查看狀態       |
| `PUT /api/v1/cases/:id`                         | `CASE_NOT_EDITABLE`   | 422  | 切換頁面為唯讀模式       | 不重試編輯          |
| `GET /api/v1/cases/:id`                         | `UNAUTHORIZED`        | 401  | 觸發登入流程         | 登入後重試          |
| `GET /api/v1/cases/:id`                         | `FORBIDDEN`           | 403  | 顯示無權訪問該案件       | 返回列表頁          |


## 狀態標記

- 本模組接口狀態：全部 `已使用`。
