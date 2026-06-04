# 跨端 Invalid-from-server fallback 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web common apiError、App platform API client、shared api-client fixed diagnostic fallback 與 locale-aware 顯示
**取證代碼入口**：`frontend/src/utils/apiError.ts`、`frontend/src/pages/Interview/Result/index.tsx`、`mobile/src/platform/api/client.ts`、`packages/api-client/src/m2.ts`
**最後核驗 Commit**：`b8c4a7b`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查下一輪確認，Web 通用 `frontend/src/utils/apiError.ts` 與 App `mobile/src/platform/api/client.ts` 的 fixed shared-client error normalization 只匹配 `Invalid ... response from server`。

但 shared api-client 的訪談 M2 路徑存在 `Invalid interview response acknowledgement from server`、`Invalid interview skip acknowledgement from server` 這類固定診斷字串，雖然同樣不是 user-facing 業務文案，卻不符合較窄的 `response from server` pattern。當 `Interview/Result`、Profile 訪談入口或 App platform client 對原始 error 再做可見錯誤提示時，可能直出英文診斷字串，未按目前語言顯示 `apiError.invalidResponse`。

## 影響範圍

- Web：通用 `getErrorMessage()` 使用者，包括 `Interview/Result` retry toast、Profile 訪談入口/重試 toast，以及其他 shared client fixed diagnostic fallback。
- App：`createAppApiClient().normalizeError()` 對 shared `RequestErrorLike` 與 `Error` 的 fixed invalid fallback。
- Shared：不改 `packages/api-client` throw contract，只在端側可見錯誤轉換層處理。
- Backend / Admin：本輪不改。

## 目標行為與方案

1. Web `normalizeVisibleErrorMessage()` 將 fixed server diagnostic pattern 從 `Invalid ... response from server` 放寬為 `Invalid ... from server`。
2. App `isSharedClientInvalidResponseMessage()` 使用同一 pattern。
3. `Invalid ... response acknowledgement from server` / `Invalid ... skip acknowledgement from server` 顯示為目前 locale 的 `apiError.invalidResponse`。
4. 後端/AI/domain 提供的具體非空 message，例如權限、rate limit、安全提醒，仍原樣保留。
5. 不改 API client contract、不改頁面流程、不新增 ad hoc page-level 翻譯 map。

## 驗證方式

- `npm --prefix frontend test -- src/utils/apiError.test.ts src/pages/Interview/Result/index.test.tsx src/assets/i18n/catalogParity.test.ts`
- `npm --prefix mobile test -- src/platform/api/client.test.js src/i18n/index.test.js --runInBand`
- `npm --prefix frontend run build`
- `npm --prefix mobile run typecheck`
- `npm run docs:check`
- 靜態搜尋確認 production normalization pattern 已覆蓋 `Invalid ... from server`。

## Owner / Status Notes

- Owner：agent
- Status：已完成本輪修復，待 commit/push。

## 2026-06-04 本輪結果

1. `frontend/src/utils/apiError.ts` 的 `normalizeVisibleErrorMessage()` 已從 `Invalid ... response from server` 放寬為 `Invalid ... from server`，覆蓋 acknowledgement 類 shared client fixed diagnostic。
2. `mobile/src/platform/api/client.ts` 的 `isSharedClientInvalidResponseMessage()` 已使用同一 pattern，`RequestErrorLike` 與 `Error` 分支都能本地化 acknowledgement 類 fixed fallback。
3. `frontend/src/utils/apiError.test.ts` 已補 zh-TW / en-US acknowledgement 類 fallback；`frontend/src/pages/Interview/Result/index.test.tsx` 已補 retry toast 不直出英文診斷；`mobile/src/platform/api/client.test.js` 已補 App RequestErrorLike / Error 兩條路徑。
4. 已驗證：`npm --prefix frontend test -- src/utils/apiError.test.ts src/pages/Interview/Result/index.test.tsx src/assets/i18n/catalogParity.test.ts`、`npm --prefix mobile test -- src/platform/api/client.test.js src/i18n/index.test.js --runInBand`、`npm --prefix frontend run build`、`npm --prefix mobile run typecheck`、`npm run docs:check` 均通過。
5. 靜態搜尋確認 production normalization pattern 已覆蓋 `Invalid ... from server`；剩餘 acknowledgement 固定字串只在測試 fixture 與本治理文件中作證據。
