# Web Chat action error message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web Chat Room action toast error feedback、shared/API error message fallback、Chat request locale 顯示邊界
**取證代碼入口**：`frontend/src/pages/Chat/Room/chatRoomUtils.ts`、`frontend/src/pages/Chat/Room/chatRoomUtils.test.ts`、`frontend/src/utils/apiError.ts`、`frontend/src/services/api/chat.ts`
**最後核驗 Commit**：`e7607ac`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查下一輪確認，Web Chat Room action feedback 仍把 API / runtime error 的 `message` 當成 UI toast 直接顯示：

- `getSendMessageErrorFeedback()` 對一般錯誤使用 `getErrorMessage(error, "chat.message.sendFail")`，現有測試明確要求 `new Error("發送失敗")` 原樣顯示。
- `getRoomMutationErrorFeedback()` 對 create invite、request judgment、leave room、kick participant 等 mutation 一般錯誤同樣保留 `Error.message`。
- Chat backend route 已開始接收 `X-Locale`，但仍有大量 controller / route success/error message 固定繁中；若 shared client 或 adapter 將這些 message 包成 `Error.message`，Web Chat action toast 仍可能不按目前 Web locale 顯示。

這個缺口與已修復的 request interceptor / stream failure 不同：它位於 Chat Room page-level action feedback helper，會直接影響使用者操作後的 toast。

## 影響範圍

- Web Chat Room：送訊息、建立邀請、接受/拒絕邀請、發起梳理、離開房間、移除 B 方等 action failure toast。
- 不影響 Chat message content、AI 生成內容、SSE event schema、room state machine 或 shared API transport contract。
- 不改 backend route success message；本輪先治理 Web action feedback 的可見 fallback 邊界。

## 目標行為與方案

1. Chat Room action helper 不再把一般 `Error.message` 作默認可見文案。
2. 已知 session / conflict / permission code 保留現有專用本地化分支。
3. 已知 fixed diagnostic（例如 `Invalid ... from server`）仍走 `getErrorMessage()` 的 normalization。
4. 未知 API/runtime message 回到 caller 提供的 locale catalog fallback，例如 `chat.message.sendFail`、`chat.message.judgmentFail`。
5. 測試改掉「保留後端 message」舊契約，新增 en-US / zh-TW 下 raw message 不外露的回歸斷言。

## 邊界與注意事項

- 不吞掉 `code`；code 仍用於 conflict/session/permission 專用分支。
- 不把所有前端 `getErrorMessage()` 全局改為忽略 message，避免影響已依賴 backend 受控 message 的頁面。
- 本輪只收斂 Chat Room action toast；其他頁面的 page-level `Error.message` 顯示需後續逐輪掃描登記。

## 修復結果

1. `frontend/src/pages/Chat/Room/chatRoomUtils.ts` 已新增 Chat action 專用錯誤文案邊界：一般 API/runtime `Error.message` 不再直接成為 toast，改回 caller 提供的 locale catalog fallback。
2. session / conflict / permission 等既有 code-specific 分支維持不變；`Invalid ... from server` 這類 fixed diagnostic 仍走 `getErrorMessage()` normalization，避免退回不可操作的 generic 文案。
3. `frontend/src/pages/Chat/Room/chatRoomUtils.test.ts` 與 `frontend/src/pages/Chat/Room/index.test.tsx` 已移除「保留 raw message」舊契約，補上 en-US / zh-TW raw message 不外露與 fixed diagnostic 仍本地化的回歸覆蓋。

## 驗證方式

- `npm --prefix frontend test -- src/pages/Chat/Room/index.test.tsx`：通過 1 file / 113 tests。
- `npm --prefix frontend test -- src/pages/Chat/Room/chatRoomUtils.test.ts src/pages/Chat/Room/index.test.tsx src/utils/apiError.test.ts src/assets/i18n/catalogParity.test.ts`：通過 4 files / 172 tests。
- `npm --prefix frontend run build`：通過。
- `npm run docs:check`：通過。
- 靜態復查已確認 Chat Room action helper 的一般錯誤分支不再把 raw `Error.message` 作 toast message。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔；2026-06-04 重新核驗時同步修正舊 raw-message 測試契約。

## 2026-06-04 重新核驗與測試契約收斂

1. `frontend/src/pages/Chat/Room/index.test.tsx` 已移除 create / accept / decline / leave / kick / loadMore / retry / SSE terminal 等路徑仍期待 raw `Error.message` 或 backend body `message` 的舊契約。
2. `frontend/src/pages/Chat/Room/chatRoomUtils.test.ts` 已把 room stream terminal / retry helper 的 raw message 期望改為 locale catalog fallback 或 fixed diagnostic normalization。
3. 重新驗證 `npm --prefix frontend test -- src/pages/Chat/Room/chatRoomUtils.test.ts src/pages/Chat/Room/index.test.tsx src/utils/apiError.test.ts src/assets/i18n/catalogParity.test.ts` 通過 4 files / 172 tests；`npm --prefix frontend run build` 與 `npm run docs:check` 通過。
