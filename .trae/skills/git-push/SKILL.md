---
name: "git-push"
description: "推送變更至遠端並附帶安全/測試檢查；當準備同步遠端時觸發。"
---

# git-push v1.0

## 目的
在 DevSecOps 檢查通過後，小步安全地推送變更。

## 何時觸發
- 本地 commit 已完成，需同步遠端

## 步驟
1. 確認本地 commit 完成，運行測試與安全掃描，確保無錯誤。
2. 執行 `git push origin <branch>`；若衝突，重試并處理。
3. 輸出推送結果與任何錯誤。

## 輸出
- 推送結果
- 錯誤說明（如有）
- confidence: high/medium/low
