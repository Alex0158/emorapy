# CJ 接口-功能-頁面 Mapping（核心版）

**文檔版本**：v1.1  
**最後更新**：2026-03-05  
**目標**：把 API -> 功能 -> 頁面 -> 流程節點建立可回歸的單點追溯。

---

## 映射規則

- API 主鍵為 `METHOD + PATH`。
- 一條 API 可映射多個頁面（多場景），但每個場景需落到明確流程節點。
- `狀態` 與 `全接口清單-主文檔` 保持一致（已使用/候選廢棄）。
- 前台「完成度」以 `功能特性清單.md` 的口徑為準（`已完成/跨功能依賴/待驗證`），不覆蓋 API 狀態欄。
- 風險等級：
  - `H`：跨多場景、涉及身份/狀態遷移/SSE/文件。
  - `M`：單場景核心功能。
  - `L`：候選或輔助能力。

## 全量映射主表

| API | 功能ID | 主要頁面 | 流程節點 | 風險 | 狀態 |
|---|---|---|---|---|---|
| `POST /api/v1/sessions/quick` | F01 | `/quick-experience/create` | 快速體驗起始 | H | 已使用 |
| `POST /api/v1/sessions/refresh` | F01 | `/quick-experience/*` | Session 續期 | H | 已使用 |
| `POST /api/v1/auth/claim-session` | F01/F09 | 登入後隱式 | 快速案件升格 | H | 已使用 |
| `POST /api/v1/cases/quick` | F01 | `/quick-experience/create` | 匿名建案 | H | 已使用 |
| `POST /api/v1/cases/collaborative` | F02 | `/quick-experience/collaborative` | A/B 輪流提交流程 | H | 已使用 |
| `GET /api/v1/cases/by-session` | F01 | `/quick-experience/create` | 回收歷史 quick case | M | 已使用 |
| `GET /api/v1/cases/:id` | F01/F03 | `/quick-experience/result/:id`、`/case/:id` | 案件讀取 | H | 已使用 |
| `POST /api/v1/cases` | F03 | `/case/create` | 正式建案 | H | 已使用 |
| `PUT /api/v1/cases/:id` | F03 | `/case/:id/review` | 案件修訂 | M | 已使用 |
| `POST /api/v1/cases/:id/submit` | F03 | `/case/:id` | draft -> submitted | H | 已使用 |
| `GET /api/v1/cases` | F03 | `/case/list` | 列表查詢 | M | 已使用 |
| `POST /api/v1/cases/:id/evidence` | F01/F03/F05 | `/quick-experience/*`、`/case/create`、`/execution/:planId/checkin` | 證據上傳 | H | 已使用 |
| `DELETE /api/v1/cases/:id/evidence/:evidenceId` | F03 | 證據組件 | 證據刪除 | M | 已使用 |
| `GET /api/v1/cases/:id/judgment` | F01/F02 | `/quick-experience/result/:id` | 結果頁判決查詢（F02 透過導頁跨功能依賴） | H | 已使用 |
| `POST /api/v1/judgments/generate/:id` | F04/F07 | `/case/:id/review`、`/chat/room/:roomId`(間接) | 判決生成 | H | 已使用 |
| `GET /api/v1/judgments/:id` | F04 | `/judgment/:id` | 判決展示 | M | 已使用 |
| `POST /api/v1/judgments/:id/accept` | F04 | `/judgment/:id` | 判決接受/拒絕 | M | 已使用 |
| `POST /api/v1/judgments/:id/repair` | F12 | （無） | 聯盟修復 | L | 候選廢棄 |
| `POST /api/v1/judgments/:id/metrics` | F12 | （無） | 臨床品質回寫 | L | 候選廢棄 |
| `POST /api/v1/judgments/:id/reconciliation-plans` | F05 | `/reconciliation/:judgmentId` | 生成和好方案 | H | 已使用 |
| `GET /api/v1/judgments/:id/reconciliation-plans` | F05 | `/reconciliation/:judgmentId` | 方案列表 | M | 已使用 |
| `GET /api/v1/reconciliation-plans/:id` | F05 | `/reconciliation/:judgmentId/:id` | 方案詳情 | M | 已使用 |
| `POST /api/v1/reconciliation-plans/:id/select` | F05 | `/reconciliation/:judgmentId/:id` | 方案選擇 | H | 已使用 |
| `POST /api/v1/execution/confirm` | F05 | `/reconciliation/:judgmentId/:id` | 執行啟動 | M | 已使用 |
| `POST /api/v1/execution/checkin` | F05 | `/execution/:planId/checkin` | 執行打卡 | M | 已使用 |
| `GET /api/v1/execution/status` | F05 | `/execution/:planId/checkin` | 單方案進度 | M | 已使用 |
| `GET /api/v1/execution/dashboard` | F05 | `/execution/dashboard` | 全局看板 | M | 已使用 |
| `POST /api/v1/interview/start` | F06 | `/profile/index`、`/profile/my-story`、`/profile/pairing` | 啟動訪談 | H | 已使用 |
| `POST /api/v1/interview/:id/respond` | F06 | `/interview/:sessionId` | SSE 回答 | H | 已使用 |
| `POST /api/v1/interview/:id/skip` | F06 | `/interview/:sessionId` | SSE 跳題 | H | 已使用 |
| `POST /api/v1/interview/:id/end` | F06 | `/interview/:sessionId` | 結束訪談 | M | 已使用 |
| `GET /api/v1/interview/resume` | F06/F08 | `/profile/index`、`/profile/my-story`、`/profile/pairing` | 恢復檢查 | M | 已使用 |
| `GET /api/v1/interview/:id` | F06 | `/interview/:sessionId` | 訪談詳情 | M | 已使用 |
| `POST /api/v1/interview/:id/retry` | F06 | `/profile/my-story`、`/interview/:sessionId/result` | 重試失敗流水線 | M | 已使用 |
| `GET /api/v1/psych-profile` | F06 | `/profile/my-story`、`/judgment/:id`、`/case/create` | 心理畫像讀取 | M | 已使用 |
| `GET /api/v1/psych-profile/feedback` | F06 | `/profile/my-story` | 回饋歷史 | M | 已使用 |
| `POST /api/v1/psych-profile/consent` | F06 | `/profile/index`、`/profile/my-story` | 同意授權 | H | 已使用 |
| `DELETE /api/v1/psych-profile` | F06 | `/profile/my-story` | 刪除心理資料 | M | 已使用 |
| `POST /api/v1/chat/rooms` | F07 | `/chat/room` | 建房 | H | 已使用 |
| `GET /api/v1/chat/rooms/:roomId` | F07 | `/chat/room/:roomId` | 房間讀取 | H | 已使用 |
| `POST /api/v1/chat/rooms/:roomId/invites` | F07 | `/chat/room/:roomId` | 建邀請碼 | H | 已使用 |
| `POST /api/v1/chat/invites/:inviteCode/accept` | F07 | `/chat/room` | 接受邀請 | H | 已使用 |
| `POST /api/v1/chat/invites/:inviteCode/decline` | F07 | `/chat/room` | 拒絕邀請 | M | 已使用 |
| `GET /api/v1/chat/rooms/:roomId/stream` | F07 | `/chat/room/:roomId` | SSE 事件流 | H | 已使用 |
| `GET /api/v1/chat/rooms/:roomId/messages` | F07 | `/chat/room/:roomId` | 歷史訊息 | M | 已使用 |
| `POST /api/v1/chat/rooms/:roomId/messages` | F07 | `/chat/room/:roomId` | 發送訊息 | H | 已使用 |
| `POST /api/v1/chat/rooms/:roomId/request-judgment` | F07/F04 | `/chat/room/:roomId` | 聊天轉判決 | H | 已使用 |
| `GET /api/v1/chat/rooms/:roomId/judgment-status` | F07 | `/chat/room/:roomId` | 判決狀態 | M | 已使用 |
| `POST /api/v1/chat/rooms/:roomId/leave` | F07 | `/chat/room/:roomId` | B 方離房 | M | 已使用 |
| `POST /api/v1/chat/rooms/:roomId/kick-b` | F07 | `/chat/room/:roomId` | A 方踢人 | M | 已使用 |
| `POST /api/v1/pairing/create` | F08 | `/profile/pairing` | 創邀請碼 | M | 已使用 |
| `POST /api/v1/pairing/join` | F08 | `/profile/pairing` | 加入配對 | M | 已使用 |
| `GET /api/v1/pairing/status` | F08/F03 | `/profile/pairing`、`/case/create` | 查配對 | M | 已使用 |
| `POST /api/v1/pairing/cancel` | F08 | `/profile/pairing` | 解除配對 | M | 已使用 |
| `GET /api/v1/profile/relationship/:pairingId` | F08 | 配對後頁面流程（待驗證） | 關係背景讀取 | L | 已使用 |
| `PUT /api/v1/profile/relationship/:pairingId` | F08 | 配對後頁面流程（待驗證） | 關係背景更新 | L | 已使用 |
| `POST /api/v1/auth/register` | F09 | `/auth/register` | 註冊 | M | 已使用 |
| `POST /api/v1/auth/login` | F09 | `/auth/login` | 登入 | H | 已使用 |
| `POST /api/v1/auth/send-verification-code` | F09 | `/auth/*` | 驗證碼發送 | M | 已使用 |
| `POST /api/v1/auth/verify-email` | F09 | `/auth/*` | 驗證碼校驗 | M | 已使用 |
| `POST /api/v1/auth/reset-password` | F09 | `/auth/forgot-password` | 發起重置 | M | 已使用 |
| `POST /api/v1/auth/reset-password-confirm` | F09 | `/auth/forgot-password` | 完成重置 | M | 已使用 |
| `GET /api/v1/user/profile` | F09 | `/profile/index`、`/profile/settings` | 個資讀取 | M | 已使用 |
| `PUT /api/v1/user/profile` | F09 | `/profile/settings` | 個資更新 | M | 已使用 |
| `POST /api/v1/user/avatar` | F09 | `/profile/index` | 頭像上傳 | M | 已使用 |
| `GET /api/v1/content-items` | F01 | `/quick-experience/result/:id` | 推薦內容 | L | 已使用 |
| `GET /api/v1/content-items/recommendations/:caseId` | F11 | （無） | 案件內容推薦 | L | 候選廢棄 |
| `POST /api/v1/content-links` | F11 | （無） | 內容關聯寫入 | L | 候選廢棄 |
| `GET /api/v1/notifications` | F13 | （無） | 通知列表 | L | 候選廢棄 |
| `POST /api/v1/admin/login` | F10 | `/admin/login` | Admin 登入 | M | 已使用 |
| `GET /api/v1/admin/me` | F10 | `/admin/*` | Admin 身份恢復 | M | 已使用 |
| `GET /api/v1/admin/jobs/stats` | F10 | `/admin/ops/jobs` | 任務統計 | M | 已使用 |
| `POST /api/v1/admin/jobs/:jobKey/trigger` | F10 | `/admin/jobs` | 任務觸發 | M | 已使用 |
| `GET /api/v1/admin/configs` | F10 | `/admin/configs`、`/admin/settings` | 配置讀取 | M | 已使用 |
| `PUT /api/v1/admin/configs` | F10 | `/admin/configs` | 配置更新 | M | 已使用 |
| `GET /api/v1/admin/users` | F10 | `/admin/users` | 用戶列表 | M | 已使用 |
| `GET /api/v1/admin/users/:userId` | F10 | `/admin/users` | 用戶詳情 | M | 已使用 |
| `PATCH /api/v1/admin/users/:userId/status` | F10 | `/admin/users` | 用戶治理 | M | 已使用 |
| `GET /api/v1/admin/audit-logs` | F10 | `/admin/audit-logs` | 稽核查詢 | M | 已使用 |
| `GET /api/v1/admin/audit-logs.csv` | F10 | `/admin/audit-logs` | 稽核下載 | M | 已使用 |
| `GET /api/v1/admin/admin-users` | F10 | `/admin/settings` | 管理員列表 | M | 已使用 |
| `POST /api/v1/admin/admin-users` | F10 | `/admin/settings` | 建立管理員 | M | 已使用 |
| `PATCH /api/v1/admin/admin-users/:adminUserId` | F10 | `/admin/settings` | 更新管理員 | M | 已使用 |
| `DELETE /api/v1/admin/admin-users/:adminUserId` | F10 | `/admin/settings` | 刪除管理員 | M | 已使用 |
| `PUT /api/v1/admin/alerts/rules` | F10 | `/admin/settings` | 告警規則 | M | 已使用 |
| `PUT /api/v1/admin/feature-flags` | F10 | `/admin/settings` | 功能旗標 | M | 已使用 |
| `POST /api/v1/admin/bootstrap` | F10 | （無） | 初始 admin 建立 | L | 候選廢棄 |
| `GET /api/v1/admin/health/detailed` | F10 | （無） | 詳細健康 | L | 候選廢棄 |
| `GET /api/v1/admin/jobs` | F10 | （無） | 任務列表 | L | 候選廢棄 |
| `GET /api/v1/admin/reports/overview` | F10 | （無） | 總覽報表 | L | 候選廢棄 |
| `GET /api/v1/admin/reports/funnel` | F10 | （無） | 漏斗報表 | L | 候選廢棄 |
| `GET /api/v1/admin/reports/costs` | F10 | （無） | 成本報表 | L | 候選廢棄 |
| `GET /api/v1/admin/runtime/interview` | F10 | （無） | 訪談運行參數 | L | 候選廢棄 |
| `GET /api/v1/admin/reports/overview.csv` | F10 | `/admin/reports` | 報表下載 | M | 已使用 |
| `POST /api/v1/admin/reports/custom` | F10 | `/admin/reports` | 客製報表 | M | 已使用 |
| `GET /health` | F14 | （監控） | 聚合健康探針 | L | 候選廢棄 |
| `GET /health/ready` | F14 | （監控） | 就緒探針 | L | 候選廢棄 |
| `GET /health/live` | F14 | （監控） | 存活探針 | L | 候選廢棄 |
| `GET /metrics` | F14 | （監控） | 指標導出 | L | 候選廢棄 |

