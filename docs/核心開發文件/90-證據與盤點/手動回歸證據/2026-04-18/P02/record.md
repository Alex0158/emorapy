# P02 手動回歸記錄

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據文檔
**來源時間**：2026-04-18
**上下文**：按日期/P 批次留存的手動回歸結果與摘要
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`cbec3aa`
**最後核驗日期**：`2026-04-18`
<!-- CORE_DOC_AUDIT_METADATA:END -->

- 狀態：PASS
- 執行人：Codex
- 時間：2026-04-18 21:08
- 瀏覽器/裝置：API verification (curl/jq)
- 測試帳號：boyfriend@test.com / girlfriend@test.com
- 截圖/錄屏：docs/核心開發文件/90-證據與盤點/手動回歸證據/2026-04-18/P02/
- 問題類型：已修復重驗
- 問題描述：`collaborative full-mode + session_id=null` 權限缺陷已修復；舊失敗案件 `a1c68225-c379-4b31-a4ad-1f282cfbb953` 在雙方登入下 `GET /cases/:id` 均返回 `200`，`GET /cases/:id/judgment` 均返回 `202(JUDGMENT_PENDING)`；新建同類案件 `1a0efa9f-cf7e-4a98-ae92-427563886ec5` 亦復現一致結果，無認證請求返回 `401`。詳見 `P02-notes.md`。

## 補充

- 流程：正式案件閉環
- 其他說明：舊 FAIL 取證保留於 `P02-notes.md` 的「初始失敗取證」段落；本輪新增兩輪 API 復驗（舊案例 + 新建案例）均通過授權邊界校驗。
