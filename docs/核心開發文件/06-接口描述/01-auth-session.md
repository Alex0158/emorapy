# 接口描述：auth + sessions

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：接口詳規
**覆蓋範圍**：接口字段契約、錯誤碼、守衛與頁面對接：01-auth-session
**取證代碼入口**：`backend/src/app.ts`、`backend/src/routes/auth.routes.ts`、`backend/src/routes/session.routes.ts`、`backend/src/services/auth.service.ts`、`backend/src/services/auth-challenge.service.ts`、`backend/src/services/email.service.ts`、`backend/src/services/session.service.ts`、`backend/src/middleware/auth.ts`、`backend/src/utils/case-classifier.ts`、`backend/src/utils/pairing-invariant.ts`、`frontend/src/pages/Auth/Register/index.tsx`、`frontend/src/store/authStore.ts`、`frontend/src/store/sessionStore.ts`、`packages/contracts/src/auth.ts`、`packages/api-client/src/m1.ts`、`mobile/src/features/m1/authRegistration.ts`、`mobile/src/features/m1/session.ts`、`mobile/src/platform/api/client.ts`、`mobile/src/platform/storage/secureStore.ts`
**最後核驗 Commit**：`8e93680`
**最後核驗日期**：`2026-07-13`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v2.8
**最後更新**：2026-07-13
**代碼基準**：`backend/src/routes/auth.routes.ts`、`backend/src/services/auth.service.ts`、`backend/src/services/auth-challenge.service.ts`、`backend/src/services/email.service.ts`、`backend/src/middleware/auth.ts`、`backend/src/utils/validation.ts`、`packages/contracts/src/auth.ts`、`packages/api-client/src/m1.ts`、`frontend/src/pages/Auth/Register/index.tsx`、`frontend/src/store/authStore.ts`、`mobile/app/(public)/auth/index.tsx`、`mobile/src/features/m1/authRegistration.ts`

---

## 模組定位

- 管理前台身份生命週期（註冊、登入、找回密碼、驗證碼）。
- 管理匿名快速體驗 `session_id` 的簽發與續期。
- 銜接「匿名 quick case -> 登入帳號」的升格動作（`claim-session`）。

## 接口契約（字段級）


| API                                        | Request（核心字段）                                        | Success（前端實際用到）                             | 常見錯誤碼                                                     | 副作用/狀態轉移             | 前端入口                                     |
| ------------------------------------------ | ---------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------- | -------------------- | ---------------------------------------- |
| `POST /api/v1/auth/register`               | `email`、`password(>=8,含字母數字)`、`registration_proof`、`nickname?`            | `data.user(email_verified=true)`、`data.token`                    | `VALIDATION_ERROR`、`EMAIL_EXISTS`、`WEAK_PASSWORD`、`REGISTRATION_PROOF_INVALID`、`REGISTRATION_PROOF_EXPIRED`、`RATE_LIMIT_EXCEEDED`   | 原子消耗 one-time proof、建立已驗證用戶、簽發 JWT          | `/auth/register`                         |
| `POST /api/v1/auth/login`                  | `email`、`password`                                   | `data.user`、`data.token`、`data.expires_in?` | `INVALID_CREDENTIALS`、`EMAIL_NOT_VERIFIED`、`UNAUTHORIZED`、`RATE_LIMIT_EXCEEDED` | 更新最後登入時間、簽發 JWT      | `/auth/login`                            |
| `POST /api/v1/auth/send-verification-code` | `email`、`type(register/verify_email)` | `data.expires_in`、`data.resend_after`（只在 SMTP provider 接受後返回；無需寄送的 verify_email no-op 亦回相同 neutral envelope） | `RATE_LIMIT_EXCEEDED`、`INVALID_EMAIL`、`EMAIL_EXISTS`、`EMAIL_DELIVERY_UNAVAILABLE` | 寫入 OTP HMAC challenge；provider 失敗即作廢 | `/auth/register`、既有帳戶驗證 |
| `POST /api/v1/auth/verify-email`           | `email`、`code(6)`、`type(register/verify_email)`                             | register：`data.verified=true`、`registration_proof`、`registration_proof_expires_in`；verify_email：`data.verified=true`                     | `INVALID_CODE`、`CODE_EXPIRED`、`RATE_LIMIT_EXCEEDED`   | register 產生短效 one-time proof；verify_email 原子更新既有 User        | 認證流程內                                    |
| `POST /api/v1/auth/reset-password`         | `email`                                              | 固定 `202` generic response                                        | 公開 response 不區分帳戶、cooldown 或 provider outcome                    | 存在帳戶時嘗試建立 reset challenge；所有 outcome 維持 anti-enumeration                | `/auth/forgot-password`                  |
| `POST /api/v1/auth/reset-password-confirm` | `email`、`code(6)`、`new_password`                     | 成功旗標                                        | `INVALID_CODE`、`CODE_EXPIRED`、`WEAK_PASSWORD`、`RATE_LIMIT_EXCEEDED`               | 寫入新密碼 hash 並使既有 token 失效           | `/auth/forgot-password`                  |
| `POST /api/v1/auth/claim-session`          | `session_id`（需 JWT）                                  | `data.case_id`（可為 null）                     | `VALIDATION_ERROR`、`UNAUTHORIZED`   | 交易式接管同 session 尚未歸屬的 quick/collaborative case、temp pairing、chat room、roleA participant、evidence；無可返回主案件時仍可 no-op 接管其他資產 | 登入/註冊後隱式                                 |
| `POST /api/v1/sessions/quick`              | 無 body                                               | `data.session_id`、`data.expires_at`         | `RATE_LIMIT_EXCEEDED`                                     | 建立匿名 session         | `/quick-experience/create`               |
| `POST /api/v1/sessions/refresh`            | 無 body                                               | `data.session_id`、`data.expires_at`         | `INVALID_SESSION_ID`、`RATE_LIMIT_EXCEEDED`                                     | 原子旋轉舊 session 或新建 session        | 全站攔截器恢復                                  |


