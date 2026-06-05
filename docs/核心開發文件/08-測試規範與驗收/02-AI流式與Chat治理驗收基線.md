# AI 流式與 Chat 治理驗收基線

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：測試規範
**覆蓋範圍**：長期測試規範、驗收口徑與回歸門檻：02-AI流式與Chat治理驗收基線
**取證代碼入口**：`backend/src/services/ai-stream.service.ts`、`backend/src/services/chat-ai-orchestrator.service.ts`、`backend/src/services/chat.service.ts`、`backend/src/routes/chat.routes.ts`、`frontend/src/hooks/useAIStreamSubscription.ts`、`frontend/src/services/aiStream.ts`、`frontend/src/services/api/chat.ts`、`mobile/src/platform/sse/useAIStreamSubscription.ts`、`mobile/src/platform/sse/aiStream.ts`、`mobile/src/platform/lifecycle/native.ts`、`mobile/app/(public)/quick/result.tsx`、`mobile/app/(app)/profile/interview.tsx`、`mobile/app/(app)/chat/room.tsx`、`mobile/app/(app)/repair/index.tsx`、`packages/contracts/src/ai-stream.ts`、`packages/api-client/src/m3.ts`、`backend/tests`、`frontend/src/**/*.test.tsx`、`mobile/src/platform/sse/*.test.js`、`frontend/e2e/**/*.ts`、`e2e/**/*.ts`、`scripts`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
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
7. App foreground/background lifecycle、`after_seq` reconnect、SecureStore session restore 與 Push / Deep Link return 的平台差異

## 2. 正式驗收條目

### 2.1 契約與 runtime

1. 共享 stream 契約已存在
2. runtime 具備 seq、snapshot、replay、heartbeat
3. production 以 Redis-backed runtime 為目標正式形態；若 Redis 不可達，後端會自動降級 memory runtime，該情況必須在發版驗收記錄中明示為降級運行
4. `packages/contracts/src/ai-stream.ts`、`frontend/src/services/aiStream.ts`、`mobile/src/platform/sse/aiStream.ts` 與 backend AI stream service 必須維持同一 event / snapshot / `after_seq` 語義；Web hook、App hook 或 backend 任一側修改都需要回歸跨端契約

### 2.2 Web / App 共享語義

1. draft 狀態語義統一
2. thinking / streaming / persisting 命名統一
3. Chat、Interview、QuickExperience 不再各自維護不同狀態機
4. App Quick Result、Profile Interview、Chat Room 與 Repair Replan 必須透過 `mobile/src/platform/sse/useAIStreamSubscription.ts` 承接 AppState background abort / foreground `after_seq` reconnect；不得用 Web SSE 測試宣稱 App lifecycle 已完成
5. Web / App 都可以共用 backend stream 契約，但 App 的 release 驗收仍需由 App 測試基線與 M6 external evidence 裁決，不能由 Web route、Web e2e 或 Admin report 代替

### 2.3 治理與可觀測

1. `/metrics` 可觀測且受保護
2. 管理端可查看 AI stream 治理資訊
3. 清理 / archive 流程具備正式治理入口
4. App telemetry / Admin app-telemetry report 只可作 release 排障與 completion audit 輸入，不得替代 native crash runtime、Push provider delivery 或 physical device evidence

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
4. Admin 與 production release gate 需保留治理面驗證入口

App：

1. `mobile/src/platform/sse/useAIStreamSubscription.test.js` 與 `mobile/src/platform/sse/client.test.js` 覆蓋 event parse、`after_seq` replay、AppState background / foreground reconnect 與 terminal state
2. Quick / Interview / Chat / Repair screen-level 測試或 smoke 必須覆蓋 hook 接線與恢復文案
3. Push-driven return、真機 interruption 與 release build lifecycle 不得由 simulator / web export / dry-run runner 代替

## 4. 發版前最低治理檢查

1. `health` / `metrics` 正常
2. Redis-backed runtime 正常（若降級 memory，需明示並補風險說明）
3. Chat 關鍵 E2E skip guard 綠燈：`npm run --workspace frontend test:e2e:critical-guard`
4. `npm run ops:release:gate:evidence`、`npm run manual-regression:gate` 與相關治理腳本可運行
5. 涉及 App AI stream、Chat、Interview、Quick 或 Repair 的變更，至少需跑 `npm --prefix mobile run platform:check` 與相關 App route / feature / release audit gate；若宣稱 release completion，必須另有 M6 external evidence

## 5. 與證據的關係

本文件裁決“應驗什麼”，不保存每次驗證的輸出。

逐次驗證證據固定放在：

1. [../90-證據與盤點/AI流式驗證/README.md](../90-證據與盤點/AI流式驗證/README.md)
2. [../90-證據與盤點/環境與發版驗證/README.md](../90-證據與盤點/環境與發版驗證/README.md)

## 6. 關聯正文

1. 平台治理與運維 gate：見 [../03-管理端與平台治理/03-運維告警與AI-Chat治理基線.md](../03-管理端與平台治理/03-運維告警與AI-Chat治理基線.md)
2. 具體落地對照：見 [../90-證據與盤點/AI流式驗證/AI流式驗收對照-2026-04-04.md](../90-證據與盤點/AI流式驗證/AI流式驗收對照-2026-04-04.md)
3. App AI stream 與 release evidence 邊界：見 [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md)、[./03-App測試與證據接入基線.md](./03-App測試與證據接入基線.md) 與 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)
