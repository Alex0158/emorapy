# Web 端凍結基線總覽

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：正式規格
**覆蓋範圍**：Web / Admin Web 已實作能力、凍結基線、平台差異與對 App 的參照邊界
**取證代碼入口**：`frontend/src/router/index.tsx`、`frontend/src/pages`、`frontend-admin/src/router.tsx`、`frontend-admin/src/pages`、`backend/src/routes`、`scripts/start-dev.sh`
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-25`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 凍結口徑

Web 端基線以當前 repo 的 `frontend/`、`frontend-admin/`、`backend/`、`packages/*` 實作為準。本次共享 API client / Web wrapper 核驗以 `3890ba8` 加當前 staged diff 為準，核驗日期為 `2026-05-25`；Admin / Mobile / release evidence 仍以各自子域文件與 gate 為準。

本基線用作 App 開發對照：

1. 已在 Web 存在的產品能力，App 應判定為「需要評估是否承接」。
2. Web 已有但不適合 App 原樣搬遷的能力，應記為平台差異。
3. Web 沒有閉環但跨端產品核心或 `CJ-PRD-*` 要求存在的能力，應記為代碼待處理任務。
4. Web 平台專屬實作不得反向污染跨端核心或通用級 PRD。
5. Web -> App 轉譯必須通過 `20-App端/01-App導航與平台Adapter基線.md` 與 `50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`，不得把本基線當成 App navigation 或 native adapter 設計。

## 2. Web 應用邊界

| 應用 | 目錄 | 定位 |
| --- | --- | --- |
| 主 Web | `frontend/` | 使用者端主入口，承接快速體驗、正式案件、聊天室、心理訪談、修復旅程、通知與個人資料 |
| Admin Web | `frontend-admin/` | 管理與平台治理入口，承接 dashboard、reports、AI monitoring、user management、content / notification governance |
| Backend | `backend/` | API、DB schema、授權、狀態機、AI ledger、通知、健康檢查與發布治理 |
| 共享層 | `packages/contracts`、`packages/api-client` | 主 Web 已消費 M1-M5 domain client 與 AI stream pure helper；Admin Web 仍維持局部 contracts / transport baseline；App 已透過 platform adapter 消費 shared packages，release sign-off 另計 |

## 3. 已落地主能力

| 能力組 | Web 基線 |
| --- | --- |
| 快速判斷 | 支持 quick experience、匿名 session、session-bound case、claim / refresh 等主鏈路 |
| 正式處理 | 支持登入、配對、正式案件、判決、修復旅程與 execution 相關流程 |
| 先聊再判 | 支持 chat room、message、AI orchestration 與轉入判斷材料的後端能力 |
| 讓系統更懂你 | 支持 interview、psych profile、profile 相關接口與頁面流 |
| 通知與內容 | 支持 notification、content、media provider 相關接口與前台入口 |
| 平台治理 | 支持 Admin Web、health / metrics / version、AI cost、recovery task、release gate 相關治理 |

細節仍以根層旗艦文件、`01-08` 正式子域與 `06-接口描述/` 為準。本文件只固定 Web 作為 App 開發的參照基線。

2026-05-12 補充：Web Header / BottomNav / 首頁 CTA 的一級入口語義已收斂為上表四條產品主線。實作上保留既有 route 與 API：快速判斷仍承接 `/quick-experience/*`，正式處理聚合 `/case/*`、`/judgment/*`、`/reconciliation/*`、`/execution/*`，先聊再判承接 `/chat/room`，讓系統更懂你承接 `/profile/*`。根層 `npm run web:product-lines:check` 固定此入口語義，避免重新把「我的案件 / 執行追蹤 / 聊天室 / 快速體驗」作為 Web primary nav。

## 4. Web 專屬平台實作

Web 端可保留以下平台專屬實作：

1. React Router / browser route guard。
2. Browser local/session storage adapter。
3. Web Header、BottomNav、桌面/手機瀏覽器 responsive layout。
4. Vite / Vercel build pipeline。
5. Admin Web 獨立 Vite/Vercel 入口；主站 `frontend/` 的 `/admin/*` 僅允許 `AdminRedirect` 轉向 `VITE_ADMIN_LOGIN_URL`，Admin API client、Admin hooks、permission route、layout 與 pages 只允許存在於 `frontend-admin/`。
6. 主站 Admin 邊界由 `npm run web:admin-boundary:check` 固定，避免 `frontend/src` 重新出現 Admin Web 實作孤島。
7. Web 一級產品入口語義由 `npm run web:product-lines:check` 固定；Header / BottomNav 不得重新以工程功能詞取代四條產品主線。
8. 本機 Web / Admin / backend 開發 stack 由 `scripts/start-dev.sh` 啟動；腳本會確保 Redis 可用，並為 backend 進程提供 `REDIS_URL=redis://127.0.0.1:6379` 與 `ALLOW_SIMPLE_LOCK=false` fallback。根層 `npm run dev:redis-baseline:check` 固定此本機 Redis baseline；Railway dev Redis 只是可選 parity 增強。
9. 發布版 Redis / Admin token gate 由 `scripts/ops-release-gate.sh` 強制，要求 `REDIS_URL`、`ADMIN_JWT_EXPIRES_IN` 與 Redis-backed `/health` payload，且禁止 `ALLOW_SIMPLE_LOCK=true`。

以下內容不得被 App 直接照搬：

1. Browser-only storage。
2. DOM-only component 或 layout 假設。
3. Web URL guard 作為最終授權來源。
4. Admin Web 管理入口。

## 5. 對 App 的基線要求

App 開發時應優先對照：

1. 路由與頁面責任：`頁面清單.md`。
2. API 使用面：`全接口清單-主文檔.md` 與 `06-接口描述/`。
3. 功能到頁面與接口映射：`接口-功能-頁面-Mapping.md`。
4. App navigation / platform adapter：`20-App端/01-App導航與平台Adapter基線.md`。
5. 跨端差異與工程落點：`50-跨端Mapping與Parity/00-跨端Parity總覽.md` 與 `50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`。

若 App 因原生權限、推播、Deep Link、SecureStore 或離線/恢復流程需要新增平台行為，應先在 App 端文件描述，再在 Parity 文件裁決是否屬於產品核心差異。

## 6. Web 十項修復裁決（2026-05-10）

Web / Admin Web 曾存在十個需按文件驅動與測試驅動收斂的活躍問題：Admin lint gate、Admin 測試入口、animation skipped tests、主站 shared API client 消費、通知卡片語義、Chat reply preview 語義、icon-only button accessible name、HTML `lang` / i18n gate、表單 label / autocomplete、P0 flow true-service / release 級證據。總體修復方案已歸檔在 [../07-待處理問題與治理/已處理/Web十項問題總體修復方案-2026-05-10.md](../07-待處理問題與治理/已處理/Web十項問題總體修復方案-2026-05-10.md)；[../07-待處理問題與治理/已處理/Web五項修復主控方案-2026-05-10.md](../07-待處理問題與治理/已處理/Web五項修復主控方案-2026-05-10.md) 已作為其中五項子方案完成歸檔。

本基線裁決：

1. Admin Web 是正式治理入口，`frontend-admin` build 通過不等於品質 gate 閉環；Admin lint 必須恢復為可通過 gate。
2. Admin Web 必須有 workspace 級最低測試入口；credential-gated E2E 可以 skip，但 skip 條件、env keys 與真服務證據路徑必須文件化。
3. Web 對外產品行為不得因 shared API client 收斂而改變；shared client 遷移只允許在保持現有 service export、toast、storage、router、session header、FormData boundary 與 retry 行為的前提下逐批進行。
4. `/notifications` 與 Chat reply preview 是受保護主入口中的高頻互動；open、CTA、snooze、dismiss、reply preview action 必須使用可理解的 semantic control 與 keyboard/focus 行為，不得只用滑鼠可點擊作為完成證據。
5. Web / Admin 的 icon-only controls、form label / autocomplete 與 HTML language / locale policy 屬於 Web 基線要求，不得延後到 App 或 release hardening 才處理。
6. P0 Web flow 的 mock-backed Playwright 綠燈不得宣稱 release 完成；真服務或 release-like artifact 必須與命令、commit、env redaction、證據路徑一起回寫。

### 6.1 本輪修復進度（2026-05-10）

截至本輪，Web / Admin 已恢復下列基線：

1. `frontend-admin` lint / build / minimum Vitest gate 已可本地重跑：`npm run lint --workspace frontend-admin`、`npm run build --workspace frontend-admin`、`npm run test --workspace frontend-admin` 均通過。
2. `frontend/src/utils/animations.test.ts` 的 `animateNumber` skipped tests 已復原，針對該檔的 skip 掃描無輸出。
3. Web / Admin 根 HTML 已對齊 default locale `zh-TW`，兩端 i18n runtime 會同步 `document.documentElement.lang`。
4. `/notifications` open control 與 Chat reply preview 已由 `div role=button` 改為 native `<button type="button">`，且本輪涉及頁面的裸 `toLocaleString()` 已改為 locale-aware formatting。

仍不得宣稱完成的項目：全量 WCAG / screen reader / 外部等級證據按 `07-待處理問題與治理/已處理/Web全量A11Y與ScreenReader外部證據缺口待辦-2026-05-11.md` 追蹤。P0 true-service / Admin credential-backed E2E 本機證據已按 `07-待處理問題與治理/已處理/WebP0流程E2E真服務證據缺口待辦-2026-05-10.md` 收口；若 release gate 指定 non-local / release / production target，仍需另補該 target artifact。M1 auth / session / quick case、M2 interview / psychProfile、M3 chat REST、M4 pairing / formal case / judgment / reconciliation / execution 與 M5 notifications / media upload 已完成 consumer 收斂。icon-only button / form label / autocomplete / hardcoded accessible name literal 已建立並通過 `npm run web:a11y:contracts` 靜態 gate，public / mock-authenticated Web routes 與 `/case/list`、`/notifications` 選定 data / error states 已通過 `npm run test:a11y --workspace frontend` axe smoke，Admin login / ops jobs baseline、data / sampled、missing permission、forbidden error states 已通過 `npm run test:a11y --workspace frontend-admin` axe smoke，但不替代全量 WCAG 掃描。

### 6.2 本輪新增樣本回寫（2026-05-10）

本輪再補兩類高頻可訪問性 / 表單樣本：

1. `frontend/src/components/business/Interview/SafetyAlert/index.tsx` 與 `frontend/src/pages/Judgment/Detail/index.tsx` 的 hardcoded 英文 accessible name 已改為 i18n 鍵對應值，並由各自 test file 覆蓋。
2. `frontend/src/pages/Profile/MyStory/index.tsx` 的 icon-only back button 已補 accessible name。
3. `frontend-admin/src/pages/Admin/Reports/index.tsx` 與 `frontend-admin/src/pages/Admin/Settings/MediaProviderSettingsCard.tsx` 已補 programmatic label 與 autocomplete 口徑。
4. `frontend/src/pages/Notifications/index.test.tsx` 與 `frontend/src/pages/Chat/Room/components/ChatMessageItem.test.tsx` 已補 role/name、focus 與 Enter 鍵語義回歸測試。
5. `frontend/src/assets/i18n/catalogParity.test.ts` 與 `frontend-admin/src/assets/i18n/catalogParity.test.ts` 已補 zh-TW / en-US key set、非空值與 placeholder parity gate。
6. Chat / Execution 裸 `toLocale*()` 已改為 locale-aware formatting，且全站裸 `toLocaleString()` / `toLocaleDateString()` / `toLocaleTimeString()` 掃描無輸出。
7. `ChatMessageComposer`、`GuideTooltip`、`FileUpload`、`RegisterPromptSection` 第二批 icon-only controls 已補 i18n accessible name 與 role/name 測試。
8. Web / Admin i18n fallback fail policy 已建立；缺 key 在非 production 直接 throw，production 回傳 `[missing-i18n:<key>]`。
9. Notifications / Chat route-level keyboard-only smoke 已補；Chat invite code input 已補 programmatic label 與 `autoComplete="off"`。
10. Admin Login、OpsJobs、AuditLogs 首輪表單 label / autocomplete 已補，並新增對應 form contract tests。
11. Case Create pre-case banner icon-only close button 已補 i18n accessible name 與回歸測試。
12. 根層 `web:a11y:contracts` 已接入 `scripts/check-web-a11y-contracts.mjs`；本輪掃描 270 個 Web / Admin source files 並通過，覆蓋 icon-only button accessible name、hardcoded `aria-label` / `alt` string literal 禁止、programmatic label 與 input / textarea autocomplete 明示。為讓 gate 清零，本輪同步修復 Auth forgot/register、Case Create/List、Chat entry/composer、Execution CheckIn、Profile Index/Pairing/Settings、QuickExperience Collaborative、Reconciliation preferences，以及 Admin Configs/Reports/Settings/Users/Media Provider/JsonConfigCard。
13. Shared API client 首批 consumer 已落地到主站 M2 domain：`frontend/src/services/api/interview.ts` 與 `frontend/src/services/api/psychProfile.ts` 改用 `createM2ApiClient(request)`，並同步更新 `interviewStore`、`psychProfileStore`、Case Create 與 Judgment Detail profile 讀取形狀。`npm run test:m2 --workspace @cj/api-client`、受影響 frontend tests 105 條、frontend lint/build 均通過。
14. Web route-level axe smoke 已建立：`npm run test:a11y --workspace frontend` 會啟動獨立 Playwright config 並掃 public routes `/`、`/quick-experience/create`、`/quick-experience/collaborative`、`/auth/login`、`/auth/register`、`/auth/forgot-password`、`/chat/room`，以及 mock-authenticated routes `/case/list`、`/notifications`、`/profile/index`；本輪 10 條測試通過且無 automated axe violations。mock-authenticated route smoke 不替代真服務證據。
15. Admin route-level axe smoke 已建立：`npm run test:a11y --workspace frontend-admin` 會掃 `/admin/login` 與 mock-authenticated `/admin/ops/jobs`；本輪首次執行發現 Admin active nav 色彩對比不足（4.23 < 4.5），已改 `frontend-admin/src/components/common/AdminSectionLayout.tsx` active nav 文字為 `text-primary-hover`，重跑後 2 條測試通過且無 automated axe violations。
16. Shared API client M5 notifications consumer 已落地：`frontend/src/services/api/notifications.ts` 改用 `createM5ApiClient(request).notifications`，並保留原 Web public exports。`npm run test:m5 --workspace @cj/api-client` 與 `npm run test:run --workspace frontend -- src/services/api/notifications.test.ts src/pages/Notifications/index.test.tsx` 均通過。M5 upload / FormData 邊界已於第 26 項完成。
17. Shared API client M1 session consumer 已落地：`frontend/src/services/api/session.ts` 改用 `createM1ApiClient(request).session`，並保留 `createSession` / `refreshSession` exports。`npm run test:m1 --workspace @cj/api-client` 與 `npm run test:run --workspace frontend -- src/services/api/session.test.ts src/store/sessionStore.test.ts src/hooks/useSession.test.ts src/services/api/index.test.ts` 均通過。M1 auth、M3/M4 與 M5 upload 已於後續分批處理。
18. Shared API client M4 pairing consumer 已落地：`frontend/src/services/api/pairing.ts` 改用 `createM4ApiClient(request).pairing`，並保留 `createPairing` / `joinPairing` / `getPairingStatus` / `cancelPairing` exports。`npm run test:m4 --workspace @cj/api-client` 與 `npm run test:run --workspace frontend -- src/services/api/pairing.test.ts src/pages/Profile/Pairing/index.test.tsx src/pages/Case/Create/index.test.tsx` 均通過。M4 case / judgment / reconciliation / execution 已於後續分批處理。
19. Shared API client M1 quick case consumer 已落地：`frontend/src/services/api/case.ts` 的 `createQuickCase`、session-bound `getCase` / `getCaseBySessionId`、`createCollaborativeCase` 改用 `createM1ApiClient(request).quick`，並保留原 exports。`npm run test:m1 --workspace @cj/api-client` 與 `npm run test:run --workspace frontend -- src/services/api/case.test.ts src/store/caseStore.test.ts src/pages/QuickExperience/Create/index.test.tsx src/pages/QuickExperience/Collaborative/index.test.tsx src/pages/QuickExperience/Result/index.test.tsx` 均通過。Formal case / judgment / reconciliation / execution 已於 M4 分批處理；upload / FormData 邊界已於第 26 項完成。
20. Shared API client M4 formal case consumer 已落地：`frontend/src/services/api/case.ts` 的 `createCase`、`getCaseList`、`submitCase`、`updateCase` 改用 `createM4ApiClient(request).cases`，並保留原 exports。`npm run test:m4 --workspace @cj/api-client` 與 `npm run test:run --workspace frontend -- src/services/api/case.test.ts src/store/caseStore.test.ts src/pages/Case/Create/index.test.tsx src/pages/Case/Detail/index.test.tsx src/pages/Case/Review/index.test.tsx src/pages/QuickExperience/Result/index.test.tsx` 均通過。M4 judgment / reconciliation / execution 已於後續批次收斂；upload / FormData 邊界已於第 26 項完成。
21. Shared API client M4 judgment consumer 已落地：`frontend/src/services/api/judgment.ts` 改用 `createM4ApiClient(request).judgment`，並保留 `generateJudgment` / `getJudgment` / `getJudgmentByCaseId` / `acceptJudgment` exports。`packages/api-client/src/m4.ts` 已補 judgment session-aware config，保留 quick result 的 `X-Session-Id` 與 `suppressGlobalSessionToast` 行為。`npm run test:m4 --workspace @cj/api-client` 與 `npm run test:run --workspace frontend -- src/services/api/judgment.test.ts src/store/judgmentStore.test.ts src/hooks/usePollingJudgment.test.ts src/pages/Case/Review/index.test.tsx src/pages/Case/Detail/index.test.tsx src/pages/Judgment/Detail/index.test.tsx src/pages/QuickExperience/Result/index.test.tsx` 均通過。M4 reconciliation / execution 已於後續批次收斂。
22. 2026-05-11 重新核驗發現 Case List F03 錯誤恢復 / 篩選 / 排序仍有 4 條 `it.skip`。本輪已在 `frontend/src/test/setup.ts` 補齊 Element pointer capture jsdom fallback，並把 `frontend/src/pages/Case/List/index.test.tsx` 的 4 條 skip 復原為正式測試；Select option 查找改用 `findByRole('option', { name })`，`npm run test:run --workspace frontend -- src/pages/Case/List/index.test.tsx` 23 tests 全部通過，0 skipped。P0 true-service / release-like E2E 證據仍未因此完成。
23. Shared API client M4 execution consumer 已落地：`frontend/src/services/api/execution.ts` 改用 `createM4ApiClient(request).execution`，並保留 `confirmExecution` / `checkin` / `getExecutionStatus` / `getAllExecutionStatuses` / `replanTrack` / `resumeTrack` exports。`npm run test:m4 --workspace @cj/api-client` 與 `npm run test:run --workspace frontend -- src/services/api/execution.test.ts src/store/executionStore.test.ts src/pages/Execution/CheckIn/index.test.tsx src/pages/Execution/Dashboard/index.test.tsx src/pages/Execution/Replan/index.test.tsx src/pages/Reconciliation/Detail/index.test.tsx` 均通過；raw wrapper scan 顯示 `execution.ts` / `reconciliation.ts` 均只透過 shared M4 client 消費。
24. Shared API client M3 chat REST consumer 已落地：`frontend/src/services/api/chat.ts` 改用 `createM3ApiClient(request).chat`，並保留 create/get room、invite、messages、request judgment、judgment status、leave、kick exports；`connectChatStream` 仍保留 Web SSE/fetch adapter。`npm run test:m3 --workspace @cj/api-client` 與 `npm run test:run --workspace frontend -- src/services/api/chat.test.ts src/services/api/chatApiUtils.test.ts src/pages/Chat/Room/index.test.tsx src/pages/Chat/Room/components/ChatMessageComposer.test.tsx src/pages/Chat/Room/components/ChatMessageItem.test.tsx src/pages/Chat/Room/hooks/useChatRoomDerivedState.test.ts src/pages/Chat/Room/chatRoomUtils.test.ts` 均通過；raw scan 只剩 stream `fetch`。
25. Shared API client M1 auth consumer 已落地：`frontend/src/services/api/auth.ts` 改用 `createM1ApiClient(request).auth`，並保留 login/register/claim/verification/reset exports；`packages/api-client/src/m1.ts` 已補 verification/reset shared contract。`npm run test:m1 --workspace @cj/api-client` 與 `npm run test:run --workspace frontend -- src/services/api/auth.test.ts src/store/authStore.test.ts src/pages/Auth/Login/index.test.tsx src/pages/Auth/Register/index.test.tsx src/pages/Auth/ForgotPassword/index.test.tsx` 均通過；raw scan 顯示 `auth.ts` 只透過 shared M1 auth 消費。
26. Shared API client M5 media upload consumer 已落地：`frontend/src/services/api/case.ts` 的 `uploadEvidence` / `deleteEvidence` 改用 `createM5ApiClient(request).media`，並保留 Web public exports；Web wrapper 只保留 `File[] -> FormData` 組裝，session header、encoded path、envelope validation 與 null `evidences` 防禦由 shared M5 contract 承接。`npm run test:m5 --workspace @cj/api-client`、`npm run test:run --workspace frontend -- src/services/api/case.test.ts src/components/business/FileUpload/index.test.tsx src/pages/QuickExperience/Create/index.test.tsx src/pages/QuickExperience/Result/index.test.tsx src/pages/Case/Create/index.test.tsx src/pages/Execution/CheckIn/index.test.tsx`、`npm run build --workspace frontend` 與 `npm run web:a11y:contracts` 均通過；raw scan 顯示 `case.ts` 無本地 raw request。
27. 2026-05-11 本輪已恢復 mock-backed frontend E2E 全量 gate：`npm run test:e2e --workspace frontend` 27/27 passed。修復包含 stale selector / stale copy / `auth.locale.label` i18n catalog drift，並把 Chat / Judgment handoff 測試對齊現行「Analysis / 梳理」語義。此結果仍不替代 P0 true-service / release-like backend 證據。
28. 2026-05-11 mock-backed E2E 同步暴露並修復兩個真實 rapid double click 缺陷：`Reconciliation/Detail` 對開始執行加同步 lock，`Execution/CheckIn` 對打卡提交加同步 lock，避免 `confirmExecution` / `checkin` 重複送出。對應 unit 與 `frontend/e2e/chat/execution-flow.e2e.ts` 已通過。
29. 2026-05-11 P0 true-service runner 已建立：`backend/scripts/web-p0-true-service-smoke.ts` 與根層 `npm run web:p0:true-service:smoke` 會用真 HTTP 與 target `DATABASE_URL` 驗 quick、formal case list/detail/evidence upload/judgment detail、chat request analysis/judgment status 與 DB ownership sanity；但它是 mutating smoke，必須顯式設定 `RUN_WEB_P0_TRUE_SERVICE_SMOKE=true`，且未產生 release-like pass artifact 前，P0 true-service evidence 仍不得宣稱完成。
30. 2026-05-11 重新執行主站 route-level axe smoke 時發現 Header active nav、default primary button 與 Footer 次文案存在 `color-contrast` failure；已修 `frontend/src/components/layout/Header.tsx` active nav 對比、`frontend/src/components/ui/button.tsx` default primary 背景與 `frontend/src/components/layout/Footer.tsx` 次文案 opacity。後續擴展狀態矩陣時又發現 Case List muted text、Notifications default badge 與 path affordance 對比不足，已修 `frontend/src/index.css` muted foreground、`frontend/src/components/ui/badge.tsx` default badge 與 `frontend/src/pages/Notifications/index.tsx` path affordance。`npm run test:a11y --workspace frontend` 已通過 14/14，`npm run test:a11y --workspace frontend-admin` 已通過 5/5。
31. 2026-05-12 Web P0 true-service runner 已在本機 local backend + local Postgres + local Redis + `AI_MOCK=true` 下產生 pass artifact：[../90-證據與盤點/環境與發版驗證/Web-P0-True-Service-Local-2026-05-12T19-08-00+08-00.json](../90-證據與盤點/環境與發版驗證/Web-P0-True-Service-Local-2026-05-12T19-08-00+08-00.json)。本輪同時修復 register verification async race、judgment `P2002` missing target recovery，以及 chat-to-judgment 單人房復用 live normal pairing 的 DB uniqueness invariant。此 artifact 不替代 release / production target artifact 或 Admin credential-backed E2E。
32. 2026-05-12 Admin credential-backed E2E 已在本機 Admin Web + local backend + local Postgres 上通過 10/10，0 skipped、0 unexpected，artifact 為 [../90-證據與盤點/環境與發版驗證/Web-Admin-Credential-E2E-Local-2026-05-12T19-39-30+08-00.json](../90-證據與盤點/環境與發版驗證/Web-Admin-Credential-E2E-Local-2026-05-12T19-39-30+08-00.json)。此 artifact 覆蓋 Admin login、configs、reports、audit logs、ops jobs、admin user audit、self-protection、token revocation、permission denied 與 CSV；若 release gate 指定 non-local / release / production target，仍需另補該 target credential-backed artifact。

對應驗證：

```bash
npm run test:run --workspace frontend -- src/components/business/Interview/SafetyAlert/index.test.tsx src/pages/Judgment/Detail/index.test.tsx src/pages/Profile/MyStory/index.test.tsx
npm run test:run --workspace frontend -- src/pages/Notifications/index.test.tsx src/pages/Chat/Room/components/ChatMessageItem.test.tsx
npm run test:run --workspace frontend -- src/assets/i18n/catalogParity.test.ts
npm run test:run --workspace frontend-admin -- src/assets/i18n/catalogParity.test.ts
npm run test:run --workspace frontend -- src/pages/Chat/Room/index.test.tsx src/pages/Execution/CheckIn/index.test.tsx src/pages/Chat/Room/components/ChatMessageItem.test.tsx src/pages/Notifications/index.test.tsx src/assets/i18n/catalogParity.test.ts
npm run test:run --workspace frontend -- src/pages/Chat/Room/components/ChatMessageComposer.test.tsx src/components/common/GuideTooltip/index.test.tsx src/components/business/FileUpload/index.test.tsx src/pages/QuickExperience/Result/components/RegisterPromptSection.test.tsx src/assets/i18n/catalogParity.test.ts
npm run test:run --workspace frontend-admin -- src/pages/Admin/Reports/index.test.tsx src/pages/Admin/Settings/MediaProviderSettingsCard.test.tsx
npm run test:run --workspace frontend -- src/pages/Case/List/index.test.tsx
npm run test:run --workspace frontend -- src/services/api/execution.test.ts src/store/executionStore.test.ts src/pages/Execution/CheckIn/index.test.tsx src/pages/Execution/Dashboard/index.test.tsx src/pages/Execution/Replan/index.test.tsx src/pages/Reconciliation/Detail/index.test.tsx
npm run test:run --workspace frontend -- src/services/api/chat.test.ts src/services/api/chatApiUtils.test.ts src/pages/Chat/Room/index.test.tsx src/pages/Chat/Room/components/ChatMessageComposer.test.tsx src/pages/Chat/Room/components/ChatMessageItem.test.tsx src/pages/Chat/Room/hooks/useChatRoomDerivedState.test.ts src/pages/Chat/Room/chatRoomUtils.test.ts
npm run test:run --workspace frontend -- src/services/api/auth.test.ts src/store/authStore.test.ts src/pages/Auth/Login/index.test.tsx src/pages/Auth/Register/index.test.tsx src/pages/Auth/ForgotPassword/index.test.tsx
npm run test:a11y --workspace frontend
npm run test:a11y --workspace frontend-admin
npm run test:run --workspace frontend -- src/components/layout/Footer.test.tsx src/components/common/ProgressSteps/index.test.tsx
RUN_WEB_P0_TRUE_SERVICE_SMOKE=true AI_MOCK=true WEB_P0_SMOKE_REPORT_PATH=docs/核心開發文件/90-證據與盤點/環境與發版驗證/Web-P0-True-Service-<timestamp>.json npm run web:p0:true-service:smoke
```
