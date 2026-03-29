# Emorapy 業務缺陷報告 - F03 Case Detail collaborative 僅原告有陳述時仍顯示提交按鈕

日期：2026-03-07  
缺陷編號：`F03-BUG-004`  
狀態：`已修復`  
嚴重度：`中`

## 1. 缺陷摘要

案件詳情頁（Case Detail）在 draft collaborative 模式下，當僅有原告陳述、被告尚未回覆時，前端仍顯示「提交案件」按鈕，且後端 `submitCase` 未對 collaborative 模式驗證 `defendant_statement`，導致原告可將未收集完雙方資訊的案件誤提交為 `submitted`。

## 2. 業務影響

1. 與 F03-BUG-001（createCase collaborative 護欄）語義不一致：建案有護欄，但詳情頁提交無護欄
2. `draft -> submitted` 狀態可被不完整案件進入，影響 review / judgment 後續流程
3. 與 remote 模式不對稱：remote 會顯示「等待被告回覆」且不顯示提交按鈕，collaborative 應同理

## 3. 觸發條件

1. 案件為 draft、mode 為 collaborative
2. `defendant_statement` 為空或未填
3. 原告視角進入 Case Detail 頁面
4. 前端顯示提交按鈕（錯誤）
5. 用戶點擊提交，後端未拒絕（錯誤）

## 4. 預期行為

- collaborative draft 當 `defendant_statement` 為空時，應與 remote 對齊：顯示「等待被告回覆」、不顯示提交按鈕
- 後端 `submitCase` 對 collaborative 模式也應驗證 `defendant_statement` 存在且非空

## 5. 實際行為（修復前）

- `needsDefendantResponse` 僅對 `mode === 'remote'` 成立，collaborative 時恆為 false
- 提交按鈕顯示條件 `status === 'draft' && !needsDefendantResponse` 對 collaborative 恆成立
- 後端 `submitCase` 僅對 remote 檢查 defendant_statement，collaborative 未檢查

## 6. 根因

- 前端：`needsDefendantResponse` 未涵蓋 `mode === 'collaborative'`
- 後端：`submitCase` 僅對 `mode === 'remote'` 驗證 defendant_statement

## 7. 修復方案

1. 前端 `Case Detail`：`needsDefendantResponse` 擴展為 `(mode === 'remote' || mode === 'collaborative') && !defendant_statement`
2. 後端 `case.service.submitCase`：對 collaborative 模式新增 defendant_statement 必填驗證，與 remote 對齊
3. 補測試：draft collaborative 僅原告有陳述時不應顯示提交按鈕；後端 submitCase collaborative 缺少 defendant 應拋錯

## 8. 修復後驗證

已通過：

- 前端 Vitest：`Case Detail` 新增用例「draft collaborative 僅原告有陳述時不應顯示提交按鈕」；52 例全數通過
- 後端 Jest：`case.service.submitCase` 補 remote/collaborative 缺少 defendant 應拋 VALIDATION_ERROR；submitCase 相關 6 例全數通過
- 全體測試通過
