# AI 流式與 Chat 治理驗收基線

本文件承接 AI 流式與 chat 治理的穩定驗收基線，取代歷史藍圖稿作為正式驗收裁決依據。

## 1. 驗收目標

以下能力必須以同一套口徑驗收：

1. 統一 stream 契約
2. 統一後端 runtime
3. 前端共享 draft / phase / recovering / persisted handoff
4. `AI Stream` replay、heartbeat、snapshot、恢復
5. Chat 與 Interview 的正式接線
6. metrics、admin 報表與治理鏈路

## 2. 正式驗收條目

### 2.1 契約與 runtime

1. 共享 stream 契約已存在
2. runtime 具備 seq、snapshot、replay、heartbeat
3. production / staging 以 Redis-backed runtime 為正式形態

### 2.2 前端共享語義

1. draft 狀態語義統一
2. thinking / streaming / persisting 命名統一
3. Chat、Interview、QuickExperience 不再各自維護不同狀態機

### 2.3 治理與可觀測

1. `/metrics` 可觀測且受保護
2. 管理端可查看 AI stream 治理資訊
3. 清理 / archive 流程具備正式治理入口

## 3. 最低測試集

後端：

1. stream runtime 單元測試
2. stream 持久化測試
3. Redis 多實例整合驗證
4. chat / judgment 相關單元與集成測試

前端：

1. Interview store / 頁面測試
2. Chat Room 頁面測試
3. 共享 draft 工具與 hook 測試
4. 共享 UI 元件族測試

## 4. 發版前最低治理檢查

1. `health` / `metrics` 正常
2. Redis-backed runtime 正常
3. chat stage gate 綠燈
4. benchmark / migration rehearsal 文檔與腳本可運行

## 5. 與證據的關係

本文件裁決“應驗什麼”，不保存每次驗證的輸出。

逐次驗證證據固定放在：

1. [../90-證據與盤點/AI流式驗證/README.md](../90-證據與盤點/AI流式驗證/README.md)
2. [../90-證據與盤點/環境與發版驗證/README.md](../90-證據與盤點/環境與發版驗證/README.md)

## 6. 關聯正文

1. 平台治理與運維 gate：見 [../03-管理端與平台治理/03-運維告警與AI-Chat治理基線.md](../03-管理端與平台治理/03-運維告警與AI-Chat治理基線.md)
2. 具體落地對照：見 [../90-證據與盤點/AI流式驗證/AI流式驗收對照-2026-04-04.md](../90-證據與盤點/AI流式驗證/AI流式驗收對照-2026-04-04.md)
