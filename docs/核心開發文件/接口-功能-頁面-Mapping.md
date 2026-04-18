# CJ 接口-功能-頁面 Mapping（核心版）

**文檔版本**：v1.8  
**最後更新**：2026-04-05  
**目標**：把 API -> 功能 -> 頁面 -> 流程節點建立可回歸的單點追溯。

---

## 映射規則

- API 主鍵為 `METHOD + PATH`。
- 一條 API 可映射多個頁面（多場景），但每個場景需落到明確流程節點。
- `狀態` 與 `全接口清單-主文檔` 保持一致（已使用/候選廢棄）。
- 前台「完成度」以 `功能特性清單.md` 的口徑為準（`已完成/跨功能依賴/待驗證`），不覆蓋 API 狀態欄。
- `F01-F10` 為主功能；`F11-F14` 僅作候選/平台能力附錄索引。
- 風險等級：
  - `H`：跨多場景、涉及身份/狀態遷移/SSE/文件。
  - `M`：單場景核心功能。
  - `L`：候選或輔助能力。

## 全量映射主表

| API | 功能ID | 主要頁面 | 流程節點 | 風險 | 狀態 |
|---|---|---|---|---|---|
| `POST /api/v1/sessions/quick` | F01 | `/quick-experience/create` | 快速體驗起始 | H | 已使用 |
| `POST /api/v1/sessions/refresh` | F01 | `/quick-experience/*` | Session 續期 | H | 已使用 |
| `POST /api/v1/auth/claim-session` | F01/F09 | 登入後隱式 | quick case 升格 | H | 已使用 |
| `POST /api/v1/cases/quick` | F01 | `/quick-experience/create` | 匿名建案 | H | 已使用 |
| `POST /api/v1/cases/collaborative` | F02 | `/quick-experience/collaborative` | A/B 輪流提交流程 | H | 已使用 |
| `GET /api/v1/cases/by-session` | F01 | `/quick-experience/create` | 回收歷史 quick case | M | 已使用 |
| `GET /api/v1/cases/:id` | F01/F03 | `/quick-experience/result/:id`、`/case/:id` | 案件讀取 | H | 已使用 |
| `GET /api/v1/profile/me` | F09 | `/profile/index` | 個人背景資料讀取 | M | 已使用 |
| `PUT /api/v1/profile/me` | F09 | `/profile/index` | 個人背景資料更新 | M | 已使用 |
| `POST /api/v1/cases` | F03 | `/case/create` | 正式建案 | H | 已使用 |
| `PUT /api/v1/cases/:id` | F03 | `/case/:id/review` | 案件修訂 | M | 已使用 |
| `POST /api/v1/cases/:id/submit` | F03 | `/case/:id` | draft -> submitted | H | 已使用 |
| `GET /api/v1/cases` | F03 | `/case/list` | 列表查詢 | M | 已使用 |
| `POST /api/v1/cases/:id/evidence` | F01/F03/F05 | `/quick-experience/*`、`/case/create`、`/execution/:planId/checkin` | 證據上傳 | H | 已使用 |
| `DELETE /api/v1/cases/:id/evidence/:evidenceId` | F03 | 證據組件 | 證據刪除 | M | 已使用 |
| `GET /api/v1/cases/:id/judgment` | F01/F02 | `/quick-experience/result/:id` | 結果頁判決查詢（F02 透過導頁跨功能依賴） | H | 已使用 |
| `GET /api/v1/streams/case_judgment/:id` | F01/F04 | `/quick-experience/result/:id` | 判決 phase 流與 persisted handoff | H | 已使用 |
| `POST /api/v1/judgments/generate/:id` | F04 | `/case/:id/review` | 判決生成（formal review） | H | 已使用 |
| `GET /api/v1/judgments/:id` | F04 | `/judgment/:id` | 判決展示（純登入後消費） | M | 已使用 |
| `POST /api/v1/judgments/:id/accept` | F04 | `/judgment/:id` | 判決接受/拒絕 | M | 已使用 |
| `POST /api/v1/judgments/:id/repair` | F12 | （無） | 聯盟修復 | L | 候選廢棄 |
| `POST /api/v1/judgments/:id/metrics` | F12 | （無） | 臨床品質回寫 | L | 候選廢棄 |
| `POST /api/v1/judgments/:id/reconciliation-plans` | F05 | `/reconciliation/:judgmentId` | 生成 Repair Journey 方案 bundle | H | 已使用 |
| `GET /api/v1/judgments/:id/reconciliation-plans` | F05 | `/reconciliation/:judgmentId` | 方案 bundle / 旅程入口狀態 | M | 已使用 |
| `GET /api/v1/reconciliation-plans/:id` | F05 | `/reconciliation/:judgmentId/:id` | 方案詳情 / 共同承諾工作台 | M | 已使用 |
| `POST /api/v1/reconciliation-plans/:id/select` | F05 | `/reconciliation/:judgmentId/:id` | 當前用戶承諾（兼容入口） | H | 已使用 |
| `POST /api/v1/reconciliation-plans/:id/respond` | F05 | `/reconciliation/:judgmentId/:id` | invitee viewed / accept / defer / decline / pause | H | 已使用 |
| `GET /api/v1/reconciliation-plans/:id/commitment` | F05 | `/reconciliation/:judgmentId/:id` | 承諾狀態查詢 | M | 已使用 |
| `POST /api/v1/reconciliation-plans/:id/invite` | F05 | `/reconciliation/:judgmentId/:id` | 邀請對方共修 | H | 已使用 |
| `POST /api/v1/reconciliation-plans/:id/pause` | F05 | `/reconciliation/:judgmentId/:id` | 暫停旅程（兼容入口） | M | 已使用 |
| `POST /api/v1/execution/confirm` | F05 | `/reconciliation/:judgmentId/:id` | 啟動今天的一小步 | M | 已使用 |
| `POST /api/v1/execution/checkin` | F05 | `/execution/:planId/checkin` | 每日脈搏回報 / 觸發重調 | H | 已使用 |
| `GET /api/v1/execution/status` | F05 | `/execution/:planId/checkin`、`/execution/:planId/replan` | 單方案修復旅程狀態 + `journey_context` + CTA hints | H | 已使用 |
| `POST /api/v1/repair-tracks/:id/replan` | F05 | `/execution/:planId/replan` | AI 異步旅程重調 / 降壓降速 / 單人先行 | H | 已使用 |
| `GET /api/v1/streams/repair_track/:id` | F05 | `/execution/:planId/replan` | AI 重調等待 / phase / replay / recovering | H | 已使用 |
| `POST /api/v1/repair-tracks/:id/resume` | F05 | `/execution/dashboard`、`/reconciliation/:judgmentId/:id` | 恢復暫停旅程 | M | 已使用 |
| `GET /api/v1/execution/dashboard` | F05 | `/execution/dashboard` | 修復進展看板 + `presentation_bucket` + 下一步 CTA | M | 已使用 |
| `POST /api/v1/interview/start` | F06 | `/profile/index`、`/profile/my-story`、`/profile/pairing`（F08 主責頁之 F06 次責入口） | 啟動訪談 | H | 已使用 |
| `POST /api/v1/interview/:id/respond` | F06 | `/interview/:sessionId` | 提交回答並啟動 AI 任務 | H | 已使用 |
| `POST /api/v1/interview/:id/skip` | F06 | `/interview/:sessionId` | 跳題並啟動 AI 任務 | H | 已使用 |
| `POST /api/v1/interview/:id/cancel` | F06 | `/interview/:sessionId` | 中止進行中的 AI 任務 | M | 已使用 |
| `GET /api/v1/streams/interview_session/:id` | F06 | `AI stream 統一鏈路` | 訪談 AI stream snapshot / replay | M | 已使用 |
| `POST /api/v1/interview/:id/end` | F06 | `/interview/:sessionId` | 結束訪談 | M | 已使用 |
| `GET /api/v1/interview/resume` | F06/F08 | `/profile/index`、`/profile/my-story`、`/profile/pairing` | 恢復檢查 | M | 已使用 |
| `GET /api/v1/interview/:id` | F06 | `/interview/:sessionId`、`/interview/:sessionId/result` | 訪談詳情/結果讀取 | M | 已使用 |
| `POST /api/v1/interview/:id/retry` | F06 | `/profile/my-story`、`/interview/:sessionId/result` | 重試失敗流水線 | M | 已使用 |
| `GET /api/v1/psych-profile` | F06 | `/profile/my-story`、`/judgment/:id`、`/case/create` | 心理畫像讀取 | M | 已使用 |
| `GET /api/v1/psych-profile/feedback` | F06 | `/profile/my-story` | 回饋歷史 | M | 已使用 |
| `POST /api/v1/psych-profile/consent` | F06 | `/profile/index`、`/profile/my-story` | 同意授權 | H | 已使用 |
| `DELETE /api/v1/psych-profile` | F06 | `/profile/my-story` | 刪除心理資料 | M | 已使用 |
| `POST /api/v1/chat/rooms` | F07 | `/chat/room` | 建房 | H | 已使用 |
| `GET /api/v1/chat/rooms/:roomId` | F07 | `/chat/room/:roomId` | 房間讀取 | H | 已使用 |
| `POST /api/v1/chat/rooms/:roomId/invites` | F07 | `/chat/room/:roomId` | 建邀請碼（需 `canonical session_id` 匹配 owner session） | H | 已使用 |
| `POST /api/v1/chat/invites/:inviteCode/accept` | F07 | `/chat/room` | 接受邀請（User only） | H | 已使用 |
| `POST /api/v1/chat/invites/:inviteCode/decline` | F07 | `/chat/room` | 拒絕邀請 | M | 已使用 |
| `GET /api/v1/chat/rooms/:roomId/stream` | F07 | `/chat/room/:roomId` | SSE 事件流 | H | 已使用 |
| `GET /api/v1/streams/chat_room/:roomId` | F07 | `/chat/room/:roomId` | Chat AI 草稿/完成/落庫主鏈路 | H | 已使用 |
| `GET /api/v1/chat/rooms/:roomId/messages` | F07 | `/chat/room/:roomId` | 歷史訊息 | M | 已使用 |
| `POST /api/v1/chat/rooms/:roomId/messages` | F07 | `/chat/room/:roomId` | 發送訊息 | H | 已使用 |
| `POST /api/v1/chat/rooms/:roomId/request-judgment` | F07 | `/chat/room/:roomId` | 聊天轉判決 request | H | 已使用 |
| `GET /api/v1/chat/rooms/:roomId/judgment-status` | F07/F04 | `/chat/room/:roomId`、`/judgment/:id`(承接) | 判決狀態與 handoff（未登入先導 auth 回跳） | M | 已使用 |
| `POST /api/v1/chat/rooms/:roomId/leave` | F07 | `/chat/room/:roomId` | B 方離房 | M | 已使用 |
| `POST /api/v1/chat/rooms/:roomId/kick-b` | F07 | `/chat/room/:roomId` | A 方踢人 | M | 已使用 |
| `POST /api/v1/pairing/create` | F08 | `/profile/pairing` | 創邀請碼 | M | 已使用 |
| `POST /api/v1/pairing/join` | F08 | `/profile/pairing` | 加入配對 | M | 已使用 |
| `GET /api/v1/pairing/status` | F08/F03 | `/profile/pairing`、`/case/create` | 查配對 | M | 已使用 |
| `POST /api/v1/pairing/cancel` | F08 | `/profile/pairing` | 解除配對 | M | 已使用 |
| `GET /api/v1/profile/relationship/:pairingId` | F08 | `/profile/pairing`（配對成功態） | 關係背景讀取 | M | 已使用 |
| `PUT /api/v1/profile/relationship/:pairingId` | F08 | `/profile/pairing`（配對成功態） | 關係背景更新 | M | 已使用 |
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
| `GET /api/v1/notifications` | F13 | `/notifications` | 通知列表 / repair journey actionable+snoozed inbox | M | 已使用 |
| `GET /api/v1/notifications/unread-count` | F13 | Header bell | 通知未讀數 | M | 已使用 |
| `POST /api/v1/notifications/read-all` | F13 | `/notifications` | 全部標記已讀 | L | 已使用 |
| `POST /api/v1/notifications/:id/read` | F13 | `/notifications` | 單條已讀 | L | 已使用 |
| `POST /api/v1/notifications/:id/dismiss` | F13 | `/notifications` | 封存較早/歷史通知 | L | 已使用 |
| `POST /api/v1/notifications/:id/snooze` | F13 | `/notifications` | 稍後提醒 repair journey actionable 通知 | M | 已使用 |
| `POST /api/v1/notifications/:id/act` | F13 | `/notifications` | 執行 CTA + 深鏈回旅程 | H | 已使用 |
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
| `GET /api/v1/admin/health/detailed` | F10 | `/admin/health` | 詳細健康 | M | 已使用 |
| `GET /api/v1/admin/jobs` | F10 | `/admin/jobs` | 任務列表 | M | 已使用 |
| `GET /api/v1/admin/reports/overview` | F10 | `/admin/reports` | 總覽報表 | M | 已使用 |
| `GET /api/v1/admin/reports/funnel` | F10 | `/admin/reports` | 漏斗報表 | M | 已使用 |
| `GET /api/v1/admin/reports/costs` | F10 | `/admin/reports` | 成本報表 | M | 已使用 |
| `GET /api/v1/admin/reports/ai-streams` | F10 | `/admin/reports` | AI Stream 治理報表 | L | 已使用 |
| `GET /api/v1/admin/reports/ai-streams/sessions` | F10 | `/admin/reports` | AI Stream Session 明細 | L | 已使用 |
| `GET /api/v1/admin/reports/ai-streams/sessions/:streamId` | F10 | `/admin/reports` | AI Stream 詳情 | L | 已使用 |
| `GET /api/v1/admin/runtime/interview` | F10 | `/admin/settings` | 訪談運行參數 | L | 已使用 |
| `GET /api/v1/admin/reports/overview.csv` | F10 | `/admin/reports` | 報表下載 | M | 已使用 |
| `POST /api/v1/admin/reports/custom` | F10 | `/admin/reports` | 客製報表 | M | 已使用 |
| `GET /api/v1/version` | F14 | `frontend` Header、`frontend-admin` AdminSectionLayout | 版本面板（三端版本顯示，部署驗證） | L | 已使用 |
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

