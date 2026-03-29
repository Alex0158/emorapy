# Emorapy 業務缺陷報告 - F06 Interview Chat 未知 errorCode 時無 reload 按鈕

日期：2026-03-07  
缺陷編號：`F06-BUG-002`  
狀態：`已修復`  
嚴重度：`低`

## 1. 缺陷摘要

心理訪談聊天頁（Interview Chat）當 errorCode 為未知類型（如 NETWORK_ERROR、SERVER_ERROR 或未列於已知清單）時，僅顯示錯誤文字，無「重新載入對話」按鈕。已知 errorCode（AI_CALL_FAILED、CONCURRENT_REQUEST、CONNECTION_LOST）已有 reload 按鈕。

## 2. 業務影響

1. 暫時性網路或伺服器錯誤時，使用者無法在頁面內重試，只能刷新整頁或離開
2. 與已知 errorCode 的錯誤恢復方式不一致

## 3. 修復方案

1. 對未知或未處理的 errorCode，當 sessionId 存在且非導航型錯誤時，顯示「重新載入對話」按鈕
2. 排除 NOT_FOUND、CONSENT_REQUIRED、RATE_LIMIT_EXCEEDED、TURN_TOO_FAST（導航或等待情境）
3. 排除已個別處理的 MAX_TURNS_REACHED、SESSION_COMPLETED、AI_CALL_FAILED、CONCURRENT_REQUEST、CONNECTION_LOST

## 4. 修復後驗證

- 既有測試：`errorCode 為未知時應顯示重新載入按鈕，點擊應呼叫 getSession（F06 錯誤恢復：未知錯誤提供 retry 出口）`
- `npm run test -- --run src/pages/Interview/Chat/index.test.tsx` 全數通過（25 例）
