# P04 手動回歸記錄

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據文檔
**來源時間**：2026-03-28
**上下文**：按日期/P 批次留存的手動回歸結果與摘要
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`bd66c2d`
**最後核驗日期**：`2026-04-18`
<!-- CORE_DOC_AUDIT_METADATA:END -->

- 狀態：
- 執行人：待指派（建議 Frontend + Backend）
- 時間：2026-03-28 21:30-22:00（Asia/Shanghai）
- 瀏覽器/裝置：Chrome 最新穩定版（Desktop）
- 測試帳號：manual-p04-<timestamp>@example.com
- 截圖/錄屏：docs/核心開發文件/90-證據與盤點/手動回歸證據/2026-03-28/P04/
- 問題類型：
- 問題描述：

## 補充

- 流程：聊天轉判決閉環
- 操作入口：http://127.0.0.1:4173/chat/room/<roomId>
- 最低驗收：
  - 邀請/接受鏈路正常或弱入口可回訪
  - request judgment 後可正確 handoff
  - 未登入場景可先 login 再回跳原目標
  - judgment detail 可正常讀取
- 證據建議命名：
  - P04-desktop-pass-01.png
  - P04-desktop-pass.mp4
