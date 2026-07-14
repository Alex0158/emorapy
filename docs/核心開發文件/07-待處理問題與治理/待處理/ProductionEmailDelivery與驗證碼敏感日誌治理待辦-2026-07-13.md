# Production Email Delivery 與驗證碼敏感日誌治理待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：註冊、郵箱驗證、密碼重置的郵件交付契約、敏感日誌、readiness 與 Production release gate
**取證代碼入口**：`backend/src/services/email.service.ts`、`backend/src/services/auth.service.ts`、`backend/src/services/auth-challenge.service.ts`、`backend/src/config/email-delivery.ts`、`backend/src/config/env.ts`、`backend/src/config/logger.ts`、`backend/src/utils/log-redaction.ts`、`backend/src/routes/health.routes.ts`、`.github/workflows/production-deploy-and-verify.yml`、`scripts/ops-release-gate.sh`
**最後核驗 Commit**：`8e93680`
**最後核驗日期**：`2026-07-13`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：待處理（本地 P0 實作已完成；正式 SMTP 設定、exact-main CI 與 Production evidence未完成）
**Owner**：Auth / Platform / Release governance
**優先級**：P0

## 已驗證 Production 現況（修正前基線）

1. exact Production Railway deployment `a6fad093-ff9b-45c5-b3c0-307c328fd92a` 的 runtime log 顯示 SMTP 未配置；本文件只記錄配置缺失與欄位存在，不保存任何 email 或驗證碼值。
2. `EmailService` 在 transporter 不存在時靜默返回；驗證碼 API 因而可在沒有寄出郵件時回報成功。
3. 未配置分支把 `email / code / type` 寫入 Production log；發送成功或失敗分支亦把 raw email 寫入 log。
4. 現行 Web 採「send → verify → register」，但 backend 的 register 驗證會更新尚未建立的 User；App / direct API 又可繞過郵箱驗證直接註冊並取得 token，形成跨端互相矛盾的契約。`sendVerificationCode()` 先持久化 plaintext code，再寄送，失敗時亦未作廢該筆 code。
5. `/health/ready` 與 Production release gate 只驗 DB migration / runtime health，未驗 email provider configuration、連線或 provider acceptance；因此上一輪 release 可在核心認證流程不可用時仍全綠。

## 本地 release branch 實作進度（尚未部署）

1. Backend 已改為 hashed challenge + one-time registration proof；Web、App與 shared contracts採同一 proof-first註冊契約，legacy unverified JWT fail closed。
2. Production Email 設定、startup transport verification與 `/health/ready` 均 fail closed；verification send只有 provider明確回報至少一個 accepted且沒有 rejected recipient才成功。
3. file及各環境 console log均會遮罩 email、OTP與 registration proof；smoke失敗只輸出穩定 error code，不輸出 raw auth body、proof或 token。
4. CI production-like使用 authenticated implicit-TLS SMTP sink完成 send / receive / verify / proof / register；release fixture有獨立 `release_fixture` provenance，不能冒充 provider acceptance。
5. Production workflow先核對 user email canonicalization 與 CITEXT migration capability 的低敏 inventory、exact deployment SHA / id與 startup readiness，再強制執行低頻 provider canary；canary 在 GitHub runner 以 `railway run --no-local` 載入同一組 Production Railway variables 後寄送，evidence綁定 exact `GITHUB_SHA`與 ISO `acceptedAt`，但不代表 exact deployed process 本身執行了寄送。artifact中性命名為 `production-release-evidence`。2026-07-13 對現行 Production 的只讀 inventory為 blank 0、non-canonical 0、collision 0、active unverified 0；CITEXT available、DB CREATE privilege 與 migration capability 均為 true，且不保存任何 email值。
6. 本地 backend build/lint、full Jest 200/202 suites passed（2 skipped）與 2470/2509 tests passed（39 skipped）、integration 5/7 suites passed（2 skipped）與 81/120 tests passed（39 skipped）、focused Auth/Email、Web 179 files / 2018 tests、Admin 16 files / 52 tests、App 36 suites / 214 tests、workflow static contract與 release scripts均已通過；全新本地 PostgreSQL DB 已完整套用 29 個 migration，fresh PostgreSQL DB flow 1 suite / 38 tests passed，production-like true-service（`AI_MOCK=true`；真 HTTP/backend/fresh DB + authenticated local TLS SMTP sink）亦通過。正式 provider、exact-main CI與 Production deployment仍是完成條件。

## 目標契約

