# AI 流式與 Chat 治理驗收基線

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：測試規範
**覆蓋範圍**：長期測試規範、驗收口徑與回歸門檻：02-AI流式與Chat治理驗收基線
**取證代碼入口**：`backend/tests`、`frontend/src/**/*.test.tsx`、`frontend/e2e/**/*.ts`、`e2e/**/*.ts`、`scripts`
**最後核驗 Commit**：`4d14e4f`
**最後核驗日期**：`2026-04-19`
<!-- CORE_DOC_AUDIT_METADATA:END -->

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
3. production / staging 以 Redis-backed runtime 為目標正式形態；若 Redis 不可達，後端會自動降級 memory runtime，該情況必須在發版驗收記錄中明示為降級運行

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
3. `frontend/e2e/chat/*.e2e.ts` 的流式恢復與失敗矩陣回歸
4. Admin 與 staging smoke 需保留治理面驗證入口

## 4. 發版前最低治理檢查

1. `health` / `metrics` 正常
2. Redis-backed runtime 正常（若降級 memory，需明示並補風險說明）
3. Chat 關鍵 E2E skip guard 綠燈：`npm run --workspace frontend test:e2e:critical-guard`
4. `npm run smoke:staging`、`npm run manual-regression:gate` 與相關治理腳本可運行

## 5. 與證據的關係

本文件裁決“應驗什麼”，不保存每次驗證的輸出。

逐次驗證證據固定放在：

1. [../90-證據與盤點/AI流式驗證/README.md](../90-證據與盤點/AI流式驗證/README.md)
2. [../90-證據與盤點/環境與發版驗證/README.md](../90-證據與盤點/環境與發版驗證/README.md)

## 6. 關聯正文

1. 平台治理與運維 gate：見 [../03-管理端與平台治理/03-運維告警與AI-Chat治理基線.md](../03-管理端與平台治理/03-運維告警與AI-Chat治理基線.md)
2. 具體落地對照：見 [../90-證據與盤點/AI流式驗證/AI流式驗收對照-2026-04-04.md](../90-證據與盤點/AI流式驗證/AI流式驗收對照-2026-04-04.md)
