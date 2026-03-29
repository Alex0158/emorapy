# Emorapy 優化報告 - F01 QuickExperience Result fetchCase 補 useMountedRef 防止卸載後 setState

日期：2026-03-07  
優化編號：`F01-OPT-002`  
狀態：`已完成`  
類型：`預防性優化`（與 F01-BUG-001 同類問題）

## 1. 問題摘要

QuickExperience Result 頁的 `fetchCase` 在 `useEffect` 中於掛載時呼叫，若使用者在 `getCase` 完成前離開頁面，`fetchCase` 仍會在 resolve 後執行 `setCaseStatus`、`setEvidenceUploadStatus`、`setJudgmentFailureReason` 等 setState，可能觸發 React「setState on unmounted component」警告，並造成不可預期行為。

## 2. 業務影響

1. 潛在 React 開發模式警告
2. 與 F01-BUG-001（useMountedRef）同類風險：異步完成時組件已卸載仍觸發副作用
3. 若 `getCase` 返回 `NOT_FOUND` 且組件已卸載，原會執行 `navigate`、`message.warning`，卸載後不應再執行

## 3. 觸發條件

1. 使用者進入 Result 頁
2. `fetchCase` 被呼叫，`getCase` 為延遲回應
3. 使用者在 `getCase` resolve 前離開頁面（導航或卸載）
4. `getCase` 完成後 `fetchCase` 繼續執行 setState / navigate

## 4. 修復方案

在 `fetchCase` 內加入 `mountedRef` 檢查：

1. **成功路徑**：`await getCase` 後立即檢查 `if (!mountedRef.current) return case_;`，避免後續 setState
2. **錯誤路徑**：`catch` 區塊開頭檢查 `if (!mountedRef.current) return null;`，避免 `NOT_FOUND` 時執行 `navigate`、`message.warning`、`caseSessionMap.remove`

## 5. 修復後驗證

- 新增回歸測試：「fetchCase 成功但組件已卸載時不應 setState」
- 執行 `vitest run src/pages/QuickExperience/Result/index.test.tsx` 通過

## 6. 備註

與 F01-OPT-001（證據上傳、judgment_failed retry、輪詢 fetchJudgment 的 useMountedRef）同屬 F01 結果頁卸載防護系列，本優化補齊 `fetchCase` 分支。
