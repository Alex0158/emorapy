# 後端設計：API 設計（代碼對齊）

> **文檔分級說明（2026-03-05 起）**  
> 本文件為二級映射文檔；接口一級權威改為 `docs/核心開發文件/全接口清單-主文檔.md` 與 `docs/核心開發文件/接口描述/`。

**文檔版本**：v3.3  
**最後更新**：2026-03-09  
**對齊基準**：`backend/src/app.ts`、`backend/src/routes/*.ts`、`backend/src/middleware/*`

---

## 0. 關聯 SSOT（導航）

- 功能邊界主清單：`docs/核心開發文件/功能特性清單.md`
- 接口一級權威：`docs/核心開發文件/全接口清單-主文檔.md`、`docs/核心開發文件/接口描述/`
- 產品流程與邊界：`docs/核心開發文件/業務流程整合.md`
- 前端接口主文檔：`docs/前端設計/08-接口一覽表.md`
- 後端 API 快查：`docs/backend/API.md`

---

## 1. 全域契約

- API 前綴：`/api/v1`
- 成功格式：`{ success: true, data?, message? }`
- 失敗格式：`{ success: false, error: { code, message, details? } }`

認證模式：
- `authenticate`：用戶 JWT
- `optionalAuthenticate`：JWT 可選，常配合 `X-Session-Id`
- `authenticateAdmin`：管理員 JWT
- `claim-session` 為 auth 成功後的弱依賴後置流程，失敗不應推翻登入/註冊成功態。

---

## 2. 路由矩陣（方法 + 認證 + 主要限制）

## 2.1 Auth（`/auth`）

- `POST /register`（public，`registerLimiter`，schema）
- `POST /login`（public，`authLimiter`，schema）
- `POST /send-verification-code`（public，`verificationCodeLimiter`，schema）
- `POST /verify-email`（public，`verifyCodeLimiter`，schema）
- `POST /reset-password`（public，`resetPasswordLimiter`，schema）
- `POST /reset-password-confirm`（public，`resetConfirmLimiter`，schema）
- `POST /claim-session`（JWT，schema）

## 2.2 Sessions（`/sessions`）

- `POST /quick`（public，`generalLimiter`）
- `POST /refresh`（public，`generalLimiter`）

## 2.3 User / Profile / Pairing

- `GET /user/profile`（JWT，`generalLimiter`）
- `PUT /user/profile`（JWT，`generalLimiter`，schema）
- `POST /user/avatar`（JWT，`generalLimiter`，上傳鏈）
- `GET /profile/me`（JWT，`generalLimiter`）
- `PUT /profile/me`（JWT，`generalLimiter`，schema）
- `GET /profile/relationship/:pairingId`（JWT，`generalLimiter`，schema）
- `PUT /profile/relationship/:pairingId`（JWT，`generalLimiter`，schema）
- `POST /pairing/create`（JWT，`generalLimiter`，schema）
- `POST /pairing/join`（JWT，`pairingJoinLimiter`，schema）
- `GET /pairing/status`（JWT，`generalLimiter`）
- `POST /pairing/cancel`（JWT，`generalLimiter`）

## 2.4 Cases（`/cases`）

- `GET /by-session`（public，`generalLimiter`，`validateSession`）
- `POST /quick`（optional auth，`generalLimiter`，schema）
- `POST /collaborative`（optional auth，`generalLimiter`，schema）
- `POST /`（JWT，`generalLimiter`，schema）
- `GET /`（JWT，`generalLimiter`）
- `POST /:id/evidence`（optional auth，`uploadLimiter`，UUID + schema）
- `DELETE /:id/evidence/:evidenceId`（optional auth，`generalLimiter`，UUID + schema）
- `GET /:id/judgment`（optional auth，`generalLimiter`，UUID + schema）
- `POST /:id/submit`（JWT，`generalLimiter`，UUID + schema）
- `PUT /:id`（JWT，`generalLimiter`，UUID + schema）
- `GET /:id`（optional auth，`generalLimiter`，UUID + schema）

## 2.5 Judgments（`/judgments`）

- `POST /generate/:id`（optional auth，`aiLimiter`，UUID schema）
- `GET /:id`（optional auth，`generalLimiter`，UUID schema）
- `POST /:id/accept`（JWT，`generalLimiter`，UUID + payload schema）
- `POST /:id/repair`（optional auth，`generalLimiter`，UUID + payload schema）
- `POST /:id/metrics`（optional auth，`generalLimiter`，UUID + payload schema）

## 2.6 Reconciliation（掛載於 `/api/v1`）

- `POST /judgments/:id/reconciliation-plans`（JWT，`aiLimiter`，schema）
- `GET /judgments/:id/reconciliation-plans`（JWT，`generalLimiter`，schema）
- `GET /reconciliation-plans/:id`（JWT，`generalLimiter`，schema）
- `POST /reconciliation-plans/:id/select`（JWT，`generalLimiter`，schema）

