# 共用機制

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：04-共用機制 子域入口、閱讀順序、NFR、AI / 資料 / 威脅建模 / 狀態機 / 可訪問性與本地化治理入口
**取證代碼入口**：`frontend/src/App.tsx`、`frontend/index.html`、`frontend/src/utils/i18n.ts`、`frontend/src/assets/i18n`、`frontend/src/hooks/useAccessibility.ts`、`frontend-admin/src/App.tsx`、`frontend-admin/index.html`、`frontend-admin/src/utils/i18n.ts`、`frontend-admin/src/assets/i18n`、`frontend/src/components/common`、`frontend/src/components/ui`、`frontend/src/components/business`、`frontend/src/services/request.ts`、`frontend/src/services/sseRequest.ts`、`frontend/src/services/aiStream.ts`、`frontend-admin/src/services/request.ts`、`backend/src/app.ts`、`backend/src/middleware/auth.ts`、`backend/src/middleware/adminAuth.ts`、`backend/src/middleware/rateLimiter.ts`、`backend/src/routes/metrics.routes.ts`、`backend/src/utils/constants.ts`、`backend/src/utils/case-classifier.ts`、`backend/src/services/case.service.ts`、`backend/src/services/judgment.service.ts`、`backend/src/services/safety-routing.service.ts`、`backend/src/services/reconciliation.service.ts`、`backend/src/services/chat.service.ts`、`backend/src/services/interview-end-session-persistence.ts`、`backend/src/services/async-pipeline-session-status.ts`、`backend/src/services/product-state-recovery-task.service.ts`、`backend/src/controllers/evidence.controller.ts`、`backend/prisma/schema.prisma`、`mobile/app`、`mobile/src/platform`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本子域承接跨主 Web、Admin token 體系、共享契約與部分跨端邏輯的正式規則與共用機制。當共用機制需要投影到 App 端時，必須經由 App navigation / platform adapter 基線與 App 工程落點 Mapping 裁決，不得直接把 Web/Admin helper 當作 App runtime。

當前正式文檔：

1. [00-共用機制總覽.md](./00-共用機制總覽.md)
2. [01-樣式Token與共享視覺規範.md](./01-樣式Token與共享視覺規範.md)
3. [02-信任安全與非功能需求.md](./02-信任安全與非功能需求.md)
4. [03-AI風險與安全治理基線.md](./03-AI風險與安全治理基線.md)
5. [04-資料治理與隱私風險基線.md](./04-資料治理與隱私風險基線.md)
6. [05-威脅建模與安全需求基線.md](./05-威脅建模與安全需求基線.md)
7. [06-狀態機與業務不變式治理基線.md](./06-狀態機與業務不變式治理基線.md)
8. [07-可訪問性本地化與內容設計治理基線.md](./07-可訪問性本地化與內容設計治理基線.md)

當前重點包括：

1. 路由守衛、跨頁承接、通知、AI stream、錯誤語義等跨流共用口徑
2. 會影響多條業務流的共享約束、case 授權分類、安全/修復資格、共享 request / stream helper 與共享契約
3. 信任安全、AI 可靠性、隱私、性能、成本、可用性與可觀測性等非功能需求
4. AI / LLM 風險、prompt injection、AI output downstream gate、ledger 與 prompt version 治理
5. 資料分類、consent、delete、retention、AI stream archive、log minimization 與 App storage / telemetry 隱私邊界
6. 信任邊界、STRIDE 威脅分類、安全需求 ID、Web / App 安全投影與 threat model 缺口
7. Case / Chat / Interview / AI Stream / Recovery 的狀態機、轉移 guard、非法轉移、恢復策略與業務不變式
8. Web / Admin / App 可訪問性、本地化、`lang`、i18n catalog、內容設計與情緒安全文案缺口
9. 已落地共享機制與仍保留分端實作邊界的正式現狀

本子域不回答：

1. 單一業務流的完整產品正文
2. 單一接口是否在用
3. 工程包結構、workspace 與共享 package 落點
4. App 原生 platform adapter、native storage、Push、Deep Link、upload provider 或 App lifecycle 的 runtime 實作

閱讀順序：

1. 先讀根層旗艦文檔確認功能、頁面與主流程
2. 再讀 [00-共用機制總覽.md](./00-共用機制總覽.md)
3. 再讀 [../06-接口描述/README.md](../06-接口描述/README.md) 中對應模組的共用約束
4. 若屬共享視覺 token、theme 邊界與樣式收斂，讀 [01-樣式Token與共享視覺規範.md](./01-樣式Token與共享視覺規範.md)
5. 若屬信任安全、AI 可靠性、性能、成本或可觀測性，讀 [02-信任安全與非功能需求.md](./02-信任安全與非功能需求.md)
6. 若屬 AI / LLM 風險、prompt、ledger、AI output downstream gate 或模型依賴邊界，讀 [03-AI風險與安全治理基線.md](./03-AI風險與安全治理基線.md)
7. 若屬資料分類、心理資料 consent/delete、retention、AI stream archive、log / evidence 最小化或 App storage / telemetry，讀 [04-資料治理與隱私風險基線.md](./04-資料治理與隱私風險基線.md)
8. 若屬信任邊界、威脅建模、ASVS / MASVS 安全需求、media / metrics / admin / App native 安全缺口，讀 [05-威脅建模與安全需求基線.md](./05-威脅建模與安全需求基線.md)
9. 若屬核心狀態、enum、狀態轉移、非法轉移、恢復任務或業務不變式，讀 [06-狀態機與業務不變式治理基線.md](./06-狀態機與業務不變式治理基線.md)
10. 若屬可訪問性、鍵盤/focus、ARIA、HTML `lang`、本地化、i18n key、內容設計或情緒安全文案，讀 [07-可訪問性本地化與內容設計治理基線.md](./07-可訪問性本地化與內容設計治理基線.md)
11. 若屬跨端工程規則，再進 [../05-工程架構與共享層/README.md](../05-工程架構與共享層/README.md)
12. 若屬 App 端共用機制、native adapter 或 shared contracts / api-client 消費，再進 [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md) 與 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)
