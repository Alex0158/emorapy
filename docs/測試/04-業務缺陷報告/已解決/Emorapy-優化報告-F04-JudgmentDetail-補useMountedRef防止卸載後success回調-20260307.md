# Emorapy 優化報告 - F04 Judgment Detail 補 useMountedRef 防止卸載後 success 回調

日期：2026-03-07  
編號：`F04-OPT-001`  
狀態：`已修復`  
類型：`預防性優化`（對齊 F01-BUG-001 修復與 useMountedRef 跨頁回歸）

## 1. 摘要

**F04-OPT-001**：判決詳情頁（Judgment Detail）的 `handleAccept`、`handleReject` 與 `handleGeneratePlans` 在 async 成功後會呼叫 `message.success`、`setShowAcceptModal`/`setShowRejectModal`、`setJudgment`、`fetchJudgment` 或 `navigate`，均未使用 `useMountedRef`。

當使用者快速離開頁面後，若 async 操作成功返回，仍會呼叫 `message.success` 與 `navigate`，可能導致非預期導航或與 F01-BUG-001 同類問題。

## 2. 業務影響

1. 使用者已離開頁面，卻被突然導向 reconciliation 頁，造成困惑
2. 與 Case Detail、Case Create、Case Review、Execution CheckIn、Interview Chat/Result 等已使用 useMountedRef 的頁面不一致

## 3. 修復方案

**Judgment Detail**：
1. 對 `handleAccept`、`handleReject`、`handleGeneratePlans` 的 async 成功路徑，在 `await` 後檢查 `mountedRef.current`，若已卸載則直接 `return`，不再呼叫 `message.success`、`setShowAcceptModal`/`setShowRejectModal`、`setJudgment`、`fetchJudgment` 或 `navigate`

## 4. 修復後驗證

- Judgment Detail 新增測試：
  - `acceptJudgment 成功但組件已卸載時不應呼叫 message.success`
  - `acceptJudgment(accepted: false) 成功但組件已卸載時不應呼叫 message.success`
  - `generatePlans 成功但組件已卸載時不應呼叫 message.success 或 navigate`
- `npm run test -- --run src/pages/Judgment/Detail/index.test.tsx` 全數通過（48 例）