## 一 API 多場景（高風險回歸）

| API | 場景A | 場景B | 風險點 | 最小回歸案例 |
|---|---|---|---|---|
| `POST /api/v1/cases/:id/evidence` | 快速體驗建案後補證據 | 正式案件建案後補證據/執行打卡補圖 | JWT 與 Session 雙憑證、文件大小與 MIME | 匿名 + 登入各上傳一次並可讀取 |
| `GET /api/v1/cases/:id` | 快速結果頁 | 正式案件詳情頁 | `X-Session-Id` 覆蓋與 404 分支處理 | 同 caseId 在兩種身份下讀取 |
| `POST /api/v1/interview/start` | Profile 首次引導 | My Story 二次進入 | consent 判斷 + 每日/每小時限額 | consent 前後與超額回應 |
| `POST /api/v1/chat/rooms/:roomId/request-judgment` | A 方首次發起 | 重複點擊/網路重送 | 房間鎖、冪等、狀態競態 | 連續點擊僅生成一次 case |
| `POST /api/v1/auth/claim-session` | 註冊後關聯 | 登入後關聯 | 失敗不應阻斷 auth 主流程 | 模擬 claim 失敗仍可登入 |
| `GET /api/v1/admin/configs` | Config 頁讀取 | Settings 頁同時讀取 | 多頁並發 + token 狀態 | 雙頁同時請求結果一致 |

