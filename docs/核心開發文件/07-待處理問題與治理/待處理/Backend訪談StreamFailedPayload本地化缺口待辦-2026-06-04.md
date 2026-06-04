# Backend 訪談 stream.failed payload 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend 訪談 AI stream failure payload、背景 respond / skip locale 傳遞、Web / App stream failed 可見錯誤來源
**取證代碼入口**：`backend/src/services/interview-stream-payload-utils.ts`、`backend/src/services/interview-response-settlement.ts`、`backend/src/services/interview.service.ts`、`backend/src/controllers/interview.controller.ts`
**最後核驗 Commit**：`965904c`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查下一輪確認，訪談 AI stream 的 `stream.failed` event 不經 Express `responseFormatter`，原本由 `buildInterviewStreamFailedPayload()` 直接把 `Error.message` 寫入 `error.message`：

- Web / App 端 stream reducer 會保留 `stream.failed.error.message`，所以後端一旦發布 `provider down`、`db write failed` 這類 runtime 診斷，前台會直接顯示不按所選語言處理的英文訊息。
- HTTP respond / skip 入口有 `localeMiddleware`，但背景 stream settlement 沒有把 `req.locale` 傳到 async respond 任務，因此 stream failure payload 無法可靠知道當次請求語言。
- Backend 一般 API response 已有 `responseFormatter` / `errorHandler` 本地化，本輪缺口只在 AI stream event payload。

## 影響範圍

- Backend `POST /interviews/:id/respond` 與 `POST /interviews/:id/skip` 啟動的背景 AI stream。
- Web 訪談 chat stream store 與 App M2 profile interview stream 對 `stream.failed.error.message` 的顯示來源。
- 不影響一般 HTTP API error response、不影響 stream event schema、不影響 AI 生成文字、不影響 SSE reconnect / cancelled / persisted 狀態機。

## 目標行為與方案

1. `buildInterviewStreamFailedPayload()` 支持可選 `locale`，由 stream settlement 傳入。
2. 已知錯誤碼使用 `translateErrorByCode(locale, code)` 產生可見 message，例如 `AI_CALL_FAILED` 在 `en-US` 下顯示 `AI call failed`。
3. 未知 runtime / provider / DB 診斷不直接進入 UI，改用 stream 專用 generic fallback：`服務內部錯誤` / `Internal service error`。
4. `respond` / `skip` controller 把 `req.locale` 傳給 `interviewService.submitResponse()` / `submitSkip()`，背景任務再傳給 `respond()`、`skipTurn()` 與 settlement。
5. 保留 `error.code`，方便前端、log、metrics 或後續治理判斷，但不把 raw `Error.message` 當成可見文案。

## 邊界與注意事項

- 不翻譯所有英文 `Error.message`，避免把第三方/provider 診斷誤當產品文案。
- zh-TW 下若未知 code 但 message 已是中文業務訊息，可保留；en-US 下只有已知 backend message map 能翻譯，否則回 generic fallback。
- 不覆蓋 `responseFormatter` 已處理的一般 API response；本輪只補 stream event 不經 middleware 的缺口。
- 不改 Web / App reducer 對具體 stream message 的保留策略，因 source payload 已在 backend 邊界治理。

## 驗證方式

- `npm --prefix backend test -- tests/unit/services/interview-stream-payload-utils.test.ts tests/unit/services/interview-response-settlement.test.ts tests/unit/services/interview.service.test.ts --runInBand`
- `npm --prefix backend run build`
- `npm run docs:check`
- 靜態復查確認 `buildInterviewStreamFailedPayload()` 不再直接發布 raw `Error.message`，且 respond / skip controller 會把 `req.locale` 傳入背景任務。

## Owner / Status Notes

- Owner：agent
- Status：已完成本輪修復與驗證，待 commit/push。

## 2026-06-04 本輪結果

1. `backend/src/services/interview-stream-payload-utils.ts` 已讓 `buildInterviewStreamFailedPayload()` 支持 `locale`，並將可見 `error.message` 收斂為：
   - 已知 error code：使用 `translateErrorByCode(locale, code)`。
   - 未知 runtime / provider / DB 診斷：使用 `服務內部錯誤` / `Internal service error`。
   - zh-TW 下未知 code 但已是中文業務訊息：保留原 message。
2. `backend/src/services/interview-response-settlement.ts` 已把 locale 傳入 failed payload builder，`error.code` 仍保留供前端狀態、log 與後續治理使用。
3. `backend/src/services/interview.service.ts` 與 `backend/src/controllers/interview.controller.ts` 已把 `req.locale` 從 respond / skip HTTP 入口傳入背景 stream 任務，避免 async settlement 丟失使用者所選語言。
4. `backend/tests/unit/services/interview-stream-payload-utils.test.ts`、`backend/tests/unit/services/interview-response-settlement.test.ts`、`backend/tests/unit/services/interview.service.test.ts` 已覆蓋已知 code 本地化、未知英文診斷不外露、en-US fallback、latestText 保留與背景 locale 傳遞。
5. 已驗證：`npm --prefix backend test -- tests/unit/services/interview-stream-payload-utils.test.ts tests/unit/services/interview-response-settlement.test.ts tests/unit/services/interview.service.test.ts --runInBand`、`npm --prefix backend run build`、`npm run docs:check` 均通過。
6. 靜態復查確認 `stream.failed` payload 不再直接發布 raw `Error.message`；剩餘 `error.message` 只在受控 helper 內用於 code/map/generic fallback 判斷。
