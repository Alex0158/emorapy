# Backend Unknown AppError Code Fallback 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend `AppError` unknown code fallback、CORS denied API error、本機 / Web / Admin / App API error 顯示語言
**取證代碼入口**：`backend/src/app.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/i18n/index.ts`、`backend/tests/unit/middleware/errorHandler.test.ts`、`backend/tests/unit/utils/backend-i18n.test.ts`
**最後核驗 Commit**：`daf9ba5`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/middleware/errorHandler.ts` 的 `AppError` 分支使用：

```ts
translateErrorByCode(locale, safeErr.code, safeErr.message)
```

`translateErrorByCode()` 對已知 code 會使用 locale catalog，但對未知 code 直接回傳 fallback。`backend/src/app.ts` 實際存在未知 code：

```ts
new AppError(403, 'CORS_ORIGIN_DENIED', '不允許的來源')
```

因此英文語系下：

```txt
CORS_ORIGIN_DENIED -> 不允許的來源
```

即使 `directEnUSMap` 已有 `不允許的來源 -> Origin is not allowed`，unknown-code AppError fallback 不會走 `translateBackendMessage()`，導致 Web / Admin / App 或本機開發版 API error 仍可能顯示繁中。

## 影響範圍

- Backend：直接受影響。CORS denied response 的 unknown AppError code fallback 未本地化。
- Web / Admin / App：間接受影響。被 CORS / origin policy 拒絕時，API response message 可能不是所選語言。
- Shared：間接受影響。API client 可保留 backend error message。

## 目前語言處理缺口

1. `translateErrorByCode('en-US', 'CORS_ORIGIN_DENIED', '不允許的來源')` 回傳繁中。
2. unknown AppError code fallback 沒有復用 backend message map。
3. `errorHandler.test.ts` 只驗證 default zh-TW CORS unknown code warn，沒有 en-US regression。

## 目標行為

1. 已知 code 行為保持不變：優先回 `enUSByCode` / `zhTWByCode` catalog。
2. 未知 code 但 fallback 是 backend-owned message 時，en-US 應走 `translateBackendMessage()`。
3. `CORS_ORIGIN_DENIED` 在 en-US 下輸出 `Origin is not allowed`。
4. zh-TW fallback 保持原文。

## 修復前分析

- 目標改動點：`backend/src/i18n/index.ts` 的 `translateErrorByCode()` fallback 分支；補 backend i18n 與 errorHandler tests。
- 替代方案 A：把 `CORS_ORIGIN_DENIED` 加入 `enUSByCode`。可解單點，但 unknown AppError fallback 仍會漏。
- 替代方案 B：把 CORS 改用 `Errors.FORBIDDEN('不允許的來源')`。會丟失 CORS-specific code，影響既有 integration tests 與診斷，不採用。
- 本輪方案：已知 code 仍用 code catalog；未知 code 的 fallback 交給 `translateBackendMessage(locale, fallback)`，復用既有 backend message map 與 dynamic pattern。
- fallback 邏輯：若沒有 fallback，仍回 code；若有 fallback，zh-TW unchanged、en-US map/dynamic translated。
- UI/UX：CORS / origin denied error 在英文語系不再顯示繁中；不改 HTTP status/code。
- 風險：低。只改 unknown code + fallback 分支；已知 code 不受影響。
- 回滾點：回滾 `backend/src/i18n/index.ts` 與兩個 backend unit test。

## 驗證方式

1. `npm --prefix backend test -- tests/unit/middleware/errorHandler.test.ts tests/unit/utils/backend-i18n.test.ts --runInBand`
2. `npm --prefix backend run build -- --pretty false`
3. 靜態檢查 `translateErrorByCode('en-US', 'CORS_ORIGIN_DENIED', '不允許的來源')` 不含 CJK。
4. `npm run docs:check`

## Owner / Status Notes

- Owner：agent
- Status：已處理
- 注意：本輪不改已知 error code 的 generic catalog 優先策略；只處理 unknown code fallback 的語言外露問題。

## 2026-06-04 本輪結果

已完成：

1. `backend/src/i18n/index.ts` 的 `translateErrorByCode()` 已保持已知 code catalog 優先，並在 unknown code + fallback 時改走 `translateBackendMessage(locale, fallback)`。
2. `CORS_ORIGIN_DENIED` 的 fallback `不允許的來源` 在 en-US 下輸出 `Origin is not allowed`。
3. `backend/tests/unit/utils/backend-i18n.test.ts` 已新增 unknown AppError code fallback regression，覆蓋 en-US、zh-TW 與無 fallback 時回 code。
4. `backend/tests/unit/middleware/errorHandler.test.ts` 已新增 response-level regression，直接驗證 `CORS_ORIGIN_DENIED` 在 `req.locale='en-US'` 下不再外露繁中。

已驗證：

1. `npm --prefix backend test -- tests/unit/middleware/errorHandler.test.ts tests/unit/utils/backend-i18n.test.ts --runInBand`：passed，2 suites / 26 tests。
2. `npm --prefix backend run build -- --pretty false`：passed。
3. 靜態檢查 `translateErrorByCode('en-US', 'CORS_ORIGIN_DENIED', '不允許的來源')` 不含 CJK，輸出 `Origin is not allowed`。

剩餘邊界：

1. 已知 error code 仍優先使用 generic code catalog，不因 custom fallback 改變 public message；此為既有錯誤模型策略。
2. 未知 code fallback 若不是 backend-owned message，仍可能保持原文作 diagnostics；本輪只保證已登記在 backend message map / dynamic translator 的 fallback 會按 locale 翻譯。
