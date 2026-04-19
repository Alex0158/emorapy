# 接口描述

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：接口詳規
**覆蓋範圍**：06-接口描述 子域入口與閱讀順序
**取證代碼入口**：`backend/src/app.ts`、`backend/src/routes`、`frontend/src/services/api`、`frontend-admin/src/services/api`
**最後核驗 Commit**：`4d14e4f`
**最後核驗日期**：`2026-04-19`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本子域承接 `CJ` 的模組級接口契約、常見錯誤碼、副作用與最小回歸集。

當前正式文檔：

1. `01-auth-session.md`
2. `02-user-profile-pairing.md`
3. `03-case.md`
4. `04-judgment.md`
5. `05-reconciliation-execution.md`
6. `06-interview-psych-profile.md`
7. `07-chat.md`
8. `08-content-notification.md`
9. `09-admin.md`
10. `10-health-metrics.md`

本子域不單獨裁決：

1. 某個接口是否在用、候選廢棄或已確認廢棄。該狀態以 [../全接口清單-主文檔.md](../全接口清單-主文檔.md) 為準；本目錄內若附帶模組級狀態摘要，只作閱讀輔助。
2. 某個功能或頁面的正式存在性
3. 跨端主流程的高位正文

使用順序：

1. 先查 [../全接口清單-主文檔.md](../全接口清單-主文檔.md) 確認接口狀態。
2. 再進入本目錄查看模組內契約、業務規則、限流與回歸風險。
3. 若要做影響分析，回查 [../接口-功能-頁面-Mapping.md](../接口-功能-頁面-Mapping.md)。

本目錄從屬於接口主冊，不替代主註冊表。
