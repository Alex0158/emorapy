# Emorapy 業務缺陷報告：F01 Quick Create 提交成功未跳轉 Result

日期：2026-03-07  
缺陷編號：`F01-BUG-001`  
狀態：`已修復`  
嚴重度：`高`

## 1. 缺陷摘要

在 F01 快速體驗主流程中，前端 create 頁成功送出 quick case 後，沒有按預期跳轉到 result 頁，導致訪客主鏈路中斷。

## 2. 業務影響

此問題直接影響：

1. 訪客從首頁進入 Emorapy 的第一條核心體驗鏈路
2. 判決結果展示
3. 補傳證據
4. 結果頁內容推薦
5. 註冊/登入轉化入口

換句話說，這不是普通 UI 細節問題，而是 F01/P01 的主閉環阻斷。

## 3. 復現條件

復現方式基於 Playwright 主鏈路：

1. 打開 `/quick-experience/create`
2. 輸入合法原告陳述
3. 點擊 `Next`
4. 第二步不填被告，直接 `Next`
5. 第三步點擊 `Submit and Start Analysis`
6. `POST /api/v1/cases/quick` 已成功返回
7. 頁面仍停留在 `/quick-experience/create`

## 4. 預期行為

當 `POST /api/v1/cases/quick` 成功返回且 response 中存在 `data.case.id` 時，前端應立即跳轉到：

```text
/quick-experience/result/:id
```

## 5. 實際行為

實際上：

1. quick case 請求已成功送出
2. request / response 已被 E2E 捕捉到
3. 但 URL 沒有變更
4. create 頁仍停留在第三步

## 6. 當前證據

已具備以下證據：

1. Playwright 測試中已等待到 `POST /api/v1/cases/quick` 的 request
2. 也已等待到其 response
3. 之後 `page.url()` 仍是 `http://127.0.0.1:4173/quick-experience/create`

這說明問題不在「表單沒送出」，而在「送出成功後主流程沒有前進」。

## 7. 可能原因

最終確認根因：

1. `frontend/src/hooks/useMountedRef.ts` 在 React `StrictMode` 下未正確回設 mounted 狀態。
2. `QuickExperience/Create/index.tsx` 成功路徑依賴 `mountedRef.current` 來決定是否 `navigate(...)`。
3. 在開發模式下，`mountedRef.current` 會永久停在 `false`，導致導航永遠不發生。

## 8. 建議修復方向

已完成：

1. 修正 `frontend/src/hooks/useMountedRef.ts`
2. 新增 `frontend/src/hooks/useMountedRef.test.tsx`
3. 重跑 F01 前端 Vitest 與 Playwright 主鏈路

後續建議：

1. 針對所有使用 `useMountedRef()` 的頁面做一次回歸
2. 保留 F01 E2E 作為回歸護欄，避免此問題再次出現

## 8.1 修復後驗證

已通過：

1. `vitest run src/hooks/useMountedRef.test.tsx src/store/authStore.test.ts src/pages/QuickExperience/Create/index.test.tsx src/pages/QuickExperience/Result/index.test.tsx`
2. `npx playwright test --config=e2e/playwright.config.ts e2e/chat/quick-experience-flow.e2e.ts`

## 9. 關聯文檔

1. `docs/測試/02-專項測試設計/Emorapy-F01-快速體驗建案與結果測試設計與開發拆解-20260307.md`
2. `docs/測試/03-失敗分析與修復/Emorapy-F01-失敗測試分析與修復報告-前端E2E主鏈路-20260307.md`
3. `docs/測試/05-修復方案與風險專題/Emorapy-F01-Session連續性與匿名升格風險專題-20260307.md`
