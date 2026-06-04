# Admin request unknown fallback 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Admin Web Axios response interceptor、unknown runtime error fallback、Admin page / route error propagation
**取證代碼入口**：`frontend-admin/src/services/request.ts`、`frontend-admin/src/services/request.test.ts`
**最後核驗 Commit**：`dfdd0a7`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查下一輪確認，`frontend-admin/src/services/request.ts` 的 response interceptor 已對 HTTP status、network、cancel 與 backend-empty message fallback 使用 `t(...)`，但 unknown error 分支仍使用：

```ts
toRequestError('UNKNOWN_ERROR', error.message || t('adminApi.error.unknown'))
```

當 adapter / runtime / 非 Axios error 帶入 `Error.message`（例如 `boom`、`Unexpected token`）時，上層 Admin page 可能直接顯示該 raw message，而不是依照 Admin 當前語言顯示 `adminApi.error.unknown`。

## 影響範圍

- Admin Web 所有使用 `frontend-admin/src/services/request.ts` 的 API consumer。
- 只影響沒有 `response`、沒有 `request`、不是 cancel 的 unknown error 分支。
- 不影響 backend 已提供且已按 `X-Locale` 回傳的 API error message，也不改 HTTP status fallback、network fallback、cancel fallback。

## 目標行為與方案

1. unknown error reject payload 固定使用 `t('adminApi.error.unknown')`，避免 raw runtime message 進入 UI。
2. 保留 error code `UNKNOWN_ERROR`，方便頁面或日誌判斷。
3. 不新增 Admin page-level fallback map，不改 backend message 優先級。
4. 補測試覆蓋 `new Error('boom')` 在 en-US 下不顯示 `boom`。

## 邊界與注意事項

- HTTP response 有 backend `error.message` 時仍保留，因 Admin request 已送 `X-Locale`，後端 response formatter 會按 locale 處理。
- HTTP response 無 backend message 時仍使用現有 status fallback。
- unknown runtime message 可作開發者 log，但不作使用者可見文案。

## 驗證方式

- `npm --prefix frontend-admin test -- src/services/request.test.ts src/utils/i18n.test.ts src/assets/i18n/catalogParity.test.ts`
- `npm --prefix frontend-admin run build`
- `npm run docs:check`
- 靜態復查確認 Admin request unknown branch 不再用 raw `error.message` 作 reject payload。

## Owner / Status Notes

- Owner：agent
- Status：已處理

## 2026-06-04 本輪結果

1. `frontend-admin/src/services/request.ts` 的 unknown error branch 已改為固定使用 `t('adminApi.error.unknown')`，不再把 raw `error.message` 作 reject payload。
2. `frontend-admin/src/services/request.test.ts` 已新增 `new Error('boom')` 回歸測試，覆蓋 en-US 下不外露 raw runtime message。
3. 保留 HTTP response backend-provided message、status fallback、network fallback 與 cancel fallback 的既有語義。
4. 已驗證：`npm --prefix frontend-admin test -- src/services/request.test.ts src/utils/i18n.test.ts src/assets/i18n/catalogParity.test.ts`、`npm --prefix frontend-admin run build`、`npm run docs:check` 均通過。
5. 靜態復查確認 `frontend-admin/src/services/request.ts` unknown branch 只使用 `adminApi.error.unknown` catalog fallback。

## 2026-06-04 收口補驗

本輪全局語言治理復查確認代碼已符合待辦目標，並完成治理狀態收口：

1. `npm --prefix frontend-admin test -- src/services/request.test.ts src/utils/i18n.test.ts src/assets/i18n/catalogParity.test.ts`：passed，3 files / 13 tests。
2. `npm --prefix frontend-admin run build`：passed。
3. 靜態復查：`frontend-admin/src/services/request.ts` unknown branch 為 `toRequestError('UNKNOWN_ERROR', t('adminApi.error.unknown'))`，未使用 raw `error.message`。
