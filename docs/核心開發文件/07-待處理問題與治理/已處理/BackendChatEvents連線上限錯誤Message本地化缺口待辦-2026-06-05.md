# Backend Chat Events 連線上限錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend chat SSE listener limit error、Web/App chat real-time connection visible error、backend i18n message map
**取證代碼入口**：`backend/src/services/chat-events.service.ts`、`backend/src/routes/chat.routes.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/locale.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend/src/services/api/chat.ts`、`frontend/src/pages/Chat/Room/index.tsx`、`mobile/app/(app)/chat`、`packages/api-client/src/m3.ts`
**最後核驗 Commit**：`a761b13`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/services/chat-events.service.ts` 的 chat SSE listener limit guard 仍有 backend-owned 中文錯誤 message 未被 `translateBackendMessage()` 覆蓋：

- `聊天室即時連線已達上限，請稍後重試`

當同一聊天室即時連線超過上限時，`/api/v1/chat/rooms/:roomId/stream` 會回傳 `RATE_LIMIT_EXCEEDED`。當 request locale 為 `en-US` 時，未覆蓋 message 仍可能直出繁中。

## 影響範圍

- Backend：chat events service、chat SSE route。
- Web：Chat room SSE connection failure / terminal error display。
- App：Chat room realtime / polling fallback connection error display。
- Shared/API client：只傳遞 backend message，不應端側新增中文錯誤對照。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋 chat room、invite、chat-to-case controller/service-level error，但 chat events listener limit fallback 尚未覆蓋。

## 目標行為

1. `en-US` locale 下，chat SSE listener limit error 必須由 backend locale layer 輸出英文。
2. `zh-TW` locale 下，原繁中 canonical message 保持不變。
3. 不改 listener 上限、SSE subscribe/unsubscribe、heartbeat、Web retry / polling fallback 或 App realtime behavior。
4. Web/App/shared client 不新增端側中文錯誤翻譯表。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`
- Focused static coverage scan：比對 `backend/src/services/chat-events.service.ts` 中文 listener limit error 是否被 backend i18n exact map 覆蓋。
- `npm --prefix backend run build`
- `npm run docs:check`

## 分析與方案

1. **業務邏輯輪**：`聊天室即時連線已達上限，請稍後重試` 是同一聊天室 listener 數達 `maxListenersPerRoom = 200` 時的 backpressure guard；修復不應調整連線上限或 subscribe/unsubscribe 行為。
2. **i18n 資料流輪**：chat stream route 的 AppError 經 `errorHandler` 按 request locale 翻譯；`RATE_LIMIT_EXCEEDED` code 有 generic 英文，但 fallback message 才能提供 chat realtime 的具體語境，因此補 `directEnUSMap`。
3. **Web/App 邊界輪**：Web/App SSE client 可將 backend message 顯示為 terminal / retry error，但不應在端側新增中文 message map。
4. **UI/UX 輪**：英文文案需說明 realtime connection limit，並提示稍後重試；不暴露 listener implementation 或數值上限。
5. **維護性輪**：新增 backend i18n regression 與 focused source coverage scan，避免 chat realtime service-level fallback message 再漏翻。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 `聊天室即時連線已達上限，請稍後重試` exact map。
2. `backend/tests/unit/utils/backend-i18n.test.ts` 已新增 chat realtime listener limit regression。
3. 未改 listener 上限、SSE subscribe/unsubscribe、heartbeat、Web retry / polling fallback 或 App realtime behavior。
4. `zh-TW` canonical message 保持原文；`en-US` 由 backend locale layer 輸出 `Chat real-time connection limit reached. Please try again later`。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
