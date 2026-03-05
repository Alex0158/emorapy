# 熊媽媽法庭 - MVP 開發計劃（代碼對齊版）

> [!WARNING]
> **ARCHIVED（歷史文件）**：本文件僅供歷史追溯，不作為現行產品、開發或運維決策依據。  
> 現行規格請以 `docs/核心開發文件/`、`README.md` 與實際程式碼為準。

**文檔版本**：v3.1  
**最後更新**：2026-03-05  
**目標**：以現有已落地系統為基礎，優先做穩定性、可維護性、可驗證性提升。

---

## 1. 當前基線（已完成能力）

## 1.1 用戶與快速體驗

- session 快速建立/刷新
- 快速建案、判決結果頁、證據補傳
- 註冊、登入、找回密碼、claim-session

## 1.2 正式案件主鏈路

- Case：建立/列表/詳情/更新/提交
- Judgment：生成/查看/接受/repair/metrics
- Reconciliation：生成/查看/選擇
- Execution：confirm/checkin/status/dashboard

## 1.3 訪談與心理畫像

- consent + interview 全生命周期（含 SSE）
- async pipeline 五步處理
- profile/feedback 讀取
- 一鍵刪除畫像資料（保留 snapshot）

## 1.4 Chat v1

- 建房/邀請/加入/訊息/SSE
- request-judgment + judgment-status
- leave/kick-b
- 基本 AI 介入與安全分流

## 1.5 管理台與運維

- admin RBAC + 配置 + 報表 + 審計 + jobs + alerts
- health/ready/live
- metrics 受保護暴露

---

## 2. 下一階段優先級

> 不盲目擴功能，先把核心鏈路的失敗率與維護成本降下來。

## P0（必做，穩定性）

### P0-1 文檔契約一致性（持續）

- 將以下四份視為發版門檻文檔：
  - `docs/功能特性清單.md`
  - `docs/前端設計/02-路由與頁面結構設計.md`
  - `docs/前端設計/08-接口一覽表.md`
  - `docs/後端設計/03-API設計.md`
- 路由、錯誤碼、狀態機變更必須同 PR 同步更新。

### P0-2 聊天轉判決可靠性

- 補齊 E2E：
  - invite accept/decline 分支
  - history_visibility 與 included_message_ids 邊界
  - request-judgment 多次觸發與衝突處理
- 回歸驗證 `judgment_failed` 的前後端提示與恢復路徑。

### P0-3 訪談可恢復性

- 補齊 `processing_failed -> retry` 端到端測試。
- 固化前端 result 頁 polling 超時與手動重試 UX。
- 驗證 consent 缺失時的雙重保護（前端提示 + 後端拒絕）。

### P0-4 限流與錯誤碼回歸

- 覆蓋 auth/interview/chat/upload/download 各 limiter 觸發行為。
- 固化常見錯誤碼映射（前端文案與 code 對照表）。

## P1（體驗補強）

### P1-1 Chat 容錯體驗

- stream 斷線/重連提示與 room 狀態恢復。
- judgment-status 視覺化與跳轉導流優化。

### P1-2 訪談結果體驗

- 強化 processing/partial_success 說明。
- feedback 與 my-story 互導一致性優化。

### P1-3 快速體驗錯誤引導

- session 過期、判決失敗、證據上傳失敗的可恢復提示。

## P2（演進，不作當期承諾）

- Chat v2 權限與觸發策略細化
- 判決上下文注入策略可視化與後台參數化
- 管理台報表維度深化

---

## 3. 驗收標準（建議落地）

## 3.1 功能驗收

- 快速體驗主流程成功率 >= 95%
- 訪談主流程（含 retry）成功率 >= 95%
- 聊天轉判決成功率 >= 95%

## 3.2 穩定性驗收

- 健康檢查持續可用，無持續性 500
- SSE 斷線可恢復（聊天與訪談）
- 關鍵錯誤碼可重現、可追蹤、可定位

## 3.3 文檔驗收

- 路由或契約變更同次更新核心四文檔
- `docs/02-產品設計.md` 與 `docs/功能特性清單.md` 不得出現互斥描述

---

## 4. 迭代節奏建議

1. 每個迭代固定回歸三主鏈路：quick / interview / chat-to-judgment。  
2. 每個迭代至少完成一項 P0 穩定性項目，不被新功能完全擠壓。  
3. 發版前執行腳本與人工回歸雙軌驗證（環境、限流、錯誤分支）。  
