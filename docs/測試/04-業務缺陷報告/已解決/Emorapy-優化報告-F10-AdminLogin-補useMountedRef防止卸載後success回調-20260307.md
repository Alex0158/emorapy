# Emorapy 優化報告 - F10 Admin Login 補 useMountedRef 防止卸載後 success 回調

日期：2026-03-07  
編號：`F10-OPT-001`  
狀態：`已修復`  
類型：`預防性優化`（對齊 F01-BUG-001 修復與 useMountedRef 跨頁回歸）

## 1. 摘要

**F10-OPT-001**：管理員登入頁（Admin Login）的 `onFinish` 在 `loginMutation.mutateAsync` 成功後會呼叫 `message.success` 與 `navigate`，未使用 `useMountedRef`。

當使用者提交登入後快速離開頁面（例如關閉分頁），若 async 操作成功返回，仍會呼叫 `message.success` 與 `navigate`，可能導致非預期導航或與 F01-BUG-001 同類問題。

## 2. 業務影響

1. 管理員登入成功後若已離開頁面，仍可能觸發導航（較少見但存在）
2. 與 Auth Login、Judgment Detail、Chat Room 等已使用 useMountedRef 的頁面不一致

## 3. 修復方案

**Admin Login**：
1. 對 `onFinish` 的 async 成功路徑，在 `await loginMutation.mutateAsync` 後檢查 `mountedRef.current`，若已卸載則直接 `return`，不再呼叫 `message.success` 與 `navigate`

## 4. 修復後驗證

- Admin Login 新增測試：`登入成功但組件已卸載時不應呼叫 message.success 或 navigate`
- `npm run test -- --run src/pages/Admin/Login/index.test.tsx` 全數通過（8 例）
