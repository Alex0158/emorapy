# 認證與會話

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：01-認證與會話 子域入口與閱讀順序
**取證代碼入口**：`backend/src/routes/auth.routes.ts`、`backend/src/routes/session.routes.ts`、`frontend/src/router/index.tsx`、`frontend/src/services/api/auth.ts`、`frontend/src/services/api/session.ts`
**最後核驗 Commit**：`587df41`
**最後核驗日期**：`2026-04-19`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本子域承接 `CJ` 前台的認證、登入、會話與身份來源正式規格入口，不裁決 Admin 登入治理。

當前正式文檔：

1. [00-認證與會話總覽.md](./00-認證與會話總覽.md)

當前重點包括：

1. Web 前台 `/auth/*`、`ProtectedRoute`、`PublicRoute` 與回跳規則
2. `session_id`、JWT、`claim-session`、session refresh rotation 的身份承接邊界
3. quick / chat / judgment handoff 所依賴的身份來源口徑

本子域不回答：

1. 正式案件、聊天室、Repair Journey 等業務流程正文
2. 管理端治理、健康檢查與運營報表
3. 跨端共享 package 與 repo 分層規則

閱讀順序：

1. 先讀 [../README.md](../README.md)
2. 再讀 [00-認證與會話總覽.md](./00-認證與會話總覽.md)
3. 再讀根層旗艦文檔中的 `頁面清單.md`、`業務流程整合.md`
4. 再讀 [../06-接口描述/01-auth-session.md](../06-接口描述/01-auth-session.md)
5. 若涉及高風險鏈路，再回看 [../90-證據與盤點/README.md](../90-證據與盤點/README.md)
