---
name: f01-quick-experience-audit
description: 分析 F01 快速體驗、quick experience、匿名 session、quick case、責任比例、結果頁與升格流程的真實業務行為、體驗問題與風險。This is an analysis-layer skill only. Use when the user mentions F01, quick experience, quick case, anonymous session, responsibility ratio, result page, claim-session, or asks to deeply audit the zero-barrier journey.
---

# F01 Quick Experience Audit

## When To Use

當分析目標涉及以下任一主題時使用本 Skill：

- `F01 快速體驗`
- `quick experience`
- `quick case`
- `匿名 session`
- `結果頁`
- `責任比例`
- `claim-session`
- `快速體驗轉化`

## Default Goal

優先檢查這條主鏈路是否仍然健康：

`進入 create -> 建立 session -> 建 quick case -> 進入 result -> 輪詢判決 -> 顯示責任比例/內容 -> 補證據/重試 -> 引導註冊`

## Layer Position

這是 `F01 分析層 Skill`。

它負責：

- 還原 F01 真實閉環
- 驗證疑點是否真實存在
- 分析對轉化、信任感、公平感、恢復路徑的影響
- 產出適合交接給落地層的優化方案

它不負責：

- 直接改動 F01 業務代碼
- 直接修改接口或資料結構
- 在未經確認前進入功能實作

## Workflow

### 1. 先還原真實 F01 閉環

至少核對以下內容：

- 誰建立 session
- quick case 的真實校驗規則
- 結果頁如何取 session 與 case
- 判決如何輪詢與重試
- 責任比例如何生成、保存、回傳、顯示
- 補證據何時允許、何時關閉
- 登入/註冊後如何做 `claim-session`

先讀 [source-map.md](source-map.md)。

### 2. 疑點排查要拆層

若使用者說「責任不真實」或「結果有問題」，不要只看 UI。至少拆成以下層級：

1. `生成邏輯`：AI 與後端如何產出比例
2. `保存/回傳`：DB 與 API 是否正確保存和標準化
3. `前端呈現`：頁面是否拿對字段、是否有回退邏輯
4. `用戶感知`：文案、視覺與結構是否讓用戶覺得不公、被說教或不可信

若需要，也可再加第 5 層：

5. `測試與歷史缺陷`：這個問題是否其實已修復、只是舊記憶仍在

### 3. 優先排查 6 個熱點

每次 F01 分析都優先檢查：

1. `session 連續性`
2. `建案驗證規則`
3. `結果頁回訪`
4. `責任比例真實性`
5. `證據補傳與判決狀態邊界`
6. `註冊引導與 claim-session`

### 4. 歷史疑點先判定是否已解

遇到曾被提過的問題時，先去 [known-risks-and-history.md](known-risks-and-history.md) 對照：

- 是否已有修復文檔
- 是否已有測試護欄
- 當前代碼是否仍保留修復邏輯

若已修復，不要重複當成現存 bug；要改寫成：

- 這是歷史高風險點
- 當前修復機制是什麼
- 目前還有沒有殘餘風險

### 5. 多視角交叉分析

除了共通的 `Marketing Expert`、`Product Manager`、`真實用戶`、`風險/濫用` 視角，F01 還要特別回答：

- 這一步會不會讓匿名新用戶在第一分鐘內流失？
- 這一步會不會破壞「公平、公正、溫暖」的品牌承諾？
- 這一步如果失敗，用戶有沒有可理解的恢復路徑？

### 6. 輸出要求

輸出 `.md` 到 `/Users/alex/Desktop/CJ/分析/`。

推薦命名：

- `YYYYMMDD-F01-quick-experience-主題-第NN輪.md`
- `YYYYMMDD-F01-responsibility-ratio-主題-第NN輪.md`

## F01-Specific Rules

- 不要把舊測試假設直接當產品需求。
- 不要把已修復歷史問題直接寫成現存缺陷。
- 不要只看單一字段，要核對回退邏輯與 session 來源優先級。
- 若涉及責任比例，必須同時看 `生成`、`回傳`、`顯示` 三層。
- 本 Skill 只做分析與交接，不直接落地修改。

## Read Next

- 核心文件地圖： [source-map.md](source-map.md)
- 已知風險與歷史： [known-risks-and-history.md](known-risks-and-history.md)
- 若本輪已確認要實作，改用 `business-flow-implementation-handoff`
