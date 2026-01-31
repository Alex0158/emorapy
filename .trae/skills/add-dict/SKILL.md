---
name: "add-dict"
description: "補充標準詞庫；當 i18n 字典缺失或需一致性校驗時觸發。"
---

# add-dict v1.0

## 目的
自動補齊字典條目並校驗一致性，降低語義風險。

## 何時觸發
- i18n-global-dictionary-usage.md 指出缺失
- 新增文本需入庫

## 步驟
1. 依 i18n-global-dictionary-usage.md 掃描缺失詞，使用 AI 生成 key/value；提供字典上下文。
2. 寫入字典文件；若衝突，重試。
3. 驗證一致性並報告衝突。

## 輸出
- 新增條目
- 更新後字典預覽
- confidence: high/medium/low
