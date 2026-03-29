# Emorapy 業務缺陷報告 - F04 Judgment Detail judgment_content 為 null 時崩潰

日期：2026-03-09  
缺陷編號：`F04-BUG-005`  
狀態：`已修復`  
嚴重度：`中`

## 1. 缺陷摘要

判決詳情頁面（Judgment Detail）將 `judgment.judgment_content` 直接傳給 `JudgmentViewer`。當 API 回傳 `judgment_content` 為 `null` 或 `undefined` 時，`JudgmentViewer` 內 `parseMarkdownSections` 呼叫 `content.split('\n')` 會拋出 `TypeError`，導致頁面白屏崩潰。

## 2. 業務影響

1. API 回傳不完整或異常資料時，判決詳情頁無法正常顯示
2. 用戶無法查看判決，影響 F04 核心流程
3. 與 F05/F03 邊界防護慣例（API 回傳不完整時不崩潰）不一致

## 3. 觸發條件

1. 用戶進入 Judgment Detail 頁面
2. `getJudgment` 成功回傳，但 `judgment_content` 為 `null` 或 `undefined`
3. 頁面渲染 `JudgmentViewer` 時傳入 `content={judgment.judgment_content}`

## 4. 預期行為

- 當 `judgment_content` 為 null/undefined 時，應使用空字串 fallback，不崩潰
- 與 Execution Dashboard `plan_summary` null、Case List `cases` undefined 等邊界處理對齊

## 5. 實際行為（修復前）

- `JudgmentViewer` 收到 `content={undefined}` 或 `content={null}`
- `parseMarkdownSections(content, ...)` 內 `content.split('\n')` 拋錯
- 頁面白屏，React 錯誤邊界可能捕獲

## 6. 根因

`Judgment Detail` 未對 `judgment.judgment_content` 做 null/undefined 防護，直接傳給子組件。

## 7. 修復方案

在 `Judgment Detail` 傳入 `JudgmentViewer` 時使用 fallback：

```tsx
content={judgment.judgment_content ?? ''}
```

## 8. 修復後驗證

- 補測試：`getJudgment 回傳 judgment_content 為 null 時應不崩潰並顯示判決區塊`
- `npm run test -- src/pages/Judgment/Detail/index.test.tsx` 全數通過
