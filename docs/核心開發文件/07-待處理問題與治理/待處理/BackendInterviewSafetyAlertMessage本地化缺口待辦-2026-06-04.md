# Backend Interview Safety Alert Message 本地化缺口待辦（2026-06-04）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend Interview safety alert SSE / AI stream phase payload、Web Interview SafetyAlert display、focused tests
**取證代碼入口**：`backend/src/services/interview-response-success-events.ts`、`backend/src/services/interview-stream-payload-utils.ts`、`backend/src/services/interview-ai-response-finalizer.ts`、`frontend/src/pages/Interview/Chat/index.tsx`、`frontend/src/store/interviewStore.ts`
**最後核驗 Commit**：`71a91a8`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題

全局語言排查第五十一輪確認 Interview safety alert 仍把 AI metadata 原文作可見 UI copy：

1. Prompt 要求模型在 metadata JSON 內輸出 `safety_message`，內容為「具體觀察到的信號」。
2. `backend/src/services/interview-response-success-events.ts` 在 `parsedMeta.safety_flag && parsedMeta.safety_message` 時，把 `parsedMeta.safety_message` 直接發成 SSE safety alert `{ message, severity }`。
3. 同一 raw message 也經 `buildInterviewStreamSafetyAlertPayload(parsedMeta.safety_message)` 寫入 AI Stream `safety_alert` phase metadata。
4. `frontend/src/pages/Interview/Chat/index.tsx` 讀取 `stream.phase safety_alert` metadata message 後呼叫 `applyStreamSafetyAlert()`；`frontend/src/store/interviewStore.ts` 再把 `data.message` 原樣放入 `safetyAlert.message`，最後 `SafetyAlert` component 直接渲染。

因此使用者切 `en-US` 時，AI metadata 仍可能是繁中，或者不同模型輸出不可控文案，蓋過當前語言的受控 UI 文案。

## 影響範圍

- Backend Interview respond / skip 成功後的 safety alert SSE event。
- Backend AI Stream `interview_session` 的 `stream.phase` / `safety_alert` metadata。
- Web Interview Chat `SafetyAlert` visible message。
- 不改 `safety_detail` / `parsedMeta.safety_message` 的 DB 保存，因為該欄位可作內部風險觀察。

## 目標

1. 可見 safety alert message 不再使用 AI `safety_message` 原文。
2. Backend 根據 request locale 發送受控安全提示文案。
3. `safety_detail` 繼續保存具體 AI 觀察，供後續內部審計或風險判定。
4. Web 前端不需要猜測或翻譯 AI 自然語言；只承接 backend 已本地化的可見 payload。

## 方案

1. 新增受控 backend message，例如 `系統偵測到安全風險，已先切換到安全支持回應。`，並在 `backend/src/i18n/index.ts` 補 en-US mapping。
2. `buildInterviewStreamSafetyAlertPayload()` 改為接受 `locale`，回傳受控 locale-aware message 與 warning severity。
3. `emitInterviewResponseSuccessEvents()` 接受 `locale`，SSE safety alert 和 AI Stream phase 都使用同一受控 payload message。
4. `finalizeInterviewAIResponse()` 與 `InterviewService.respond()` 把 request locale 傳入 success events。
5. 更新 backend focused tests，確認 AI `safety_message` 仍寫入 DB `safety_detail`，但可見 SSE / stream phase message 改為 locale-aware generic message。
6. 更新 Web store / page focused tests，確認 `applyStreamSafetyAlert()` 對缺失 message 使用 `interview.safetyAlert` 類 catalog fallback，並且 route event 承接 backend message。

## 邊界

- 不翻譯或重寫 AI 回覆正文。
- 不移除 `safety_message` metadata parsing，也不改 `interviewTurn.safety_detail` 保存語義。
- 不把任意 backend/model message 加入白名單；可見 UI copy 必須走受控 catalog/direct map。
- 若未來需要展示具體風險類型，應新增 code / category 欄位，再由前端 catalog mapping，而不是顯示 `safety_message` 原文。

## 驗收

1. Backend focused tests 覆蓋 safety alert SSE / stream phase 不外露 `parsedMeta.safety_message`。
2. Backend en-US locale test 覆蓋 safety alert 可見 message 英文化。
3. Web focused tests 覆蓋 safety alert missing message fallback 與 route event 傳遞。
4. `npm --prefix backend test -- tests/unit/services/interview-response-success-events.test.ts tests/unit/services/interview-stream-payload-utils.test.ts tests/unit/services/interview.service.test.ts --runInBand` 通過。
5. `npm --prefix frontend test -- src/store/interviewStore.test.ts src/pages/Interview/Chat/index.test.tsx src/components/business/Interview/SafetyAlert/index.test.tsx src/assets/i18n/catalogParity.test.ts` 通過。
6. Backend / frontend build 與 `npm run docs:check` 通過。
