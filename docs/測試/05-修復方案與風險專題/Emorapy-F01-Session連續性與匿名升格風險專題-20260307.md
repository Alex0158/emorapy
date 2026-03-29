# Emorapy F01 Session 連續性與匿名升格風險專題

日期：2026-03-07  
關聯功能：`F01`、`F09`  
關聯流程：`P01 快速體驗閉環`

## 1. 專題背景

F01 是 Emorapy 的匿名入口，也是最容易暴露 session、狀態轉移、轉化升格問題的地方。本輪測試與代碼盤點後，已看到三類彼此關聯的高風險點：

1. quick create 成功後的前端導航穩定性（已修復，需回歸守護）
2. quick case 回訪時的 session 連續性
3. 匿名 quick case 在登入/註冊後的 `claim-session` 升格語義

## 2. 當前風險清單

### 2.1 風險 A：quick create 成功後未前進到 result

修復前表現：

1. `POST /cases/quick` request / response 已成功
2. 前端仍停留在 create 頁

最終根因：

1. `useMountedRef()` 在 React `StrictMode` 下未正確回設 mounted 狀態
2. 成功分支中的 `navigate()` 因 `mountedRef.current === false` 被跳過

當前狀態：

1. 已修復
2. F01 Playwright 主鏈路已重跑通過

風險等級：`P1（由阻斷降為回歸風險）`

### 2.2 風險 B：result 頁優先使用舊 `caseSessionMap`

當前代碼中，result 頁查詢 session 的優先順序為：

1. `caseSessionMap.get(caseId)`
2. `sessionStorage.get()`
3. `useSessionStore().session`

但 `refreshSession()` 只更新全局 session，不會回寫既有 `caseSessionMap`。

風險結果：

1. refresh 成功後，結果頁可能仍使用舊 case session 查詢
2. 造成 quick case 回訪錯誤、判決拉取錯誤或 evidence 補傳失敗

本輪新增確認：

1. 前端錯誤攔截器原本會先清掉全局 session，再執行 refresh
2. 導致 refresh 可能帶不到舊 `X-Session-Id`
3. 後端因此無法旋轉舊 session，而是直接新建 session
4. 已建立缺陷：`F01-BUG-002`
5. 現已完成修復：
   - refresh 顯式攜帶失敗請求中的舊 session
   - refresh 成功後同步更新 `caseSessionMap`

風險等級：`P1（由真缺陷降為回歸風險）`

### 2.3 風險 C：`claim-session` 文檔語義與實作不一致

當前文檔與註釋把 `claim-session` 描述得像：

1. 匿名案件升格為正式身份案件
2. 甚至轉 remote / 建立正式配對

但實際代碼目前做的更像：

1. 若 quick case 尚未綁定 `plaintiff_id`，則補寫當前 user
2. 沒有完整升格語義

風險等級：`P1`

## 3. 測試層面的啟示

這三個風險都不是單點 API 能解決的，必須同時由三層護欄承接：

1. 後端單元測試：固定 `claim-session` 當前真實行為
2. 前端頁面測試：固定 session fallback 與錯誤提示
3. E2E 主鏈路：驗證匿名入口到 result 的真實前進能力

## 4. 建議修復方案

### 4.1 第一階段：先修閉環阻斷

1. 已完成修復 create 成功後未跳 result 的問題
2. 已完成重跑：
   - `QuickExperience/Create` 頁測試
   - `quick-experience-flow.e2e.ts`
3. 已補 `session refresh -> caseSessionMap` 連續性護欄測試與修復

### 4.2 第二階段：修 session 連續性

1. 明確規範 refresh 後是否需要更新 `caseSessionMap`
2. 若需要，補一個集中更新策略，而不是把 map 更新散落在頁面內
3. 針對舊 case 回訪建立專門回歸測試

### 4.3 第三階段：釐清匿名升格語義

1. 確認 `claim-session` 的產品語義到底是：
   - 只綁定 user
   - 還是完整升格為正式案件
2. 一旦確認，必須同步更新：
   - 核心接口文檔
   - F01/F09 專項測試設計
   - 後端與前端測試護欄

## 5. 建議的回歸清單

1. create -> result 正常跳轉
2. result 頁以 `caseSessionMap` 取回舊案件
3. session 過期 -> refresh -> result 仍能回訪
4. quick case 完成後登入，`claim-session` 成功不影響 auth 主流程
5. quick case 完成後登入，`claim-session` 失敗也不阻斷 auth 成功態

## 6. 結論

F01 的核心風險不是「案例數不足」，而是「匿名流量入口的狀態連續性與升格語義尚未完全穩定」。其中 `Create -> Result` 阻斷已完成修復，後續重點應轉向 session 連續性與匿名升格語義。本專題要求後續所有 F01/F09 修復，都必須同時回答以下三個問題：

1. 匿名 session 是否穩定延續？
2. 成功建案後是否一定能前進到 result？
3. quick case 綁帳號後，到底完成了什麼業務語義？
