# 發版前手動回歸結果總覽（2026-04-18）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據文檔
**來源時間**：2026-04-18
**上下文**：按日期/P 批次留存的手動回歸結果與摘要
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`4a1374a`
**最後核驗日期**：`2026-04-18`
<!-- CORE_DOC_AUDIT_METADATA:END -->

生成時間：2026-04-18T13:08:52.000Z

| 流程 | 狀態 | 執行人 | 時間 | 裝置/瀏覽器 | 證據 | 問題類型 | 備註 |
|---|---|---|---|---|---|---|---|
| P01 快速體驗閉環 | PASS | Codex | 2026-04-18 20:52 | Chrome Desktop (Playwright) + API smoke | docs/核心開發文件/90-證據與盤點/手動回歸證據/2026-04-18/P01/ | 已修復重驗 | 快速體驗閉環已重驗通過。真 API `POST /api/v1/cases/quick` 現在可於 `5.53s` 內返回 `201`，前台 `http://127.0.0.1:4173/quick-experience/create` 提交後約 `7s` 內跳轉至 `/quick-experience/result/e126fe31-7192-48f9-8286-0723f1f5ef0a`。 |
| P02 正式案件閉環 | PASS | Codex | 2026-04-18 21:08 | API verification (curl/jq) | docs/核心開發文件/90-證據與盤點/手動回歸證據/2026-04-18/P02/ | 已修復重驗 | `collaborative full-mode + session_id=null` 權限缺陷已修復；舊失敗案件 `a1c68225-c379-4b31-a4ad-1f282cfbb953` 與新建案件 `1a0efa9f-cf7e-4a98-ae92-427563886ec5` 在雙方登入下讀取 `GET /cases/:id` 均為 `200`，讀取 `GET /cases/:id/judgment` 均為 `202(JUDGMENT_PENDING)`，未認證請求為 `401`。詳見 `P02-notes.md`。 |
| P03 心理訪談閉環 | PASS | Codex | 2026-04-18 20:35 | Chrome Desktop (Playwright) + API/DB verification | docs/核心開發文件/90-證據與盤點/手動回歸證據/2026-04-18/P03/ | 已修復重驗 | 心理訪談閉環已重驗通過。session `bc333002-cdf5-40eb-8f4f-1840eed0993f` 在同頁連續 quick-tag 回合中，可跨過真實 `15-20s` AI latency，自動把 canonical 下一輪 AI 回覆回寫到 UI，輸入框恢復可用並可持續完成後續對話；詳見 `P03-notes.md`。 |
| P04 聊天轉判決閉環 | PASS | Codex | 2026-04-18 20:08 | Chrome Desktop (Playwright) + API verification | docs/核心開發文件/90-證據與盤點/手動回歸證據/2026-04-18/P04/ | 已修復重驗 | 聊天轉判決閉環已重驗通過。匿名 owner 可正常進房、發起判決、等待生成、被導向 `/auth/login`，登入後可進入對應 `/judgment/:id` 詳情頁；瀏覽器 network 中 `POST /request-judgment => 200 OK`，頁面未再出現 `網絡連接失敗，請檢查網絡連接`。詳見 `P04-notes.md`。 |
| P05 Admin 運維閉環 | PASS | Codex | 2026-04-18 18:36 | Chrome Desktop (Playwright) | docs/核心開發文件/90-證據與盤點/手動回歸證據/2026-04-18/P05/ |  |  |

## 原始記錄

- P01: `./P01/record.md`
- P02: `./P02/record.md`
- P03: `./P03/record.md`
- P04: `./P04/record.md`
- P05: `./P05/record.md`
