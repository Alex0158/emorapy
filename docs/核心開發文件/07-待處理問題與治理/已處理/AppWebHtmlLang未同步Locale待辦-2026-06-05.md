# App Web HTML Lang 未同步 Locale 待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App web shell HTML lang、App i18n runtime document language sync 與 locale 切換測試
**取證代碼入口**：`mobile/app/+html.tsx`、`mobile/src/i18n/index.ts`、`mobile/src/i18n/index.test.js`
**最後核驗 Commit**：`b513ace`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`mobile/app/+html.tsx` 仍固定輸出 `<html lang="en">`，但 App i18n runtime 的預設語言是 `zh-TW`。同時 `mobile/src/i18n/index.ts` 在 `setLocale()` / `initializeLocalePreference()` 時只更新 App locale store，沒有同步 web `document.documentElement.lang`。

因此在 Expo web / static web shell 下，瀏覽器、搜尋、翻譯與輔助技術看到的文件語言可能仍是英文，和使用者目前所選 `zh-TW` / `en-US` 不一致。

## 影響範圍

- App web shell：`mobile/app/+html.tsx`。
- App i18n runtime：`mobile/src/i18n/index.ts`。
- 不影響 native iOS / Android DOM，因 native 環境沒有 `document`。
- 不改 API/SSE `X-Locale`、catalog key、storage persistence 或 visible copy。

## 目標行為與方案

1. App web static HTML 預設 `lang` 應與 default locale `zh-TW` 一致。
2. App runtime locale 變更時，若在 web DOM 環境，必須同步 `document.documentElement.lang`。
3. `setLocale('en-US')` 後 web `html.lang` 應為 `en-US`；切回 `zh-TW` 後應為 `zh-TW`。
4. native 環境不應因缺少 `document` 而報錯。

## 邊界與注意事項

- 不新增 App 語言切換 UI；既有 public home 按鈕繼續使用 `setLocale()`。
- 不改 locale normalization：`en*` 仍歸一為 `en-US`，其他歸一為 `zh-TW`。
- 不把 Web/Admin 的 DOM helper 引入 App；在 App i18n runtime 內用最小 DOM guard 即可。

## 修復結果

1. `mobile/app/+html.tsx` 已將 static web shell `<html lang>` 預設改為 `zh-TW`。
2. `mobile/src/i18n/index.ts` 新增 guarded `syncDocumentLocale()`；`setLocale()` 與模組初始化會在 web DOM 環境同步 `document.documentElement.lang`。
3. `mobile/src/i18n/index.test.js` 已用最小 DOM mock 覆蓋 `zh-TW` / `en-US` 切換時的 document language 同步；Node/native 無 `document` 時仍安全跳過。

## 驗證方式

- `npm --prefix mobile test -- src/i18n/index.test.js --runInBand`：通過，5 tests。
- `npm --prefix mobile run typecheck`：通過。
- `npm run docs:check`：通過。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
