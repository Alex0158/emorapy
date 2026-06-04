# Web 串流錯誤 fallback 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web Chat room stream、Execution replan stream、QuickExperience result stream、固定 fallback error message 與 locale-aware 顯示
**取證代碼入口**：`frontend/src/pages/Chat/Room/chatRoomUtils.ts`、`frontend/src/pages/Execution/Replan/index.tsx`、`frontend/src/pages/QuickExperience/Result/index.tsx`、`frontend/src/pages/QuickExperience/Result/index.test.tsx`、`frontend/src/utils/apiError.ts`
**最後核驗 Commit**：`ad2c358`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查第二輪確認 Web 仍有兩條 stream error 顯示路徑直接使用 `error.message`：

1. `frontend/src/pages/Chat/Room/chatRoomUtils.ts` 的 `getRoomStreamTerminalErrorText(error)` 直接返回 `error.message || t('chat.message.streamTerminalError')`。
2. `frontend/src/pages/Execution/Replan/index.tsx` 的 `onTerminalError` 直接 `setStreamError(error.message)`，失敗快照顯示也直接使用 `waitingSnapshot?.error?.message`。

若 stream terminal error 或 snapshot error 來源是 shared/service 固定 fallback，例如 `Invalid ... response from server`，Web 會把固定英文診斷字串顯示給使用者，未按目前 `cj_locale` 顯示語言。

## 目標改動點與方案

1. Chat room terminal stream error 改用既有 `getErrorMessage(error, 'chat.message.streamTerminalError')`，復用 `apiError.invalidResponse` normalization。
2. Execution replan 新增局部 stream error helper，terminal error 與 snapshot error 都先經 `getErrorMessage(error, 'execReplan.failedDesc')`。
3. 保留 backend / AI / domain 提供的具體非空 `message`，只轉換既有 `getErrorMessage()` 已明確識別的固定 invalid-response pattern。
4. 不改 stream 重連、terminal 判斷、AI event schema、replan form、toast 或路由行為。

## 驗證方式

- `npm --prefix frontend test -- src/pages/Chat/Room/chatRoomUtils.test.ts src/pages/Execution/Replan/index.test.tsx src/utils/apiError.test.ts src/assets/i18n/catalogParity.test.ts`
- `npm --prefix frontend run build`
- `npm run docs:check`

## Owner / Status Notes

- Owner：agent
- Status：已完成並歸檔。後續全局語言排查若發現其他 Web / Admin / App 直出 fixed fallback message，需另行登記。

## 2026-06-04 本輪結果

1. `frontend/src/pages/Chat/Room/chatRoomUtils.ts` 的 terminal stream error 已改用 `getErrorMessage(error, 'chat.message.streamTerminalError')`，保留 backend 具體 message，並把 `Invalid ... response from server` 固定 fallback 轉為目前 locale 的 `apiError.invalidResponse`。
2. `frontend/src/pages/Execution/Replan/index.tsx` 已新增 `getReplanStreamErrorText()`，terminal error callback 與 failed snapshot error 都走同一 normalization，不再直接顯示固定英文 invalid-response 診斷字串。
3. `frontend/src/pages/Chat/Room/chatRoomUtils.test.ts` 已補 zh-TW / en-US terminal invalid-response fallback 驗證；`frontend/src/pages/Execution/Replan/index.test.tsx` 已補 terminal callback 與 failed snapshot 兩條路徑驗證；`frontend/src/utils/apiError.test.ts` 同步加固 en-US catalog loading helper，避免 locale lazy import 造成測試假陰性。
4. `docs/核心開發文件/文件收斂/03-CJ-核心開發文件逐文件代碼校驗總台賬-2026-04-18.md` 已加入本治理文件並同步摘要統計。
5. 已驗證：`npm --prefix frontend test -- src/pages/Chat/Room/chatRoomUtils.test.ts src/pages/Execution/Replan/index.test.tsx src/utils/apiError.test.ts src/assets/i18n/catalogParity.test.ts`、`npm --prefix frontend run build`、`npm run docs:check` 均通過。

## 2026-06-04 下一輪問題登記：QuickExperience Result stream.failed

### 問題位置與現象

