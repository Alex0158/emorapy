# 接口描述：content + notification

**文檔版本**：v2.1  
**最後更新**：2026-03-05  
**代碼基準**：`backend/src/routes/content.routes.ts`、`backend/src/routes/notification.routes.ts`、`frontend/src/services/api/content.ts`

---

## 模組定位

- `content` 提供知識內容與提示文案（目前前台僅使用 list）。
- `notification` 為保留接口，待通知中心頁落地後接線。

## 接口契約（字段級）

| API | Request（核心字段） | Success（前端實際用到） | 常見錯誤碼 | 副作用/狀態轉移 | 前端入口 |
|---|---|---|---|---|---|
| `GET /api/v1/content-items` | query `type?` `language?` `limit?` | `data.items[]` | `VALIDATION_ERROR` | 無 | `/quick-experience/result/:id` |
| `GET /api/v1/content-items/recommendations/:caseId` | `caseId(uuid)` | `data.items[]`（保留） | `NOT_FOUND` `FORBIDDEN` | 無 | （候選，未接線） |
| `POST /api/v1/content-links` | `case_id(uuid)` `content_id(uuid)` `relation?` | `data.link`（保留） | `VALIDATION_ERROR` `UNAUTHORIZED` | 建立 case-content 關聯 | （候選，未接線） |
| `GET /api/v1/notifications` | JWT header | `data.notifications[]`（保留） | `UNAUTHORIZED` | 無 | （候選，未接線） |

## 操作級規則（深水區）

- `content-items` 是目前唯一實際接線內容接口，失敗時前端降級為不顯示推薦區塊，不阻斷主流程。
- `recommendations/content-links` 與 `notifications` 均應保留健康性，但不納入前台回歸必測主路徑。

## 回歸測試最小集

1. 快速結果頁 `content-items` 正常渲染與語言切換。  
2. 候選接口 schema/auth 基礎可用性檢查（防止漂移壞死）。  

## 錯誤碼覆蓋矩陣（API -> code -> UI 行為）

| API | error.code | HTTP | UI 行為 | 重試策略 |
|---|---|---:|---|---|
| `GET /api/v1/content-items` | `VALIDATION_ERROR` | 400 | 忽略非法 query，回退到預設篩選 | 修正 query 後重拉 |
| `GET /api/v1/content-items/recommendations/:caseId` | `NOT_FOUND` | 404 | 顯示「暫無推薦」而非錯誤頁 | 不需重試 |
| `GET /api/v1/content-items/recommendations/:caseId` | `FORBIDDEN` | 403 | 顯示無權查看推薦 | 返回上游頁 |
| `POST /api/v1/content-links` | `VALIDATION_ERROR` | 400 | 提示關聯字段錯誤 | 修正後重送 |
| `POST /api/v1/content-links` | `UNAUTHORIZED` | 401 | 導向登入 | 登入後重送 |
| `GET /api/v1/notifications` | `UNAUTHORIZED` | 401 | 清 token 並導登入 | 登入後重拉 |

## 狀態標記

- 已使用：1
- 候選廢棄：3
