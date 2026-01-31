---
name: "doc-clean"
description: "整理 Markdown 文件至 docs/ 目錄；當需提升文檔結構與存儲效率時觸發。"
---

# doc-clean v1.0

## 目的
集中管理 Markdown，優化存儲結構並保持可追溯。

## 何時觸發
- 文檔分散於項目中
- 調整文檔結構或發布前整理

## 步驟
1. 掃描項目所有 *.md（排除根 README.md 與 .trae/ 內文件）。
2. 小步移動至 docs/ 目錄，保留原相對路徑；若衝突，重試或報告。
3. 確認移動成功後刪除原文件，提升存儲效率。

## 輸出
- 移動清單
- 警告（若有）
- confidence: high/medium/low
