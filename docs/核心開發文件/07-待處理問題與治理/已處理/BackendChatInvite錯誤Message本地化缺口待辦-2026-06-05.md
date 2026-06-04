# Backend Chat Invite 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend chat invite route fallback error、Web/App chat invite visible error、backend i18n message map
**取證代碼入口**：`backend/src/routes/chat.routes.ts`、`backend/src/services/chat.service.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend/src/services/api/chat.ts`、`frontend/src/pages/Chat/Room/hooks/useChatRoomEntryActions.ts`、`mobile/app/(app)/chat/index.tsx`、`packages/api-client/src/m3.ts`
**最後核驗 Commit**：`e01345f`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/routes/chat.routes.ts` 的 chat invite decline route 仍有 backend-owned 中文錯誤 message 未被 `translateBackendMessage()` 覆蓋：

- `邀請不存在`

當 decline invite 找不到 invite 時，該錯誤會經 backend response message 回到 Web/App chat invite 操作。當 request locale 為 `en-US` 時，未覆蓋 message 仍可能直出繁中。

## 影響範圍

- Backend：chat invite decline route。
- Web：Chat room join / decline invite flow。
- App：Chat invite entry / invite landing flow。
- Shared/API client：M3 chat client 傳遞 backend message，不應端側新增中文錯誤對照。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋 pairing invite、chat room、chat-to-case 等多個 chat service message，但 route-level `邀請不存在` 尚未覆蓋。

## 目標行為

1. `en-US` locale 下，chat invite not-found fallback error 必須由 backend locale layer 輸出英文。
2. `zh-TW` locale 下，原繁中 canonical message 保持不變。
3. 不改 invite lookup、accept/decline side effect、invite code 格式或 Web/App shared chat client。
4. Web/App/shared client 不新增端側中文錯誤翻譯表。

## 分析與方案

1. **業務邏輯輪**：`邀請不存在` 是 decline route 對 service 回傳 null 的 not-found fallback；修復只補翻譯，不改 service contract。
2. **i18n 資料流輪**：route 丟出的 AppError 經 error handler / response formatter 按 request locale 翻譯，應集中補 `directEnUSMap`。
3. **邊界輪**：此 message 與 pairing invite `邀請碼無效/過期/已使用` 不同，不應改成 invite code invalid，也不應透露 invite 是否過期或被使用。
4. **UI/UX 輪**：英文錯誤需短句，可直接用於 toast 或 form-level error。
5. **維護性輪**：新增 backend i18n regression 與 focused static coverage scan。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，25 tests。
- Focused static coverage scan：比對 `backend/src/routes/chat.routes.ts` 中文 invite fallback error 是否被 backend i18n exact map 覆蓋：通過。
- `npm --prefix backend run build`：通過。
- `npm run docs:check`：待本輪文檔回寫後執行。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 `邀請不存在` exact map。
2. `backend/tests/unit/utils/backend-i18n.test.ts` 已新增 chat invite route fallback message regression。
3. 未改 invite lookup、accept/decline side effect、invite code 格式、Web/App chat flow 或 shared M3 client。
4. `邀請不存在` 與 `邀請碼不存在` 維持不同英文語義，避免把 route-level invite not-found 改成 invite-code-specific wording。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
