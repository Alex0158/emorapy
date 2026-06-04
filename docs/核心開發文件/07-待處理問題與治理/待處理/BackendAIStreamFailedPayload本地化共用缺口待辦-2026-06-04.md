# Backend AI stream.failed payload 本地化共用缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend M1 quick judgment、M3 chat AI、M4 repair replan 的 AI stream failure payload 與 request locale 傳遞
**取證代碼入口**：`backend/src/services/ai-stream-failure-payload-utils.ts`、`backend/src/services/judgment.service.ts`、`backend/src/services/chat-ai-orchestrator.service.ts`、`backend/src/services/chat.service.ts`、`backend/src/services/execution.service.ts`
**最後核驗 Commit**：`45103b6`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查下一輪確認，訪談 stream failure 已補 locale-aware payload，但其他 AI stream source 仍有本地化缺口：

- M3 `chat-ai-orchestrator.service.ts` 的 `CHAT_AI_STREAM_FAILED` 直接發布 `err.message`。
- M4 `execution.service.ts` 的 `REPLAN_FAILED` 直接發布 `error.message` 或固定繁中 `AI 重調失敗`。
- M1 `judgment.service.ts` 的 quick judgment stream failure 使用受控 `failureReason`，但文案固定繁中；英文語系使用者仍可能在 App / Web stream failed state 看到繁中文案。

這些 `stream.failed` event 不經 Express `responseFormatter`，端側 reducer 會直接使用 `event.error.message`，因此必須在 backend stream payload 邊界完成 locale-aware 可見文案治理。

## 影響範圍

- M1 快速/正式案件梳理 stream failure。
- M3 Chat room AI response stream failure。
- M4 Repair track replan stream failure。
- Web / App 端所有使用 AI stream snapshot / event `error.message` 顯示的頁面。
- 不影響 AI 生成內容、不改 SSE schema、不改 reconnect / persisted / cancelled 狀態機。

## 目標行為與方案

1. 新增共用 `buildAIStreamFailurePayload()`，集中處理 AI stream failed 可見 error payload。
2. 已知 stream error code 使用 backend i18n code map 產生 locale-aware message。
3. 受控繁中 fallback message（例如 judgment failure reason）在 en-US 下使用 backend message map 翻譯；若沒有翻譯，不把繁中或 raw runtime message 推給 UI。
4. 未知 provider / runtime / DB 診斷回 generic fallback，不直接顯示 `Error.message`。
5. Controller / service 將 `req.locale` 傳入 judgment、chat AI 與 repair replan 的 async stream 任務。

## 邊界與注意事項

- 不翻譯所有英文 `Error.message`，避免誤把 provider 診斷當產品文案。
- `error.code` 必須保留，供端側狀態、log、metrics 與後續治理使用。
- Judgment case DB 的 `judgment_failure_reason` 可繼續保存既有繁中內部原因，本輪只治理 stream event 可見 payload。
- 不把端側 reducer 改成吞掉所有 backend message；source payload 已在 backend 邊界治理。

## 驗證方式

- `npm --prefix backend test -- tests/unit/services/ai-stream-failure-payload-utils.test.ts tests/unit/services/chat-ai-orchestrator.service.test.ts tests/unit/services/chat.service.test.ts tests/unit/services/execution.service.test.ts tests/unit/services/judgment.service.test.ts tests/unit/controllers/judgment.controller.test.ts tests/unit/routes/chat.routes.test.ts --runInBand`
- `npm --prefix backend run build`
- `npm run docs:check`
- 靜態復查確認 `aiStreamService.failed(...)` 非訪談呼叫不再直接傳 raw `error.message` 作可見 payload。

## Owner / Status Notes

- Owner：agent
- Status：已修復並完成本輪驗證。

## 本輪修復結果

1. 新增 `backend/src/services/ai-stream-failure-payload-utils.ts`，集中建立 AI stream failed 可見 payload：已知 code 走 backend i18n code map，受控繁中 backend message 在 en-US 下走 message map，未知 provider/runtime 診斷回 generic fallback。
2. `backend/src/services/judgment.service.ts` 已改用共用 helper；M1 judgment stream failure 會按 request locale 發送 `JUDGMENT_STREAM_TIMEOUT` / `JUDGMENT_STREAM_FAILED` 的可見 message，不再把固定繁中 failure reason 直接推給英文使用者。
3. `backend/src/services/chat-ai-orchestrator.service.ts` 已改用共用 helper；M3 chat AI `CHAT_AI_STREAM_FAILED` 不再發布 raw `err.message`。
4. `backend/src/services/execution.service.ts` 已改用共用 helper；M4 repair replan `REPLAN_FAILED` 不再發布 raw `error.message` 或固定繁中 fallback。
5. `backend/src/controllers/judgment.controller.ts`、`backend/src/controllers/case.controller.ts`、`backend/src/routes/chat.routes.ts`、`backend/src/controllers/reconciliation.controller.ts`、`backend/src/services/chat.service.ts` 已把 request locale 傳入 judgment、chat judgment、chat AI 與 repair replan 的 async stream 任務邊界。
6. 已驗證：backend focused tests 7 個 suite / 179 tests 通過；`npm --prefix backend run build` 通過。