## 操作級規則（深水區）

- `request.ts` 對非 admin API 自動帶 JWT；同時會補 `X-Session-Id`，形成雙憑證併存。
- Session 類 401/400（`SESSION_EXPIRED`、`SESSION_ID_REQUIRED`、`INVALID_SESSION_ID`）在 Web request interceptor 中只做「清舊 -> refresh / 補建 session -> 提示」；不得假設 interceptor 會自動重放原始請求，頁面或調用方仍需自行重拉 / 重送以避免死循環。
- `claim-session` 屬提升體驗轉化率的「弱依賴」：失敗不應阻斷登入成功態。
- 註冊唯一正式順序是 `send registration code → verifyRegistrationCode() 取得 proof → register(proof)`；Web 與 App 不得直接 register，也不得把 proof 寫入 local/session storage、URL、telemetry 或 log。email 改變、重發、proof 過期或驗證流程重新開始時必須清除舊 proof。
- OTP DB 欄位只保存 `EMAIL_OTP_PEPPER` keyed HMAC；registration proof 為高熵 opaque value，DB 只保存 SHA-256 digest。proof 必須綁定 normalized email、register purpose、challenge 與 expiry，且只能在建立 User 的同一 transaction 內消耗一次。
- `authenticate` 對 legacy `email_verified=false` JWT fail closed；register 成功時建立的 User 必須已是 `email_verified=true`，才可簽發可進入保護資源的 token。
- Web 與 App 登入遇到 `EMAIL_NOT_VERIFIED` 時，固定走 `send verify_email → verify code → retry login`，不得要求舊帳戶重新註冊；兩端的 OTP expiry 與 resend 倒數必須使用服務端 `expires_in / resend_after`，不可硬編不同時間。
- `claim-session` 對外只承諾返回 `case_id | null`，但內部必須保持同 session 匿名資產歸戶一致：不能只綁 `cases.plaintiff_id`，而漏掉 `pairings.user1_id`、`chat_rooms.owner_user_id`、`chat_participants.user_id` 或 `evidences.user_id`。
- `claim-session` 的 case / evidence 歸戶必須使用 `backend/src/utils/case-classifier.ts` 的 `buildClaimableSessionCaseWhere(session_id)`：只允許 quick（`session_id` 或 `quick_sessions` 關聯）與同 session 的 `collaborative(session_id 有值)`；不能因 formal case 殘留 `session_id` 或 `quick_sessions` 關聯而被錯誤歸戶。
- `claim-session` 的 temp pairing 歸戶必須使用 `backend/src/utils/pairing-invariant.ts` 的 `buildSessionBoundQuickPairingWhere(session_id)`：只允許 `pairing_type=quick + status=temp`，不能因 normal pairing 殘留 `session_id` 被匿名登入歸戶。
- `claim-session` 不做 quick -> formal 的隱式升格，不改 `Case.mode`，不建立正式 normal pairing；若未來要升格，必須另開狀態機與 migration / backfill 任務。
- `claim-session` 只能補尚未歸屬的匿名欄位，不覆蓋既有 user ownership；正式 `collaborative + session_id = null` 不作為匿名 session 主 case 返回。
- `reset-password` 刻意不暴露用戶是否存在；不存在／inactive 帳號、cooldown、SMTP failure 與 provider accepted 都返回 byte-equivalent `202` body。同步 SMTP 的 timing side channel 仍屬殘餘風險，若要更強保證需另立 durable outbox / worker 契約。
- `sessions/refresh` 若帶合法舊 `X-Session-Id`，後端會做「新建 -> 遷移 `case_id/pairing_id/session_data` -> 刪舊」的原子旋轉；前端必須同步替換本地 `sessionStorage` 與 `caseSessionMap`。
- `sessions/refresh` 遷移 `cases.session_id` 時必須使用 `buildClaimableSessionCaseWhere(old_session_id)`：只搬遷 quick / 同 session collaborative 的匿名關聯，不能因 formal case 殘留 `session_id` 或 `quick_sessions` 關聯而被 session 旋轉帶走。
- `sessions/refresh` 遷移 `pairings.session_id` 時必須使用 `buildSessionBoundQuickPairingWhere(old_session_id, pairing_id)`：只旋轉 quick temp pairing，不能更新 normal pending/active/cancelled pairing。
- App 端 session / auth 由 `mobile/src/platform/storage/secureStore.ts`、`mobile/src/platform/api/client.ts` 與 `mobile/src/features/m1/session.ts` 承接：API client 只注入 token / `X-Session-Id`，quick session recovery 由 M1 helper 在 recoverable error 後清理或補建；不得把 Web request interceptor 的恢復語義直接寫成 App runtime。

