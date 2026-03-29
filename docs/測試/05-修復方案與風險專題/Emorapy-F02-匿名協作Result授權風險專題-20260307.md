# Emorapy F02 匿名協作 Result 授權風險專題

日期：2026-03-07  
關聯功能：`F02`、`F01`  
關聯流程：`P01 快速體驗閉環`

## 1. 專題背景

F02 並不是獨立結果頁，而是提交後承接到 F01 的 `Result` 頁。這代表只要匿名授權語義有一處不一致，就會出現「前半段成功、後半段失效」的假閉環。

本輪已確認：

1. F02 建案/提交使用匿名 session
2. F02 結果展示、判決輪詢、補證據借用 F01 Result
3. 若後端只有 `quick` 被視為匿名案件，`collaborative` 就會在承接點斷裂

## 2. 本輪確認的風險

### 2.1 風險 A：匿名 collaborative case 被誤判成需登入案件

修復前表現：

1. `getCaseById`
2. `getJudgmentByCaseId`
3. `upload/delete evidence`

都只對 `quick` 走 session 驗證。

風險結果：

1. F02 `collaborative -> result` 在真環境下可能得到 `UNAUTHORIZED/FORBIDDEN`
2. 使用者看到的是「成功跳頁，但內容讀不出來」
3. 補證據能力也可能不一致

當前狀態：`已修復，降為回歸風險`

### 2.2 風險 B：F02 與 F01 共用 Result，容易只修單點不修全鏈

當前啟示：

1. 只修 `getJudgmentByCaseId` 不夠
2. 只修 `getCaseById` 也不夠
3. `evidence` 若仍保留舊邏輯，Result 頁後半段一樣會斷

因此匿名 Result 授權必須視為一條鏈，而不是三個獨立 API。

### 2.3 風險 C：真 DB 環境仍未驗證

目前已完成：

1. 後端單元
2. 前端 Result 錯誤矩陣
3. flow 測試檔案與案例補寫

但當前環境：

1. `tests/integration/quick-experience.flow.test.ts` 因 `SKIP_DB_INIT!=false` 被 skip
2. 所以真實 DB 流程還沒有最終驗證

風險等級：`P1`

## 3. 測試層面的啟示

後續所有 F02/F01 承接回歸都必須同時回答：

1. 匿名 session 是否一路被帶到 result？
2. case / judgment / evidence 三條鏈是否使用同一授權口徑？
3. 發生 session 類錯誤時，前端是否給出正確提示，而不是誤判成 pending？

## 4. 已完成修復方案

### 4.1 後端

1. `case.service.getCaseById()` 納入 `collaborative`
2. `judgment.service.getJudgmentByCaseId()` 納入 `collaborative`
3. `evidence.controller` 的 upload / delete 納入 `collaborative`

### 4.2 測試護欄

1. 後端單元固定 `collaborative` session 授權
2. `QuickExperience/Result` 補 `INVALID_SESSION_ID`、`FORBIDDEN` 錯誤矩陣
3. `quick-experience.flow` 補 collaborative case detail 讀取案例

## 5. 建議的後續回歸清單

1. 在可用 DB 環境執行 `tests/integration/quick-experience.flow.test.ts`
2. 真實驗證 `collaborative -> result -> getCase`
3. 真實驗證 `collaborative -> result -> getJudgment`
4. 真實驗證 `collaborative -> result -> evidence upload/delete`
5. 補 session 過期後的回訪與提示矩陣

## 6. 結論

F02 的主要風險不在 A/B 提交本身，而在「匿名協作案件一旦進入共用 Result 頁，授權語義是否仍然一致」。`F02-BUG-001` 已修復，但在真 DB 環境完成回歸前，仍應視為高優先級回歸風險。
