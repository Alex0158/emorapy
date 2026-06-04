# Backend Chat 錯誤 Message 本地化與術語缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend chat room / invite / chat-to-case API 錯誤訊息、Web Chat / Case handoff error 顯示、App Chat / Case handoff error 顯示、backend i18n message map
**取證代碼入口**：`backend/src/services/chat.service.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend/src/pages/Chat`、`mobile/app/(app)/chat`
**最後核驗 Commit**：`057ae7d`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/services/chat.service.ts` 的 room permission、invite、message send 與 chat-to-case handoff flow 仍有多個 backend-owned 中文錯誤 message，例如：

- `訊息發送過於頻繁，請稍後再試`
- `你沒有該聊天室權限`
- `只有發起方可發送邀請`
- `邀請碼不存在`
- `邀請碼不可用`
- `聊天室當前狀態不允許接受邀請`
- `只有聊天室成員可發起判決`
- `缺少發起方資訊，無法轉判決`
- `部分訊息不存在或不可納入判決`

這些錯誤會經 `errorHandler` / `responseFormatter` 進入 API error payload；Web / App chat flow 會把 backend error message 顯示給使用者。當 request locale 為 `en-US` 時，目前 `translateBackendMessage()` 沒有覆蓋這批 chat service fallback message，因此英文使用者仍可能看到中文錯誤。同時，chat-to-case 部分繁中 source message 仍沿用舊對外術語「判決」，即使 `zh-TW` locale 也會顯示不符合現行術語治理的文案。

## 影響範圍

- Backend：chat room、chat invite、send message、chat-to-case handoff API error payload。
- Web：Chat room、invite、case handoff flow 顯示 backend error。
- App：Chat room、invite、case handoff flow 顯示 backend error。
- Shared/API client：沿用 backend `error.message`，不應在端側另建中文 message 翻譯表。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋 chat 成功 message、chat-to-case title 與 safety notice，但 chat service 自有 permission / invite / handoff fallback error message 未全量覆蓋。繁中 canonical message 也仍有 `轉判決`、`發起判決`、`納入判決`、`判決生成中` 等舊詞。

## 目標行為

1. `zh-TW` locale 下，chat-to-case user-facing error 使用現行術語「梳理結果」，不再顯示「轉判決 / 發起判決 / 納入判決」。
2. `en-US` locale 下，chat service error message 必須翻譯為英文，且使用 `Analysis` 對應梳理結果。
3. `roomId`、`cursor`、`ISO`、`session_id`、`B 方` 等技術或角色語義不被誤改。
4. 修復集中在 backend i18n / canonical message 層，Web/App/shared client 不新增 ad hoc 中文 message 對照表。

## 修復結果

1. `backend/src/services/chat.service.ts` 已將 chat-to-case user-facing error 的繁中 canonical message 收斂為「梳理結果」術語。
2. `backend/src/i18n/index.ts` 已補齊 chat room permission、invite、message send、cursor 與 chat-to-case handoff error 的 en-US exact message map。
3. `session_id`、`cursor`、`ISO`、`B 方` 等技術或角色語義保留，不在翻譯中改寫為不明確稱呼。
4. Web/App/shared client 不新增端側中文錯誤翻譯表，仍統一消費 backend locale layer。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，15 tests。
- `npm --prefix backend run build`：通過。
- `rg -n "轉判決|發起判決|納入判決|再次發起判決|判決生成中" backend/src/services/chat.service.ts`：無殘留。
- `npm run docs:check`：通過。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
