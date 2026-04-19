# P04 手動回歸記錄

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
- 時間：2026-04-18 20:08
- 瀏覽器/裝置：Chrome Desktop (Playwright) + API verification
- 測試帳號：guest session + girlfriend@test.com
- 截圖/錄屏：docs/核心開發文件/90-證據與盤點/手動回歸證據/2026-04-18/P04/
- 問題類型：已修復重驗
- 問題描述：聊天轉判決閉環已重驗通過。匿名 owner 可正常進房、發起判決、等待生成、被導向 `/auth/login`，登入後可進入對應 `/judgment/:id` 詳情頁；瀏覽器 network 中 `POST /request-judgment => 200 OK`，頁面未再出現 `網絡連接失敗，請檢查網絡連接`。詳見 `P04-notes.md`。

## 補充

- 流程：聊天轉判決閉環
- invite/accept 是否正常：正常。本次重驗以 owner session `guest_1776513762484_5042b640f0044111` 建房，invite code=`ZZQ7DC`，`girlfriend@test.com` 成功 accept，room 進入 `group_active`。
- request judgment 是否成功：成功。`POST /api/v1/chat/rooms/cb7461ef-dd47-4ceb-92a0-4106ffe1aa40/request-judgment` 在瀏覽器 network 中返回 `200 OK`；後端最終生成 `case.id=333dc4d2-e1a7-4ac5-a355-f62d7eff8fa3`、`judgment.id=e2ba8293-7cbd-42e5-9a1a-0349223fd64a`。
- login handoff 是否正確：正確。匿名態在判決完成後自動跳轉到 `/auth/login`。
- judgment detail 是否可讀：可讀。登入後自動進入 `/judgment/e2ba8293-7cbd-42e5-9a1a-0349223fd64a`，頁面實際渲染 `關係分析結果`、`判決書` 與後續方向卡片。
- 其他說明：本輪同時保留修復前失敗證據，用於對照 loading 卡死、AI 訊息誤帶入 `included_message_ids`、以及前台 `30s` timeout 假失敗三個已修復問題。
