---
name: business-flow-deep-analysis
description: 深度分析業務流程、用戶體驗、產品合理性與漏洞風險，並以文檔、代碼、API、測試與歷史缺陷交叉驗證後輸出優化方案。This is an analysis-layer skill only. Use when the user asks to analyze a business flow, quick experience, user journey, conversion path, product logic, UX issue, loophole, defect, or asks for multi-angle business review.
---

# Business Flow Deep Analysis

## Quick Start

在開始前先做 3 件事：

1. 鎖定分析目標、流程範圍、成功指標。
2. 先建立證據矩陣，再下判斷。
3. 把結論寫成 `.md` 放到 `/Users/alex/Desktop/CJ/分析/`。

若使用者沒有指定流程，預設先分析 `F01 快速體驗`。

## Layer Position

這是 `分析層 Skill`，只負責：

- 理解業務流程與真實規則
- 發現、驗證、分級疑點
- 做多視角交叉分析
- 提出優化方案與交接建議

這個 Skill 不負責：

- 直接改動業務代碼
- 直接修改資料結構或接口
- 直接執行產品方案落地
- 在沒有明確交接前進入實作

## Core Workflow

### 1. 定義本輪分析目標

先明確回答以下問題：

- 這輪分析的是哪一條流程或哪一個節點？
- 目標是排查什麼：合理性、轉化、體驗、缺陷、漏洞、信任感，還是錯誤恢復？
- 分析對象是新用戶、回訪用戶、付費前用戶、還是某個特殊人群？

### 2. 建立證據矩陣

至少從以下 5 類證據中取 3 類，且必須包含 `代碼`：

- 文檔：產品、流程、設計、接口、測試設計
- 代碼：前端頁面、後端服務、工具函數、狀態管理
- API：路由、請求參數、響應字段、授權與錯誤碼
- 測試：單元、整合、E2E、測試設計文檔
- 歷史缺陷：已知 bug、修復報告、回歸驗證

不要只根據單一文檔或單一測試下結論。

### 3. 先還原真實流程

先整理：

- 真實入口
- 關鍵步驟
- 狀態轉移
- 關鍵授權憑證
- 失敗分支
- 回訪或重試機制
- 與其他模組的邊界

輸出時要能對應到具體功能點、頁面、接口與核心文件。

### 4. 發現疑點時的處理規則

若發現可疑點，不要立刻定義為 bug。先做二次排查：

1. 找到對應的產品文檔或流程文檔。
2. 找到真正執行該行為的核心代碼。
3. 找相關測試或歷史缺陷報告。
4. 判斷該疑點屬於哪一類：
   - `已確認問題`
   - `高疑似問題`
   - `已修復歷史問題`
   - `文檔或認知過時`
   - `需要運行驗證`

只有當至少兩類證據互相支撐時，才能標為 `已確認問題`。

### 5. 做多視角交叉分析

對每個已確認問題或高疑似問題，都要從以下視角交叉分析：

- `Marketing Expert`：是否破壞第一印象、信任感、轉化節點、分享意願、留存動機
- `Product Manager`：流程是否合理、規則是否一致、狀態機是否穩定、是否符合核心價值
- `真實用戶`：是否困惑、是否被誤導、是否感到被說教、是否容易中斷或放棄
- `風險/濫用視角`：是否能被繞過、誤觸、刷量、誤判、或形成安全/公平性問題

不要只寫表面體驗問題，要同時說明背後機制是否健康。

### 6. 產出優化方案

每個方案至少回答：

- 想解決哪個真實問題
- 為什麼這比其他方案更合理
- 對轉化、信任感、穩定性、實現成本的影響
- 是否需要前後端同步調整
- 是否需要補測試或補文檔

若有多個方案，先給預設推薦方案，再列替代方案。

### 7. 落文規則

每輪分析都要輸出 markdown 到 `/Users/alex/Desktop/CJ/分析/`。

建議命名：

`YYYYMMDD-模組-主題-第NN輪.md`

例如：

`20260312-F01-quick-experience-responsibility-ratio-第01輪.md`

## Hard Rules

- 先證據，後判斷。
- 疑點不等於結論。
- 舊問題先判斷是否已修復。
- 缺少代碼依據時，不要寫成確定事實。
- 缺少運行證據但風險高時，明確標記為 `需要運行驗證`。
- 在分析階段，不要直接修改業務代碼。
- 若已形成穩定方案，只輸出交接內容，不直接落地。

## Default Output Structure

使用 [report-template.md](report-template.md)。

若需要更細的判定準則、視角問題清單與結論分級，讀 [reference.md](reference.md)。

若分析已完成且要進入真正實作，改用 `business-flow-implementation-handoff`。

## Related Skill

若本輪目標是 `F01 快速體驗`、`quick experience`、`匿名 session`、`責任比例`、`quick case`，同時使用 `f01-quick-experience-audit`。
若本輪已拿到確認過的優化方案，要拆成落地改動、測試與驗收，改用 `business-flow-implementation-handoff`。
