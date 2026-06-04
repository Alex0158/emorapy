# Mobile Authenticated Stream Error 本地化缺口待辦（2026-06-04）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App profile interview / repair replan / chat room AI stream status error display、App stream callbacks、M2/M3/M4 screen tests
**取證代碼入口**：`mobile/app/(app)/profile/interview.tsx`、`mobile/app/(app)/repair/index.tsx`、`mobile/app/(app)/chat/room.tsx`、`mobile/src/platform/sse/useAIStreamSubscription.ts`、`mobile/src/platform/api/errorMessages.ts`、`mobile/src/i18n/catalogs`
**最後核驗 Commit**：`cc5d12b`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題

全局語言排查第五十三輪確認 App 已登入側三個 AI stream 畫面仍有 raw error message 可見路徑：

1. `mobile/app/(app)/profile/interview.tsx` 在 stream ready snapshot / event / connection error / terminal error 邊界直接顯示 `error.message`。
2. `mobile/app/(app)/repair/index.tsx` 在 repair replan stream ready snapshot / event / connection error / terminal error 邊界直接顯示 `error.message`。
3. `mobile/app/(app)/chat/room.tsx` 在 chat AI stream ready snapshot / event / connection error / terminal error 邊界直接顯示 `error.message`。

這些畫面的 `error` state 會直接進入可見 FeatureRow / panel 文案，導致使用者切換 en-US 時仍可能看到 backend 固定繁中、provider/runtime diagnostic 或測試舊契約文案。

## 影響範圍

- App Profile Interview stream sync error display。
- App Repair replan stream sync error display。
- App Chat Room mediator draft AI stream error display。
- 不包含 AI 正常生成正文、draft text、fullText / deltaText 的正常內容顯示。

## 目標

1. 三個已登入 App stream 畫面不再直接顯示 event/snapshot/callback raw `error.message`。
2. 已知 status / HTTP code / domain code 顯示 App locale catalog message；未知 error 使用場景對應 stream fallback。
3. 正常 AI generated text 仍可顯示，不被 error fallback 誤覆蓋。
4. 修復邏輯盡量抽共用 helper，避免 profile / repair / chat 三處重複發散。

## 方案

1. 在 App platform 層新增或復用 AI stream visible error formatter，輸入 `{ code, status, message }`，輸出 locale-aware message。
2. Profile Interview / Repair Replan / Chat Room stream ready/event/callback 的 `error` state 全部改用 formatter。
3. 補三個場景的 fallback catalog key 或使用既有 stream disconnected / status catalog。
4. 更新 focused tests，覆蓋 raw event/snapshot/callback message 不外露，以及 generated text 正常保留。

## 邊界

- 不改 AI Stream shared contract。
- 不改 backend stream failed payload。
- 不改 hook lifecycle / retry / foreground recovery。
- 不翻譯 AI 正常生成內容。
- 不處理非 stream API mutation/query error；該類已由 App API normalization 後續單獨掃描。

## 驗收

1. M2 / M3 / M4 focused tests 覆蓋 raw stream error 不外露。
2. en-US locale fallback 覆蓋通過。
3. AI generated text 保留測試通過。
4. `npm --prefix mobile run typecheck` 通過。
5. `npm run docs:check` 通過。
