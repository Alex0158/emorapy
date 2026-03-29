# 接口描述：user + profile + pairing

**文檔版本**：v2.3  
**最後更新**：2026-03-14  
**代碼基準**：`backend/src/routes/user.routes.ts`、`backend/src/routes/profile.routes.ts`、`backend/src/routes/pairing.routes.ts`、`backend/src/utils/validation.ts`

---

## 模組定位

- `user`：帳號層資料（暱稱、偏好、頭像）。
- `profile`：心理/關係上下文資料容器，供判決與訪談擴展。
- `pairing`：雙方配對與邀請碼生命周期管理。

## 接口契約（字段級）

| API | Request（核心字段） | Success（前端實際用到） | 常見錯誤碼 | 副作用/狀態轉移 | 前端入口 |
|---|---|---|---|---|---|
| `GET /api/v1/user/profile` | JWT header | `data.user` | `UNAUTHORIZED` | 無 | `/profile/index`、`/profile/settings` |
| `PUT /api/v1/user/profile` | `nickname?` `gender?` `age?` `notification_enabled?` 等 | `data.user` | `VALIDATION_ERROR` | 更新 user profile 行 | `/profile/settings` |
| `POST /api/v1/user/avatar` | multipart `files/avatar` | `data.user.avatar_url`（前端依此回填） | `FILE_TOO_LARGE` `INVALID_FILE_TYPE` | 生成文件資源、更新頭像 URL | `/profile/index` |
| `GET /api/v1/profile/me` | JWT header | `data.profile`（動態 key/value） | `UNAUTHORIZED` | 無 | Profile 相關流程 |
| `PUT /api/v1/profile/me` | 動態 JSON（最多 30 keys） | `data.profile` | `VALIDATION_ERROR` | Upsert 個人背景 | Profile 相關流程 |
| `GET /api/v1/profile/relationship/:pairingId` | `pairingId(uuid)` | `data.profile` | `FORBIDDEN` `NOT_FOUND` | 無 | `/profile/pairing`（配對成功態） |
| `PUT /api/v1/profile/relationship/:pairingId` | `pairingId(uuid)` + 動態 JSON（最多 60 keys） | `data.profile` | `FORBIDDEN` `VALIDATION_ERROR` | Upsert 關係背景 | `/profile/pairing`（配對成功態） |
| `POST /api/v1/pairing/create` | 空 body | `data.pairing.invite_code` | `UNAUTHORIZED` | 建立 pending pairing | `/profile/pairing` |
| `POST /api/v1/pairing/join` | `invite_code(6)` | `data.pairing.status=active` | `INVALID_CODE` `CODE_EXPIRED` `RATE_LIMIT_EXCEEDED` | 由 pending -> active | `/profile/pairing` |
| `GET /api/v1/pairing/status` | JWT header | `data.pairing`（或 404） | `NOT_FOUND` | 無 | `/profile/pairing`、`/case/create` |
| `POST /api/v1/pairing/cancel` | 空 body | `data.pairing.status=cancelled` | `NOT_FOUND` | active/pending -> cancelled | `/profile/pairing` |

## 操作級規則（深水區）

- 頭像上傳已收斂至 `services/api/user.ts` 的 `uploadAvatar(formData)`，由 request 實例與攔截器處理 token。
- `pairing/join` 採獨立 limiter，避免邀請碼暴力猜測。
- `getPairingStatus` 在前端把 `404` 視為 `null`（不是錯誤），這是流程控制關鍵語義。
- `profile/relationship/:pairingId` 屬配對依賴型接口，未配對時應返回不可訪問語義而非空資料。
- 前端目前採最小白名單字段接入（stage/duration/communication/methods/strengths/challenges/completion），保存後即時回顯並支援重進重讀。

## 回歸測試最小集

1. 配對建立 -> 加入 -> 查狀態 -> 解除配對全鏈路。  
2. `/case/create` 以 `pairing/status` 判斷是否導向 `/profile/pairing`。  
3. 頭像上傳成功後頁面立即回填新 URL。  
4. `pairing/status` 返回 404 時前端不應崩潰（應顯示未配對態）。  
5. 配對成功後可讀取並保存 relationship profile（刷新或重進頁面可回顯）。  

## 錯誤碼覆蓋矩陣（API -> code -> UI 行為）

| API | error.code | HTTP | UI 行為 | 重試策略 |
|---|---|---:|---|---|
| `GET /api/v1/user/profile` | `UNAUTHORIZED` | 401 | 清 token 並導向登入 | 登入後重進 |
| `PUT /api/v1/user/profile` | `VALIDATION_ERROR` | 400 | 表單逐欄提示 | 修正後重送 |
| `POST /api/v1/user/avatar` | `FILE_TOO_LARGE` | 413 | 提示壓縮圖片 | 更換檔案後重傳 |
| `POST /api/v1/user/avatar` | `INVALID_FILE_TYPE` | 400 | 提示不支持格式 | 改副檔名/格式後重傳 |
| `GET /api/v1/profile/relationship/:pairingId` | `FORBIDDEN` | 403 | 顯示無配對權限，導向配對頁 | 完成配對後再訪問 |
| `GET /api/v1/profile/relationship/:pairingId` | `NOT_FOUND` | 404 | 顯示資料尚未建立 | 可先引導建立資料 |
| `POST /api/v1/pairing/join` | `INVALID_CODE` | 400 | 顯示邀請碼錯誤 | 允許重新輸入 |
| `POST /api/v1/pairing/join` | `CODE_EXPIRED` | 400 | 提示邀請碼過期 | 需重新索取邀請碼 |
| `POST /api/v1/pairing/join` | `RATE_LIMIT_EXCEEDED` | 429 | 顯示加入過頻 | 冷卻後重試 |
| `GET /api/v1/pairing/status` | `NOT_FOUND` | 404 | 視為「未配對」而非錯誤頁 | 不需重試 |
| `POST /api/v1/pairing/cancel` | `NOT_FOUND` | 404 | 視為已解除/無配對 | 不需重試 |

## 狀態標記

- 本模組接口狀態：全部 `已使用`。