## 回歸測試最小集

1. send → provider accepted → verify OTP → one-time proof → register 原子建立 `email_verified=true` User → 登入；proof 缺失、錯 email、過期與重播全部拒絕，User create rollback 後 proof 可安全重試。
2. 快速體驗建立 session，過期後可刷新恢復。
3. quick / session-bound collaborative case 建立後登入，`claim-session` 成功綁定主 case；同 session 的 pairing、chat room、roleA participant、evidence 一併歸戶；失敗時不影響登入主流程。
4. `claim-session` 不得 claim formal remote / formal collaborative；evidence owner 歸戶也必須套用同一 claimable session case scope。
5. `claim-session` 與 `sessions/refresh` 不得 claim / rotate normal pairing；temp pairing scope 必須套用 `buildSessionBoundQuickPairingWhere()`。
6. `sessions/refresh` 旋轉帶 `case_id` 的匿名 session 時，case update scope 必須套用 `buildClaimableSessionCaseWhere()`，避免 formal case 被誤遷移到新匿名 session。
7. OTP 不得以 plaintext 落 DB / log；第五次錯碼與同時正確輸入最多一方成功，concurrent register 同 proof 最多建立一個 User。
8. reset-password 的不存在帳戶、cooldown、SMTP failure 與 accepted 對外維持相同 202；confirm 只能消耗一次 reset challenge 並只增加一次 token_version。
9. CI production-like 使用 authenticated TLS SMTP sink 跑完整寄送與註冊，不得由 DB 讀出 OTP；Production release fixture 只可在 `EMORAPY_RELEASE_GATE=1` 下為 synthetic smoke email 建立短效 proof，不可暴露為 HTTP endpoint。

## 錯誤碼覆蓋矩陣（API -> code -> UI 行為）

> 口徑以 `backend/src/utils/errors.ts` 為準；歷史別名（如 `EMAIL_ALREADY_EXISTS`）統一映射為 `EMAIL_EXISTS`。


| API                                        | error.code            | HTTP | UI 行為                | 重試策略              |
| ------------------------------------------ | --------------------- | ---- | -------------------- | ----------------- |
| `POST /api/v1/auth/register`               | `VALIDATION_ERROR`    | 400  | 高亮字段錯誤並保留輸入          | 修正後立即重送           |
| `POST /api/v1/auth/register`               | `EMAIL_EXISTS`        | 409  | 提示改用登入/忘記密碼          | 不重試，改走登入流程        |
| `POST /api/v1/auth/register`               | `WEAK_PASSWORD`       | 400  | 提示密碼強度不足              | 修正密碼後重送           |
| `POST /api/v1/auth/register`               | `REGISTRATION_PROOF_INVALID` | 400 | 清除 proof 並返回驗證碼步驟 | 重新取得驗證碼與 proof |
| `POST /api/v1/auth/register`               | `REGISTRATION_PROOF_EXPIRED` | 400 | 提示驗證已過期並返回驗證碼步驟 | 重新取得驗證碼與 proof |
| `POST /api/v1/auth/login`                  | `INVALID_CREDENTIALS` | 401  | 留在登入頁顯示錯誤            | 人工修正帳密後重送         |
| `POST /api/v1/auth/login`                  | `EMAIL_NOT_VERIFIED`  | 403  | 提示 legacy 帳戶需完成郵箱驗證 | 完成既有帳戶驗證後重試   |
| `POST /api/v1/auth/login`                  | `RATE_LIMIT_EXCEEDED` | 429  | 顯示限流倒數               | 冷卻後重試             |
| `POST /api/v1/auth/send-verification-code` | `INVALID_EMAIL`       | 400  | email 欄位錯誤提示         | 修正 email 後重送      |
| `POST /api/v1/auth/send-verification-code` | `EMAIL_EXISTS`        | 409  | 註冊發碼時提示改用登入／忘記密碼 | 不重試，改走登入流程 |
| `POST /api/v1/auth/send-verification-code` | `RATE_LIMIT_EXCEEDED` | 429  | 顯示發碼過頻提示             | 冷卻後重送             |
| `POST /api/v1/auth/send-verification-code` | `EMAIL_DELIVERY_UNAVAILABLE` | 503 | 顯示郵件服務暫時不可用，不能宣稱已寄出 | provider 恢復後重送 |
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
