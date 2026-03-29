# Emorapy 優化報告 - F03 Case Detail / Case Create 補 useMountedRef 防止卸載後 success 回調

日期：2026-03-07  
編號：`F03-OPT-001`、`F03-OPT-002`、`F03-OPT-003`  
狀態：`已修復`  
類型：`預防性優化`（對齊 F01-BUG-001 修復與 useMountedRef 跨頁回歸）

## 1. 摘要

**F03-OPT-001**：案件詳情頁（Case Detail）的 `handleSubmit`、`handleDefendantRespond` 與「查看判決」按鈕的 async 回調，均未使用 `useMountedRef`。

**F03-OPT-002**：案件創建頁（Case Create）的 `handleSubmit` 在 createCase 成功後會呼叫 `message.success` 與 `navigate`，亦未使用 `useMountedRef`。

**F03-OPT-003**：審理中頁（Case Review）的 `handleRetryJudgment` 在 generateJudgment 成功後會呼叫 `setJudgment` 與 `message.success`，亦未使用 `useMountedRef`。

當使用者快速離開頁面（例如點擊返回）後，若 async 操作成功返回，仍會呼叫 `message.success` 與 `navigate`，可能導致非預期導航或與 F01-BUG-001 同類問題。

## 2. 業務影響

1. 使用者已離開頁面，卻被突然導向 review 或判決頁，造成困惑
2. 與 QuickExperience Create、Execution CheckIn、Interview Chat/Result 等已使用 useMountedRef 的頁面不一致

## 3. 修復方案

**Case Detail**：
1. 對 `handleSubmit`、`handleDefendantRespond` 與「查看判決」onClick 的 async 成功/錯誤路徑，皆檢查 `mountedRef.current` 後再呼叫 `message.success` / `message.error` / `navigate` / `setCase_` / `setSubmitting` / `setRespondLoading`
2. 在 `finally` 中僅對 `setSubmitting` / `setRespondLoading` 做 mounted 檢查，避免 setState 於已卸載組件

**Case Create**：
1. 對 `handleSubmit` 的 createCase 成功路徑、證據上傳成功/失敗路徑、navigate、錯誤路徑與 `finally` 的 `setSubmitting`，皆檢查 `mountedRef.current`

**Case Review**：
1. 對 `handleRetryJudgment` 的 generateJudgment 成功路徑、JUDGMENT_EXISTS 分支、錯誤路徑與 `finally` 的 `setRetrying`，皆檢查 `mountedRef.current`

## 4. 修復後驗證

- Case Detail 新增測試：`submitCase 成功但組件已卸載時不應呼叫 message.success 或 navigate`
- Case Create 新增測試：`createCase 成功但組件已卸載時不應呼叫 message.success 或 navigate`
- Case Review 新增測試：`judgment_failed 時 generateJudgment 成功但組件已卸載時不應呼叫 message.success`
- `npm run test -- --run src/pages/Case/Detail/index.test.tsx src/pages/Case/Create/index.test.tsx src/pages/Case/Review/index.test.tsx` 全數通過
