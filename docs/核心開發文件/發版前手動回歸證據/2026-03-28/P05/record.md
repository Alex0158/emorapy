# P05 手動回歸記錄

- 狀態：
- 執行人：待指派（建議 Admin FE + Backend）
- 時間：2026-03-28 22:00-22:30（Asia/Shanghai）
- 瀏覽器/裝置：Chrome 最新穩定版（Desktop）
- 測試帳號：admin-smoke@example.com
- 截圖/錄屏：docs/核心開發文件/發版前手動回歸證據/2026-03-28/P05/
- 問題類型：
- 問題描述：

## 補充

- 流程：Admin 運維閉環
- 操作入口：http://127.0.0.1:5173/admin/login
- 最低驗收：
  - admin login 成功
  - users/configs 各完成一次變更
  - audit logs 可查到對應操作
  - 不可自刪/自停用/自改角色
- 證據建議命名：
  - P05-desktop-pass-01.png
  - P05-desktop-pass.mp4
