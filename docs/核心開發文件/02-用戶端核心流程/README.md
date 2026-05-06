# 用戶端核心流程

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：02-用戶端核心流程 子域入口與閱讀順序
**取證代碼入口**：`frontend/src/router/index.tsx`、`frontend/src/pages`、`backend/src/routes/case.routes.ts`、`backend/src/routes/interview.routes.ts`、`backend/src/routes/chat.routes.ts`
**最後核驗 Commit**：`adda512`
**最後核驗日期**：`2026-05-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本子域承接 `CJ` 面向普通用戶的核心業務流程入口，當前以 Web 前台實作為取證基準。跨 Web / App 的最高產品語義回 [../00-跨端產品核心/README.md](../00-跨端產品核心/README.md)；App 是否承接及如何承接，總覽回 [../20-App端/README.md](../20-App端/README.md) 與 [../50-跨端Mapping與Parity/README.md](../50-跨端Mapping與Parity/README.md)，進入實作前必須補讀 [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md) 與 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)。

當前正式文檔：

1. [00-用戶端核心流程總覽.md](./00-用戶端核心流程總覽.md)

當前重點包括：

1. 快速體驗、協作聽證、正式案件、聊天室、Repair Journey
2. 心理訪談、心理畫像、個人資料、配對與前置 trigger
3. 通知中心與前台主流程直接相關的頁面入口、狀態轉移與 handoff

本子域不回答：

1. API 是否在用、候選廢棄或已確認廢棄
2. 管理端治理、平台監控與運營配置
3. 共用 package 落點與工程分層
4. App 原生 navigation、Deep Link、Push、SecureStore、upload 或 App lifecycle 的平台策略

閱讀順序：

1. 先讀 [../00-跨端產品核心/00-跨端產品核心總覽.md](../00-跨端產品核心/00-跨端產品核心總覽.md) 與根層的 `功能特性清單.md`、`業務流程整合.md`
2. 再讀 [00-用戶端核心流程總覽.md](./00-用戶端核心流程總覽.md)
3. 需要 Web 已實作基線時，讀 [../10-Web端/00-Web端凍結基線總覽.md](../10-Web端/00-Web端凍結基線總覽.md)
4. 需要 App 承接狀態時，讀 [../20-App端/00-App端總覽.md](../20-App端/00-App端總覽.md) 與 [../50-跨端Mapping與Parity/00-跨端Parity總覽.md](../50-跨端Mapping與Parity/00-跨端Parity總覽.md)
5. 需要進入 App 實作時，讀 [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md) 與 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)
6. 再讀 [../06-接口描述/02-user-profile-pairing.md](../06-接口描述/02-user-profile-pairing.md) 至 [../06-接口描述/08-content-notification.md](../06-接口描述/08-content-notification.md) 中對應模組
7. 若需要活躍案例或回歸包，再進 [../測試/README.md](../測試/README.md)
8. 若需要已核實的證據，再進 [../90-證據與盤點/README.md](../90-證據與盤點/README.md)
