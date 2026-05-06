# 活躍場景案例

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：測試索引
**覆蓋範圍**：測試目錄入口與使用規則
**取證代碼入口**：`backend/tests`、`frontend/src/**/*.test.tsx`、`frontend/e2e/**/*.ts`、`e2e/**/*.ts`、`scripts`、`mobile/app`、`mobile/src/platform`
**最後核驗 Commit**：`1295216`
**最後核驗日期**：`2026-05-06`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本目錄承接當前仍直接服務於功能驗收與回歸的案例庫。

當前子域：

1. [quick-experience/README.md](./quick-experience/README.md)
2. [chat-room/README.md](./chat-room/README.md)

使用原則：

1. 只保留仍具回歸價值的案例
2. 案例用於驗證主流程與高風險邊界，不單獨裁決正式產品規格
3. 場景案例若只剩歷史展示價值，應移出本目錄或降級到根級 `歸檔/`
4. App 場景案例不得直接複製 Web route；必須先對應到 App screen / navigation、platform adapter 與 `50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md` 中的能力分組
5. App 場景案例若需要作為正式回歸，還必須符合 `08-測試規範與驗收/03-App測試與證據接入基線.md` 的證據命名與回寫規則
