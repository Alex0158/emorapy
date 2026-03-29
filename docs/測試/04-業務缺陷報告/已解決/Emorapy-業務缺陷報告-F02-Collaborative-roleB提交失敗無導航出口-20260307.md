# Emorapy 業務缺陷報告 - F02 Collaborative role_b 提交失敗時無導航出口

日期：2026-03-07  
缺陷編號：`F02-BUG-003`  
狀態：`已修復`  
嚴重度：`中`

## 1. 缺陷摘要

協作聽證頁面（QuickExperience Collaborative）在 role_b 階段，當 `createCollaborativeCase` 提交失敗時，僅顯示 `message.error`。該階段 UI 僅有「提交」按鈕，無「返回」按鈕，使用者無法返回 handoff 重新交接設備或修正流程，亦無法返回 intro 重新開始。

## 2. 業務影響

1. 使用者提交失敗後僅能重試，無法返回上一步（如 session 過期需重新 handoff）
2. 與 role_a 階段（有「返回」按鈕）不一致
3. 與其他頁面錯誤恢復模式（失敗不阻塞導航出口）不一致

## 3. 觸發條件

1. 用戶進入協作模式，完成 role_a、handoff，進入 role_b
2. 在 role_b 填寫被告陳述後點擊提交
3. `createCollaborativeCase` 拋錯（網路失敗、SESSION_EXPIRED、FORBIDDEN 等）

## 4. 預期行為

依 F02 錯誤恢復慣例（與 role_a、Profile Pairing 等對齊）：
- 顯示錯誤訊息後，使用者可點擊「返回」按鈕回到 handoff 階段
- 用戶可重新交接設備或選擇其他操作

## 5. 實際行為（修復前）

- 顯示 `message.error`（toast）
- role_b 卡片僅有提交按鈕，無返回按鈕
- 使用者無法返回 handoff

## 6. 根因

role_b 階段的 `Card` 僅渲染提交按鈕，未提供返回 handoff 的導航出口。role_a 有 `collaborative.back` 可返回 intro，role_b 缺少對應按鈕。

## 7. 修復方案

在 role_b 的按鈕區新增「返回」按鈕，點擊時 `setPhase('handoff')`，使用既有 `t('collaborative.back')` 文案。

## 8. 修復後驗證

- 新增測試：`role_b 提交失敗時應仍可點擊返回並導向 handoff（F02 錯誤恢復：失敗不阻塞導航出口）`
- `npm run test -- --run src/pages/QuickExperience/Collaborative/index.test.tsx` 全數通過
