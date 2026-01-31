---
name: "audit"
description: "依七大原則/DevSecOps 審計並量化評分；當需品質/安全審核時觸發。"
---

# audit v1.0

## 目的
全面審核 SOLID、DRY、KISS 與安全/Lean 符合度，消除浪費。

## 何時觸發
- 合併前審核
- 例行品質巡檢

## 步驟
1. 檢查 SOLID、DRY、KISS + 安全/Lean；提供審計上下文。
2. 使用 linter/掃描工具檢測違規；若錯誤，重試修復。
3. 輸出分數化報告（如合規率 %），低於閾值建議修復。

## 輸出
- 審計分數與詳述
- 修復建議
- confidence: high/medium/low
