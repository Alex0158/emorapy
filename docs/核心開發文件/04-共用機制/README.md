# 共用機制

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：04-共用機制 子域入口與閱讀順序
**取證代碼入口**：`frontend/src/App.tsx`、`frontend-admin/src/App.tsx`、`frontend/src/components/common`、`frontend/src/services/request.ts`、`frontend/src/services/sseRequest.ts`、`frontend/src/services/aiStream.ts`、`frontend-admin/src/services/request.ts`、`backend/src/services/judgment.service.ts`、`backend/src/services/safety-routing.service.ts`、`backend/src/services/reconciliation.service.ts`、`backend/src/services/chat.service.ts`、`backend/src/controllers/evidence.controller.ts`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`c906290`
**最後核驗日期**：`2026-05-03`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本子域承接跨主 Web、Admin token 體系、共享契約與部分跨端邏輯的正式規則與共用機制。

當前正式文檔：

1. [00-共用機制總覽.md](./00-共用機制總覽.md)
2. [01-樣式Token與共享視覺規範.md](./01-樣式Token與共享視覺規範.md)

當前重點包括：

1. 路由守衛、跨頁承接、通知、AI stream、錯誤語義等跨流共用口徑
2. 會影響多條業務流的共享約束、case 授權分類、安全/修復資格、共享 request / stream helper 與共享契約
3. 已落地共享機制與仍保留分端實作邊界的正式現狀

本子域不回答：

1. 單一業務流的完整產品正文
2. 單一接口是否在用
3. 工程包結構、workspace 與共享 package 落點

閱讀順序：

1. 先讀根層旗艦文檔確認功能、頁面與主流程
2. 再讀 [00-共用機制總覽.md](./00-共用機制總覽.md)
3. 再讀 [../06-接口描述/README.md](../06-接口描述/README.md) 中對應模組的共用約束
4. 若屬共享視覺 token、theme 邊界與樣式收斂，讀 [01-樣式Token與共享視覺規範.md](./01-樣式Token與共享視覺規範.md)
5. 若屬跨端工程規則，再進 [../05-工程架構與共享層/README.md](../05-工程架構與共享層/README.md)
