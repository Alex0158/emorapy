---
name: "git-commit"
description: "生成並提交 Conventional Commits；當需要規範化提交且自查通過時觸發。"
---

# git-commit v1.0

## 目的
在零信任預檢後，以規範訊息提交變更。

## 何時觸發
- 準備提交代碼

## 步驟
1. 小步運行文檔同步與 linter/安全預檢；若錯誤先修復，提供 AI commit 上下文。
2. 生成 Conventional Commits message。
3. 執行 `git commit -m "<message>"`。

## 輸出
- commit ID
- message
- confidence: high/medium/low
