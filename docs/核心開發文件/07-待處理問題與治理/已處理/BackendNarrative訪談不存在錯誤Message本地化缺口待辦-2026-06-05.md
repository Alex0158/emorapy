# Backend Narrative 訪談不存在錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend narrative extraction not-found fallback error、Web/App profile narrative / psych profile pipeline visible error、backend i18n message map
**取證代碼入口**：`backend/src/services/narrative.service.ts`、`backend/src/services/async-pipeline.service.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/locale.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend/src/pages/Profile`、`mobile/app/(app)/profile`、`packages/api-client/src/m2.ts`
**最後核驗 Commit**：`237bced`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/services/narrative.service.ts` 的 `NarrativeService.extractNarratives()` 在找不到 interview session 時拋出 backend-owned 中文錯誤 message：

- `訪談不存在`

`backend/src/i18n/index.ts` 已覆蓋 `訪談不存在或無權限`，但沒有覆蓋此處更精確的 not-found exact message。當 narrative extraction 被 async pipeline 或 profile narrative / psych profile 相關流程觸發，錯誤進入 API response、pipeline failure status 或端側可見診斷時，`en-US` locale 仍可能漏翻。

## 影響範圍

- Backend：narrative extraction service、async psych/profile pipeline failure path。
- Web：Profile / interview result / psych profile 相關狀態或錯誤呈現。
- App：Profile / interview 相關 screen 與 shared API client error normalization。
- Shared/API client：只傳遞 backend message，不應端側新增中文錯誤對照。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 的 direct map 已有 interview session access 的 `訪談不存在或無權限`，但 `narrative.service.ts` 使用的是不同語義的 `訪談不存在`。兩者不可合併處理：前者刻意隱藏 not-found / no-access 差異，後者是 backend pipeline 內部對 interview session 缺失的精確 not-found 診斷。

## 目標行為

1. `en-US` locale 下，narrative extraction 的 `訪談不存在` 必須由 backend locale layer 輸出英文。
2. `zh-TW` locale 下，原繁中 canonical message 保持不變。
3. 不改 narrative extraction、profile narrative 寫入、AI summary、async pipeline、Web/App profile UI 或 retry UX。
4. Web/App/shared client 不新增端側中文錯誤翻譯表。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`
- Focused static coverage scan：比對 `backend/src/services/narrative.service.ts` 的 backend-owned 中文 error message 是否被 backend i18n exact map 覆蓋。
- `npm --prefix backend run build`
- `npm run docs:check`

## 分析與方案

1. **業務邏輯輪**：`訪談不存在` 表示 narrative extraction 收到的 session id 無法在 `interviewSession` 找到；修復不應改變 session 查詢、domains touched 推導、ProfileNarrative 寫入或 AI summary。
2. **i18n 資料流輪**：backend response formatter / error handler 已統一按 request locale 翻譯 message；缺口只在 exact message map，因此補 `directEnUSMap` 即可。
3. **Web/App 邊界輪**：Web/App/profile/shared client 不應猜測中文 backend message；端側只消費 locale-aware backend response。
4. **UI/UX 輪**：英文文案使用直接、低診斷負擔的 `Interview not found`，避免把 async pipeline implementation detail 暴露給用戶。
5. **維護性輪**：新增 regression test 與 focused source scan，確保 `訪談不存在` 不再被 `訪談不存在或無權限` 的近似覆蓋掩蓋。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 `訪談不存在` exact map，`en-US` 輸出 `Interview not found`。
2. `backend/tests/unit/utils/backend-i18n.test.ts` 已新增 `訪談不存在` regression，避免被 `訪談不存在或無權限` 的相近字串掩蓋。
3. Focused static coverage scan 已確認 `backend/src/services/narrative.service.ts` 的 backend-owned 中文 error message 被 backend i18n exact map 覆蓋。
4. 未改 narrative extraction、profile narrative 寫入、AI summary、async pipeline、Web/App profile UI 或 retry UX；Web/App/shared client 仍只消費 backend locale-aware response。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
