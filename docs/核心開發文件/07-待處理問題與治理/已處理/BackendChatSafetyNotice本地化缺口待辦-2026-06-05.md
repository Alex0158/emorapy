# Backend Chat Safety Notice 本地化缺口待辦（2026-06-05）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Chat-to-case safety notice message、Web Chat Room、App Chat Room 的 locale 與安全文案一致性
**取證代碼入口**：`backend/src/utils/product-safety-policy.ts`、`backend/src/services/chat.service.ts`、`frontend/src/pages/Chat/Room/components/ChatMessageItem.tsx`、`mobile/app/(app)/chat/room.tsx`
**最後核驗 Commit**：`f7cc34f`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理
**Owner**：Backend / Web / Mobile
**關聯核心文件**：`04-共用機制/07-可訪問性本地化與內容設計治理基線.md`、`20-App端/01-App導航與平台Adapter基線.md`、`50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`

---

## 1. 問題

`backend/src/utils/product-safety-policy.ts` 的 `getChatJudgmentRequestPolicy()` 會為 `crisis_support` / `safety_support` 產生 `noticeMessage`。`backend/src/services/chat.service.ts` 在 request judgment 前會把該 `noticeMessage` 寫入 `chatMessage.content`，message type 為 `safety_notice`。

Web Chat Room `ChatMessageItem` 與 App Chat Room 會直接顯示 `message.content`。因此該安全提示是跨端可見文案，但目前只有繁中，且繁中文案仍使用「判決」而非核心術語「梳理結果 / Analysis」。

## 2. 影響

1. 英文使用者在聊天室請求 Analysis 並觸發 safety route 時，會看到繁中 safety notice。
2. 繁中使用者會在 safety notice 中看到舊術語「判決」，與核心術語表不一致。
3. 因為 notice 已被寫入資料欄位 `chatMessage.content`，Web / App 端側 i18n catalog 不會自動修正。

## 3. 目標

1. `getChatJudgmentRequestPolicy()` 或其消費點必須承接 request locale。
2. `crisis_support` / `safety_support` 的 `noticeMessage` 必須有 zh-TW 與 en-US 版本。
3. zh-TW 版本使用「梳理結果 / 安全支持流程」等核心術語，不再使用「判決」。
4. Web / App 不對 `chatMessage.content` 二次翻譯，只消費 backend 已按 locale 寫入的 safety notice。

## 4. 邊界與注意事項

1. 不改 chat message schema；仍使用 `content` 儲存 safety notice。
2. 不遷移舊 chat message 內容；既有歷史訊息如需修復應另立 data repair 待辦。
3. `reasons`、internal safety flags、log / assessment snapshot 可保留內部診斷語言；只有會進入 UI 的 `noticeMessage` 與 rejection message 需本輪處理。
4. 安全文案不得弱化危機提示，不得把系統能力表述成治療、法律裁決或危機救援。

## 5. 驗收

```bash
npm --prefix backend test -- tests/unit/utils/product-safety-policy.test.ts tests/unit/services/chat.service.test.ts --runInBand
npm --prefix backend run build -- --noEmit
npm run docs:check
```

## 6. 修復紀錄

2026-06-05 已修復：

1. `backend/src/utils/product-safety-policy.ts` 的 chat judgment safety policy 已承接 `BackendLocale`，`crisis_support` / `safety_support` 的 `noticeMessage` 與危機 rejection message 均有 zh-TW / en-US 版本。
2. zh-TW safety notice 已收斂「判決」舊術語，改用「梳理結果 / 安全支持流程」口徑；en-US notice 使用 `Analysis`。
3. `backend/src/services/chat.service.ts` 在 request judgment 前把 request locale 傳入 safety policy，因此寫入 `chatMessage.content` 的 safety notice 已是目標語言。
4. Web / App Chat Room 繼續只顯示 backend message content，不建立端側翻譯表或二次修補歷史訊息。

本輪已通過：

```bash
npm --prefix backend test -- tests/unit/utils/product-safety-policy.test.ts tests/unit/services/chat.service.test.ts --runInBand
```
