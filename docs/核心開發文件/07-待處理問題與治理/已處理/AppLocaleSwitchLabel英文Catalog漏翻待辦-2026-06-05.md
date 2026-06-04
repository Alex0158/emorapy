# App Locale Switch Label 英文 Catalog 漏翻待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App public home 語言切換入口、App en-US catalog、copy completeness gate
**取證代碼入口**：`mobile/app/(public)/index.tsx`、`mobile/src/i18n/catalogs/en-US.ts`、`mobile/src/i18n/index.test.js`、`mobile/scripts/check-user-copy-contracts.mjs`
**最後核驗 Commit**：`1aed311`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`mobile/src/i18n/catalogs/en-US.ts` 中 `app.locale.switchToZhTW` 仍為 `切換為繁體中文`。該 key 由 `mobile/app/(public)/index.tsx` 的語言切換按鈕直接顯示；當使用者目前選擇 `en-US` 時，按鈕文案仍會出現中文，沒有完全跟隨所選語言。

## 影響範圍

- App public home 語言切換入口。
- App i18n catalog completeness gate。
- 不影響 API/SSE `X-Locale`、locale persistence 或其他 screen copy。

## 目標行為與方案

1. `en-US` catalog 中語言切換按鈕應以英文顯示 `Switch to Traditional Chinese`。
2. `zh-TW` catalog 可保留 `切換為繁體中文`。
3. 補 App i18n 測試，明確覆蓋 `en-US` 下兩個切換按鈕文案。
4. 擴充 `mobile/scripts/check-user-copy-contracts.mjs`，掃描 `mobile/src/i18n/catalogs/en-US.ts`，禁止英文 catalog 再出現 CJK 字元，避免漏翻回流。

## 邊界與注意事項

- 不改 locale 切換狀態機：仍由 `setLocale()` / `useLocale()` 觸發畫面重渲染。
- 不把 catalog key、route、test id 或 domain enum 視為使用者文案。
- 此輪只處理英文 catalog 漏翻與防回流 gate，不重新翻譯 backend / AI 生成內容。

## 驗證方式

- `npm --prefix mobile test -- src/i18n/index.test.js --runInBand`
- `npm --prefix mobile run copy:check`
- `rg -n "[\\p{Han}]" mobile/src/i18n/catalogs/en-US.ts`

## Owner / Status Notes

- Owner：agent
- Status：已完成並歸檔。

## 2026-06-05 本輪結果

1. `mobile/src/i18n/catalogs/en-US.ts` 已將 `app.locale.switchToZhTW` 修正為 `Switch to Traditional Chinese`。
2. `mobile/src/i18n/index.test.js` 已覆蓋 zh-TW / en-US 下 `app.locale.switchToEnglish` 與 `app.locale.switchToZhTW` 的實際輸出。
3. `mobile/scripts/check-user-copy-contracts.mjs` 已新增 en-US catalog CJK gate，防止英文 catalog 後續再混入 CJK 可見文案。
4. 已驗證：focused i18n test 通過，`copy:check` 通過，`rg -n "[\\p{Han}]" mobile/src/i18n/catalogs/en-US.ts` 無結果。
