# App stream hook runtime message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App AI stream subscription hook、runtime connection error fallback、M1/M3 stream UI recovery
**取證代碼入口**：`mobile/src/platform/sse/useAIStreamSubscription.ts`、`mobile/src/platform/sse/useAIStreamSubscription.test.js`、`mobile/src/platform/api/errorMessages.ts`
**最後核驗 Commit**：`1c10728`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查下一輪確認，`mobile/src/platform/sse/useAIStreamSubscription.ts` 的 default stream error normalization 對普通 `Error` 仍直接使用 `error.message`：

- `new Error('SSE stream disconnected')` 已映射到 `getLocalizedStreamDisconnectedMessage()`。
- 但其他 runtime error，例如 network adapter / fetch-event-source / provider wrapper 拋出的 `new Error('provider down')`，會原樣成為 `AppStreamError.message`。

這會讓 M1 / M3 等 App stream UI 顯示 raw runtime diagnostic，不按 App 所選語言顯示。

## 影響範圍

- App AI stream hook 的 default `normalizeStreamError()`。
- 使用 default normalize 的 stream screen / callback。
- 不影響由 `connectAppSSE()` 已 normalize 的 typed `RequestErrorLike`；該類已在前輪改為 locale fallback。

## 目標行為與方案

1. 普通 runtime `Error.message` 不再作可見 fallback。
2. 已 typed 的 `{ code, message }` error 保持原樣，因為前置 platform client 已負責本地化。
3. 無 typed error 的 runtime failure 統一顯示 `getLocalizedStreamDisconnectedMessage()`。
4. 保留 status 時仍輸出 `HTTP_<status>` code，但 message 使用 stream disconnected locale fallback。

## 邊界與注意事項

- 不改 `connectAppSSE()`，也不改 stream event payload。
- 不吞掉 terminal / recoverable 判斷所需的 typed code；typed error 仍優先返回。
- 後續若發現 feature 自訂 `normalizeError` 仍外露 raw message，另行登記。

## 驗證方式

- `npm --prefix mobile run test -- src/platform/sse/useAIStreamSubscription.test.js --runInBand`：通過 1 suite / 4 tests。
- `npm --prefix mobile run typecheck`：通過。
- `npm run docs:check`：待提交前執行。
- 靜態復查已確認 default hook normalization 不再把普通 `Error.message` 作可見 fallback。

## 修復結果

1. `mobile/src/platform/sse/useAIStreamSubscription.ts` 的 default `normalizeStreamError()` 已改為：typed `{ code, message }` error 保持原樣；非 typed runtime failure 統一使用 `getLocalizedStreamDisconnectedMessage()`。
2. status 存在時仍保留 `HTTP_<status>` code 與 `status` 欄位，但 message 不再使用 raw `Error.message`。
3. `mobile/src/platform/sse/useAIStreamSubscription.test.js` 已新增 `new Error('provider down')` en-US 回歸測試，確認 raw runtime message 不外露。

## Owner / Status Notes

- Owner：agent
- Status：已修復，待提交。
