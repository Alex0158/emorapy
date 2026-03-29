# Emorapy 業務缺陷報告 - F03 Case Review cancelled 狀態誤顯示審理中

日期：2026-03-09  
缺陷編號：`F03-BUG-005`  
狀態：`已修復`  
嚴重度：`中`

## 1. 缺陷摘要

審理中頁面（Case Review）在 `useEffect` 中僅處理 `completed`、`judgment_failed`、`submitted`、`in_progress`、`draft` 五種狀態。當案件狀態為 `cancelled` 時，未進入任何分支，導致頁面誤顯示「AI 審理中」與進度條，語義錯誤。

## 2. 業務影響

1. 已取消案件不應顯示審理中，會誤導用戶
2. 與 draft 處理不一致：draft 會導回 detail，cancelled 應有對應導航
3. 影響 F03 正式案件流程的狀態邊界完整性

## 3. 觸發條件

1. 用戶直接進入 `/case/:id/review` 或從他處導向
2. 該案件 `status` 為 `cancelled`
3. `getCase` 成功回傳該案件

## 4. 預期行為

- `cancelled` 案件進入 review 頁時，應提示並導回案件列表或詳情，不應顯示審理中

## 5. 實際行為（修復前）

- `cancelled` 未進入 useEffect 任一分支，不 fetch、不 poll、不 redirect
- 頁面 fallthrough 至預設「審理中」UI，顯示進度條與「AI 分析中」

## 6. 根因

`useEffect` 的 status 分支未涵蓋 `cancelled`，與 `draft` 對稱處理缺失。

## 7. 修復方案

在 `useEffect` 中新增 `cancelled` 分支，與 `draft` 對齊：

```ts
} else if (case_.status === 'cancelled') {
  message.warning(t('review.caseCancelled'));
  navigate(`/case/list`, { replace: true });
}
```

## 8. 修復後驗證

- 補測試：`cancelled 案件進入 review 時應提示並導回案件列表`
- `npm run test -- src/pages/Case/Review/index.test.tsx` 全數通過