## 前台完成度補丁表（對齊功能特性清單 v2.1）

| API | 功能ID | API 狀態（主註冊） | 前台完成度（功能清單） | 修訂說明 | 取證 |
|---|---|---|---|---|---|
| `GET /api/v1/cases/:id/judgment` | F02 | 已使用 | 跨功能依賴 | 協作頁只負責提交與導頁，判決查詢在 result 頁執行 | `pages/QuickExperience/Collaborative`、`pages/QuickExperience/Result` |
| `GET /api/v1/reconciliation-plans/:id` | F05 | 已使用 | 已完成 | 打卡流程先取 `judgment.case_id`，再進照片上傳與 checkin | `pages/Execution/CheckIn` |
| `POST /api/v1/cases/:id/evidence` | F05 | 已使用 | 已完成 | 打卡照片上傳實際調用 case evidence 接口 | `pages/Execution/CheckIn`、`services/api/case.ts` |
| `GET /api/v1/profile/relationship/:pairingId` | F08 | 已使用 | 待驗證 | 後端可用，但前台主流程未檢出明確調用點 | 前端檢索 `rg "/profile/relationship"` 無命中 |
| `PUT /api/v1/profile/relationship/:pairingId` | F08 | 已使用 | 待驗證 | 同上，暫不宣稱前台已完成 | 前端檢索 `rg "/profile/relationship"` 無命中 |

## 追溯閉環檢查

- API -> 功能：見本文件 `功能ID` 欄。
- 功能 -> 頁面：見 `功能特性清單.md` 的「頁面 × API 小功能點」。
- 頁面 -> 路由守衛：見 `頁面清單.md`。
- 流程 -> API：見 `業務流程整合.md`（下一文檔）。
