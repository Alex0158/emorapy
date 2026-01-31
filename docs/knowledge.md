# 知識庫條目（本次任務）
- 日期：2026-01-31
- 類型：Improve + Audit + i18n + Test
- 詳述：\n  - 拆分 QuickExperience/Result 七區塊為子元件，提升可讀性與維護性，行為不變。\n  - 生成 i18n 鍵值提案（標題、提示、操作、錯誤、等待文案），覆蓋主要文本。\n  - 新增後端 retry 工具單元測試，覆蓋 transient 成功與 4xx 停止。\n  - 啟動本地前端預覽驗證拆分效果；安全審計確認無硬編碼憑證，Helmet/CORS 配置存在。\n- 相關檔案：\n  - docs/plan/workflow.md\n  - docs/i18n/proposals.md\n  - frontend/src/pages/QuickExperience/Result/components/*\n  - backend/tests/unit/utils/retry.test.ts\n- confidence: high

## FixBug 2026-01-31：輸入驗證缺失
- 類型：缺陷 / 安全加固
- 問題：\n  - GET /api/v1/execution/status 的 plan_id 查詢參數未驗證，可能傳入無效 UUID 導致 Prisma 異常。\n  - GET/PUT /api/v1/profile/relationship/:pairingId 的 pairingId 路徑參數未驗證，同上。\n- 方案：\n  - 新增 executionStatusQuerySchema、pairingIdParamSchema，強制 UUID 格式驗證。\n  - 在對應路由加入 validate 中間件。\n- 預防：新 API 路由需檢查 params/query/body 是否皆有對應 Joi schema 驗證。\n- 相關檔案：\n  - backend/src/utils/validation.ts\n  - backend/src/routes/execution.routes.ts\n  - backend/src/routes/profile.routes.ts\n  - backend/src/routes/content.routes.ts\n  - backend/tests/unit/utils/validation-schemas.test.ts\n- 補充：GET /api/v1/content-items/recommendations/:caseId 的 caseId 已加入 caseIdParamSchema 驗證。\n- confidence: high

## Improve 2026-01-31：PDCA 改進
- 類型：重構 + i18n + 測試
- 詳述：DRY 提取 normalizeJudgment 至 utils/judgment.ts；補齊 zh-TW 的 error.*、pending.*、actions.createAnother；修復 case.service 隱式 any；新增 judgment utils 單元測試。\n- 相關檔案：backend/src/utils/judgment.ts、backend/tests/unit/utils/judgment.test.ts、frontend/src/assets/i18n/zh-TW.ts、ActionsSection.tsx\n- confidence: high

## Improve 2026-02-01：PDCA 改進（第二輪）
- 類型：文檔 + 單元測試 + i18n
- 詳述：新增 docs/naming-conventions.md 整合前後端命名規範；新增 utils/request.test.ts（9 用例）；補齊 zh-TW 的 common.*、message.* 鍵；QuickExperience/Result 5 處 message 改用 t()。
- 相關檔案：docs/naming-conventions.md、backend/tests/unit/utils/request.test.ts、frontend/src/assets/i18n/zh-TW.ts、frontend/src/pages/QuickExperience/Result/index.tsx
- 單元測試：129 passed（+9 request utils）
- Lint：Backend 0 Error
- confidence: high
