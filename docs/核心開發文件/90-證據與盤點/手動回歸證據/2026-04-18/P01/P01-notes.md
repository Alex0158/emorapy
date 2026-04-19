# P01 補充說明

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據文檔
**來源時間**：2026-04-18
**上下文**：按日期/P 批次留存的手動回歸結果與摘要
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`bd66c2d`
**最後核驗日期**：`2026-04-18`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 根因拆解

1. `backend/src/utils/lock.ts`
   Redis 初始化失敗後仍保留不可達 client，後續 `acquire/release` 每次都先嘗試 Redis，再降級到內存鎖，導致 quick-case 主鏈路額外累積數秒延遲。

2. `backend/src/utils/cache.ts`
   Redis 緩存 client 同樣在不可達時被反覆重試，`detectCaseType` 的 quota/cache 路徑會先卡 Redis，再回退到 memory cache。

3. `backend/src/config/env.ts`
   開發環境白名單只覆蓋 `5173-5175`，而本地用戶端實際跑在 `4173`。因此前台 `quick-experience/create` 真機提交會在 `OPTIONS /api/v1/sessions/quick`、`OPTIONS /api/v1/cases/quick` 被 CORS 拒絕。

## 修復內容

- `backend/src/utils/lock.ts`
  Redis 首次連接/操作失敗後即 `disconnect(false)` 並將當前 client 設為 `null`，後續所有鎖操作直接走 simple-lock fallback。

- `backend/src/utils/cache.ts`
  Redis 首次連接/操作失敗後即 `disconnect(false)` 並將當前 client 設為 `null`，後續所有緩存操作直接走 memory cache。

- `backend/src/config/env.ts`
  補齊本地開發 origin 白名單：
  `localhost/127.0.0.1:4173-4175` 與 `localhost/127.0.0.1:5173-5175`。

## 驗證結果

- API smoke：
  `POST /api/v1/cases/quick` 在 `25s` hard timeout 下已恢復為 `201`，本輪實測耗時 `5.53s`。

- CORS preflight：
  `OPTIONS /api/v1/sessions/quick` 對 `Origin: http://127.0.0.1:4173` 返回 `204`，並帶 `Access-Control-Allow-Origin`。

- 前台真機：
  Playwright 以匿名 session 在 `http://127.0.0.1:4173/quick-experience/create` 完整填寫三步表單後提交，約 `7s` 內跳轉到：
  `/quick-experience/result/e126fe31-7192-48f9-8286-0723f1f5ef0a`

## 證據

- 截圖：`P01-desktop-pass-01.png`
- Playwright 導出：`output/playwright/p01-quick-experience-pass-2026-04-18.png`
