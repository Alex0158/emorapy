# 接口描述：auth + sessions

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：接口詳規
**覆蓋範圍**：接口字段契約、錯誤碼、守衛與頁面對接：01-auth-session
**取證代碼入口**：`backend/src/app.ts`、`backend/src/routes`、`backend/src/services/auth.service.ts`、`backend/src/services/session.service.ts`、`backend/src/utils/case-classifier.ts`、`frontend/src/services/api`、`frontend-admin/src/services/api`
**最後核驗 Commit**：`18a5900`
**最後核驗日期**：`2026-05-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v2.5
**最後更新**：2026-05-04
**代碼基準**：`backend/src/routes/auth.routes.ts`、`backend/src/services/auth.service.ts`、`backend/src/services/session.service.ts`、`backend/src/routes/session.routes.ts`、`backend/src/utils/validation.ts`、`frontend/src/services/api/auth.ts`、`frontend/src/services/api/session.ts`

---

## 模組定位

- 管理前台身份生命週期（註冊、登入、找回密碼、驗證碼）。
- 管理匿名快速體驗 `session_id` 的簽發與續期。
- 銜接「匿名 quick case -> 登入帳號」的升格動作（`claim-session`）。

## 接口契約（字段級）


| API                                        | Request（核心字段）                                        | Success（前端實際用到）                             | 常見錯誤碼                                                     | 副作用/狀態轉移             | 前端入口                                     |
| ------------------------------------------ | ---------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------- | -------------------- | ---------------------------------------- |
| `POST /api/v1/auth/register`               | `email`、`password(>=8,含字母數字)`、`nickname?`            | `data.user`、`data.token`                    | `VALIDATION_ERROR`、`EMAIL_EXISTS`、`WEAK_PASSWORD`、`RATE_LIMIT_EXCEEDED`   | 建立用戶、簽發 JWT          | `/auth/register`                         |
| `POST /api/v1/auth/login`                  | `email`、`password`                                   | `data.user`、`data.token`、`data.expires_in?` | `INVALID_CREDENTIALS`、`UNAUTHORIZED`、`RATE_LIMIT_EXCEEDED` | 更新最後登入時間、簽發 JWT      | `/auth/login`                            |
| `POST /api/v1/auth/send-verification-code` | `email`、`type(register/reset_password/verify_email)` | 成功旗標（無固定 data）                              | `RATE_LIMIT_EXCEEDED`、`INVALID_EMAIL`                     | 寫入驗證碼紀錄，觸發郵件發送       | `/auth/register`、`/auth/forgot-password` |
| `POST /api/v1/auth/verify-email`           | `email`、`code(6)`、`type`                             | `data.verified:boolean`                     | `INVALID_CODE`、`CODE_EXPIRED`、`RATE_LIMIT_EXCEEDED`   | 依 type 更新驗證狀態        | 認證流程內                                    |
| `POST /api/v1/auth/reset-password`         | `email`                                              | 成功旗標                                        | `RATE_LIMIT_EXCEEDED`                    | 嘗試生成重設碼；不存在帳號時仍回成功                | `/auth/forgot-password`                  |
| `POST /api/v1/auth/reset-password-confirm` | `email`、`code(6)`、`new_password`                     | 成功旗標                                        | `INVALID_CODE`、`CODE_EXPIRED`、`WEAK_PASSWORD`、`RATE_LIMIT_EXCEEDED`               | 寫入新密碼 hash 並使既有 token 失效           | `/auth/forgot-password`                  |
| `POST /api/v1/auth/claim-session`          | `session_id`（需 JWT）                                  | `data.case_id`（可為 null）                     | `VALIDATION_ERROR`、`UNAUTHORIZED`   | 交易式接管同 session 尚未歸屬的 quick/collaborative case、temp pairing、chat room、roleA participant、evidence；無可返回主案件時仍可 no-op 接管其他資產 | 登入/註冊後隱式                                 |
| `POST /api/v1/sessions/quick`              | 無 body                                               | `data.session_id`、`data.expires_at`         | `RATE_LIMIT_EXCEEDED`                                     | 建立匿名 session         | `/quick-experience/create`               |
| `POST /api/v1/sessions/refresh`            | 無 body                                               | `data.session_id`、`data.expires_at`         | `INVALID_SESSION_ID`、`RATE_LIMIT_EXCEEDED`                                     | 原子旋轉舊 session 或新建 session        | 全站攔截器恢復                                  |


## 操作級規則（深水區）

- `request.ts` 對非 admin API 自動帶 JWT；同時會補 `X-Session-Id`，形成雙憑證併存。
- Session 類 401/400（`SESSION_EXPIRED`、`SESSION_ID_REQUIRED`、`INVALID_SESSION_ID`）走「清舊 -> refresh -> 重試」策略，避免死循環。
- `claim-session` 屬提升體驗轉化率的「弱依賴」：失敗不應阻斷登入成功態。
- `claim-session` 對外只承諾返回 `case_id | null`，但內部必須保持同 session 匿名資產歸戶一致：不能只綁 `cases.plaintiff_id`，而漏掉 `pairings.user1_id`、`chat_rooms.owner_user_id`、`chat_participants.user_id` 或 `evidences.user_id`。
- `claim-session` 的 case / evidence 歸戶必須使用 `backend/src/utils/case-classifier.ts` 的 `buildClaimableSessionCaseWhere(session_id)`：只允許 quick（`session_id` 或 `quick_sessions` 關聯）與同 session 的 `collaborative(session_id 有值)`；不能因 formal case 殘留 `session_id` 或 `quick_sessions` 關聯而被錯誤歸戶。
- `claim-session` 不做 quick -> formal 的隱式升格，不改 `Case.mode`，不建立正式 normal pairing；若未來要升格，必須另開狀態機與 migration / backfill 任務。
- `claim-session` 只能補尚未歸屬的匿名欄位，不覆蓋既有 user ownership；正式 `collaborative + session_id = null` 不作為匿名 session 主 case 返回。
- `reset-password` 刻意不暴露用戶是否存在；不存在帳號時仍返回成功，避免枚舉用戶。
- `sessions/refresh` 若帶合法舊 `X-Session-Id`，後端會做「新建 -> 遷移 `case_id/pairing_id/session_data` -> 刪舊」的原子旋轉；前端必須同步替換本地 `sessionStorage` 與 `caseSessionMap`。
- `sessions/refresh` 遷移 `cases.session_id` 時必須使用 `buildClaimableSessionCaseWhere(old_session_id)`：只搬遷 quick / 同 session collaborative 的匿名關聯，不能因 formal case 殘留 `session_id` 或 `quick_sessions` 關聯而被 session 旋轉帶走。

## 回歸測試最小集

1. 註冊 -> 登入 -> 取得 token 可訪問受保護頁。
2. 快速體驗建立 session，過期後可刷新恢復。
3. quick / session-bound collaborative case 建立後登入，`claim-session` 成功綁定主 case；同 session 的 pairing、chat room、roleA participant、evidence 一併歸戶；失敗時不影響登入主流程。
4. `claim-session` 不得 claim formal remote / formal collaborative；evidence owner 歸戶也必須套用同一 claimable session case scope。
5. `sessions/refresh` 旋轉帶 `case_id` 的匿名 session 時，case update scope 必須套用 `buildClaimableSessionCaseWhere()`，避免 formal case 被誤遷移到新匿名 session。
6. 驗證碼與重置密碼流程在限流條件下有正確錯誤提示。

## 錯誤碼覆蓋矩陣（API -> code -> UI 行為）

> 口徑以 `backend/src/utils/errors.ts` 為準；歷史別名（如 `EMAIL_ALREADY_EXISTS`）統一映射為 `EMAIL_EXISTS`。


| API                                        | error.code            | HTTP | UI 行為                | 重試策略              |
| ------------------------------------------ | --------------------- | ---- | -------------------- | ----------------- |
| `POST /api/v1/auth/register`               | `VALIDATION_ERROR`    | 400  | 高亮字段錯誤並保留輸入          | 修正後立即重送           |
| `POST /api/v1/auth/register`               | `EMAIL_EXISTS`        | 409  | 提示改用登入/忘記密碼          | 不重試，改走登入流程        |
| `POST /api/v1/auth/register`               | `WEAK_PASSWORD`       | 400  | 提示密碼強度不足              | 修正密碼後重送           |
| `POST /api/v1/auth/login`                  | `INVALID_CREDENTIALS` | 401  | 留在登入頁顯示錯誤            | 人工修正帳密後重送         |
| `POST /api/v1/auth/login`                  | `UNAUTHORIZED`        | 401  | 提示帳號未激活或未完成郵箱驗證 | 完成驗證或聯繫支持後重試   |
| `POST /api/v1/auth/login`                  | `RATE_LIMIT_EXCEEDED` | 429  | 顯示限流倒數               | 冷卻後重試             |
| `POST /api/v1/auth/send-verification-code` | `INVALID_EMAIL`       | 400  | email 欄位錯誤提示         | 修正 email 後重送      |
| `POST /api/v1/auth/send-verification-code` | `RATE_LIMIT_EXCEEDED` | 429  | 顯示發碼過頻提示             | 冷卻後重送             |
| `POST /api/v1/auth/verify-email`           | `INVALID_CODE`        | 400  | 顯示驗證碼錯誤              | 允許重新輸入            |
| `POST /api/v1/auth/verify-email`           | `CODE_EXPIRED`        | 400  | 提示驗證碼過期              | 先重發碼再驗證           |
| `POST /api/v1/auth/reset-password`         | `RATE_LIMIT_EXCEEDED` | 429  | 顯示重設郵件發送過頻，不暴露帳號是否存在 | 冷卻後重試 |
| `POST /api/v1/auth/reset-password-confirm` | `INVALID_CODE`        | 400  | 顯示重設碼錯誤              | 重新輸入或重發碼 |
| `POST /api/v1/auth/reset-password-confirm` | `CODE_EXPIRED`        | 400  | 提示重設碼過期              | 先重發碼再重設 |
| `POST /api/v1/auth/reset-password-confirm` | `WEAK_PASSWORD`       | 400  | 顯示密碼強度規則             | 修正密碼後重送           |
| `POST /api/v1/auth/claim-session`          | `VALIDATION_ERROR`  | 400  | 僅記錄 warning，不回滾登入成功態 | 修正 session payload 後再嘗試 |
| `POST /api/v1/auth/claim-session`          | `UNAUTHORIZED`     | 401  | 不阻斷登入成功態，僅放棄綁定     | 重新登入後再嘗試           |
| `POST /api/v1/sessions/quick`              | `RATE_LIMIT_EXCEEDED` | 429  | 顯示建立體驗過頻             | 冷卻後重試             |
| `POST /api/v1/sessions/refresh`            | `INVALID_SESSION_ID`     | 400  | 清理衝突的本地 session 來源，僅保留單一 `X-Session-Id` 後重試   | 修正來源後重試       |
| `POST /api/v1/sessions/refresh`            | `RATE_LIMIT_EXCEEDED`     | 429  | 顯示續期過頻，避免循環刷新   | 冷卻後重試       |


## 狀態標記

- 本模組接口狀態：全部 `已使用`。
