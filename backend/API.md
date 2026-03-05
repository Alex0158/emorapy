# 熊媽媽法庭 - Backend API 索引（代碼對齊版）

**文檔版本**：v3.1  
**最後更新**：2026-03-05  
**對齊基準**：`backend/src/app.ts`、`backend/src/routes/*.ts`

---

## 0. SSOT Cross References

- Feature boundary list: `docs/功能特性清單.md`
- Product boundary and flows: `docs/02-產品設計.md`
- Authoritative backend API spec: `docs/後端設計/03-API設計.md`
- Frontend API map: `docs/前端設計/08-接口一覽表.md`

---

## 1. 基本約定

- API Base：`http://localhost:3001/api/v1`
- 健康/指標在根路由：
  - `GET /health`
  - `GET /health/ready`
  - `GET /health/live`
  - `GET /metrics`
- 響應封裝：
  - 成功：`{ success: true, data?, message? }`
  - 失敗：`{ success: false, error: { code, message, details? } }`

---

## 2. 路由分組（快查）

## 2.1 Auth / Sessions

- `/auth/*`
  - register、login、send-verification-code、verify-email、reset-password、reset-password-confirm、claim-session
- `/sessions/*`
  - quick、refresh

## 2.2 User / Profile / Pairing

- `/user/profile` (GET/PUT), `/user/avatar` (POST)
- `/profile/me` (GET/PUT)
- `/profile/relationship/:pairingId` (GET/PUT)
- `/pairing/create|join|status|cancel`

## 2.3 Case / Judgment / Reconciliation / Execution

- `/cases/*`
  - by-session、quick、collaborative、list/create、detail/update/submit、evidence 上傳刪除、case judgment 查詢
- `/judgments/*`
  - generate、detail、accept、repair、metrics
- `/judgments/:id/reconciliation-plans` (POST/GET)
- `/reconciliation-plans/:id` (GET), `/reconciliation-plans/:id/select` (POST)
- `/execution/confirm|checkin|status|dashboard`

## 2.4 Interview / Psych Profile

- `/interview/start|resume|:id|:id/end|:id/retry`
- `/interview/:id/respond` (SSE)
- `/interview/:id/skip` (SSE)
- `/psych-profile` (GET/DELETE)
- `/psych-profile/feedback` (GET)
- `/psych-profile/consent` (POST)

## 2.5 Chat v1

- `/chat/rooms` (POST)
- `/chat/rooms/:roomId` (GET)
- `/chat/rooms/:roomId/invites` (POST)
- `/chat/invites/:inviteCode/accept|decline` (POST)
- `/chat/rooms/:roomId/messages` (GET/POST)
- `/chat/rooms/:roomId/stream` (SSE)
- `/chat/rooms/:roomId/request-judgment` (POST)
- `/chat/rooms/:roomId/judgment-status` (GET)
- `/chat/rooms/:roomId/leave` (POST)
- `/chat/rooms/:roomId/kick-b` (POST)

## 2.6 Content / Notification

- `/content-items` (GET)
- `/content-items/recommendations/:caseId` (GET)
- `/content-links` (POST)
- `/notifications` (GET)

## 2.7 Admin

- 前綴：`/admin/*`
- 公開入口：
  - `/admin/bootstrap`
  - `/admin/login`
- 受保護（admin JWT + 權限守衛）：
  - me, health detailed, jobs/stats/trigger
  - configs
  - app users + status
  - audit logs + csv
  - admin users CRUD
  - reports (overview/funnel/costs/custom + csv)
  - runtime interview config
  - alerts rules
  - feature flags

---

## 3. SSE 事件契約（摘要）

## 訪談 SSE
- `token`
- `metadata`
- `safety_alert`
- `complete`
- `error`

## 聊天 SSE
- `ready`
- `ping`
- `message`
- `invite`
- `room_status`
- `system`（保留）

---

## 4. Metrics 保護

- `METRICS_ENABLED=false` -> `404`
- production 下 `/metrics` 需滿足其一：
  - `X-Metrics-Token` 匹配
  - 來源 IP 在 `METRICS_ALLOWED_IPS`

---

## 5. 權威詳規

字段級契約、認證/限流矩陣與錯誤碼映射，請以以下文件為準：
- `docs/後端設計/03-API設計.md` (authoritative detailed spec)
