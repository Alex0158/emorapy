# App API Client Runtime Message 本地化缺口待辦（2026-06-04）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App platform API error normalization、M1-M5 screen visible error display、App i18n catalog fallback
**取證代碼入口**：`mobile/src/platform/api/client.ts`、`mobile/src/platform/api/client.test.js`、`mobile/app`、`mobile/src/features`、`mobile/src/i18n`
**最後核驗 Commit**：`07e5bf3`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查第五十四輪確認，App platform API client 的普通 runtime `Error` fallback 仍會把 `Error.message` 直接放入 `RequestErrorLike.message`：

- `mobile/src/platform/api/client.ts` 的 `normalizeError()` 在 `error instanceof Error` 且不是 shared invalid-response / `SyntaxError` / `SSE stream disconnected` 時，回傳 `toRequestError('APP_ERROR', error.message)`。
- App 多數 screen 以 `normalizeM1Error(error).message`、`normalizeM2Error(error).message`、`normalizeM3Error(error).message`、`normalizeM4Error(error).message`、`normalizeM5Error(error).message` 作可見錯誤文案。
- 因此本機 adapter、query/mutation、React Query 或平台 runtime 若丟出 `new Error('local failure')`、英文 provider diagnostic 或固定繁中診斷，就可能在使用者選擇 `en-US` 或其他 locale 時直出，沒有走 App catalog fallback。

## 影響範圍

- App：受影響。涵蓋 public quick/auth、authenticated profile/interview/chat/case/repair/notifications 等使用 `normalizeM*Error(...).message` 的 visible error path。
- Shared：間接受影響。`@cj/api-client` domain normalizer 會消費 platform `RequestErrorLike`。
- Backend：不直接改。HTTP response / stream payload 本地化由 backend / App stream 各自待辦處理。
- Web / Admin：不直接改；Web / Admin 已有獨立 request / api error normalization 待辦。

## 目前語言處理缺口

1. 普通 App runtime `Error.message` 仍可能成為可見 UI 文案。
2. 既有 App API client 測試明確期待 `new Error('local failure')` 保留原文，與「UI 不外露 raw diagnostic」目標相反。
3. Screen 層大量 `.message` 顯示路徑目前依賴 platform normalization；若 central adapter 不收斂，逐頁修補會重複且容易漏掉。

## 目標行為

1. 普通 App runtime `Error` 不再直接外露 `error.message`。
2. 使用者可見 message 固定使用目前 App locale 的 unknown fallback：`發生未知錯誤，請稍後再試。` / `An unknown error occurred. Please try again later.`。
3. 保留以下受控例外：
   - shared invalid-response fixed diagnostic 映射到 invalid-response locale fallback；
   - `SyntaxError` 映射到 invalid-response locale fallback；
   - `SSE stream disconnected` 映射到 stream disconnected locale fallback；
   - 已是 `RequestErrorLike` 且不是 shared invalid-response diagnostic 的 typed app/domain error 保持其 code/message/details，避免破壞 domain client 已本地化錯誤。
4. 不改 screen UI 結構，不新增頁面級 ad hoc 語言分支。

## 深入分析與方案

### 目標改動點

- `mobile/src/platform/api/client.ts`：只修改普通 `Error` fallback，將 `error.message` 改為 `getLocalizedUnknownMessage()`。
- `mobile/src/platform/api/client.test.js`：把舊 raw message 契約改成 locale-aware fallback 契約，補 zh-TW / en-US 驗證。

### 替代方案

- 逐頁替換 `normalizeM*Error(error).message`：不採用。這會把同一安全邊界散落到每個 screen，且無法阻止未來新增 screen 再次直出。
- 保留 raw message 但只針對英文語系翻譯：不採用。runtime diagnostic 不是穩定翻譯資源，且可能含敏感或技術細節。
- 在 shared domain normalizer 裡覆蓋 `APP_ERROR`：不採用。App platform 才知道目前 locale 與 native/runtime diagnostic 邊界；shared package 應保持 platform-agnostic。

### 業務邏輯與資料流

1. App API/SSE adapter 以 `getLocale()` 送 `X-Locale`，backend-owned response message 由 backend locale middleware / formatter 處理。
2. Domain API client 或 React Query error 進入 screen 前會經過 `normalizeM*Error()` / platform `normalizeError()`。
3. Screen 目前顯示 `.message`，因此 platform normalization 是最後一道阻止 raw runtime diagnostic 進入 UI 的中央邊界。

### 邊界與注意事項

- 不翻譯 AI 正常生成內容；AI generated text 不屬 runtime error diagnostic。
- 不更改 HTTP status fallback、network fallback、invalid response fallback、stream disconnected fallback。
- 不移除 details；typed backend/domain error 的 details 仍供調試或程式判斷，但不應在 UI 直接顯示。
- logger / telemetry 若需要 raw error，應在 observability 邊界保留，不應混入 user-facing message。

### UI / UX

- 使用者看到與目前 App locale 一致的通用錯誤文案。
- 不在表單、toast、FeatureRow 中暴露英文技術診斷或另一語言。
- 保持現有 screen 互動流程與錯誤容器，不造成 layout / navigation 變動。

## 驗證方式

1. `npm --prefix mobile test -- src/platform/api/client.test.js src/i18n/index.test.js`
2. `npm --prefix mobile run typecheck`
3. 靜態搜尋確認 `mobile/src/platform/api/client.ts` 不再存在 `toRequestError('APP_ERROR', error.message)`。
4. 靜態搜尋確認剩餘 `error.message` 僅為受控偵測、telemetry / boundary 診斷或非本輪 scope。
5. `npm run docs:check`

## Owner / Status Notes

- Owner：agent
- Status：已完成本輪修復。後續全局語言排查若發現其他 App visible error path 仍直出 raw message，需另行登記。
- 後續：繼續全局語言排查下一輪。

## 修復結果

1. `mobile/src/platform/api/client.ts` 的普通 `Error` fallback 已由 `toRequestError('APP_ERROR', error.message)` 改為 `toRequestError('APP_ERROR', getLocalizedUnknownMessage())`。
2. shared invalid-response fixed diagnostic、`SyntaxError`、`SSE stream disconnected` 與 typed `RequestErrorLike` 分支保持原有受控映射，不影響 domain/API 已本地化錯誤。
3. `mobile/src/platform/api/client.test.js` 已把舊 raw `local failure` 契約改成 zh-TW / en-US unknown fallback 契約，並用 `provider down` 釘住未知 runtime diagnostic 不外露。
4. M1-M5 screen 仍可使用既有 `normalizeM*Error(...).message`，但普通 runtime `APP_ERROR` 現在已在 platform normalization 中被本地化。

## 本輪驗證

1. `npm --prefix mobile test -- src/platform/api/client.test.js src/i18n/index.test.js` 通過 2 suites / 10 tests。
2. `npm --prefix mobile test -- __tests__/m1-screens.test.js __tests__/m2-screens.test.js __tests__/m3-screens.test.js __tests__/m4-screens.test.js __tests__/m5-notifications.test.js` 通過 5 suites / 74 tests。
3. `npm --prefix mobile run typecheck` 通過。
4. 靜態搜尋確認 `toRequestError('APP_ERROR', error.message)` 已無結果；`mobile/src/platform/api/client.ts` 內剩餘 `error.message` 僅用於 shared invalid-response / `SSE stream disconnected` 受控偵測。
