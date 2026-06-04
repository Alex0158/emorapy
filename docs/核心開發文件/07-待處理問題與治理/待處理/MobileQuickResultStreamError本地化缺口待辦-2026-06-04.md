# Mobile Quick Result Stream Error 本地化缺口待辦（2026-06-04）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App quick result AI stream status/error display、App stream hook callbacks、M1 quick judgment stream tests
**取證代碼入口**：`mobile/app/(public)/quick/result.tsx`、`mobile/src/platform/sse/useAIStreamSubscription.ts`、`mobile/src/platform/api/client.ts`、`mobile/src/platform/api/errorMessages.ts`、`mobile/src/i18n/catalogs`
**最後核驗 Commit**：`0a76537`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題

全局語言排查第五十二輪確認 App 公開快速體驗結果頁仍有 stream error raw message 可見路徑：

1. `mobile/app/(public)/quick/result.tsx` 的 `describeStreamStatus()` 對 `AIStreamEvent` / `AIStreamSnapshot` 直接返回 `input.error.message`。
2. 同頁 `reduceReady()` / `reduceEvent()` 把 `latestSnapshot.error?.message`、`event.error?.message` 放入 `streamState.error`。
3. `onConnectionError()` / `onTerminalError()` 將 `useAIStreamSubscription` normalized `AppStreamError.message` 原樣寫入 `streamState.error`。
4. `streamDetailText` 優先顯示 `streamState.error`，因此 backend stream failed payload、App platform normalization 或 runtime diagnostic 都可能蓋過使用者所選語言。

雖然 `mobile/src/platform/sse/useAIStreamSubscription.ts` 的 default runtime normalization 已修復為 localized disconnected fallback，但本頁仍在 event/snapshot/message callback 邊界直接信任 `error.message`，形成 App UI 層的二次外露缺口。

## 影響範圍

- App `/(public)/quick/result` 快速體驗結果頁。
- M1 quick judgment AI stream ready snapshot / stream failed event / stream cancelled event / connection error / terminal error。
- 不包含 AI 判斷正文、summary、delta / fullText 的正常內容顯示。

## 目標

1. Quick Result stream status/error UI 不再直接顯示 `event.error.message`、`snapshot.error.message` 或 callback `error.message`。
2. 已知 code / status 可映射為 App locale catalog message；未知 error 回 quick-result stream fallback。
3. 保留 `deltaText` / `fullText` / `text` 作為 AI 生成內容顯示，不把正常 AI 內容誤判為 UI chrome 文案。
4. App en-US 語系下，stream failure UI 必須顯示英文 catalog/fallback，而不是 backend 固定繁中或 runtime diagnostic。

## 方案

1. 在 quick result screen 內新增或復用 App stream error formatter，輸入 `AIStreamEvent['error']` / `AIStreamSnapshot['error']` / `AppStreamError`，輸出 locale-aware fallback。
2. `describeStreamStatus()` 對 `input.error` 改用 formatter；對 `fullText` / `deltaText` / `phase` 維持既有語義。
3. `reduceReady()` / `reduceEvent()` 的 `error` state 改用同一 formatter；`onConnectionError()` / `onTerminalError()` 不再直接寫 `error.message`。
4. 若 catalog 尚缺 quick-result stream failure fallback，補 zh-TW / en-US key。
5. 補 focused tests 覆蓋 stream event raw message、snapshot raw message、connection/terminal raw message 不外露，以及正常 `fullText` / `text` 仍可顯示。

## 邊界

- 不改 `AIStreamEvent` / `AIStreamSnapshot` contract。
- 不改 `useAIStreamSubscription` hook 的重連與 lifecycle 行為。
- 不改 M1 quick judgment API 或 backend stream failed payload。
- 不翻譯 AI 生成的 judgment summary / fullText / delta content；本輪只治理 UI error/status chrome。

## 驗收

1. Focused tests 覆蓋 raw `event.error.message` / `snapshot.error.message` / callback `error.message` 不再顯示。
2. Focused tests 覆蓋 en-US locale fallback。
3. Focused tests 覆蓋 AI `fullText` / `text` 正常顯示不受影響。
4. `npm --prefix mobile run typecheck` 通過。
5. `npm run docs:check` 通過。

## 修復結果

1. `mobile/app/(public)/quick/result.tsx` 已新增 `formatQuickResultStreamError()`，用 `status` / `HTTP_*` / 已知 code 映射 App locale catalog，不再顯示 raw `message`。
2. `describeStreamStatus()` 對 event/snapshot error 改用 formatter；`fullText`、`deltaText`、`phase`、snapshot `text` 的正常 AI 內容顯示維持不變。
3. `reduceReady()` / `reduceEvent()` / `onConnectionError()` / `onTerminalError()` 已統一用 formatter 寫入 `streamState.error`。
4. `mobile/src/i18n/catalogs/zh-TW.ts` 與 `mobile/src/i18n/catalogs/en-US.ts` 已新增 `quick.result.stream.error` fallback。
5. `mobile/__tests__/m1-screens.test.js` 已補 raw stream event error、connection error 不外露，以及 generated text 不被 fallback 覆蓋的回歸測試。

## 本輪驗證

1. `npm --prefix mobile test -- __tests__/m1-screens.test.js` 通過 1 suite / 24 tests。
2. `npm --prefix mobile run typecheck` 通過。
3. `npm --prefix mobile test -- src/i18n/index.test.js __tests__/m1-screens.test.js` 通過 2 suites / 28 tests。
4. 靜態掃描確認 `mobile/app/(public)/quick/result.tsx` 不再包含 `error.message` / `error?.message` 直出；raw `provider down`、`socket exploded`、`服務器錯誤` 僅作測試輸入與否定斷言。
