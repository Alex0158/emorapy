# 活躍測試入口

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：測試索引
**覆蓋範圍**：測試目錄入口與使用規則
**取證代碼入口**：`backend/tests`、`frontend/src/**/*.test.tsx`、`frontend/e2e/**/*.ts`、`e2e/**/*.ts`、`scripts`、`mobile/app`、`mobile/src/platform`
**最後核驗 Commit**：`1295216`
**最後核驗日期**：`2026-05-06`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本目錄承接與 `核心開發文件/` 緊密配套的活躍測試案例、回歸包與執行入口。

當前活躍案例與回歸包主要服務 Web/Admin/Backend 現有流程；App 端尚未建立 CJ App 專屬 smoke / regression 入口。App 測試加入本目錄前，必須先在 `20-App端/01-App導航與平台Adapter基線.md`、`50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md` 與 `08-測試規範與驗收/03-App測試與證據接入基線.md` 明確對應能力、工程落點與驗收 gate。

本目錄內允許同時存在兩類文件：

1. 可直接重跑的活躍案例、回歸包與執行版
2. 仍需保留但只作歷史回看的 dated 執行記錄

它回答的是：

1. 當前有哪些主動維護的場景案例
2. 哪些回歸包與驗收矩陣仍應直接配套 SSOT 使用
3. 做功能回歸時應從哪裡進入

它不回答：

1. 長期測試策略與高位覆蓋規則
2. 所有歷史測試設計與失敗分析
3. 單次環境核驗與證據鏈

當前子域：

1. [活躍場景案例/README.md](./活躍場景案例/README.md)
2. [回歸與驗收/README.md](./回歸與驗收/README.md)

閱讀順序：

1. 先讀 [../08-測試規範與驗收/README.md](../08-測試規範與驗收/README.md)
2. 再讀本目錄
3. 若需要更細的歷史測試資料，再進根級 `歸檔/`
4. 若要新增 App 測試，再回 [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md)、[../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md) 與 [../07-待處理問題與治理/README.md](../07-待處理問題與治理/README.md)
5. App 測試證據接入規則另看 [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md)

最新手動回歸結果請直接看：

1. `docs/核心開發文件/90-證據與盤點/手動回歸證據/2026-04-18/summary.md`
2. `npm run manual-regression:gate` 的當次輸出
