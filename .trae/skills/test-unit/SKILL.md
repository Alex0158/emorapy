---
name: "test-unit"
description: "運行單元測試與覆蓋率；當需要驗證變更穩定性與效能時觸發。"
---

# test-unit v1.0

## 目的
小步執行所有測試，評估覆蓋率與效能，確保品質。

## 何時觸發
- 合併前/提交前/回歸測試時

## 步驟
1. 使用 pytest/jest 等小步執行所有測試，評估能源效率；提供測試上下文。
2. 計算覆蓋率並報告失敗；若失敗，重試修復。
3. 建議呼叫 fixbug skill。

## 輸出
- 測試摘要
- 詳細 log
- confidence: high/medium/low
