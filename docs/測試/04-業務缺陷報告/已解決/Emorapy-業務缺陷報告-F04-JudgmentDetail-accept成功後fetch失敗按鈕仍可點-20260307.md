# Emorapy 業務缺陷報告 - F04 Judgment Detail accept 成功後 fetch 失敗按鈕仍可點

日期：2026-03-07  
缺陷編號：`F04-BUG-004`  
狀態：`已修復`  
嚴重度：`中`

## 1. 缺陷摘要

判決詳情頁面（Judgment Detail）在用戶接受或拒絕判決成功後，會呼叫 `fetchJudgment()` 刷新資料。若此時 `getJudgment` 失敗，原邏輯未做樂觀更新，導致 `judgment.user1_acceptance` 仍為 `undefined`，接受/拒絕按鈕依舊可點擊，違反「已決不可重選」業務規則。

## 2. 業務影響

1. 用戶接受/拒絕判決成功後，若網路瞬斷或 API 暫時不可用，按鈕仍 enabled，可再次點擊
2. 造成重複請求，雖後端可能冪等，但 UX 不當且可能誤導用戶
3. 與 F04 業務規則「已決不可重選」不一致

## 3. 觸發條件

1. 用戶在 Judgment Detail 頁面點擊接受或拒絕判決
2. `acceptJudgment` 成功
3. 緊接著 `fetchJudgment()` 被呼叫
4. `getJudgment` 失敗（網路錯誤、伺服器暫時不可用等）

## 4. 預期行為

- 接受/拒絕成功後，即使 fetch 失敗，按鈕應 disabled，避免用戶重複操作
- 應做樂觀更新：`setJudgment(prev => ({ ...prev, user1_acceptance: true/false }))`

## 5. 實際行為（修復前）

- `acceptJudgment` 成功後只呼叫 `fetchJudgment()`，未樂觀更新 judgment
- fetch 失敗時 judgment 維持原樣，`user1_acceptance` 為 `undefined`
- 按鈕 `disabled={judgment.user1_acceptance !== undefined}` 為 false，仍可點擊

## 6. 根因

`handleAccept` 與 `handleReject` 未在成功後立即樂觀更新 judgment，只依賴 fetch 回傳的資料。

## 7. 修復方案

在 `acceptJudgment` / `acceptJudgment(accepted: false)` 成功後，先執行樂觀更新：

```ts
setJudgment((prev) => (prev ? { ...prev, user1_acceptance: true } : null));  // accept
setJudgment((prev) => (prev ? { ...prev, user1_acceptance: false } : null)); // reject
```

再呼叫 `fetchJudgment()` 嘗試取得最新資料。

## 8. 修復後驗證

- 強化測試：`acceptJudgment 成功後 fetchJudgment 失敗應保留 judgment 且按鈕應 disabled`
- `acceptJudgment(accepted: false)` 對稱用例同様強化
- `npm run test -- --run src/pages/Judgment/Detail/index.test.tsx` 全數通過
