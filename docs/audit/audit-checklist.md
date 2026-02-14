# 全區審計執行清單（七大原則 / DevSecOps）

下次執行全區審計時，可依此清單掃描並產出報告。範圍：backend/src、frontend/src（不含測試）。  
**審計目錄總覽**：[README.md](README.md)（報告與設計文件索引、繼續入口）。

## 歷次審計與後續（更新於 2026-02-08）

- **最新審計**：[audit-20260208-triple-round.md](audit-20260208-triple-round.md) — 三輪 audit/improve/add-unit-test/check，綜合合規率 ≈ 92%。
- **逐檔案審計**：[per-file-audit-20260206.md](per-file-audit-20260206.md) — 按模組逐檔審計。
- **已完成**：rateLimiter DRY createRateLimitMessage、429 邊緣測試；後端 749 單元測試通過；Linter 0 錯誤。
- **待後續**：case.service/ai.service 若繼續膨脹再考慮按子域拆分。拆分方案見 [split-large-services-design-20260206.md](split-large-services-design-20260206.md)。**依賴注入**：已實施至全部 Controller（見 [di-design-20260206.md](di-design-20260206.md) §7）。
- **驗證指令**：後端 `cd backend && npm run test:unit`；前端 `cd frontend && npx vitest run`。

## 1. Linter

- [ ] 後端：`cd backend && npx eslint src --ext .ts`，記錄錯誤/警告數與 exit code
- [ ] 前端：`cd frontend && npm run lint`；若失敗（如 esquery），改用 Cursor ReadLints 掃 frontend/src
- [ ] 合規：0 錯誤 = 100%；僅警告則依數量扣分

## 2. SOLID

- [ ] 檢視 case.service、ai.service 行數與職責邊界
- [ ] 抽樣 1–2 個控制器，確認僅委派服務
- [ ] 評分：職責清晰約 85–90%；大檔但文檔已接受則維持 85%

## 3. DRY

- [ ] grep `getCaseStatusTag|getExecutionStatusTag|getCaseTypeTag|getDifficultyText|getPlanTypeText` 於 frontend/src（排除 *.test.*），確認皆引用 statusTags
- [ ] grep `normalizeJudgment` 於 backend/src，確認集中於 utils/judgment.ts
- [ ] 評分：已集中無殘留約 92–95%

## 4. KISS

- [ ] 抽樣 2–3 個 route/controller，確認結構簡單、錯誤集中於 errorHandler
- [ ] 評分：無過度抽象約 90%

## 5. 安全（Secure）

- [ ] grep `eval(`, `dangerouslySetInnerHTML` 於 backend/src、frontend/src
- [ ] 確認 CORS、Helmet、限流、JWT、bcrypt、生產錯誤隱藏、errorHandler 類型守衛
- [ ] grep `validate`/Joi 使用處數（後端）
- [ ] 評分：無禁止項且已具備齊全約 92%

## 6. Lean（去浪費）

- [ ] grep `: any|as any|<any>` 於 backend/src、frontend/src（排除 *.test.*）
- [ ] grep `console\.(log|warn|error|info|debug)` 排除 logger/config
- [ ] 評分：any 少、console 受控約 88–95%

## 7. 產出

- [ ] 計算綜合合規率（建議 Linter、安全權重略高）
- [ ] 寫入 `docs/audit/audit-YYYYMMDD.md` 或 **逐檔案版** `docs/audit/per-file-audit-YYYYMMDD.md`：摘要表、按模組/逐檔案審計表、建議修復（若 < 90% 附 confidence）、附錄掃描數據
- [ ] 閾值：≥ 90% 達標；< 90% 須列出建議修復與優先級

## 參考

- 方法與維度：[seven-principles-devsecops-20260201.md](seven-principles-devsecops-20260201.md)、[per-file-audit-20260206.md](per-file-audit-20260206.md)
- CI：`.github/workflows/ci.yml`（push/PR 時執行兩端 lint、單元測試、build）
