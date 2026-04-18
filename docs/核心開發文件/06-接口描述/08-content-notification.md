# 接口描述：content + notification

**文檔版本**：v2.4  
**最後更新**：2026-04-05  
**代碼基準**：`backend/src/routes/content.routes.ts`、`backend/src/routes/notification.routes.ts`、`backend/src/services/notification.service.ts`、`frontend/src/services/api/content.ts`、`frontend/src/services/api/notifications.ts`

---

## 模組定位

- `content` 提供知識內容與提示文案（目前前台僅使用 list）。
- `notification` 已升級為通知中心主鏈路，承接 repair journey 的再進場、邀請回應、replan ready、resume 等狀態驅動通知。

## 接口契約（字段級）

| API | Request（核心字段） | Success（前端實際用到） | 常見錯誤碼 | 副作用/狀態轉移 | 前端入口 |
|---|---|---|---|---|---|
| `GET /api/v1/content-items` | query `type?` `language?` `limit?` | `data.items[]` | `VALIDATION_ERROR` | 無 | `/quick-experience/result/:id` |
| `GET /api/v1/content-items/recommendations/:caseId` | `caseId(uuid)` | `data.items[]`（保留） | `NOT_FOUND` `FORBIDDEN` | 無 | （候選，未接線） |
| `POST /api/v1/content-links` | `case_id(uuid)` `content_id(uuid)` `relation?` | `data.link`（保留） | `VALIDATION_ERROR` `UNAUTHORIZED` | 建立 case-content 關聯 | （候選，未接線） |
| `GET /api/v1/notifications` | query `state?` `status?` `template_code?` `limit?` `cursor?` | `data.notifications[]` `data.next_cursor` `data.has_more` | `UNAUTHORIZED` `VALIDATION_ERROR` | 無 | `/notifications` |
| `GET /api/v1/notifications/unread-count` | JWT header | `data.unread_count` | `UNAUTHORIZED` | 無 | Header bell badge |
| `POST /api/v1/notifications/:id/read` | `id(uuid)` | `data.notification` | `UNAUTHORIZED` `NOT_FOUND` | 補 `read_at` | `/notifications` |
| `POST /api/v1/notifications/read-all` | JWT header | `data.updatedCount` `data.readAt` | `UNAUTHORIZED` | 批量補 `read_at` | `/notifications` |
| `POST /api/v1/notifications/:id/dismiss` | `id(uuid)` | `data.notification` | `UNAUTHORIZED` `NOT_FOUND` | 補 `dismissed_at`，同時保證已讀 | `/notifications` |
| `POST /api/v1/notifications/:id/snooze` | `id(uuid)` `hours?` | `data.notification` | `UNAUTHORIZED` `NOT_FOUND` | 補 `snoozed_until`，暫時退出 actionable 區 | `/notifications` |
| `POST /api/v1/notifications/:id/act` | `id(uuid)` `action_key?` | `data.notification` `data.target{path,action_key,entity_type,entity_id}` | `UNAUTHORIZED` `NOT_FOUND` | 補 `acted_at`，返回深鏈目標 | `/notifications` |

## 操作級規則（深水區）

- `content-items` 是目前唯一實際接線內容接口，失敗時前端降級為不顯示推薦區塊，不阻斷主流程。
- `notifications` 現已是前台主流程的一部分：
  - Header bell 只拉 `unread-count`
  - `/notifications` 頁拉可分區列表，支持 `actionable / unread / snoozed / archived`
  - `act` 返回標準 deep-link target，前端不再依模板自行猜測跳頁
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
| `GET /api/v1/content-items` | `VALIDATION_ERROR` | 400 | 忽略非法 query，回退到預設篩選 | 修正 query 後重拉 |
| `GET /api/v1/content-items/recommendations/:caseId` | `NOT_FOUND` | 404 | 顯示「暫無推薦」而非錯誤頁 | 不需重試 |
| `GET /api/v1/content-items/recommendations/:caseId` | `FORBIDDEN` | 403 | 顯示無權查看推薦 | 返回上游頁 |
| `POST /api/v1/content-links` | `VALIDATION_ERROR` | 400 | 提示關聯字段錯誤 | 修正後重送 |
| `POST /api/v1/content-links` | `UNAUTHORIZED` | 401 | 導向登入 | 登入後重送 |
| `GET /api/v1/notifications` | `UNAUTHORIZED` | 401 | 清 token 並導登入 | 登入後重拉 |
| `GET /api/v1/notifications/unread-count` | `UNAUTHORIZED` | 401 | Header bell 降級為不顯示未讀數，不阻塞導航 | 登入後重拉 |
| `POST /api/v1/notifications/:id/read` | `NOT_FOUND` | 404 | 提示通知已不存在，從列表移除或重拉 | 重新拉列表 |
| `POST /api/v1/notifications/:id/snooze` | `NOT_FOUND` | 404 | 提示通知已失效，保守回退列表刷新 | 重新拉列表 |
| `POST /api/v1/notifications/:id/act` | `NOT_FOUND` | 404 | 提示通知已失效，阻止跳頁 | 重新拉列表 |

## 狀態標記

- 已使用：6
- 候選廢棄：2
