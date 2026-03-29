# Emorapy 優化報告 - F06 Profile MyStory 補 useMountedRef 防止卸載後 success 回調

日期：2026-03-07  
編號：`F06-OPT-001`  
狀態：`已修復`  
類型：`預防性優化`（對齊 F01-BUG-001 修復與 useMountedRef 跨頁回歸）

## 1. 摘要

**F06-OPT-001**：我的故事頁（Profile MyStory）的 `handleStartChat`、`handleRetryFailed`、`handleDelete` 在 async 成功後會呼叫 `navigate`、`message.info`、`message.success` 與 `setDeleteModalOpen`，均未使用 `useMountedRef`。

當使用者快速離開頁面後，若 async 操作成功返回，仍會呼叫 `message.success`、`message.info` 或 `navigate`，可能導致非預期導航或與 F01-BUG-001 同類問題。

## 2. 業務影響

1. 使用者已離開頁面，卻被突然導向訪談頁或個人資料頁，造成困惑
2. 與 Interview Chat、Interview Result、Profile Pairing 等已使用 useMountedRef 的頁面不一致

## 3. 修復方案

**Profile MyStory**：
1. 對 `handleStartChat` 的 checkResume/startSession 成功路徑，在 `await` 後檢查 `mountedRef.current`，若已卸載則直接 `return`，不再呼叫 `navigate`
2. 對 `handleRetryFailed` 的 retryFailed 成功路徑，在 `await` 後檢查 `mountedRef.current`，若已卸載則直接 `return`，不再呼叫 `message.info` 或 `setFailedSessionId`
3. 對 `handleDelete` 的 deleteAllData 成功路徑，在 `await` 後檢查 `mountedRef.current`，若已卸載則直接 `return`，不再呼叫 `message.success`、`setDeleteModalOpen` 或 `navigate`
4. 對各 handler 的 `catch` 與 `finally` 路徑，同樣檢查 `mountedRef.current` 後再執行副作用

## 4. 修復後驗證

- Profile MyStory 新增測試：
  - `deleteAllData 成功但組件已卸載時不應呼叫 message.success 或 navigate`
  - `繼續聊天 startSession 成功但組件已卸載時不應呼叫 navigate`
  - `retryFailed 成功但組件已卸載時不應呼叫 message.info`
- `npm run test -- --run src/pages/Profile/MyStory/index.test.tsx` 全數通過（31 例）
