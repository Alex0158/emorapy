# 用戶端核心流程

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：02-用戶端核心流程 子域入口與閱讀順序
**取證代碼入口**：`frontend/src/router/index.tsx`、`frontend/src/pages`、`backend/src/routes/case.routes.ts`、`backend/src/routes/interview.routes.ts`、`backend/src/routes/chat.routes.ts`
**最後核驗 Commit**：`bd66c2d`
**最後核驗日期**：`2026-04-18`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本子域承接 `CJ` 面向普通用戶的核心業務流程入口，當前以 Web 前台實作為取證基準；若 Mobile 復用同一接口語義，以本子域流程裁決為準，但不在此單獨裁決頁面實作。

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

閱讀順序：

1. 先讀根層的 `功能特性清單.md`、`頁面清單.md`、`業務流程整合.md`
2. 再讀 [00-用戶端核心流程總覽.md](./00-用戶端核心流程總覽.md)
3. 再讀 [../06-接口描述/02-user-profile-pairing.md](../06-接口描述/02-user-profile-pairing.md) 至 [../06-接口描述/08-content-notification.md](../06-接口描述/08-content-notification.md) 中對應模組
4. 若需要活躍案例或回歸包，再進 [../測試/README.md](../測試/README.md)
5. 若需要已核實的證據，再進 [../90-證據與盤點/README.md](../90-證據與盤點/README.md)
