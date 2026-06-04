# Admin request response message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Admin Web request service success=false envelope、HTTP response error normalization、Admin pages API error fallback
**取證代碼入口**：`frontend-admin/src/services/request.ts`、`frontend-admin/src/services/request.test.ts`、`frontend-admin/src/assets/i18n`
**最後核驗 Commit**：`d68cb47`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查下一輪確認，Admin Web request service 仍會優先使用 response body message 作可見錯誤：

- `frontend-admin/src/services/request.ts` 的 `success=false` envelope 分支使用 `err.message || t('adminApi.error.requestFailed')`。
- HTTP response error 分支使用 `apiError.message || getLocalizedStatusMessage(status)`。
- `frontend-admin/src/services/request.test.ts` 仍明確要求 backend-provided message 優先於 Admin fallback。

這會讓 Admin 在 en-US 或其他非 zh-TW 語系下，因後端固定繁中 message 或 raw diagnostic 覆蓋 Admin locale catalog fallback，導致錯誤顯示不按 Admin 所選語言。

## 影響範圍

- Admin Web 所有透過 `frontend-admin/src/services/request.ts` 的 API consumer。
- success=false API envelope reject payload。
- HTTP response error reject payload。
- 不影響 Admin unknown runtime branch；該分支已在前輪固定為 `adminApi.error.unknown`。

## 目標行為與方案

1. Admin success=false envelope 可見 message 改為 `adminApi.error.requestFailed` catalog fallback。
2. Admin HTTP response error 可見 message 改為 status-based Admin catalog fallback。
3. 保留 `code` / `details`，讓頁面仍可做權限、衝突或 validation 分支。
4. 若未來要顯示某些 backend 受控 message，必須建立顯式白名單；本輪不默認信任所有 response body message。

## 邊界與注意事項

- 不改 backend response formatter 或 Admin `X-Locale` header。
- 不改 Admin page-level toast 文案。
- 不改 invalid Admin identity response fallback；那是 shared API client fixed diagnostic normalization。

## 驗證方式

- `npm --prefix frontend-admin test -- src/services/request.test.ts src/assets/i18n/catalogParity.test.ts`：通過 2 files / 9 tests。
- `npm --prefix frontend-admin run build`：通過。
- `npm run docs:check`：待提交前執行。
- 靜態復查已確認 `frontend-admin/src/services/request.ts` 不再用 `err.message` / `apiError.message` 作可見 fallback。

## 修復結果

1. `frontend-admin/src/services/request.ts` 的 success=false envelope 分支已改為 `adminApi.error.requestFailed` catalog fallback，不再直接承接 response body `message`。
2. HTTP response error 分支已改為 status-based Admin catalog fallback，保留 `code` / `details`。
3. `frontend-admin/src/services/request.test.ts` 已把舊的「backend-provided message 優先」契約改為 raw message 不外露，並新增 success=false envelope message 不外露覆蓋。

## Owner / Status Notes

- Owner：agent
- Status：已修復，待提交。
