# P05 手動回歸記錄

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據文檔
**來源時間**：2026-04-18
**上下文**：按日期/P 批次留存的手動回歸結果與摘要
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`bd66c2d`
**最後核驗日期**：`2026-04-18`
<!-- CORE_DOC_AUDIT_METADATA:END -->

- 狀態：PASS
- 執行人：Codex
- 時間：2026-04-18 18:36
- 瀏覽器/裝置：Chrome Desktop (Playwright)
- 測試帳號：admin-smoke@example.com
- 截圖/錄屏：docs/核心開發文件/90-證據與盤點/手動回歸證據/2026-04-18/P05/
- 問題類型：
- 問題描述：

## 補充

- 流程：Admin 運維閉環
- 其他說明：users 狀態修改、configs 合法 key 寫入、audit logs 可見 user_activate 與 system_config upsert；執行中修復 backend CORS methods 缺少 PATCH 與 frontend-admin configs limit=200 漂移。
