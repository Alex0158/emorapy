# 接口描述：user + profile + pairing

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：接口詳規
**覆蓋範圍**：接口字段契約、錯誤碼、守衛與頁面對接：02-user-profile-pairing
**取證代碼入口**：`backend/src/app.ts`、`backend/src/routes/user.routes.ts`、`backend/src/routes/profile.routes.ts`、`backend/src/routes/pairing.routes.ts`、`backend/src/services/pairing.service.ts`、`backend/src/services/auth.service.ts`、`backend/src/services/session.service.ts`、`backend/src/jobs/cleanup.job.ts`、`backend/src/utils/pairing-invariant.ts`、`packages/api-client/src/m4.ts`、`frontend/src/services/api/pairing.ts`、`frontend/src/pages/Profile/Pairing`、`frontend/src/pages/Case/Create`、`mobile/app/(app)/case/index.tsx`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v2.6
**最後更新**：2026-05-31
**代碼基準**：`backend/src/routes/user.routes.ts`、`backend/src/routes/profile.routes.ts`、`backend/src/routes/pairing.routes.ts`、`backend/src/services/pairing.service.ts`、`backend/src/jobs/cleanup.job.ts`、`backend/src/utils/pairing-invariant.ts`、`backend/src/utils/validation.ts`、`packages/api-client/src/m4.ts`

---

## 模組定位

- `user`：帳號層資料（暱稱、偏好、頭像）。
- `profile`：心理/關係上下文資料容器，供判決與訪談擴展。
- `pairing`：雙方配對與邀請碼生命周期管理。

## 接口契約（字段級）


| API                                           | Request（核心字段）                                          | Success（前端實際用到）                 | 常見錯誤碼                                               | 副作用/狀態轉移                    | 前端入口                                 |
| --------------------------------------------- | ------------------------------------------------------ | ------------------------------- | --------------------------------------------------- | --------------------------- | ------------------------------------ |
| `GET /api/v1/user/profile`                    | JWT header                                             | `data.user`                     | `UNAUTHORIZED`                                      | 無                           | `/profile/index`、`/profile/settings` |
| `PUT /api/v1/user/profile`                    | `nickname?` `gender?` `age?` `notification_enabled?` 等 | `data.user`                     | `VALIDATION_ERROR`                                  | 更新 user profile 行           | `/profile/settings`                  |
| `POST /api/v1/user/avatar`                    | multipart `files/avatar`                               | `data.user.avatar_url`（前端依此回填）  | `FILE_TOO_LARGE` `INVALID_FILE_TYPE`                | 生成文件資源、更新頭像 URL             | `/profile/index`                     |
| `GET /api/v1/profile/me`                      | JWT header                                             | `data.profile`（動態 key/value）    | `UNAUTHORIZED`                                      | 無                           | Profile 相關流程                         |
| `PUT /api/v1/profile/me`                      | 動態 JSON（最多 30 keys）                                    | `data.profile`                  | `VALIDATION_ERROR`                                  | Upsert 個人背景                 | Profile 相關流程                         |
| `GET /api/v1/profile/relationship/:pairingId` | `pairingId(uuid)`                                      | `data.profile`                  | `FORBIDDEN` `NOT_FOUND`                             | 無                           | `/profile/pairing`（配對成功態）            |
| `PUT /api/v1/profile/relationship/:pairingId` | `pairingId(uuid)` + 動態 JSON（最多 60 keys）                | `data.profile`                  | `FORBIDDEN` `VALIDATION_ERROR`                      | Upsert 關係背景                 | `/profile/pairing`（配對成功態）            |
| `POST /api/v1/pairing/create`                 | 空 body                                                 | `data.pairing.invite_code`      | `UNAUTHORIZED`                                      | 建立 pending pairing          | `/profile/pairing`                   |
| `POST /api/v1/pairing/join`                   | `invite_code(6)`                                       | `data.pairing.status=active`    | `INVALID_CODE` `CODE_EXPIRED` `ALREADY_PAIRED` `RATE_LIMIT_EXCEEDED` | 由 pending -> active         | `/profile/pairing`                   |
| `GET /api/v1/pairing/status`                  | JWT header                                             | `data.pairing`；未配對時為 `null`  | `UNAUTHORIZED`                                      | 無                           | `/profile/pairing`、`/case/create`、App case screen |
| `POST /api/v1/pairing/cancel`                 | 空 body                                                 | `data.pairing.status=cancelled` | `NOT_FOUND`                                         | active/pending -> cancelled | `/profile/pairing`                   |


## 操作級規則（深水區）

