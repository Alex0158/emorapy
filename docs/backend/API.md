# 熊媽媽法庭 - docs/backend/API（代碼對齊快查）

**文檔版本**：v3.1  
**最後更新**：2026-03-05  
**對齊基準**：`backend/src/app.ts`、`backend/src/routes/*.ts`  
**說明**：本文件為 docs 目錄內快查鏡像，與 `backend/API.md` 同步。

---

## 0. 關聯 SSOT（導航）

- 功能邊界主清單：`docs/功能特性清單.md`
- 產品流程與邊界：`docs/02-產品設計.md`
- 後端 API 權威詳規：`docs/後端設計/03-API設計.md`
- 前端接口主文檔：`docs/前端設計/08-接口一覽表.md`

---

## 1. Base 與基礎端點

- API Base：`http://localhost:3001/api/v1`
- 健康檢查：`/health`、`/health/ready`、`/health/live`
- 指標：`/metrics`（production 需 token 或白名單 IP）

---

## 2. 路由清單（快查）

## Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/send-verification-code`
- `POST /auth/verify-email`
- `POST /auth/reset-password`
- `POST /auth/reset-password-confirm`
- `POST /auth/claim-session`

## Sessions
- `POST /sessions/quick`
- `POST /sessions/refresh`

## User / Profile / Pairing
- `GET|PUT /user/profile`
- `POST /user/avatar`
- `GET|PUT /profile/me`
- `GET|PUT /profile/relationship/:pairingId`
- `POST /pairing/create`
- `POST /pairing/join`
- `GET /pairing/status`
- `POST /pairing/cancel`

## Cases
- `GET /cases/by-session`
- `POST /cases/quick`
- `POST /cases/collaborative`
- `POST /cases`
- `GET /cases`
- `POST /cases/:id/evidence`
- `DELETE /cases/:id/evidence/:evidenceId`
- `GET /cases/:id/judgment`
- `POST /cases/:id/submit`
- `PUT /cases/:id`
- `GET /cases/:id`

## Judgments
- `POST /judgments/generate/:id`
- `GET /judgments/:id`
- `POST /judgments/:id/accept`
- `POST /judgments/:id/repair`
- `POST /judgments/:id/metrics`

## Reconciliation / Execution
- `POST /judgments/:id/reconciliation-plans`
- `GET /judgments/:id/reconciliation-plans`
- `GET /reconciliation-plans/:id`
- `POST /reconciliation-plans/:id/select`
- `POST /execution/confirm`
- `POST /execution/checkin`
- `GET /execution/status`
- `GET /execution/dashboard`

## Content / Notification
- `GET /content-items`
- `GET /content-items/recommendations/:caseId`
- `POST /content-links`
- `GET /notifications`

## Interview / Psych Profile
- `POST /interview/start`
- `POST /interview/:id/respond`（SSE）
- `POST /interview/:id/skip`（SSE）
- `POST /interview/:id/end`
- `GET /interview/resume`
- `GET /interview/:id`
- `POST /interview/:id/retry`
- `GET /psych-profile`
- `GET /psych-profile/feedback`
- `POST /psych-profile/consent`
- `DELETE /psych-profile`

## Chat
- `POST /chat/rooms`
- `GET /chat/rooms/:roomId`
- `POST /chat/rooms/:roomId/invites`
- `POST /chat/invites/:inviteCode/accept`
- `POST /chat/invites/:inviteCode/decline`
- `GET /chat/rooms/:roomId/stream`（SSE）
- `GET /chat/rooms/:roomId/messages`
- `POST /chat/rooms/:roomId/messages`
- `POST /chat/rooms/:roomId/request-judgment`
- `GET /chat/rooms/:roomId/judgment-status`
- `POST /chat/rooms/:roomId/leave`
- `POST /chat/rooms/:roomId/kick-b`

## Admin（`/admin/*`）
- bootstrap/login/me
- health detailed
- jobs/list/stats/trigger
- configs
- users/status
- audit logs + csv
- admin users CRUD
- reports（overview/funnel/costs/custom + csv）
- runtime interview config
- alerts rules
- feature flags

---

## 3. SSE 事件（快查）

## 訪談
- `token`
- `metadata`
- `safety_alert`
- `complete`
- `error`

## 聊天
- `ready`
- `ping`
- `message`
- `invite`
- `room_status`
- `system`（保留）

---

## 4. 權威詳規

字段級契約、認證/限流矩陣、錯誤碼映射請以：
- `docs/後端設計/03-API設計.md`

為準。
