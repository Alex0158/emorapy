# 測試規範與驗收

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：08-測試規範與驗收 子域入口與閱讀順序
**取證代碼入口**：`backend/tests`、`frontend/src/**/*.test.tsx`、`frontend/e2e/**/*.ts`、`e2e/**/*.ts`、`scripts`、`mobile/app`、`mobile/src/platform`
**最後核驗 Commit**：`1295216`
**最後核驗日期**：`2026-05-06`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本目錄承接可作為長期依據的測試策略、覆蓋規則、驗收口徑與高位執行指引。

當前長期取證入口以實際倉庫結構為準：

1. `backend/tests`
2. `frontend/src/**/*.test.tsx`
3. `frontend/e2e/**/*.ts`
4. `e2e/**/*.ts`
5. `scripts/`
6. `mobile/app`、`mobile/src/platform`（僅作 App 測試缺口取證入口；尚無正式 App smoke / regression / CI gate）

上述入口目前主要覆蓋 Backend、Web、Admin Web、跨站真服務與發布/手動回歸腳本；`mobile/` 尚未形成 CJ App smoke / regression / CI 測試入口。App 測試落地前，不得把現有 Web/Admin 測試通過推斷為 App 已驗收。

本目錄不單獨定義以下產品正式語義：

1. 功能是否存在
2. 頁面哪裡是正式主入口
3. API 屬於已使用、候選廢棄或已確認廢棄
4. 業務流程的正式主鏈是什麼

若測試文檔與產品正式語義衝突，仍以 `核心開發文件/` 根層旗艦文檔、對應正式子域與現碼為準。

當前正式文檔：

1. [01-測試文檔分層與使用規則.md](./01-測試文檔分層與使用規則.md)
2. [02-AI流式與Chat治理驗收基線.md](./02-AI流式與Chat治理驗收基線.md)
3. [03-App測試與證據接入基線.md](./03-App測試與證據接入基線.md)

活躍案例、回歸包與補充證據，統一從 [../測試/README.md](../測試/README.md) 與 [../90-證據與盤點/README.md](../90-證據與盤點/README.md) 進入。歷史測試設計、缺陷分析與一次性報告一律在根級 `歸檔/` 回看。

若新增 App smoke、Deep Link、Push、SecureStore/session restore、upload 或 App API adapter 測試，必須同步回寫 [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md)、[../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)，並在必要時更新 [../07-待處理問題與治理/README.md](../07-待處理問題與治理/README.md) 下的待辦。
