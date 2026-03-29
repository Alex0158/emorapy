# Emorapy 優化報告 - F08 Profile Pairing 補 useMountedRef 防止卸載後 success 回調

日期：2026-03-07  
編號：`F08-OPT-001`  
狀態：`已修復`  
類型：`預防性優化`（對齊 F01-BUG-001 修復與 useMountedRef 跨頁回歸）

## 1. 摘要

**F08-OPT-001**：配對管理頁（Profile Pairing）的 `handleCreatePairing`、`handleJoinPairing`、`handleCancelPairing`、`handleSaveRelationshipProfile` 與 `startInterviewFlow` 在 async 成功後會呼叫 `message.success`、`setPairing`、`setRelationshipProfile`、`relationshipForm.setFieldsValue` 或 `navigate`，均未使用 `useMountedRef`。

當使用者快速離開頁面後，若 async 操作成功返回，仍會呼叫 `message.success` 與 `navigate`，可能導致非預期導航或與 F01-BUG-001 同類問題。

## 2. 業務影響

1. 使用者已離開頁面，卻被突然導向 interview 頁，造成困惑
2. 與 Judgment Detail、Reconciliation List/Detail、Auth Login/Register/ForgotPassword、Collaborative 等已使用 useMountedRef 的頁面不一致

## 3. 修復方案

**Profile Pairing**：
1. 對 `handleCreatePairing`、`handleJoinPairing`、`handleCancelPairing` 的 async 成功路徑，在 `await` 後檢查 `mountedRef.current`，若已卸載則直接 `return`，不再呼叫 `message.success` 或 `setPairing`/`setInviteCode`
2. 對 `handleSaveRelationshipProfile` 的 async 成功路徑，在 `staleRef.current` 檢查後加入 `!mountedRef.current`，若已卸載則直接 `return`
3. 對 `startInterviewFlow`，在 `checkResume` 與 `startSession` 兩次 `await` 後各檢查 `mountedRef.current`，若已卸載則直接 `return`，不再呼叫 `navigate`

## 4. 修復後驗證

- Profile Pairing 新增測試：
  - `createPairing 成功但組件已卸載時不應呼叫 message.success`
  - `joinPairing 成功但組件已卸載時不應呼叫 message.success`
  - `cancelPairing 成功但組件已卸載時不應呼叫 message.success`
  - `saveRelationshipProfile 成功但組件已卸載時不應呼叫 message.success`
  - `startInterviewFlow 成功但組件已卸載時不應呼叫 message.success 或 navigate`
- `npm run test -- --run src/pages/Profile/Pairing/index.test.tsx` 全數通過（51 例）
