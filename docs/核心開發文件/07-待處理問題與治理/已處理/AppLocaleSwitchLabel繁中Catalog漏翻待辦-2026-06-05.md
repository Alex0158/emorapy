# App Locale Switch Label 繁中 Catalog 漏翻待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App public home 語言切換按鈕、zh-TW catalog locale switch copy 與 App i18n runtime 測試
**取證代碼入口**：`mobile/app/(public)/index.tsx`、`mobile/src/i18n/catalogs/zh-TW.ts`、`mobile/src/i18n/index.test.js`
**最後核驗 Commit**：`d8ab414`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`mobile/src/i18n/catalogs/zh-TW.ts` 中 `app.locale.switchToEnglish` 仍為 `Switch to English`。該 key 由 `mobile/app/(public)/index.tsx` 的語言切換按鈕直接顯示；當使用者目前選擇 `zh-TW` 時，按鈕文案仍會出現英文，沒有完全跟隨所選語言。

## 影響範圍

- App public home 語言切換入口。
- App zh-TW catalog 的 locale switch copy。
- 不影響 API/SSE `X-Locale`、locale persistence 或其他 screen copy。

## 目標行為與方案

1. `zh-TW` catalog 中語言切換按鈕應以繁中顯示 `切換為英文`。
2. `en-US` catalog 繼續顯示 `Switch to English` / `Switch to Traditional Chinese`。
3. 調整 App i18n 測試，明確覆蓋 zh-TW / en-US 下語言切換文案都按當前 locale 輸出。

## 邊界與注意事項

- 不改 `setLocale()` / `useLocale()` / persistence 行為。
- 不新增 zh-TW catalog Latin gate，因為 catalog 內存在合理英文品牌、縮寫與技術專名；本輪只修可證明的 locale switch visible copy。

## 修復結果

1. `mobile/src/i18n/catalogs/zh-TW.ts` 的 `app.locale.switchToEnglish` 已改為 `切換為英文`。
2. `mobile/src/i18n/index.test.js` 已改為驗證 zh-TW 下該 key 輸出繁中文案，並保留 en-US 下 `Switch to English` 的對照。
3. 本輪不改語言切換狀態機、storage、API/SSE header 或 catalog gate；修復範圍收斂在可證明的 visible label residual。

## 驗證方式

- `npm --prefix mobile test -- src/i18n/index.test.js --runInBand`：通過，4 tests。
- `npm --prefix mobile run copy:check`：通過。
- `npm --prefix mobile run typecheck`：通過。
- `npm run docs:check`：通過。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
