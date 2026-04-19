# 活躍場景案例

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：測試索引
**覆蓋範圍**：測試目錄入口與使用規則
**取證代碼入口**：`backend/tests`、`frontend/src/**/*.test.tsx`、`frontend/e2e/**/*.ts`、`e2e/**/*.ts`、`scripts`
**最後核驗 Commit**：`4d14e4f`
**最後核驗日期**：`2026-04-19`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本目錄承接當前仍直接服務於功能驗收與回歸的案例庫。

當前子域：

1. [quick-experience/README.md](./quick-experience/README.md)
2. [chat-room/README.md](./chat-room/README.md)

使用原則：

1. 只保留仍具回歸價值的案例
2. 案例用於驗證主流程與高風險邊界，不單獨裁決正式產品規格
3. 場景案例若只剩歷史展示價值，應移出本目錄或降級到根級 `歸檔/`
