# Emorapy 業務缺陷報告 - F03 Case Create getPairingStatus 失敗時無 retry 按鈕

日期：2026-03-07  
缺陷編號：`F03-BUG-003`  
狀態：`已修復`  
嚴重度：`低`

## 1. 缺陷摘要

正式案件建立頁（Case Create）當 `getPairingStatus` 失敗時，僅將狀態設為 pending 並顯示「需前往配對」，無 retry 按鈕。若為暫時性網路錯誤且使用者實已配對，無法直接重試載入，需導向配對頁再返回。

## 2. 業務影響

1. 暫時性網路或服務錯誤時，已配對使用者需先前往配對頁再返回才能重試
2. 無法區分「API 失敗」與「未配對」，皆顯示相同 pending UI
3. 與 Profile Pairing、Execution CheckIn 等頁面的 retry 模式不一致

## 3. 觸發條件

1. 使用者進入案件建立頁 `/case/create`
2. `getPairingStatus` 失敗（網路錯誤等）
3. 顯示「需前往配對」與前往配對按鈕，無 retry 按鈕

## 4. 修復方案

1. 新增 `pairingLoadError` 狀態，於 getPairingStatus 失敗時設定錯誤訊息
2. 將 `checkPairing` 抽出為 `useCallback` 供 retry 呼叫
3. 當 `pairingLoadError` 時顯示 error Alert，提供「重試」與「前往配對」按鈕
4. 當非 loadError 的 pending（配對未完成）仍維持原「需前往配對」UI

## 5. 修復後驗證

- 更新測試：getPairingStatus 失敗時應顯示錯誤訊息與 retry、前往配對按鈕
- 新增測試：getPairingStatus 失敗時點擊 retry 應重新呼叫，成功後應顯示建立表單（F03 錯誤恢復）
- `npm run test -- --run src/pages/Case/Create/index.test.tsx` 全數通過（23 例）
