# Web 共享 API Client 消費收斂待辦（2026-05-10）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：主站 Web API service、`packages/api-client` M1-M5 domain client、Web / App shared layer parity
**取證代碼入口**：`frontend/src/services/api`、`frontend/src/services/request.ts`、`frontend-admin/src/services/request.ts`、`packages/api-client/src`
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-25`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理；M1 auth / session / quick case、M2 interview / psychProfile、M3 chat REST、M4 pairing / formal case / judgment / reconciliation / execution 與 M5 notifications / media upload consumer 已落地；`connectChatStream` SSE/fetch 與 Web/Admin platform APIs 保留為 adapter 邊界
**Owner**：Frontend / Shared Platform
**優先級**：P1
**分類**：Web / App shared layer parity

## 1. 問題

`packages/api-client` 已提供 M1-M5 domain client。Admin Web 的 `frontend-admin/src/services/request.ts` 已開始消費 `@cj/api-client` 的 HTTP envelope helper；主站 Web 目前已完成 M1 auth / session / quick case、M2 interview / psychProfile、M3 chat REST、M4 pairing / formal case / judgment / reconciliation / execution 與 M5 notifications / media upload consumer 接線。`connectChatStream` SSE/fetch、Web `request.ts` interceptor、toast、storage、router、cancel/retry 與 Admin 平台 API 保留為 platform adapter，不納入本 shared domain consumer 待辦。

這與 Parity 文件中的 Web 配合要求存在偏差：完整 App 版需要 Web 配合共享層收斂，把 auth / session / quick / case / chat / interview / notification API shape 下沉到 `packages/api-client`。

## 2. 證據

`packages/api-client/src/index.ts` 已導出：

```ts
export * from './apiResponse.js';
export * from './aiStreamState.js';
export * from './createHttpClient.js';
export * from './m1.js';
export * from './m2.js';
export * from './m3.js';
export * from './m4.js';
export * from './m5.js';
export * from './types.js';
```

`frontend-admin/src/services/request.ts` 已使用：

```ts
import {
  createHttpClient,
  isApiResponseEnvelope,
  readApiResponseError,
  statusToRequestCode,
  statusToRequestMessage,
  toRequestError,
  wrapSuccessfulApiResponse,
} from '@cj/api-client';
```

M1-M5 domain consumer 已在主站落地：

```ts
// frontend/src/services/api/session.ts
import { createM1ApiClient } from '@cj/api-client';
const sharedSessionApi = createM1ApiClient(request).session;

// frontend/src/services/api/case.ts
import { createM1ApiClient } from '@cj/api-client';
const sharedQuickApi = createM1ApiClient(request).quick;

// frontend/src/services/api/interview.ts
import { createM2ApiClient } from '@cj/api-client';
const sharedInterviewApi = createM2ApiClient(request).interview;

// frontend/src/services/api/psychProfile.ts
import { createM2ApiClient } from '@cj/api-client';
const sharedPsychProfileApi = createM2ApiClient(request).psychProfile;

// frontend/src/services/api/pairing.ts
import { createM4ApiClient } from '@cj/api-client';
const sharedPairingApi = createM4ApiClient(request).pairing;

// frontend/src/services/api/case.ts
import { createM4ApiClient } from '@cj/api-client';
const sharedFormalCaseApi = createM4ApiClient(request).cases;

// frontend/src/services/api/case.ts
import { createM5ApiClient } from '@cj/api-client';
const sharedMediaApi = createM5ApiClient(request).media;

// frontend/src/services/api/judgment.ts
import { createM4ApiClient } from '@cj/api-client';
const sharedJudgmentApi = createM4ApiClient(request).judgment;