全局語言排查下一輪確認 `frontend/src/pages/QuickExperience/Result/index.tsx` 的 `useAIStreamSubscription` `onEvent` 分支在收到 `stream.failed` 時直接 `setJudgmentError(event.error.message)`。

若 stream event payload 來源是固定 fallback，例如 `Invalid judgment response from server`，QuickExperience Result 錯誤狀態會直接把英文診斷字串顯示在判決/分析結果頁，未按目前 `cj_locale` 使用 `apiError.invalidResponse` 的 zh-TW / en-US 文案。

### 影響範圍

- Web：QuickExperience Result 頁的 AI 分析/判決 stream failed 錯誤狀態。
- Shared：復用既有 `frontend/src/utils/apiError.ts` normalization，不改 `@cj/contracts` stream event schema。
- App / Admin / Backend：本輪不改。

### 目標行為

1. `stream.failed` 的 `event.error` 進入 UI 前必須經 `getErrorMessage(event.error, 'message.judgmentRetryHint')`。
2. 固定 `Invalid ... response from server` pattern 顯示為目前 locale 的 `apiError.invalidResponse`。
3. backend / AI / domain 提供的具體非空 message 保持原樣，避免吞掉可行動的業務錯誤。
4. 不改 polling、retry、stream persisted、phase history 或 result layout。

### 驗證方式

- `npm --prefix frontend test -- src/pages/QuickExperience/Result/index.test.tsx src/utils/apiError.test.ts src/assets/i18n/catalogParity.test.ts`
- `npm --prefix frontend run build`
- `npm run docs:check`
- 靜態搜尋確認 QuickExperience Result 不再直接顯示 `event.error.message`。

### Owner / Status Notes

- Owner：agent
- Status：已完成本輪修復，待 commit/push。

### 2026-06-04 本輪結果

1. `frontend/src/pages/QuickExperience/Result/index.tsx` 的 `stream.failed` 分支已改用 `getErrorMessage(event.error, 'message.judgmentRetryHint')`，固定 `Invalid ... response from server` fallback 會依目前 locale 顯示 `apiError.invalidResponse`。
2. `frontend/src/pages/QuickExperience/Result/index.test.tsx` 已補 stream failed invalid-response 測試，並 mock `connectAIStream` 直接觸發 event callback，避免依賴真實 SSE/fetch。
3. 已驗證：`npm --prefix frontend test -- src/pages/QuickExperience/Result/index.test.tsx src/utils/apiError.test.ts src/assets/i18n/catalogParity.test.ts`、`npm --prefix frontend run build`、`npm run docs:check` 均通過。
4. 靜態搜尋 `event.error.message` / `setJudgmentError(event.error.message)` / `Invalid .*response from server` 在 QuickExperience Result production code 已無殘留；剩餘命中只在測試 fixture 中用於反證不直出。

## 2026-06-05 歸檔復核

1. 代碼復核確認 Chat Room terminal stream error、Execution Replan terminal / failed snapshot error、QuickExperience Result `stream.failed` error 都已進入 `getErrorMessage(...)`，不再直接顯示 `error.message` / `event.error.message` 的 fixed invalid-response diagnostic。
2. 復核時發現 `frontend/src/pages/QuickExperience/Result/index.test.tsx` 仍保留舊預期，期待 `INVALID_SESSION_ID` / `FORBIDDEN` / `SERVER_ERROR` / generic `Error` raw message 或 action fallback；已改為鎖定現行語言治理契約：已知 code 走 `common.*` catalog，普通 runtime `Error` 走 caller fallback，不外露 raw message。
3. 2026-06-05 復跑 `npm --prefix frontend test -- src/pages/QuickExperience/Result/index.test.tsx`，通過 1 file / 64 tests。
4. 2026-06-05 復跑 `npm --prefix frontend test -- src/pages/Chat/Room/chatRoomUtils.test.ts src/pages/Execution/Replan/index.test.tsx src/utils/apiError.test.ts src/assets/i18n/catalogParity.test.ts src/pages/QuickExperience/Result/index.test.tsx`，通過 5 files / 127 tests。
5. 2026-06-05 復跑 `npm --prefix frontend run build`，通過。