1. Production 缺少完整 Resend HTTPS API 設定時 backend 不得啟動；partial configuration 在所有環境一律視為錯誤。SMTP adapter 僅供允許 outbound SMTP 的環境使用。
2. 驗證碼寄送不得 silent skip；provider 未接受時 API 不得宣稱「已發送」，且新建但未被 provider 接受的 challenge 必須立即作廢。
3. 註冊正式流程固定為 `send OTP → verify OTP 取得短效 one-time registration proof → register 原子消耗 proof 並建立 email_verified=true User`；未驗證、proof 缺失／過期／重播、或跨 email 使用一律 fail closed，Web、App 與 direct API 不保留 legacy bypass。
4. 密碼重置維持 user-enumeration 防護；不存在帳戶與已存在帳戶的公開 response 不得用來推斷帳戶是否存在。
5. application log 不得保存 raw email、驗證碼、SMTP credential 或可從 provider error 反推出收件人的內容；只允許穩定 event、purpose、provider error code 與非敏感 internal ref。
6. `/health/ready` 必須回傳 cached email transport readiness；每個 Production deploy 必須驗證 `mode=resend_api / status=ready / verifiedAt`，不得在 health request 內即時連線 provider。Resend sending-only key 無保證可用的 non-mutating auth probe，所以 startup 只驗 adapter 配置，真 provider acceptance 由低頻 canary 證明。運行期 `transport_unavailable/not_configured` 寄送失敗會把 cached status 降為 `unavailable` 並令 readiness 回 503，後續明確 provider accepted 才恢復；單一 recipient rejection 不降全局 transport。
7. CI production-like 必須使用本地 authenticated TLS SMTP sink 跑完整 send / receive / verify / register 鏈；每次 Production deploy 均必須執行一次低頻真 provider canary，只記 recipient 是否已配置、provider 是否接受及 release SHA，不作為 health probe 的副作用。現行 canary 由 GitHub runner 使用 Production Railway variables 寄送，不可將它單獨當成 deployed-process execution 證據。
8. provider canary 的證據邊界是「Resend HTTPS API 已接受」；與 exact deployed backend 的 `/version` 及 initialized `/health/ready` 合併時，可證明相同 release 配置已載入，且相同 Production variables 通過 provider acceptance，但仍不冒充 exact deployed process 已寄送、inbox 最終送達、spam placement 或使用者已讀。要宣稱 inbox delivered 必須另有受控 mailbox 或 provider delivery webhook 證據。

## 實作邊界

1. Production 明確使用 Resend HTTPS API；SMTP adapter 保留但不作 Railway fallback。Provider-specific boundary 集中在單一 transport adapter，避免業務 service 綁死 provider payload。
2. 設定判斷集中為純函數，供 startup、EmailService、readiness、tests 與 canary 共用，避免每層自行解讀 env。
3. verification mail 失敗以穩定 `EMAIL_DELIVERY_UNAVAILABLE`（HTTP 503）回傳；不得把 SMTP message 或 stack 暴露到 API。
4. pairing / Analysis 通知屬非認證通知，可維持業務流程不因郵件失敗而回滾，但不得 silent skip 或洩漏敏感 metadata；失敗須留下低敏 operational event。
5. 不建立 outbox / worker 作為本輪 P0 的前置條件；若後續需要 guaranteed retry，另立資料生命週期與佇列契約，不能在 AuthService 加無界 retry。
6. OTP 只保存由獨立 `EMAIL_OTP_PEPPER` 計算的 keyed HMAC；registration proof 使用高熵 opaque value，DB 只保存 digest，前端只留 component / screen memory。
7. 密碼重置不存在帳戶、cooldown、provider failure 與 provider accepted 的公開 response 固定為相同 `202`；runtime 仍需低敏 operational event，不能用差異狀態洩漏帳戶存在性。
8. email-based Auth limiter 必須先做 trim/lowercase，再以 SHA-256 subject 建 bucket；不得讓大小寫變體繞過限流，也不得把 raw email 當 limiter key。
9. Auth challenge migration 不嘗試把 legacy plaintext OTP 轉成 HMAC，而是在 cutover 作廢所有舊 OTP；這會使部署前最多 5 分鐘內取得的碼需重新寄送，且 rollback 不會復原。發布證據必須保留這個有意 cutover 邊界。

## 完成條件

1. backend focused unit / integration tests 覆蓋：完整／partial／缺失 SMTP、寄送失敗 challenge 作廢、OTP digest、proof 缺失／過期／重播／跨 email、原子 consume + verified User、reset enumeration 邊界、legacy unverified JWT fail closed、log redaction、readiness fail closed、provider canary acceptance。
2. shared contracts、Web、App 均完成 proof-first parity；CI authenticated TLS SMTP sink 能跑完整 email registration + claim-session，且 smoke 不再從 DB 讀 OTP plaintext。
3. backend / shared / Web / App build、lint、focused tests、core docs gate、Production workflow static contract 全部通過。
4. Production Railway variables 已配置完整 SMTP 與專用 canary recipient；不得把 secret 複製到 repo、artifact 或 commentary。
5. exact-main CI 成功後由正式 `Production Deploy and Verify` 發布；live `/version` 對齊 exact SHA，`/health/ready` 顯示 startup-verified email ready；workflow 強制 runner-side provider canary，artifact 必須顯示 provider accepted，並保留「非 exact deployed process 寄送／非 inbox delivery」邊界。
6. 新 deployment logs 不再出現 raw email、OTP 或 proof；以部署範圍的低敏關鍵字 audit 驗證。
7. 完成後回寫 `01-認證與會話`、`06-接口描述/01-auth-session.md`、運維 Runbook 與測試規範，再把本文件移至 `已處理/`。

## 外部依賴與停止條件

Production rollout 需要已驗證的寄件網域／SMTP credential 與 canary recipient。若現有外部帳戶沒有這些值，repo 內實作、測試與 PR 可繼續，但不得部署一個必然因缺配置而啟動失敗的版本，也不得以重新開啟 silent fallback 代替配置。
