---
name: "add-translation"
description: "補齊最近變更的 i18n 條目；當代碼新增文本需國際化時觸發。"
---

# add-translation v1.0

## 目的
自動掃描變更並補齊翻譯資源，降低漏翻風險。

## 何時觸發
- 有新文案或硬編碼文本
- 合併前進行 i18n 自查

## 步驟
1. 掃描 git diff，提取新文本，使用 AI 建議翻譯；提供變更上下文。
2. 比對資源文件，補缺失 key/value；風險項人工確認。
3. 檢測多義詞並列出需確認清單。

## 輸出
- 新增條目清單
- 更新腳本（如有）
- confidence: high/medium/low
