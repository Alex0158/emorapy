# Backend 回傳訊息英文語系翻譯 Map 缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend API response formatter、錯誤與成功 message、Web/Admin/App API message 顯示語言
**取證代碼入口**：`backend/src/i18n/index.ts`、`backend/src/middleware/responseFormatter.ts`、`backend/src/services/admin-config-rules.ts`、`backend/src/services/chat-message-analysis.ts`、`backend/src/services/media-providers/`
**最後核驗 Commit**：`6f0acbf`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/middleware/responseFormatter.ts` 會依照 `req.locale` 翻譯 `data.message` 與 `data.error.message`，但 `backend/src/i18n/index.ts` 的 `directEnUSMap` 只支援 exact match。靜態差集掃描顯示 backend 仍有多個會進入 API response 或 stream payload 的繁中 message 未覆蓋，例如：

- `backend/src/services/admin-config-rules.ts`：`interview.maxTurns 不可小於 interview.softTarget`、`interview.softTarget 不可大於 interview.maxTurns`
- `backend/src/services/chat-message-analysis.ts`：聊天轉梳理結果的資料缺口提示
- `backend/src/services/execution.service.ts`：`AI 重調失敗`
- `backend/src/services/interview-stream-payload-utils.ts`：`服務內部錯誤`
- `backend/src/services/media-providers/*`：媒體供應商連線測試成功/失敗與 fallback 訊息

英文語系請求若觸發上述訊息，Web / Admin / App 可能原樣顯示繁中，未完整按使用者所選語言顯示。

## 影響範圍

- Web：受影響。`frontend/src/services/request.ts` 與多個 `getErrorMessage()` 路徑會顯示 backend message。
- Admin：受影響。Admin config validation、media provider test connection 會消費 backend message 或 error message。
- App：受影響。App API/SSE adapter 會送 `X-Locale`，但 backend 未翻譯的 message 仍會透出繁中。
- Backend：直接受影響。`translateBackendMessage()` 未覆蓋所有 user-facing response message。
- Shared：間接受影響。`packages/api-client` 會保留 API message 作為 `RequestErrorLike.message`。

## 目前語言處理缺口

1. `directEnUSMap` 沒覆蓋所有繁中 API response / stream payload message。
2. 動態 provider message 使用 template string，exact match 無法翻譯。
3. 聊天資料缺口分析訊息可能成為梳理結果前置品質提示或 metadata 顯示，英文語系仍會是繁中。
4. Admin config / media provider setting 的 validation 與 test result 會混用 Admin catalog 英文與 backend 繁中 message。

## 目標行為

1. 英文語系 API response 中的 backend 自有 message 不再保留繁中。
2. 保留 backend 作為 message 邊界：Web / Admin / App 不新增 ad hoc 分支去猜測 backend 中文。
3. 動態 provider message 以可維護 pattern 翻譯，不要求把 provider display name 本身本地化。
4. `judgment` 相關 user-facing 英文仍使用 `Analysis`，不得把內部 `judgment` 直接暴露成產品文案。

## 修復前分析

- 目標改動點：`backend/src/i18n/index.ts` 的直接翻譯表與動態訊息 pattern；必要時補 backend unit test。
- 替代方案 A：把所有 controller/service message 改為 message key。長期更乾淨，但涉及 response contract 與大量跨層改造，不適合本輪精準修復。
- 替代方案 B：前端攔截中文 message 再翻譯。會在 Web/Admin/App 形成多套 map，違反 backend/API message 邊界。
- 本輪方案：沿用既有 `translateBackendMessage()`，補齊 missing exact messages，並增加少量 pattern translator 處理 provider display name 與 fallback error 片段。
- fallback 邏輯：`zh-TW` 保持原文；`en-US` 先走 exact map，再走 pattern，最後才回退原文。這保留未知訊息的診斷可見性，但已知 user-facing 訊息必須覆蓋。
- Web/App 差異：Web/Admin/App 都只消費 API message；不需要各端新增 catalog key。
- 風險：過度 pattern 可能誤翻 server diagnostics。本輪 pattern 僅覆蓋已知 provider/test/AI stream wording，避免泛化。
- 回滾點：單檔 `backend/src/i18n/index.ts` 與測試，可直接 revert 本提交。

## 驗證方式

- 靜態差集掃描 backend `message: '繁中'` 與 `directEnUSMap` / pattern 覆蓋情況。
- Backend unit test 覆蓋 exact message 與 dynamic provider message 翻譯。
- `npm --prefix backend test -- --runInBand` 或 focused backend test。
- `npm --prefix backend run typecheck`
- `npm run docs:check`

## Owner / Status Notes

- Owner：agent
- Status：已處理
- 注意：server log、ops alert、第三方 API 原始錯誤 detail 不在本輪翻譯範圍；只有會進入 API response / stream payload 的 backend 自有 message 才納入。

## 2026-06-04 本輪結果

已完成：

1. `backend/src/i18n/index.ts` 已補齊 Admin config、chat message analysis、execution replan、interview stream failure 與 media provider test connection 相關 backend-owned message 的 en-US 翻譯。
2. `translateBackendMessage()` 已新增受限 dynamic pattern，處理 provider display name + 固定中文後綴的 success / fallback / failure 訊息；provider 名稱本身不本地化。
3. Backend user-facing `JUDGMENT_*` 與 `判決生成中` / `判決已生成` 的英文輸出已改為 `Analysis` terminology，符合 AGENTS.md 對外術語規則。
4. `backend/tests/unit/utils/backend-i18n.test.ts` 已新增 exact map、dynamic provider message、zh-TW unchanged 與 Analysis terminology 測試。

已驗證：

1. `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts tests/unit/middleware/responseFormatter.test.ts --runInBand`：passed。
2. `npm --prefix backend run build:contracts && npm --prefix backend run build -- --pretty false`：passed。
3. 靜態差集：抽取 `backend/src` 中 response-like `message: '繁中'`，逐一執行 `translateBackendMessage('en-US', message)` 後 `untranslatedResponseMessages=0`。

剩餘邊界：

1. Server log、ops alert 與第三方 API raw detail 仍不作 user-facing 翻譯；若未來進入 Web/Admin/App UI，需另行登記。
2. Shared `packages/api-client` 的 fixed diagnostic fallback 仍屬 client diagnostic；Web/Admin/App adapter 已在各自 visible boundary 轉 locale-aware fallback，shared client 本身不承擔 runtime locale store。
