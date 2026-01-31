---
name: "develop"
description: "按 PDCA + DevSecOps 進行開發；當需要端到端計劃/執行/檢查/優化時觸發。"
---

# develop v1.0

## 目的
AI 導向分解與落地，保證安全與質量。

## 何時觸發
- 新功能/重構/修復的完整開發流程

## 步驟
1. Plan：分解任務，引用 ProjectRule，使用 AI 制定方案；提供 PRD 上下文。
2. Do：小步實施，應用原則 + 安全檢查；必要時呼叫 improve。
3. Check：審核與單元測試；若失敗重試。
4. Act：優化並輸出進度與 confidence。

## 輸出
- 進度摘要
- confidence: high/medium/low
