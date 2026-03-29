---
name: business-flow-implementation-handoff
description: 接收已完成的業務流程分析結論與已確認優化方案，將其拆解為可實作的改動項、測試項、驗收項與風險控制。Use when analysis is complete, the user has accepted an optimization direction, and the next step is implementation, refactor, task breakdown, code change planning, or execution handoff.
---

# Business Flow Implementation Handoff

## When To Use

只有在以下條件都成立時才使用：

1. 已完成分析層工作
2. 已有清楚的已確認問題或已接受方案
3. 需要開始落地、改代碼、補測試、調整接口或安排驗收

若還在判斷「這是不是問題」，不要用這個 Skill，先回到 `business-flow-deep-analysis` 或 `f01-quick-experience-audit`。

## Layer Position

這是 `落地層 Skill`。

它負責：

- 接收分析報告與已確認方案
- 拆成前端、後端、API、測試、文檔改動
- 排定實作順序與驗收口徑
- 在需要時進入真正的代碼修改

它不負責：

- 替代分析層做問題定性
- 在缺少確認方案時自行決策產品方向

## Required Input

開始前至少要有以下其中 2 項，且最好包含第 1 項：

1. `/Users/alex/Desktop/CJ/分析/` 內的分析報告
2. 已確認的推薦方案
3. 明確的優先級或範圍限制
4. 已知不可動的模組或約束

## Workflow

### 1. 先讀分析結論

先抽出：

- 已確認問題
- 不做項
- 推薦方案
- 影響範圍
- 待驗證項

### 2. 轉成落地清單

至少拆成以下欄位：

- 前端改動
- 後端改動
- API 或資料契約改動
- 測試改動
- 文檔改動
- 風險與回歸點

### 3. 定義實作順序

預設順序：

1. 先改最小必要契約
2. 再改核心邏輯
3. 再補 UI 或交互
4. 再補測試
5. 最後做文檔與驗收

### 4. 驗收規則

每個落地任務都要明確：

- 改完後應看到什麼行為
- 哪些既有流程不能被破壞
- 需要哪些測試護欄
- 是否需要新的分析回合再確認

## Output

使用 [handoff-template.md](handoff-template.md)。

若使用者要求你直接開始實作，就先按模板整理一版最小落地清單，再開始改動。

## Related Skills

- 做問題發現與方案確認：`business-flow-deep-analysis`
- 做 F01 專項分析：`f01-quick-experience-audit`