- 頭像上傳已收斂至 `services/api/user.ts` 的 `uploadAvatar(formData)`，由 request 實例與攔截器處理 token。
- 主 Web request 攔截器在偵測 `FormData` 時會移除預設 `Content-Type`，交由瀏覽器自動附帶 multipart boundary；否則 `POST /api/v1/user/avatar` 會因 boundary 缺失被後端判為 `VALIDATION_ERROR`。
- `pairing/join` 採獨立 limiter，避免邀請碼暴力猜測。
- 正式配對 invariant：同一 user 最多只能有一條 `normal` 且 `pending/active` 的 pairing；`quick/temp` pairing 不參與這條限制。
- `pairing/create` 和 `pairing/join` 均使用 `backend/src/utils/pairing-invariant.ts` 的同一條件。`join` 會在原子更新前檢查加入者是否已有其他正式 pending/active pairing，違反時返回 `ALREADY_PAIRED`。
- `pairing/join` 的原子更新必須同時限定 `id`、`status=pending`、`pairing_type=normal`、`user2_id=null`，防止並發覆蓋已加入者。
- 匿名 quick/temp pairing 的查詢、claim 與 session refresh 必須使用 `buildSessionBoundQuickPairingWhere(session_id, pairing_id?)`；排程清理必須使用 `buildQuickTempPairingWhere({ createdBefore })`。兩者都固定 `pairing_type=quick + status=temp`，涉及匿名 session 時再加 `session_id`，避免 normal pairing 因歷史殘留 `session_id` 被匿名流程接管、旋轉或清理。
- `pairing/status` 的現行後端語義是「認證成功後一律 200，未配對時 `data.pairing=null`」；shared API client 仍兼容舊 `404` 並轉為 `null`，但正式契約不得再把 `404` 寫成主要未配對語義。
- `profile/relationship/:pairingId` 屬配對依賴型接口，未配對時應返回不可訪問語義而非空資料。
- 前端目前採最小白名單字段接入（stage/duration/communication/methods/strengths/challenges/completion），保存後即時回顯並支援重進重讀。

## 回歸測試最小集

1. 配對建立 -> 加入 -> 查狀態 -> 解除配對全鏈路。
2. `/case/create` 以 `pairing/status` 判斷是否導向 `/profile/pairing`。
3. 頭像上傳成功後頁面立即回填新 URL。
4. `pairing/status` 返回 `data.pairing=null` 時 Web / App 不應崩潰，應顯示未配對態；shared API client 對舊 `404` 的兼容只能作向後相容，不是現行後端主契約。
5. 配對成功後可讀取並保存 relationship profile（刷新或重進頁面可回顯）。
6. quick/temp pairing 查詢、`claim-session` 歸戶、`sessions/refresh` 旋轉與 `cleanup_temp_pairings` 清理不得影響 normal pending/active/cancelled pairing。

## 錯誤碼覆蓋矩陣（API -> code -> UI 行為）


| API                                           | error.code            | HTTP | UI 行為         | 重試策略       |
| --------------------------------------------- | --------------------- | ---- | ------------- | ---------- |
| `GET /api/v1/user/profile`                    | `UNAUTHORIZED`        | 401  | 清 token 並導向登入 | 登入後重進      |
| `PUT /api/v1/user/profile`                    | `VALIDATION_ERROR`    | 400  | 表單逐欄提示        | 修正後重送      |
| `POST /api/v1/user/avatar`                    | `FILE_TOO_LARGE`      | 413  | 提示壓縮圖片        | 更換檔案後重傳    |
| `POST /api/v1/user/avatar`                    | `INVALID_FILE_TYPE`   | 400  | 提示不支持格式       | 改副檔名/格式後重傳 |
| `GET /api/v1/profile/relationship/:pairingId` | `FORBIDDEN`           | 403  | 顯示無配對權限，導向配對頁 | 完成配對後再訪問   |
| `GET /api/v1/profile/relationship/:pairingId` | `NOT_FOUND`           | 404  | 顯示資料尚未建立      | 可先引導建立資料   |
| `POST /api/v1/pairing/join`                   | `INVALID_CODE`        | 400  | 顯示邀請碼錯誤       | 允許重新輸入     |
| `POST /api/v1/pairing/join`                   | `CODE_EXPIRED`        | 400  | 提示邀請碼過期       | 需重新索取邀請碼   |
| `POST /api/v1/pairing/join`                   | `ALREADY_PAIRED`      | 409  | 提示需先解除現有正式配對 | 解除或取消後再加入 |
| `POST /api/v1/pairing/join`                   | `RATE_LIMIT_EXCEEDED` | 429  | 顯示加入過頻        | 冷卻後重試      |
| `GET /api/v1/pairing/status`                  | `UNAUTHORIZED`        | 401  | 清 token 並導向登入      | 登入後重進      |
| `POST /api/v1/pairing/cancel`                 | `NOT_FOUND`           | 404  | 視為已解除/無配對     | 不需重試       |


## 狀態標記

- 本模組接口狀態：全部 `已使用`。
