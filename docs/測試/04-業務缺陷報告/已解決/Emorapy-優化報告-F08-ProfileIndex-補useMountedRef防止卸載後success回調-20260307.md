# Emorapy 優化報告 - F08 Profile Index 補 useMountedRef 防止卸載後 success 回調

日期：2026-03-07  
編號：`F08-OPT-002`  
狀態：`已修復`  
類型：`預防性優化`（對齊 F01-BUG-001 修復與 useMountedRef 跨頁回歸）

## 1. 摘要

**F08-OPT-002**：個人資料頁（Profile Index）的 `handleSubmit`（updateProfile）、頭像上傳、繼續聊天 onClick、ConsentModal onConsent 在 async 成功後會呼叫 `message.success`、`updateUser`、`setConsentOpen` 或 `navigate`，均未使用 `useMountedRef`。

當使用者快速離開頁面後，若 async 操作成功返回，仍會呼叫 `message.success` 與 `navigate`，可能導致非預期導航或與 F01-BUG-001 同類問題。

## 2. 業務影響

1. 使用者已離開頁面，卻被突然導向 interview 頁，造成困惑
2. 與 Profile Pairing、Judgment Detail、Auth 等已使用 useMountedRef 的頁面不一致

## 3. 修復方案

**Profile Index**：
1. 對 `handleSubmit` 的 async 成功路徑，在 `await updateProfile` 後檢查 `mountedRef.current`，若已卸載則直接 `return`
2. 對頭像上傳 `beforeUpload` 的 async 成功路徑，在 fetch 成功後檢查 `mountedRef.current`，若已卸載則直接 `return`
3. 對繼續聊天 onClick，在 `checkResume` 與 `startSession` 兩次 `await` 後各檢查 `mountedRef.current`，若已卸載則直接 `return`
4. 對 ConsentModal `onConsent`，在 `giveConsent`、`checkResume`、`startSession` 各 `await` 後檢查 `mountedRef.current`，若已卸載則直接 `return`

## 4. 修復後驗證

- Profile Index 新增測試：
  - `updateProfile 成功但組件已卸載時不應呼叫 message.success`
  - `繼續聊天 startSession 成功但組件已卸載時不應呼叫 message.success 或 navigate`
- `npm run test -- --run src/pages/Profile/Index/index.test.tsx` 全數通過（25 例）
