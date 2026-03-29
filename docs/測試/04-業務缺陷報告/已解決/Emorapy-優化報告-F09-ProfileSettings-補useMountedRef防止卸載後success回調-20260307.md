# Emorapy 優化報告 - F09 Profile Settings 補 useMountedRef 防止卸載後 success 回調

日期：2026-03-07  
編號：`F09-OPT-004`  
狀態：`已修復`  
類型：`預防性優化`（對齊 F01-BUG-001 修復與 useMountedRef 跨頁回歸）

## 1. 摘要

**F09-OPT-004**：個人設定頁（Profile Settings）的 `handleSubmit` 在 updateProfile 成功後會呼叫 `updateUser` 與 `message.success`，未使用 `useMountedRef`。

當使用者快速離開頁面後，若 async 操作成功返回，仍會呼叫 `message.success`，可能導致與 F01-BUG-001 同類問題。

## 2. 業務影響

1. 使用者已離開頁面，卻仍顯示成功訊息，造成困惑
2. 與 Login、Register、ForgotPassword、Profile Index 等已使用 useMountedRef 的頁面不一致

## 3. 修復方案

**Profile Settings**：
1. 對 `handleSubmit` 的 async 成功路徑，在 `await updateProfile` 後檢查 `mountedRef.current`，若已卸載則直接 `return`，不再呼叫 `updateUser` 或 `message.success`
2. 對 `catch` 與 `finally` 路徑，同樣檢查 `mountedRef.current` 後再呼叫 `message.error` 或 `setSaving`

## 4. 修復後驗證

- Profile Settings 新增測試：`updateProfile 成功但組件已卸載時不應呼叫 message.success`
- `npm run test -- --run src/pages/Profile/Settings/index.test.tsx` 全數通過（20 例）
