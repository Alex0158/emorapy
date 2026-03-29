# Emorapy 優化報告 - F03 Case Create checkPairing 補 useMountedRef 防止卸載後 setState

日期：2026-03-07  
優化編號：`F03-OPT-004`  
狀態：`已完成`  
類型：`預防性優化`（與 F01-BUG-001 同類問題）

## 1. 問題摘要

Case Create 頁的 `checkPairing` 在 `useEffect` 中於掛載時呼叫，若使用者在 `getPairingStatus` 完成前離開頁面，`checkPairing` 仍會在 resolve/reject 後執行 `setPairingId`、`setPairingStatus`、`setPairingLoadError`，可能觸發 React「setState on unmounted component」警告。

## 2. 業務影響

1. 潛在 React 開發模式警告
2. 與 F01-BUG-001（useMountedRef）同類風險：異步完成時組件已卸載仍觸發 setState
3. 影響 F03 正式案件建案入口穩定性

## 3. 觸發條件

1. 使用者進入 Case Create 頁
2. `checkPairing` 被呼叫，`getPairingStatus` 為延遲回應
3. 使用者在 `getPairingStatus` resolve/reject 前離開頁面
4. `getPairingStatus` 完成後 `checkPairing` 繼續執行 setState

## 4. 修復方案

在 `checkPairing` 內加入 `mountedRef` 檢查：

1. **成功路徑**：`await getPairingStatus` 後立即檢查 `if (!mountedRef.current) return;`
2. **錯誤路徑**：`catch` 區塊開頭檢查 `if (!mountedRef.current) return;`

## 5. 修復後驗證

- 新增回歸測試：「checkPairing 成功但組件已卸載時不應 setState」、「checkPairing 失敗但組件已卸載時不應 setState」
- 執行 `vitest run src/pages/Case/Create/index.test.tsx` 通過

## 6. 備註

與 F03-OPT-001（Case Detail）、F03-OPT-002（handleSubmit）、F03-OPT-003（Case Review）同屬 F03 useMountedRef 卸載防護系列，本優化補齊 `checkPairing` 分支。
