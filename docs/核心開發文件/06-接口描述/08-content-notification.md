# 接口描述：content + notification

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：接口詳規
**覆蓋範圍**：接口字段契約、錯誤碼、守衛與頁面對接：08-content-notification
**取證代碼入口**：`backend/src/app.ts`、`backend/src/routes`、`frontend/src/services/api`、`frontend-admin/src/services/api`
**最後核驗 Commit**：`9e8ae87`
**最後核驗日期**：`2026-04-18`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v2.5  
**最後更新**：2026-04-18  
**代碼基準**：`backend/src/routes/content.routes.ts`、`backend/src/routes/notification.routes.ts`、`backend/src/controllers/content.controller.ts`、`backend/src/controllers/notification.controller.ts`、`backend/src/services/content.service.ts`、`backend/src/services/notification.service.ts`、`backend/src/utils/validation.ts`、`frontend/src/services/api/content.ts`、`frontend/src/services/api/notifications.ts`

---

## 模組定位

- `content` 提供知識內容與提示文案（目前前台僅使用 list）。
- `notification` 已升級為通知中心主鏈路，承接 repair journey 的再進場、邀請回應、replan ready、resume 等狀態驅動通知。

## 接口契約（字段級）

| API | Request（核心字段） | Success（前端實際用到） | 常見錯誤碼 | 副作用/狀態轉移 | 前端入口 |
|---|---|---|---|---|---|
| `GET /api/v1/content-items` | query `type?` `tags?` `language?` `is_active?` `limit?` | `data.items[]` | （通常無固定業務錯誤碼） | 無 | `/quick-experience/result/:id` |
| `GET /api/v1/content-items/recommendations/:caseId` | `caseId(uuid)` query `relation?` | `data.items[]`（`caseContentLink + content`） | `VALIDATION_ERROR` `NOT_FOUND` `FORBIDDEN` `UNAUTHORIZED` `SESSION_EXPIRED` | 無 | （候選，未接線） |
| `POST /api/v1/content-links` | `case_id(uuid)` `content_id(uuid)` `relation?` | `data.link`（upsert） | `VALIDATION_ERROR` `UNAUTHORIZED` `FORBIDDEN` `NOT_FOUND` | 建立/覆蓋 case-content 關聯 | （候選，未接線） |
| `GET /api/v1/notifications` | query `state?` `status?` `template_code?` `limit?` `cursor?` | `data.notifications[]` `data.next_cursor` `data.has_more` | `UNAUTHORIZED` `VALIDATION_ERROR` | 無 | `/notifications` |
| `GET /api/v1/notifications/unread-count` | JWT header | `data.unread_count` | `UNAUTHORIZED` | 無 | Header bell badge |
| `POST /api/v1/notifications` | `channel(email|push)` `template_code` `payload?` `dedup_key?` `action_key?` `priority?` `group_key?` | `data.notification` | `UNAUTHORIZED` `VALIDATION_ERROR` | 建立單條通知（系統/運維保留入口） | （候選，無前台直接入口） |
| `POST /api/v1/notifications/:id/read` | `id(uuid)` | `data.notification` | `UNAUTHORIZED` `VALIDATION_ERROR` `NOT_FOUND` | 補 `read_at` | `/notifications` |
| `POST /api/v1/notifications/read-all` | JWT header | `data.updatedCount` `data.readAt` | `UNAUTHORIZED` | 批量補 `read_at` | `/notifications` |
| `POST /api/v1/notifications/:id/dismiss` | `id(uuid)` | `data.notification` | `UNAUTHORIZED` `VALIDATION_ERROR` `NOT_FOUND` | 補 `dismissed_at`，同時保證已讀 | `/notifications` |
| `POST /api/v1/notifications/:id/snooze` | `id(uuid)` `hours?(1..168)` | `data.notification` | `UNAUTHORIZED` `VALIDATION_ERROR` `NOT_FOUND` | 補 `snoozed_until`，暫時退出 actionable 區 | `/notifications` |
| `POST /api/v1/notifications/:id/act` | `id(uuid)` `action_key?` | `data.notification` `data.target{path,action_key,entity_type,entity_id}` | `UNAUTHORIZED` `VALIDATION_ERROR` `NOT_FOUND` | 補 `acted_at`，返回深鏈目標 | `/notifications` |

## 操作級規則（深水區）

- `content-items` 是目前唯一實際接線內容接口，失敗時前端降級為不顯示推薦區塊，不阻斷主流程。
- `content-items/recommendations/:caseId` 為候選接口，但授權不獨立定義：直接複用 `caseService.getCaseById` 的 mode 分流（session-bound vs 當事人 JWT）。
- `notifications` 現已是前台主流程的一部分：
  - Header bell 只拉 `unread-count`
  - `/notifications` 頁拉可分區列表，支持 `actionable / unread / snoozed / archived`
  - `act` 返回標準 deep-link target，前端不再依模板自行猜測跳頁
