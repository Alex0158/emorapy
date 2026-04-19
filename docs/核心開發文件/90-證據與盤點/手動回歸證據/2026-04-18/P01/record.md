# P01 手動回歸記錄

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
- 時間：2026-04-18 20:52
- 瀏覽器/裝置：Chrome Desktop (Playwright) + API smoke
- 測試帳號：anonymous quick session
- 截圖/錄屏：docs/核心開發文件/90-證據與盤點/手動回歸證據/2026-04-18/P01/
- 問題類型：已修復重驗
- 問題描述：快速體驗閉環已重驗通過。真 API `POST /api/v1/cases/quick` 現在可於 `5.53s` 內返回 `201`，前台 `http://127.0.0.1:4173/quick-experience/create` 提交後約 `7s` 內跳轉至 `/quick-experience/result/e126fe31-7192-48f9-8286-0723f1f5ef0a`。

## 補充

- 流程：快速體驗閉環
- 其他說明：根因已收斂並修復為兩段。其一是 `backend/src/utils/lock.ts`、`backend/src/utils/cache.ts` 在 Redis 不可達時會反覆觸發失敗客戶端，導致 quick-case 鏈路被多次 `get/set/unlock` fallback 拉長到 `20s+`；修復後改為首次失敗即永久降級到 memory fallback。其二是 `backend/src/config/env.ts` 的本地開發 origin 白名單未覆蓋實際前台端口 `4173`，導致前台真機提交撞上 CORS；現已補齊 `4173-4175` 與 `5173-5175` 的 localhost/127.0.0.1 白名單。