// frontend/src/services/api/notifications.ts
import { createM5ApiClient } from '@cj/api-client';
const sharedNotificationsApi = createM5ApiClient(request).notifications;
```

`frontend/package.json` 已明確依賴 `@cj/api-client`，避免主站依賴偶然 workspace hoist。`frontend/src/services/api/session.ts` 保留 `createSession` / `refreshSession` public exports，但底層改走 M1 shared session client。`frontend/src/services/api/auth.ts` 保留 login / register / claim / verification / reset public exports，但底層改走 M1 shared auth client。`frontend/src/services/api/case.ts` 中 `createQuickCase`、session-bound `getCase` / `getCaseBySessionId` 與 `createCollaborativeCase` 已改走 M1 shared quick client；formal case `createCase` / `getCaseList` / `submitCase` / `updateCase` 已改走 M4 shared formal case client；evidence `uploadEvidence` / `deleteEvidence` 已改走 M5 shared media client，Web wrapper 只保留 `File[] -> FormData` 組裝與 public export。`frontend/src/services/api/judgment.ts` 保留 `generateJudgment`、`getJudgment`、`getJudgmentByCaseId`、`acceptJudgment` exports，但底層改走 M4 shared judgment client；shared client 已承接 quick session header 與 `suppressGlobalSessionToast` metadata。`frontend/src/services/api/chat.ts` 的 REST exports 已改走 M3 shared chat client，`connectChatStream` SSE/fetch adapter 留在 Web。`frontend/src/services/api/interview.ts`、`frontend/src/services/api/psychProfile.ts`、`frontend/src/services/api/pairing.ts`、`frontend/src/services/api/reconciliation.ts`、`frontend/src/services/api/execution.ts` 與 `frontend/src/services/api/notifications.ts` 均保留原 public exports，底層分別委派 M2 / M4 / M5 shared client。`frontend/src/utils/aiStreamState.ts` 已改為消費 `@cj/api-client` 的 AI stream pure helper。

主站其餘 service export 仍保留穩定 public API：

```ts
export * from './auth';
export * from './user';
export * from './session';
export * from './pairing';
export * from './case';
export * from './judgment';
export * from './reconciliation';
export * from './execution';
export * from './interview';
export * from './psychProfile';
export * from './profile';
export * from './chat';
export * from './aiStreamState';
```

Admin 相關 API 已由 Admin boundary cleanup 移出主站 service barrel，不屬於本 shared-domain consumer 待辦。`frontend/src/services/request.ts` 仍是主站自有 axios instance / interceptor 實作。這是刻意保留的 Web adapter seam，用來承接 token/session、`X-Session-Id`、`X-Locale`、FormData boundary、toast、logout、request cancel 與 retry 等 Web side effect，不能直接下沉到 shared package。

### 2.1 本輪 M2 首批收斂證據（2026-05-10）

本輪只遷移低風險 M2 domain：

1. `frontend/src/services/api/interview.ts` 改用 `createM2ApiClient(request).interview`，保留 `interviewApi.startSession/checkResume/getSession/respond/skip/cancel/endSession/retryFailed` public export。
2. `frontend/src/services/api/psychProfile.ts` 改用 `createM2ApiClient(request).psychProfile`，保留 `psychProfileApi.getProfile/getFeedbackHistory/giveConsent/deleteAllData` public export。
3. `frontend/src/store/interviewStore.ts` 與 `frontend/src/store/psychProfileStore.ts` 已切到 shared client 的 raw domain result contract。
4. `frontend/src/pages/Case/Create/index.tsx`、`frontend/src/pages/Judgment/Detail/index.tsx` 已同步 profile result shape。

本輪驗證：

```bash
npm run test:m2 --workspace @cj/api-client
npm run test:run --workspace frontend -- src/services/api/interview.test.ts src/services/api/psychProfile.test.ts src/store/interviewStore.test.ts src/store/psychProfileStore.test.ts src/pages/Case/Create/index.test.tsx src/pages/Judgment/Detail/index.test.tsx
npm run lint --workspace frontend
npm run build --workspace frontend
npm run web:a11y:contracts
```

結果：`@cj/api-client` M2 contract 4 條通過；frontend 6 個受影響測試檔、105 條測試通過；frontend lint/build 通過；Web a11y contract 270 files scanned 通過。

### 2.2 本輪 M1 session 收斂證據（2026-05-10）

本輪遷移 M1 中副作用較低的 session domain，不擴大到 auth claim 或 quick case：

1. `frontend/src/services/api/session.ts` 改用 `createM1ApiClient(request).session`。
2. 保留 `createSession` 與 `refreshSession` public export，`sessionStore`、`useSession` 與頁面層 import 不變。
3. 保留 Web `request.ts` 作為 adapter seam，M1 shared client 只處理 session quick / refresh transport 與 envelope validation。
4. `packages/api-client/tests/m1.test.mjs` 已覆蓋 quick session create / refresh、`X-Session-Id` header、envelope failure 與 invalid success payload。
5. `frontend/src/services/api/session.test.ts` 已改為驗證 Web wrapper 是否呼叫 shared M1 session method；`frontend/src/store/sessionStore.test.ts` 與 `frontend/src/hooks/useSession.test.ts` 繼續覆蓋 consumer 行為。

本輪驗證：

```bash
npm run test:m1 --workspace @cj/api-client
npm run test:run --workspace frontend -- src/services/api/session.test.ts src/store/sessionStore.test.ts src/hooks/useSession.test.ts src/services/api/index.test.ts
```

結果：`@cj/api-client` M1 contract 4 條通過；frontend session service / store / hook / export 35 條測試通過。

### 2.3 本輪 M1 quick case 收斂證據（2026-05-10）

本輪遷移 M1 quick case domain，不擴大到 formal case、judgment、evidence upload 或 FormData：

1. `frontend/src/services/api/case.ts` 中 `createQuickCase`、`getCase`、`getCaseBySessionId`、`createCollaborativeCase` 改用 `createM1ApiClient(request).quick`。
2. 保留上述 public export，`caseStore`、QuickExperience Create / Collaborative / Result 頁面 import 不變。
3. `createCase`、`getCaseList`、`submitCase`、`updateCase`、`uploadEvidence`、`deleteEvidence` 當時暫留本地 wrapper；formal case 已於 2.5 收斂，upload / FormData 已於 2.11 獨立批次收斂。
4. `packages/api-client/tests/m1.test.mjs` 已補 collaborative quick case、session header 與 missing session-bound case normalize contract。
5. `frontend/src/services/api/case.test.ts` 已分層：M1 quick methods 驗證 shared client delegation；formal / upload methods 繼續驗證本地 request wrapper。

本輪驗證：

```bash
npm run test:m1 --workspace @cj/api-client
npm run test:run --workspace frontend -- src/services/api/case.test.ts src/store/caseStore.test.ts src/pages/QuickExperience/Create/index.test.tsx src/pages/QuickExperience/Collaborative/index.test.tsx src/pages/QuickExperience/Result/index.test.tsx
```

結果：`@cj/api-client` M1 contract 5 條通過；frontend case service / store / QuickExperience 168 條測試通過。

### 2.4 本輪 M4 pairing 收斂證據（2026-05-10）

本輪遷移 M4 中副作用較低的 pairing domain，不擴大到 formal case、judgment、reconciliation 或 execution：

1. `frontend/src/services/api/pairing.ts` 改用 `createM4ApiClient(request).pairing`。
2. 保留 `createPairing`、`joinPairing`、`getPairingStatus`、`cancelPairing` public export，Profile Pairing 與 Case Create 頁面 import 不變。
3. 保留 Web `request.ts` 作為 adapter seam，M4 shared client 只處理 pairing lifecycle transport、envelope validation 與 not-found normalize。
4. `packages/api-client/tests/m4.test.mjs` 已覆蓋 pairing create / join / status / cancel lifecycle。
5. `frontend/src/services/api/pairing.test.ts` 已改為驗證 Web wrapper 是否呼叫 shared M4 pairing method；`frontend/src/pages/Profile/Pairing/index.test.tsx` 與 `frontend/src/pages/Case/Create/index.test.tsx` 繼續覆蓋 consumer 行為。

本輪驗證：

```bash
npm run test:m4 --workspace @cj/api-client
npm run test:run --workspace frontend -- src/services/api/pairing.test.ts src/pages/Profile/Pairing/index.test.tsx src/pages/Case/Create/index.test.tsx
```

結果：`@cj/api-client` M4 contract 6 條通過；frontend pairing service / Profile Pairing / Case Create 101 條測試通過。

### 2.5 本輪 M4 formal case 收斂證據（2026-05-10）

本輪遷移 M4 formal case domain，不擴大到 judgment、reconciliation、execution 或 evidence upload：

1. `frontend/src/services/api/case.ts` 中 `createCase`、`getCaseList`、`submitCase`、`updateCase` 改用 `createM4ApiClient(request).cases`。
2. `getCase` 暫時仍走 M1 quick client，因為它同時服務 quick result 的 session-bound read；後續若需要 formal-only get，需另開批次裁決。
3. `uploadEvidence` / `deleteEvidence` 當時暫留本地 wrapper；upload / FormData 已於 2.11 獨立批次收斂。
4. `packages/api-client/tests/m4.test.mjs` 已覆蓋 formal case create / list / update / submit / get contract。
5. `frontend/src/services/api/case.test.ts` 已分層：M1 quick methods、M4 formal methods 與 local upload methods 分別驗證。

本輪驗證：

```bash
npm run test:m4 --workspace @cj/api-client
npm run test:run --workspace frontend -- src/services/api/case.test.ts src/store/caseStore.test.ts src/pages/Case/Create/index.test.tsx src/pages/Case/Detail/index.test.tsx src/pages/Case/Review/index.test.tsx src/pages/QuickExperience/Result/index.test.tsx
```

結果：`@cj/api-client` M4 contract 6 條通過；frontend case service / store / Case pages / QuickExperience Result 226 條測試通過。

### 2.6 本輪 M4 judgment 收斂證據（2026-05-10）

本輪遷移 M4 judgment domain，不擴大到 reconciliation 或 execution：

1. `frontend/src/services/api/judgment.ts` 改用 `createM4ApiClient(request).judgment`。
2. 保留 `generateJudgment`、`getJudgment`、`getJudgmentByCaseId`、`acceptJudgment` public export，Judgment Store、Case Review / Detail、QuickExperience Result 與 Judgment Detail 頁面 import 不變。
3. `packages/api-client/src/m4.ts` 的 judgment `generate` / `getByCaseId` 已補 `sessionId` 參數，保留 quick result 的 `X-Session-Id` 行為；`getByCaseId` 也保留 `metadata.suppressGlobalSessionToast`。
4. `packages/api-client/tests/m4.test.mjs` 已覆蓋 judgment generate / get / getByCaseId / accept contract 與 session-aware config。
5. `frontend/src/services/api/judgment.test.ts` 已改為驗證 Web wrapper 是否呼叫 shared M4 judgment method。

本輪驗證：

```bash
npm run test:m4 --workspace @cj/api-client
npm run test:run --workspace frontend -- src/services/api/judgment.test.ts src/store/judgmentStore.test.ts src/hooks/usePollingJudgment.test.ts src/pages/Case/Review/index.test.tsx src/pages/Case/Detail/index.test.tsx src/pages/Judgment/Detail/index.test.tsx src/pages/QuickExperience/Result/index.test.tsx
```

結果：`@cj/api-client` M4 contract 6 條通過；frontend judgment service / store / hook / pages 187 條測試通過。

### 2.7 本輪 M5 notifications 收斂證據（2026-05-10）

本輪遷移 M5 中低副作用的 notifications domain，不擴大到 media / upload：

1. `frontend/src/services/api/notifications.ts` 改用 `createM5ApiClient(request).notifications`。
2. 保留 `listNotifications`、`getUnreadNotificationCount`、`markNotificationRead`、`markAllNotificationsRead`、`dismissNotification`、`snoozeNotification`、`actOnNotification` public export，頁面層不需要改 import。
3. 保留 Web `request.ts` 作為 adapter seam，繼續承接 token/session、`X-Locale`、toast/error policy、request cancel 與 retry。
4. `frontend/src/services/api/notifications.test.ts` 已改為驗證 Web wrapper 是否呼叫 shared M5 notifications method；`frontend/src/pages/Notifications/index.test.tsx` 繼續覆蓋通知頁 open / CTA / snooze / dismiss 行為。
5. M5 media upload / FormData boundary 當時尚未遷移；已於 2.11 以獨立批次與上傳 contract tests 保護完成。

本輪驗證：

```bash
npm run test:m5 --workspace @cj/api-client
npm run test:run --workspace frontend -- src/services/api/notifications.test.ts src/pages/Notifications/index.test.tsx
```

### 2.8 M4 execution consumer 補充方案（2026-05-11）

2026-05-11 重新核驗 `frontend/src/services/api` 後，`reconciliation.ts` 已使用 `createM4ApiClient(request).reconciliation`，但 `execution.ts` 仍直接使用本地 `request.get/post`。`packages/api-client/src/m4.ts` 已有 `createExecutionApi()`，且 `packages/api-client/tests/m4.test.mjs` 覆蓋 execution dashboard / status / checkin / confirm / replan / resume，因此此項是「shared client 已準備、Web consumer 未收斂」。

五輪方案分析與裁決：

1. **業務鏈路輪**：execution 是 reconciliation 後的修復旅程入口，承接 dashboard、每日 check-in、replan/resume。Web consumer 收斂必須保持 `confirmExecution`、`checkin`、`getExecutionStatus`、`getAllExecutionStatuses`、`replanTrack`、`resumeTrack` public exports 不變，避免頁面、store、App parity 文件同時漂移。
2. **現有代碼輪**：Web wrapper 的主要本地邏輯是 envelope unwrap 與 `records/recent_checkins` array normalize；shared M4 execution client 已實作同樣錯誤文案與 normalize，因此不需要在 Web wrapper 保留重複 unwrap。
3. **共享層邊界輪**：`frontend/src/services/request.ts` 仍作 Web adapter seam，保留 token/session、`X-Locale`、toast/error policy、request cancel 與 retry；`packages/api-client` 只承接 platform-neutral transport / DTO normalize，不下沉 router、toast 或 storage。
4. **測試輪**：Web service test 應從「驗證 raw endpoint」改為「驗證 public export delegate 到 shared execution methods」，並保留 normalize / method argument contract。`@cj/api-client` 的 M4 contract test 繼續覆蓋 endpoint path 與 envelope behavior。
5. **回歸輪**：本批不碰 execution pages、store 或 backend contract；驗收需跑 `npm run test:m4 --workspace @cj/api-client`、execution service/store/pages targeted tests、Web build 與 raw wrapper scan，確認 `execution.ts` 不再直接 `request.get/post`。

落地要求：

1. `frontend/src/services/api/execution.ts` import `createM4ApiClient` 並建立 `sharedExecutionApi`。
2. 六個 public exports 改為 delegate shared M4 execution methods。
3. `frontend/src/services/api/execution.test.ts` mock `@cj/api-client`，驗證 delegate 與 public API 不變。
4. 文件回寫後，待處理狀態應將 M4 execution 從「仍待」改成「已落地」；當時尚待的 M1 auth、M3 chat、M5 upload 已分別於 2.9、2.10、2.11 完成。

本輪驗證：

```bash
npm run test:m4 --workspace @cj/api-client
npm run test:run --workspace frontend -- src/services/api/execution.test.ts src/store/executionStore.test.ts src/pages/Execution/CheckIn/index.test.tsx src/pages/Execution/Dashboard/index.test.tsx src/pages/Execution/Replan/index.test.tsx src/pages/Reconciliation/Detail/index.test.tsx
rg -n "request\\.(get|post|put|patch|delete)|createM4ApiClient" frontend/src/services/api/execution.ts frontend/src/services/api/reconciliation.ts
```

結果：`@cj/api-client` M4 contract 6 條通過；frontend execution service / store / CheckIn / Dashboard / Replan / Reconciliation Detail 32 條通過；raw wrapper scan 顯示 `execution.ts` 與 `reconciliation.ts` 均只透過 `createM4ApiClient(request)` 消費 shared client。

### 2.9 M3 chat REST consumer 補充方案（2026-05-11）

2026-05-11 重新核驗 `frontend/src/services/api/chat.ts` 後，Chat REST methods 仍直接使用本地 `request.get/post`；`packages/api-client/src/m3.ts` 已提供 `createM3ApiClient(request).chat`，覆蓋 create/get room、invite accept/decline、messages list/send、request judgment、judgment status、leave、kick，且保留 180s judgment timeout 與 encoded path contract。`connectChatStream` 則是 Web SSE/fetch adapter，依賴 token、session、locale header 與 stream chunk parser，本批不下沉。

五輪方案分析與裁決：

1. **業務鏈路輪**：Chat 是 Web P0 主流程的一部分，REST methods 承接房間建立、邀請、訊息、請求裁判；收斂後必須保持 `createChatRoom`、`getChatRoom`、`createChatInvite`、`acceptChatInvite`、`declineChatInvite`、`listChatMessages`、`sendChatMessage`、`requestChatJudgment`、`getChatJudgmentStatus`、`leaveChatRoom`、`kickChatParticipantB` exports 不變。
2. **現有代碼輪**：Web wrapper 的本地 REST 邏輯主要是 path helper、envelope unwrap、null guard、list messages normalize、judgment 180s timeout；shared M3 client 已覆蓋這些 REST contract，因此 Web wrapper 可改為 delegation，降低重複邏輯。
3. **邊界輪**：`connectChatStream` 保留在 Web，因為它是 SSE/fetch 長連線 adapter，涉及 `env.apiBaseURL`、`sessionStorage`、`getLocale()`、local token、stream parse 與 abort lifecycle；shared package 目前只承接 platform-neutral REST client。
4. **測試輪**：`frontend/src/services/api/chat.test.ts` 需改成 mock `@cj/api-client` 驗證 REST public exports delegate shared methods；stream tests 保持現狀，繼續覆蓋 header / error / chunk parsing。`packages/api-client/tests/m3.test.mjs` 繼續負責 endpoint path、envelope、timeout 與 normalize contract。
5. **回歸輪**：驗收需跑 `npm run test:m3 --workspace @cj/api-client`、chat service test、Chat room / composer / item targeted tests、Web build 與 raw wrapper scan。raw scan 應允許 `connectChatStream` 的 `fetch` 與 stream helper，但不應再看到 Chat REST `request.get/post`。

落地要求：

1. `frontend/src/services/api/chat.ts` import `createM3ApiClient` 並建立 `sharedChatApi`。
2. Chat REST public exports 改為 delegate shared methods；`connectChatStream` 與 stream utils 保持本地。
3. `frontend/src/services/api/chat.test.ts` 分成 REST delegation tests 與 stream adapter tests，避免把 shared package path contract 重複寫死在 Web wrapper。
4. 文件狀態在驗證通過後應將 M3 chat REST 從「仍待」移出；當時剩餘的 M1 auth 與 M5 upload / FormData 已於 2.10、2.11 完成。

本輪驗證：

```bash
npm run test:m3 --workspace @cj/api-client
npm run test:run --workspace frontend -- src/services/api/chat.test.ts src/services/api/chatApiUtils.test.ts src/pages/Chat/Room/index.test.tsx src/pages/Chat/Room/components/ChatMessageComposer.test.tsx src/pages/Chat/Room/components/ChatMessageItem.test.tsx src/pages/Chat/Room/hooks/useChatRoomDerivedState.test.ts src/pages/Chat/Room/chatRoomUtils.test.ts
rg -n "request\\.(get|post|put|patch|delete)|fetch\\(" frontend/src/services/api/chat.ts
npm run build --workspace frontend
```

結果：`@cj/api-client` M3 contract 5 條通過；frontend chat service / utils / room / composer / item / derived state / room utils 188 條通過；raw scan 只剩 `connectChatStream` 的 SSE `fetch`，符合本批「REST 收斂、SSE 留 Web adapter」裁決；frontend build 通過。

### 2.10 M1 auth consumer 補充方案（2026-05-11）

2026-05-11 重新核驗 `frontend/src/services/api/auth.ts` 後，M1 auth 仍直接使用本地 `request.post`。`packages/api-client/src/m1.ts` 已覆蓋 `login`、`register`、`claimSession`，但尚未覆蓋 `sendVerificationCode`、`verifyEmail`、`resetPassword`、`confirmResetPassword`，因此直接在 Web 端半套接線會留下同一 service 混合 shared unwrap 與本地 unwrap 的狀態。

五輪方案分析與裁決：

1. **業務鏈路輪**：auth 是 Web P0 入口，承接註冊、登入、快速體驗 claim、驗證碼與忘記密碼；不能只遷移 login/register 而讓 verification/reset 留在本地，否則 App/Web shared auth contract 仍不完整。
2. **shared contract 輪**：先補 `packages/api-client/src/m1.ts` 的 verification/reset methods 與 tests，再切 Web consumer。shared client 應保留 login/register token + user guard、claimSession `{ case_id: null }` normalize、verifyEmail missing verified -> false。
3. **Web adapter 輪**：`frontend/src/services/request.ts` 繼續承接 token/session、locale、toast、logout、request cancel 與 retry；`packages/api-client` 只承接 platform-neutral auth transport / envelope / normalize。
4. **測試輪**：`packages/api-client/tests/m1.test.mjs` 必須覆蓋 send/verify/reset/confirm；`frontend/src/services/api/auth.test.ts` 改成 mock `createM1ApiClient(request).auth`，驗證 public exports delegate 且錯誤透傳；`authStore` 與 Auth pages targeted tests 應保留。
5. **回歸輪**：驗收需跑 `npm run test:m1 --workspace @cj/api-client`、auth service/store/pages targeted tests、Web build 與 raw wrapper scan。完成後 shared API client 待辦只剩 M5 upload / FormData，並已於 2.11 完成；Admin auth/admin API 不屬本批 Web main-site shared auth。

落地要求：

1. Shared M1 auth 新增 `sendVerificationCode`、`verifyEmail`、`resetPassword`、`confirmResetPassword`。
2. Web `auth.ts` 改用 `createM1ApiClient(request).auth`，保留所有 public exports 與 types。
3. Auth tests 從 raw endpoint assertions 改為 shared client delegation；endpoint path 與 envelope failure 由 package tests 承接。
4. 完成後更新本文件、Web 十項總控方案與 Web 基線中的 remaining shared API client 狀態。

本輪驗證：

```bash
npm run test:m1 --workspace @cj/api-client
npm run test:run --workspace frontend -- src/services/api/auth.test.ts src/store/authStore.test.ts src/pages/Auth/Login/index.test.tsx src/pages/Auth/Register/index.test.tsx src/pages/Auth/ForgotPassword/index.test.tsx
rg -n "request\\.(get|post|put|patch|delete)|createM1ApiClient" frontend/src/services/api/auth.ts packages/api-client/src/m1.ts
npm run build --workspace frontend
```

結果：`@cj/api-client` M1 contract 7 條通過；frontend auth service / authStore / Login / Register / ForgotPassword 118 條通過；raw scan 顯示 `auth.ts` 只透過 `createM1ApiClient(request).auth` 消費 shared client；frontend build 通過。當時剩餘 M5 upload / FormData 已於 2.11 完成。

### 2.11 M5 media upload consumer 補充方案（2026-05-11）

2026-05-11 重新核驗 `frontend/src/services/api/case.ts` 後，M5 `createMediaUploadApi()` 已存在於 `packages/api-client/src/m5.ts`，且 package contract 已覆蓋 encoded path、FormData object identity 與 `X-Session-Id` header；但 Web `uploadEvidence` / `deleteEvidence` 仍直接使用本地 `request.post/delete`。這是最後一個已登記的主站 Web shared domain consumer 缺口。

五輪方案分析與裁決：

1. **業務鏈路輪**：evidence upload 橫跨 F03 formal case、F05 repair execution、QuickExperience session-bound revisit 與 FileUpload component。Web public exports 必須保持 `uploadEvidence(caseId, files, sessionId?)` 與 `deleteEvidence(caseId, evidenceId, sessionId?)` 不變，避免頁面層與 store 層感知 shared client 遷移。
2. **FormData 邊界輪**：`packages/api-client` 不應接收 `File[]`，因為 App/native upload adapter 與 Web `File` 型別不同；Web wrapper 保留 `File[] -> FormData` 組裝，shared M5 media client 接收已組好的 `FormData`，負責 path/header/envelope contract。
3. **錯誤契約輪**：Web 既有行為對 `evidences: null` 會拋 `Invalid evidence response from server`，而非靜默回空陣列。shared M5 media client 必須補 `ensureValue(data.evidences, 'INVALID_EVIDENCE_RESPONSE', 'Invalid evidence response from server')`，保留 F03/F05 不完整 payload 防禦。
4. **測試輪**：`packages/api-client/tests/m5.test.mjs` 覆蓋 null payload rejection 與非陣列 normalize；`frontend/src/services/api/case.test.ts` 改為驗證 Web wrapper 是否組出 FormData、委派 shared M5 media、保留 sessionId 與錯誤透傳。endpoint path 不再在 Web service test 重複寫死。
5. **回歸輪**：本批不修改 FileUpload、Case Create、QuickExperience、Execution CheckIn 的 consumer 呼叫形狀；驗收需跑 M5 package contract、case service / upload consumer targeted tests、Web build、raw wrapper scan 與 Web a11y contracts。

落地結果：

1. `packages/api-client/src/m5.ts` 的 media upload 對 null / missing `evidences` 改為明確拋錯，並保留非陣列回空陣列的防禦 normalize。
2. `frontend/src/services/api/case.ts` 建立 `sharedMediaApi = createM5ApiClient(request).media`；`uploadEvidence` 只組 FormData 後委派 `sharedMediaApi.uploadEvidence`，`deleteEvidence` 委派 `sharedMediaApi.deleteEvidence`。
3. `frontend/src/services/api/case.test.ts` 改為 M1 quick / M4 formal / M5 media delegation 分層測試。
4. raw wrapper scan 顯示 `case.ts` 已不再直接呼叫 `request.get/post/put/delete`；`frontend/src/services/request.ts` 仍保留 token/session、locale、toast、cancel/retry 等 Web adapter seam。

本輪驗證：

```bash
npm run test:m5 --workspace @cj/api-client
npm run test:run --workspace frontend -- src/services/api/case.test.ts src/components/business/FileUpload/index.test.tsx src/pages/QuickExperience/Create/index.test.tsx src/pages/QuickExperience/Result/index.test.tsx src/pages/Case/Create/index.test.tsx src/pages/Execution/CheckIn/index.test.tsx
rg -n "request\\.(get|post|put|patch|delete)|createM5ApiClient" frontend/src/services/api/case.ts packages/api-client/src/m5.ts
npm run build --workspace frontend
npm run web:a11y:contracts
```

結果：`@cj/api-client` M5 contract 6 條通過；frontend case service / FileUpload / QuickExperience Create / QuickExperience Result / Case Create / Execution CheckIn 159 條通過；raw scan 只剩 `case.ts` 的 `createM5ApiClient(request).media`，無本地 raw request；frontend build 通過；Web a11y contracts 通過。

### 2.12 2026-05-25 partial staging 核驗

2026-05-25 重新按可提交批次核驗：Batch 1 只 staged shared API client、主站 Web API wrappers、`frontend/src/utils/aiStreamState.ts`、`frontend/package.json` 的 `@cj/api-client` dependency，以及 root `package-lock.json` 中 `frontend` / `packages/api-client` 的必要 lock entries。未 staged `backend`、`mobile`、`frontend-admin`、Web A11Y / Admin / release sign-off / telemetry / Sentry / Expo 升級等後續批次。

本輪驗證：

```bash
git diff --cached --check
npm --workspace @cj/api-client run test:m1
npm --workspace @cj/api-client run test:m2
npm --workspace @cj/api-client run test:m3
npm --workspace @cj/api-client run test:m4
npm --workspace @cj/api-client run test:m5
npm --workspace @cj/api-client run test:ai-stream-state
npm --prefix frontend run test -- --run src/services/api src/utils/aiStreamState.ts
npm --prefix frontend run build
```

結果：`@cj/api-client` M1 7 條、M2 4 條、M3 5 條、M4 6 條、M5 6 條、AI stream 5 條均通過；frontend service / API index / AI stream wrapper 16 files、149 tests 通過；frontend production build 通過；cached diff whitespace check 通過。此證據只證明 Batch 1 shared-client / Web-wrapper 收斂，不宣稱 Mobile release sign-off、Web A11Y 全量證據、Admin domain API 下沉或 production P0 true-service 完成。

## 3. 核心文件依據

`50-跨端Mapping與Parity/00-跨端Parity總覽.md` 的 Web 配合要求明確列出：

1. `frontend/src/services/api/*` 與 `packages/api-client/src` 需要收斂 Domain API client。
2. `frontend/src/services/request.ts` 與 `packages/contracts/src/common.ts` 需要形成共用 error code、request id、retry 語義。
3. 共享 contracts / api-client / domain logic 的消費狀態與文件描述不一致時，必須新增待處理任務。

## 4. 風險

1. Web / App 對同一 API shape 的已登記 shared domain consumer 分叉已收斂；後續風險轉為新增 API 時未同步補 `packages/api-client` contract tests 與 Web/App consumer。
2. Web 自有 toast、retry、session mutation、router、cancel registry、SSE/fetch lifecycle 行為與 App platform adapter 逐步偏離。
3. 後續 backend response shape 變更需要同時改 Web wrapper、App client、shared package，增加回歸成本。

## 5. 目標狀態

1. 主站 Web 明確裁決哪些 API 改用 `@cj/api-client` domain client，哪些因 toast / router / storage / SSE side effect 保留 platform adapter；目前已完成 M1 auth / session / quick case、M2 interview / psychProfile、M3 chat REST、M4 pairing / formal case / judgment / reconciliation / execution 與 M5 notifications / media upload。
2. `frontend/src/services/request.ts` 中平台專屬 interceptor 與 shared error / response normalize 分層清楚。
3. 每個遷移批次都有對應 tests，避免直接替換導致 quick session、chat stream、upload、auth claim 等高風險行為回歸。
4. 若暫不遷移某 API，需在本文件或 shared layer ADR 記錄理由。

## 5.1 修復裁決

本問題納入 [Web五項修復主控方案-2026-05-10.md](./Web五項修復主控方案-2026-05-10.md) 的 P1-B 階段。主站 Web 不做一次性替換；保留 Web adapter seam，保留 token/session、toast、router、storage、FormData 組裝、request cancel、retry 與 SSE/fetch 等 Web side effect，再按 domain 逐批消費 `@cj/api-client`。M1 auth / session / quick case、M2 interview / psychProfile、M3 chat REST、M4 pairing / formal case / judgment / reconciliation / execution 與 M5 notifications / media upload 已完成；`connectChatStream` 是 Web SSE adapter，不視為 shared REST consumer 缺口。

## 6. 驗收命令

```bash
rg -n "from '@cj/api-client'|from \"@cj/api-client\"" frontend/src frontend-admin/src packages/api-client/src
npm run test:m1 --workspace @cj/api-client
npm run test:m2 --workspace @cj/api-client
npm run test:m3 --workspace @cj/api-client
npm run test:m4 --workspace @cj/api-client
npm run test:m5 --workspace @cj/api-client
npm run test:run --workspace frontend -- src/services/api/auth.test.ts src/store/authStore.test.ts src/pages/Auth/Login/index.test.tsx src/pages/Auth/Register/index.test.tsx src/pages/Auth/ForgotPassword/index.test.tsx
npm run test:run --workspace frontend -- src/services/api/session.test.ts src/store/sessionStore.test.ts src/hooks/useSession.test.ts src/services/api/index.test.ts
npm run test:run --workspace frontend -- src/services/api/case.test.ts src/store/caseStore.test.ts src/pages/QuickExperience/Create/index.test.tsx src/pages/QuickExperience/Collaborative/index.test.tsx src/pages/QuickExperience/Result/index.test.tsx
npm run test:run --workspace frontend -- src/services/api/case.test.ts src/store/caseStore.test.ts src/pages/Case/Create/index.test.tsx src/pages/Case/Detail/index.test.tsx src/pages/Case/Review/index.test.tsx src/pages/QuickExperience/Result/index.test.tsx
npm run test:run --workspace frontend -- src/services/api/case.test.ts src/components/business/FileUpload/index.test.tsx src/pages/QuickExperience/Create/index.test.tsx src/pages/QuickExperience/Result/index.test.tsx src/pages/Case/Create/index.test.tsx src/pages/Execution/CheckIn/index.test.tsx
npm run test:run --workspace frontend -- src/services/api/judgment.test.ts src/store/judgmentStore.test.ts src/hooks/usePollingJudgment.test.ts src/pages/Case/Review/index.test.tsx src/pages/Case/Detail/index.test.tsx src/pages/Judgment/Detail/index.test.tsx src/pages/QuickExperience/Result/index.test.tsx
npm run test:run --workspace frontend -- src/services/api/execution.test.ts src/store/executionStore.test.ts src/pages/Execution/CheckIn/index.test.tsx src/pages/Execution/Dashboard/index.test.tsx src/pages/Execution/Replan/index.test.tsx src/pages/Reconciliation/Detail/index.test.tsx
npm run test:run --workspace frontend -- src/services/api/chat.test.ts src/services/api/chatApiUtils.test.ts src/pages/Chat/Room/index.test.tsx src/pages/Chat/Room/components/ChatMessageComposer.test.tsx src/pages/Chat/Room/components/ChatMessageItem.test.tsx src/pages/Chat/Room/hooks/useChatRoomDerivedState.test.ts src/pages/Chat/Room/chatRoomUtils.test.ts
npm run test:run --workspace frontend -- src/services/api/interview.test.ts src/services/api/psychProfile.test.ts src/store/interviewStore.test.ts src/store/psychProfileStore.test.ts src/pages/Case/Create/index.test.tsx src/pages/Judgment/Detail/index.test.tsx
npm run test:run --workspace frontend -- src/services/api/pairing.test.ts src/pages/Profile/Pairing/index.test.tsx src/pages/Case/Create/index.test.tsx
npm run test:run --workspace frontend -- src/services/api/notifications.test.ts src/pages/Notifications/index.test.tsx
npm run lint --workspace frontend
npm run build --workspace frontend
npm run build --workspace frontend-admin
npm run docs:check
```
