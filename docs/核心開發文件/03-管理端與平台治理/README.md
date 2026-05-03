# 管理端與平台治理

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：03-管理端與平台治理 子域入口與閱讀順序
**取證代碼入口**：`backend/src/routes/admin.routes.ts`、`backend/src/routes/health.routes.ts`、`backend/src/routes/metrics.routes.ts`、`backend/src/middleware/adminAuth.ts`、`backend/src/config/env.ts`、`backend/src/utils/admin-jwt.ts`、`frontend/src/router/index.tsx`、`frontend/src/utils/adminEntry.ts`、`frontend-admin/src/router.tsx`、`frontend-admin/src/pages`、`backend/package.json`
**最後核驗 Commit**：`963c0d3`
**最後核驗日期**：`2026-04-19`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本子域承接 `CJ` 管理端 Web、主站 admin 轉導入口與平台治理能力的正式規格入口。

當前正式文檔：

1. [00-管理端與平台治理總覽.md](./00-管理端與平台治理總覽.md)
2. [01-環境與部署基線.md](./01-環境與部署基線.md)
3. [02-發布與回滾檢查表.md](./02-發布與回滾檢查表.md)
4. [03-運維告警與AI-Chat治理基線.md](./03-運維告警與AI-Chat治理基線.md)
5. [04-兩版本運作規範.md](./04-兩版本運作規範.md)
6. [05-運維連接與調用Runbook.md](./05-運維連接與調用Runbook.md)

當前重點包括：

1. Admin Web 的身份入口、頁面責任、RBAC 與治理能力
2. 健康檢查、metrics、後台任務、runtime config、報表與 settings 治理入口
3. 與審計、告警規則、feature flags、media provider 配置相關的正式口徑

本子域不回答：

1. 普通用戶主流程與情境案例正文
2. API 主冊狀態判定
3. 營銷、品牌與對外敘事材料

閱讀順序：

1. 先讀根層的 `頁面清單.md`、`功能特性清單.md`
2. 再讀 [00-管理端與平台治理總覽.md](./00-管理端與平台治理總覽.md)
3. 再讀 [../06-接口描述/09-admin.md](../06-接口描述/09-admin.md) 與 [../06-接口描述/10-health-metrics.md](../06-接口描述/10-health-metrics.md)
4. 若需要判斷本機版與發布版邊界，先讀 [04-兩版本運作規範.md](./04-兩版本運作規範.md)
5. 若需要查平台連接、`.env`、發布狀態或 DB migration，先讀 [05-運維連接與調用Runbook.md](./05-運維連接與調用Runbook.md)
6. 若需要環境、部署、回滾與 smoke 基線，先讀 [01-環境與部署基線.md](./01-環境與部署基線.md) 與 [02-發布與回滾檢查表.md](./02-發布與回滾檢查表.md)
7. 若需要告警、metrics、chat stage gate 與 benchmark / migration drill 基線，再讀 [03-運維告警與AI-Chat治理基線.md](./03-運維告警與AI-Chat治理基線.md)
8. 若需要環境核驗與運行證據，再進 [../90-證據與盤點/環境與發版驗證/README.md](../90-證據與盤點/環境與發版驗證/README.md)