- `POST /api/v1/notifications` 仍保留為系統/運維創建入口，前台不直接調用；其渲染內容主要來自 `payload` 而非 top-level `title/body/path` 字段。
- `GET /api/v1/notifications` 的 `cursor` 為 `notification.id(uuid)`；分頁不是時間戳游標。
- `GET /api/v1/notifications/unread-count` 只統計「未讀 + 未dismiss + snooze到期或未snooze」的通知。
- repair journey 通知 payload 應帶：
  - `title/body/path/cta_label`
  - `entity_type/entity_id`
  - `journey_status`
  - `track_id/plan_id/judgment_id`
  - `priority/group_key/snoozed_until`
  - `journey_context`
  - `partner_state/reason_code`

## 通知 DTO 補充

- `NotificationItem`
  - `priority`
  - `group_key`
  - `snoozed_until`
  - `journey_context`
- `render_payload`
  - `priority`
  - `partner_state`
  - `reason_code`

## 回歸測試最小集

1. 快速結果頁 `content-items` 正常渲染與語言切換。  
2. Header bell 讀取 `unread-count`，登入態能正確顯示未讀數。  
3. `/notifications` 能完成 `read / read-all / dismiss / snooze / act` 操作並深鏈回旅程。  

## 錯誤碼覆蓋矩陣（API -> code -> UI 行為）

| API | error.code | HTTP | UI 行為 | 重試策略 |
|---|---|---:|---|---|
| `GET /api/v1/content-items` | （通常無固定業務錯誤碼） | - | 失敗時不渲染推薦區塊，不阻斷主流程 | 手動刷新頁面 |
| `GET /api/v1/content-items/recommendations/:caseId` | `VALIDATION_ERROR` | 400 | caseId 格式錯誤，提示參數錯誤 | 修正 caseId 後重試 |
| `GET /api/v1/content-items/recommendations/:caseId` | `NOT_FOUND` | 404 | 顯示「暫無推薦」而非錯誤頁 | 不需重試 |
| `GET /api/v1/content-items/recommendations/:caseId` | `FORBIDDEN` | 403 | 顯示無權查看推薦 | 返回上游頁 |
| `GET /api/v1/content-items/recommendations/:caseId` | `UNAUTHORIZED` | 401 | 提示需登入後查看 | 登入後重試 |
| `GET /api/v1/content-items/recommendations/:caseId` | `SESSION_EXPIRED` | 401 | 提示匿名會話失效 | 先刷新 session |
| `POST /api/v1/content-links` | `VALIDATION_ERROR` | 400 | 提示關聯字段錯誤 | 修正後重送 |
| `POST /api/v1/content-links` | `UNAUTHORIZED` | 401 | 導向登入 | 登入後重送 |
| `POST /api/v1/content-links` | `FORBIDDEN` | 403 | 提示無權關聯該案件 | 返回上游頁 |
| `POST /api/v1/content-links` | `NOT_FOUND` | 404 | 案件或內容不存在 | 刷新數據後重試 |
| `GET /api/v1/notifications` | `UNAUTHORIZED` | 401 | 清 token 並導登入 | 登入後重拉 |
| `GET /api/v1/notifications` | `VALIDATION_ERROR` | 400 | query 不合法，提示篩選條件錯誤 | 修正篩選後重拉 |
| `GET /api/v1/notifications/unread-count` | `UNAUTHORIZED` | 401 | Header bell 降級為不顯示未讀數，不阻塞導航 | 登入後重拉 |
| `POST /api/v1/notifications` | `VALIDATION_ERROR` | 400 | channel/template/payload 不合法 | 修正後重送 |
| `POST /api/v1/notifications/:id/read` | `NOT_FOUND` | 404 | 提示通知已不存在，從列表移除或重拉 | 重新拉列表 |
| `POST /api/v1/notifications/:id/read` | `VALIDATION_ERROR` | 400 | 通知ID格式錯誤 | 修正後重試 |
| `POST /api/v1/notifications/:id/snooze` | `NOT_FOUND` | 404 | 提示通知已失效，保守回退列表刷新 | 重新拉列表 |
| `POST /api/v1/notifications/:id/snooze` | `VALIDATION_ERROR` | 400 | 小時或通知ID不合法 | 修正後重試 |
| `POST /api/v1/notifications/:id/act` | `NOT_FOUND` | 404 | 提示通知已失效，阻止跳頁 | 重新拉列表 |
| `POST /api/v1/notifications/:id/act` | `VALIDATION_ERROR` | 400 | 通知ID或 action_key 不合法 | 修正後重試 |

## 狀態標記

- 已使用：8
- 候選廢棄：3
