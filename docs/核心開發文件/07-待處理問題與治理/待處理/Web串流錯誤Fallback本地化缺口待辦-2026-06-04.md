# Web 串流錯誤 fallback 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web Chat room stream、Execution replan stream、固定 fallback error message 與 locale-aware 顯示
**取證代碼入口**：`frontend/src/pages/Chat/Room/chatRoomUtils.ts`、`frontend/src/pages/Execution/Replan/index.tsx`、`frontend/src/utils/apiError.ts`
**最後核驗 Commit**：`6d13ea4`
**最後核驗日期**：`2026-06-04`
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
- Status：已完成本輪修復。後續全局語言排查若發現其他 Web / Admin / App 直出 fixed fallback message，需另行登記。

## 2026-06-04 本輪結果

1. `frontend/src/pages/Chat/Room/chatRoomUtils.ts` 的 terminal stream error 已改用 `getErrorMessage(error, 'chat.message.streamTerminalError')`，保留 backend 具體 message，並把 `Invalid ... response from server` 固定 fallback 轉為目前 locale 的 `apiError.invalidResponse`。
2. `frontend/src/pages/Execution/Replan/index.tsx` 已新增 `getReplanStreamErrorText()`，terminal error callback 與 failed snapshot error 都走同一 normalization，不再直接顯示固定英文 invalid-response 診斷字串。
3. `frontend/src/pages/Chat/Room/chatRoomUtils.test.ts` 已補 zh-TW / en-US terminal invalid-response fallback 驗證；`frontend/src/pages/Execution/Replan/index.test.tsx` 已補 terminal callback 與 failed snapshot 兩條路徑驗證；`frontend/src/utils/apiError.test.ts` 同步加固 en-US catalog loading helper，避免 locale lazy import 造成測試假陰性。
4. `docs/核心開發文件/文件收斂/03-CJ-核心開發文件逐文件代碼校驗總台賬-2026-04-18.md` 已加入本治理文件並同步摘要統計。
5. 已驗證：`npm --prefix frontend test -- src/pages/Chat/Room/chatRoomUtils.test.ts src/pages/Execution/Replan/index.test.tsx src/utils/apiError.test.ts src/assets/i18n/catalogParity.test.ts`、`npm --prefix frontend run build`、`npm run docs:check` 均通過。