## 2.7 Execution（`/execution`）

- `POST /confirm`（JWT，`generalLimiter`，schema）
- `POST /checkin`（JWT，`generalLimiter`，schema）
- `GET /status`（JWT，`generalLimiter`，schema）
- `GET /dashboard`（JWT，`generalLimiter`）

## 2.8 Content / Notification（掛載於 `/api/v1`）

- `GET /content-items`（public，`generalLimiter`）
- `GET /content-items/recommendations/:caseId`（optional auth，`generalLimiter`，schema）
- `POST /content-links`（JWT，`generalLimiter`，schema）
- `GET /notifications`（JWT，`generalLimiter`）

## 2.9 Interview / Psych Profile

- `POST /interview/start`（JWT + `requireConsent`，`interviewStartLimiter`，schema）
- `POST /interview/:id/respond`（JWT + `requireConsent`，`interviewRespondLimiter`，schema，SSE）
- `POST /interview/:id/skip`（JWT + `requireConsent`，`interviewRespondLimiter`，schema，SSE）
- `POST /interview/:id/end`（JWT + `requireConsent`，schema）
- `GET /interview/resume`（JWT + `requireConsent`）
- `GET /interview/:id`（JWT + `requireConsent`，schema）
- `POST /interview/:id/retry`（JWT + `requireConsent`，schema）
- `GET /psych-profile`（JWT）
- `GET /psych-profile/feedback`（JWT）
- `POST /psych-profile/consent`（JWT）
- `DELETE /psych-profile`（JWT）

## 2.10 Chat（`/chat`）

- `POST /rooms`（optional auth，`generalLimiter`，schema）
- `GET /rooms/:roomId`（optional auth，`generalLimiter`，schema）
- `POST /rooms/:roomId/invites`（optional auth，`generalLimiter`，schema）
- `POST /invites/:inviteCode/accept`（optional auth，`generalLimiter`，schema）
- `POST /invites/:inviteCode/decline`（optional auth，`generalLimiter`，schema）
- `GET /rooms/:roomId/stream`（optional auth，`generalLimiter`，schema，SSE）
- `GET /rooms/:roomId/messages`（optional auth，`generalLimiter`，schema）
- `POST /rooms/:roomId/messages`（optional auth，`generalLimiter`，schema）
- `POST /rooms/:roomId/request-judgment`（optional auth，`generalLimiter`，schema）
- `GET /rooms/:roomId/judgment-status`（optional auth，`generalLimiter`，schema）
- `POST /rooms/:roomId/leave`（optional auth，`generalLimiter`，schema）
- `POST /rooms/:roomId/kick-b`（optional auth，`generalLimiter`，schema）

補充規則：
- chat 接口中，房間讀寫仍可由 `User/Session` 視權限承接，但 `accept invite` 已收斂為 `User only`。
- 匿名 A 房主建立 invite 時，需以 `room.session_id` 與當前 `canonical session_id` 一致作為 owner 判定前提。
- `GET /rooms/:roomId/judgment-status` 僅負責 handoff；正式 judgment 詳情消費由登入後鏈路承接。

## 2.11 Admin（`/admin`）

公開：
- `POST /bootstrap`
- `POST /login`

其餘需 `authenticateAdmin` + 權限：
- me、health detailed
- jobs/list/stats/trigger
- configs
- users/detail/status
- audit logs + csv
- admin users CRUD
- reports（overview/funnel/costs/custom + csv）
- runtime interview config
- alerts rules
- feature flags

## 2.12 Health / Metrics（根路由）

- `GET /health`
- `GET /health/ready`
- `GET /health/live`
- `GET /metrics`

`/metrics`：
- `METRICS_ENABLED=false` -> 404
- production 需 token 或白名單 IP

---

## 3. SSE 事件契約

## 訪談 SSE（respond/skip）

- `token`
- `metadata`
- `safety_alert`
- `complete`
- `error`

## 聊天 SSE（stream）

- `ready`
- `ping`
- `message`
- `invite`
- `room_status`
- `system`（保留）

---

## 4. 常見錯誤碼（高頻）

- `UNAUTHORIZED`、`FORBIDDEN`、`NOT_FOUND`
- `VALIDATION_ERROR`
- `RATE_LIMIT_EXCEEDED`
- `CONSENT_REQUIRED`
- `SESSION_ID_REQUIRED` / `INVALID_SESSION_ID` / `SESSION_EXPIRED`
- `MAX_TURNS_REACHED` / `TURN_TOO_FAST`
- `CASE_NOT_READY`
- `CONCURRENT_REQUEST`

---

## 5. 維護規則

路由或契約變更時，至少同步：
1. `backend/src/routes/*.ts`  
2. 本文件  
3. `docs/前端設計/08-接口一覽表.md`  
4. `docs/核心開發文件/功能特性清單.md`（若能力邊界改變）  
