# Web en-US Catalog Lazy Load 初始回退中文待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web 主站 i18n runtime、en-US catalog 載入策略、初始語言與語言切換即時顯示
**取證代碼入口**：`frontend/src/utils/i18n.ts`、`frontend/src/utils/i18n.test.ts`、`frontend/src/assets/i18n/en-US.ts`、`frontend/src/assets/i18n/zh-TW.ts`
**最後核驗 Commit**：`4b714c6`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`frontend/src/utils/i18n.ts` 將 `en-US` catalog 初始設為空物件，並以 dynamic import 非同步載入。當 `current` 為 `en-US` 但 catalog 尚未載入時，`t()` 會回退到 `zh-TW` catalog；既有 `frontend/src/utils/i18n.test.ts` 也允許 `setLocale('en-US')` 後 immediate translation 暫時返回 `關係分析結果`。

這代表使用者已選擇英文時，Web 主站仍可能在初始渲染或語言切換瞬間顯示繁中文案，沒有完全按所選語言顯示。

## 影響範圍

- Web 主站 `frontend/src/utils/i18n.ts`。
- Web 初始 locale 由 `cj_locale` / legacy `mbc_locale` / `navigator.language` 判定為 `en-US` 的首屏。
- Web 語言切換到 `en-US` 後，catalog 載入前的 immediate render。
- 不影響 Admin Web；`frontend-admin/src/utils/i18n.ts` 已同步 import `en-US` catalog。
- 不影響 App；App catalog 已同步載入。

## 目標行為與方案

1. Web 主站 `en-US` catalog 必須在 `t()` 可被呼叫前可用。
2. `current === 'en-US'` 時，已存在的 en-US key 不得短暫回退到 zh-TW 值。
3. 移除 lazy-load notification 競態，保持 `setLocale()` 後全局 locale listener 可以穩定觸發 RouterProvider 重掛載。
4. 更新 i18n 測試，將「en-US immediate 可暫時顯示中文」改為失敗契約。

## 邊界與注意事項

- 不改 `cj_locale` / `mbc_locale` storage key。
- 不改 `normalizeLocale()` 規則。
- 不新增 runtime 翻譯服務或 fallback 翻譯；缺 key 仍按現有 missing-i18n 策略處理。
- 同步 import en-US catalog 會讓主站 i18n bundle 變大一點；本輪以 selected locale 顯示正確性優先。

## 修復結果

1. `frontend/src/utils/i18n.ts` 已同步 import `frontend/src/assets/i18n/en-US.ts`，`catalogs['en-US']` 不再以空字典啟動。
2. `setLocale()` 移除 en-US dynamic import / promise notification，locale 變更後同步通知 listener。
3. `frontend/src/utils/i18n.test.ts` 已把 en-US immediate translation 改為必須直接返回 `Relationship Analysis Result`，不再允許短暫 zh-TW fallback。

## 驗證方式

- `npm --prefix frontend test -- src/utils/i18n.test.ts src/assets/i18n/catalogParity.test.ts`：通過，2 files / 17 tests。
- `npm --prefix frontend run build`：通過。
- `npm run docs:check`：通過。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
