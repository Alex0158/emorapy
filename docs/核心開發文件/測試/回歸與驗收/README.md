# 回歸與驗收

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：測試索引
**覆蓋範圍**：測試目錄入口與使用規則
**取證代碼入口**：`backend/tests`、`frontend/src/**/*.test.tsx`、`frontend/e2e/**/*.ts`、`e2e/**/*.ts`、`scripts`、`mobile/app`、`mobile/src/platform`
**最後核驗 Commit**：`1295216`
**最後核驗日期**：`2026-05-06`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本目錄承接仍具使用價值的回歸包、執行版與驗收矩陣，並保留少量仍需回看結果的歷史記錄。

## 活躍執行入口

1. `Repair Journey 2.3 場景驗收矩陣.md`
2. `未登入直連-回歸驗證清單.md`
3. `發版前手動回歸包-2026-03-17.md`
4. `發版前手動回歸執行版-2026-03-17.md`

## 歷史結果回看

1. `發版前回歸記錄-2026-03-17.md`

使用規則：

1. 活躍執行一律從上面的回歸包、執行版與驗收矩陣進入。
2. dated 回歸記錄只用於回看當次輸出，不直接替代當前執行入口。
3. 這些文件不直接替代 `08-測試規範與驗收/`。
4. 這些 Web/Admin/Backend 回歸包不代表 App 已驗收；新增 App 回歸包前，必須先對齊 App navigation / platform adapter 基線與 App 首輪工程落點 Mapping。
5. App 回歸包若要進入本目錄，必須先符合 `08-測試規範與驗收/03-App測試與證據接入基線.md`，並把證據結果落到 `90-證據與盤點/`，不能只以本機啟動或 Expo 模板可打開作為回歸完成。

最新人工回歸結果與門禁狀態以 `docs/核心開發文件/90-證據與盤點/手動回歸證據/2026-04-18/summary.md` 與 `npm run manual-regression:gate` 為準。
