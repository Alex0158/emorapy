# Emorapy 優化報告 - F09 Auth ForgotPassword 補 useMountedRef 防止卸載後 success 回調

日期：2026-03-07  
編號：`F09-OPT-003`  
狀態：`已修復`  
類型：`預防性優化`（對齊 F01-BUG-001 修復與 useMountedRef 跨頁回歸）

## 1. 摘要

**F09-OPT-003**：忘記密碼頁（Auth ForgotPassword）的 `handleSendResetEmail`、`handleResetPassword` 在 async 成功後會呼叫 `message.success`、`setCurrentStep`、`setResetDone` 或 `navigate`（含 setTimeout 延遲導航），未使用 `useMountedRef`。

當使用者快速離開頁面後，若 async 操作成功返回，仍會呼叫 `message.success` 與 `navigate`，可能導致非預期導航或與 F01-BUG-001 同類問題。

## 2. 業務影響

1. 使用者已離開頁面，卻被突然導向登入頁，造成困惑
2. 與其他已使用 useMountedRef 的頁面不一致

## 3. 修復方案

**Auth ForgotPassword**：
1. 對 `handleSendResetEmail`、`handleResetPassword` 的 async 成功路徑，在 `await` 後檢查 `mountedRef.current`，若已卸載則直接 `return`
2. 對 `handleResetPassword` 內 `setTimeout` 的 navigate 回調，執行前再次檢查 `mountedRef.current`

## 4. 修復後驗證

- Auth ForgotPassword 新增測試：`confirmResetPassword 成功但組件已卸載時不應呼叫 message.success 或 navigate`
- `npm run test -- --run src/pages/Auth/ForgotPassword/index.test.tsx` 全數通過（23 例）
