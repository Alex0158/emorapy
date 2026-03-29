# Emorapy 優化報告 - F05 Reconciliation Detail 補 useMountedRef 防止卸載後 success 回調

日期：2026-03-07  
編號：`F05-OPT-004`  
狀態：`已修復`  
類型：`預防性優化`（對齊 F01-BUG-001 修復與 useMountedRef 跨頁回歸）

## 1. 摘要

**F05-OPT-004**：和好方案詳情頁（Reconciliation Detail）的 `handleSelect` 與 `handleStartExecution` 在 async 成功後會呼叫 `message.success`、`fetchPlan` 或 `navigate`，均未使用 `useMountedRef`。

當使用者快速離開頁面後，若 async 操作成功返回，仍會呼叫 `message.success` 與 `navigate`，可能導致非預期導航或與 F01-BUG-001 同類問題。

## 2. 業務影響

1. 使用者已離開頁面，卻被突然導向執行打卡頁，造成困惑
2. 與 Reconciliation List、Judgment Detail、Case Detail 等已使用 useMountedRef 的頁面不一致

## 3. 修復方案

**Reconciliation Detail**：
1. 對 `handleSelect`、`handleStartExecution` 的 async 成功路徑，在 `await` 後檢查 `mountedRef.current`，若已卸載則直接 `return`，不再呼叫 `message.success`、`fetchPlan` 或 `navigate`

## 4. 修復後驗證

- Reconciliation Detail 新增測試：
  - `selectPlan 成功但組件已卸載時不應呼叫 message.success`
  - `confirmExecution 成功但組件已卸載時不應呼叫 message.success 或 navigate`
- `npm run test -- --run src/pages/Reconciliation/Detail/index.test.tsx` 全數通過（38 例）