## 前台完成度補丁表（對齊功能特性清單 v3.0）

| API | 功能ID | API 狀態（主註冊） | 前台完成度（功能清單） | 修訂說明 | 取證 |
|---|---|---|---|---|---|
| `POST /api/v1/sessions/refresh` | F01 | 已使用 | 已完成 | session 恢復已升級為 F01 正式映射，不再只存在於例外敘述 | `services/api/session.ts`、`sessionStore` |
| `POST /api/v1/auth/claim-session` | F01/F09 | 已使用 | 跨功能依賴 | quick 升格由 F09 auth 成功態承接，功能歸屬改為共用後置流程 | `authStore.ts` |
| `GET /api/v1/cases/:id/judgment` | F02 | 已使用 | 跨功能依賴 | 協作頁只負責提交與導頁，判決查詢在 result 頁執行 | `pages/QuickExperience/Collaborative`、`pages/QuickExperience/Result` |
| `GET /api/v1/interview/:id` | F06 | 已使用 | 已完成 | 訪談結果頁已納入 F06 正式承接，不再只記聊天頁讀取 | `pages/Interview/Chat`、`pages/Interview/Result` |
| `POST /api/v1/interview/start` | F06 | 已使用 | 已完成 | `/profile/pairing` 已正式納入 F08 主責頁上的 F06 次責入口 | `pages/Profile/Pairing`、`services/api/interview.ts` |
| `GET /api/v1/reconciliation-plans/:id` | F05 | 已使用 | 已完成 | 打卡流程先取 `judgment.case_id`，再進照片上傳與 checkin | `pages/Execution/CheckIn` |
| `POST /api/v1/cases/:id/evidence` | F05 | 已使用 | 已完成 | 打卡照片上傳實際調用 case evidence 接口 | `pages/Execution/CheckIn`、`services/api/case.ts` |
| `GET /api/v1/profile/relationship/:pairingId` | F08 | 已使用 | 已完成 | `/profile/pairing` 已在配對成功態接入讀取流程 | `frontend/src/services/api/profile.ts`、`frontend/src/pages/Profile/Pairing` |
| `PUT /api/v1/profile/relationship/:pairingId` | F08 | 已使用 | 已完成 | `/profile/pairing` 已接入保存與回顯流程 | `frontend/src/services/api/profile.ts`、`frontend/src/pages/Profile/Pairing` |
| `POST /api/v1/chat/rooms/:roomId/invites` | F07 | 已使用 | 已完成 | 匿名 owner 仍需 `room.session_id` 與當前 `canonical session_id` 匹配才可建立 invite | `pages/Chat/Room`、`chat-flow` E2E 補丁 |
| `GET /api/v1/chat/rooms/:roomId/judgment-status` | F07/F04 | 已使用 | 跨功能依賴 | chat 僅負責 judgment ready handoff；正式 judgment 消費由 F04 登入鏈路承接 | `pages/Chat/Room`、`pages/Judgment/Detail` |
| `GET /api/v1/user/profile` | F09 | 已使用 | 已完成 | `/profile/settings` 已明確納入 F09 頁面責任 | `pages/Profile/Settings` |
| `GET /api/v1/admin/health/detailed` | F10 | 已使用 | 已完成 | admin health 已明確納入 F10 子域 | `frontend-admin/src/pages/Admin/Health` |

## 追溯閉環檢查

- API -> 功能：見本文件 `功能ID` 欄。
- 功能 -> 頁面：見 `功能特性清單.md` 的「頁面 × API 小功能點」。
- 頁面 -> 路由守衛：見 `頁面清單.md`。守衛與直連行為（未登入強制跳轉、admin 無 token 重定向）以 `頁面清單.md` 與 `02-用戶端核心流程/00-用戶端核心流程總覽.md` 為準。
- 流程 -> API：見 `業務流程整合.md`（下一文檔）。
