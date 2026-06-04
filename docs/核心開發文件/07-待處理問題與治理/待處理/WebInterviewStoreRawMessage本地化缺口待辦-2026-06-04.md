# Web Interview Store Raw Message 本地化缺口待辦（2026-06-04）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web Interview store error state、stream failure fallback、focused tests
**取證代碼入口**：`frontend/src/store/interviewStoreUtils.ts`、`frontend/src/store/interviewStore.ts`、`frontend/src/store/interviewStoreUtils.test.ts`、`frontend/src/store/interviewStore.test.ts`
**最後核驗 Commit**：`2b5b577`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題

全局語言排查第五十輪確認 Web Interview store 仍存在 raw message 顯示路徑：

1. `frontend/src/store/interviewStoreUtils.ts` 的 `getLocalizedMessageFallback()` 只把 `Invalid ... from server` 轉為 `apiError.invalidResponse`，其餘非空字串會原樣返回。
2. `extractInterviewErrorInfo()` 對 string error、object `message` 與 `Error.message` 仍可能把 raw backend / adapter / runtime message 放入 `info.message`。
3. `frontend/src/store/interviewStore.ts` 的 respond / start / end / get / retry / stream failure error state 會使用 `info.message || t(...)`，因此 raw message 一旦存在就會覆蓋使用者所選語言的 catalog fallback。
4. 現有測試釘住舊契約：`too fast`、`plain error`、`start fail` 會直接成為 store error 或 stream failure message。

## 影響範圍

- Web Interview Chat / Result 相關 store error state。
- 訪談 respond、skip、start session、end session、get session、retry failed、stream failure 等失敗提示。
- 可能來源包括 backend response body、shared adapter fixed diagnostic、runtime exception、SSE stream failure wrapper。

## 目標

1. 普通 raw `message` / `Error.message` 不得直接成為 Web Interview 可見錯誤文案。
2. 保留 `code` / `status` 給業務分支與上層 UI 判斷。
3. 受控 fixed diagnostic（例如 `Invalid ... from server`）仍轉為 locale catalog fallback。
4. 各 store action 使用對應業務 fallback key，例如 `interview.respondFail`、`interview.startFail`、`interview.endFail`、`interview.loadFail`、`interview.retryFail`。

## 方案

1. `interviewStoreUtils.ts` 引入 shared `getErrorMessage()` 作為唯一可見錯誤 normalization 入口；它已收斂為 invalid-response normalization、code/status catalog mapping 或 caller fallback。
2. `extractInterviewErrorInfo(err, fallbackKey)` 接受 caller fallback key，對 object error 保留 `code` / `status`，但 `message` 只取受控 catalog 結果。
3. `getInterviewStreamFailureMessage(error, fallbackKey)` 對 `{ code, message }` 使用同一 normalization，避免 stream failure 的普通 raw message 直出。
4. `interviewStore.ts` 的各 catch branch 顯式傳入業務 fallback key，並直接使用 normalized `info.message`。
5. 更新 focused tests，將 raw message 直出舊契約改為「不外露 raw，顯示對應 fallback 或 code mapping」。

## 邊界

- 不改 backend formatter、SSE event schema、Interview API shape、stream 狀態機或 optimistic turns 邏輯。
- 不處理 `applyStreamSafetyAlert(data.message)`；該 message 屬 stream safety alert payload，可另輪判定是否需要 backend / frontend 共同白名單或 catalog key mapping。
- 不新增任意 backend message 白名單；若未來產品需要顯示 backend-owned 可見文案，必須以 code / catalog key 的受控方式引入。

## 驗收

1. `frontend/src/store/interviewStoreUtils.test.ts` 覆蓋 raw `message` / string error / stream failure raw message 不外露。
2. `frontend/src/store/interviewStore.test.ts` 覆蓋 `new Error('start fail')` 不再成為 store visible error。
3. `npm --prefix frontend test -- src/store/interviewStoreUtils.test.ts src/store/interviewStore.test.ts src/utils/apiError.test.ts src/assets/i18n/catalogParity.test.ts` 通過。
4. `npm --prefix frontend run build` 通過。
5. `npm run docs:check` 通過。

## 修復結果

1. `frontend/src/store/interviewStoreUtils.ts` 已移除 `getLocalizedMessageFallback()` 的 raw message 直出邏輯，Interview store visible error 統一交給 shared `getErrorMessage()` normalization。
2. `extractInterviewErrorInfo(err, fallbackKey)` 已支援 caller fallback key；respond / start / end / get / retry 分支分別傳入 `interview.respondFail`、`interview.startFail`、`interview.endFail`、`interview.loadFail`、`interview.retryFail`。
3. `getInterviewStreamFailureMessage()` 已對 `{ code, message, status }` 使用同一 normalization；普通 stream failure raw message 回 `interview.respondFail`，已知 code 仍可走 catalog mapping。
4. `frontend/src/store/interviewStore.test.ts` 與 `frontend/src/store/interviewStoreUtils.test.ts` 已移除 `start fail`、`end fail`、`retry fail`、`Failed to fetch`、`skip fail`、`stream failed`、`too fast`、`plain error` 等 raw message 可見直出舊契約。

## 本輪驗證

1. `npm --prefix frontend test -- src/store/interviewStoreUtils.test.ts src/store/interviewStore.test.ts src/utils/apiError.test.ts src/assets/i18n/catalogParity.test.ts` 通過 4 files / 76 tests。
2. `npm --prefix frontend run build` 通過。
3. 靜態掃描確認 `frontend/src/store/interviewStore.ts` / `frontend/src/store/interviewStoreUtils.ts` 不再存在 `info.message || t(...)`、`getLocalizedMessageFallback`、`return message;` 或 focused test raw message 直出 expectation。

## 後續邊界

`applyStreamSafetyAlert(data.message)` 本輪未納入；該 message 來自 stream safety alert payload，需要另輪判定 backend event payload 是否應改為 code / catalog key，或前端是否應建立顯式白名單。
