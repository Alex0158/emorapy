# Web 訪談錯誤 fallback 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web Interview store、API error state、fixed invalid-response fallback 與 locale-aware 顯示
**取證代碼入口**：`frontend/src/store/interviewStore.ts`、`frontend/src/store/interviewStoreUtils.ts`、`frontend/src/pages/Interview/Chat/index.tsx`、`frontend/src/pages/Interview/Result/index.tsx`
**最後核驗 Commit**：`58bc868`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查下一輪確認 `frontend/src/store/interviewStore.ts` 的 `startSession`、`respond` / `skipTurn`、`endSession`、`getSession`、`retryFailed` 等錯誤路徑都經 `extractInterviewErrorInfo(err)` 取得 `info.message`，再直接寫入 store 的 user-facing `error` state。

`interviewStoreUtils.ts` 目前只有 `getInterviewStreamFailureMessage()` 會把固定 `Invalid ... response from server` 診斷字串轉成目前 locale 的 `apiError.invalidResponse`；非 stream 的 API / shared client 錯誤 extraction 仍會保留 `Invalid interview ... response from server` 或 `Invalid interview response acknowledgement from server`。因此當 shared api-client 或本地 adapter 丟出固定 fallback error 時，訪談頁錯誤狀態可能直出英文診斷字串，未按使用者所選語言顯示。

## 影響範圍

- Web：Interview Chat / Result 依賴 `useInterviewStore().error` 的錯誤顯示、retry toast fallback、store state。
- Shared：復用現有 fixed invalid-response pattern，不改 `@cj/api-client` error throw contract。
- Backend / Admin / App：本輪不改。

## 目前語言處理缺口

1. `getInterviewStreamFailureMessage()` 已處理 stream failed fixed fallback。
2. `extractInterviewErrorInfo()` 仍把 `Error.message`、plain object `message` 與字串 error 原樣回傳。
3. `interviewStore.ts` 多個 API error branch 直接信任 `info.message` 作為可見 UI 文案。

## 目標行為與方案

1. 將 `extractInterviewErrorInfo()` 共用的 message extraction 接上與 stream failure 相同的 fixed invalid-response normalization。
2. `Invalid ... response from server` / `Invalid ... acknowledgement from server` 這類 shared client 固定診斷訊息顯示為目前 locale 的 `apiError.invalidResponse`。
3. 具體 backend / AI / domain message，例如 rate limit、安全提示、權限說明，仍原樣保留。
4. 空字串 / 空白 message 維持使用 `common.unknownError` 或呼叫端 fallback 的既有行為。
5. 不改訪談狀態機、optimistic streaming、turn 回退、retry 流程、route 或 UI layout。

## 驗證方式

- `npm --prefix frontend test -- src/store/interviewStoreUtils.test.ts src/store/interviewStore.test.ts src/assets/i18n/catalogParity.test.ts`
- `npm --prefix frontend run build`
- `npm run docs:check`
- 靜態搜尋確認 `interviewStore.ts` 仍只經 `extractInterviewErrorInfo()` / `getInterviewStreamFailureMessage()` 進入可見錯誤 state，固定 invalid-response 不會直出。

## Owner / Status Notes

- Owner：agent
- Status：已完成本輪修復，待 commit/push。

## 2026-06-04 本輪結果

1. `frontend/src/store/interviewStoreUtils.ts` 已將 `extractInterviewErrorInfo()` 的 object message 與 string error 分支都接上 fixed invalid-from-server normalization。
2. 訪談 stream failure 與非 stream API/store error 現在共用同一類 `Invalid ... from server` 診斷訊息轉換，會依目前 locale 顯示 `apiError.invalidResponse`。
3. `frontend/src/store/interviewStoreUtils.test.ts` 已補 object error / string error 的 zh-TW / en-US fallback 驗證；`frontend/src/store/interviewStore.test.ts` 已補 `startSession` 與 `respond` 實際 store error state 驗證。
4. 已驗證：`npm --prefix frontend test -- src/store/interviewStoreUtils.test.ts src/store/interviewStore.test.ts src/assets/i18n/catalogParity.test.ts`、`npm --prefix frontend run build`、`npm run docs:check` 均通過。
5. 靜態搜尋確認 production code 中 fixed invalid interview fallback 已集中在 `interviewStoreUtils.ts` normalization；`interviewStore.ts` 的 `info.message` 來源已是 normalized extraction，剩餘 fixed invalid 字串只在測試 fixture。
