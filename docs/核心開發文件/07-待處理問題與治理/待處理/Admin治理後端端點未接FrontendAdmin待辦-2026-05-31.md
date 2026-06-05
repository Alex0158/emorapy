# Admin 治理後端端點未接 Frontend Admin 待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Admin notification / product-state recovery backend endpoints 與 `frontend-admin` UI / service 承接差異
**取證代碼入口**：`backend/src/routes/admin.routes.ts`、`backend/src/controllers/admin.controller.ts`、`backend/src/services/notification.service.ts`、`backend/src/services/product-state-recovery-task.service.ts`、`frontend-admin/src/router.tsx`、`frontend-admin/src/services/api/admin.ts`、`frontend-admin/src/pages/Admin`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 現狀

Backend 已註冊以下 Admin governance endpoints：

1. `GET /api/v1/admin/notifications`
2. `POST /api/v1/admin/notifications/:notificationId/cancel`
3. `POST /api/v1/admin/notifications/bulk-cancel`
4. `POST /api/v1/admin/notifications/:notificationId/retry`
5. `GET /api/v1/admin/product-state/recovery-tasks`
6. `PATCH /api/v1/admin/product-state/recovery-tasks/:taskId/status`

這些端點的 backend route、controller、service 與單元測試存在，能證明後端契約已提供。但 `frontend-admin/src/services/api/admin.ts` 沒有 notification / product-state recovery task 對應方法，`frontend-admin/src/router.tsx` 與 `frontend-admin/src/pages/Admin` 也沒有對應頁面或 reports 子模組承接。

## 代碼依據

- `backend/src/routes/admin.routes.ts`、`backend/src/controllers/admin.controller.ts`：後端 Admin notification / product-state recovery endpoints 已註冊。
- `backend/src/services/notification.service.ts`、`backend/src/services/product-state-recovery-task.service.ts`：後端通知治理與 product-state recovery task service 能力存在。
- `frontend-admin/src/services/api/admin.ts`、`frontend-admin/src/router.tsx`、`frontend-admin/src/pages/Admin`：未找到上述 notification / recovery task 專用 service 方法、route 或頁面承接。

## 文件偏差

`全接口清單-主文檔.md` 曾把上述端點標為 `已使用`，且證據欄寫成 `Admin notification management` / `Admin recovery task workflow`；`接口-功能-頁面-Mapping.md` 曾把它們映射到 `/admin/reports`。現碼只能證明 backend API 已存在，不能證明 Admin Web service / page 已接線。

## 風險

1. 產品與工程分析會誤以為 Admin Web 已能查詢、取消、批量召回、重送通知，或處理 product-state recovery task。
2. API 主冊缺少 `待承接` 狀態時，容易把「目標能力未接 UI」錯寫成 `已使用` 或 `候選廢棄`。
3. 後續若直接依 `/admin/reports` 做回歸，會漏測真正需要新增的 Admin Web UI / service / permission / a11y 行為。

## 目標狀態

1. `frontend-admin/src/services/api/admin.ts` 補齊 notification / product-state recovery task client 方法與型別。
2. Admin Web 明確決定承接位置：可新增獨立治理頁，也可在 Reports / Ops 區內建立明確子模組；不得只在 Mapping 表寫 `/admin/reports`。
3. UI 承接後補對應測試、permission empty/forbidden/error state、keyboard/focus/a11y 保障與 `web:a11y:contracts` 回歸。
4. UI 未承接前，主冊與 Mapping 必須維持 `待承接`，不得用 `已使用` 完成語氣描述。

## 需要修改的文件

- `docs/核心開發文件/全接口清單-主文檔.md`
- `docs/核心開發文件/接口-功能-頁面-Mapping.md`
- `docs/核心開發文件/06-接口描述/09-admin.md`
- `docs/核心開發文件/10-Web端/00-Web端凍結基線總覽.md`
- UI 承接時同步更新 `docs/核心開發文件/頁面清單.md` 與相關測試 / 驗收文件

## 驗證命令

```bash
npm run docs:check
npm run web:admin-boundary:check
npm run web:a11y:contracts
```

UI 承接時還必須補跑 `npm --prefix frontend-admin run test`、`npm --prefix frontend-admin run lint` 與相關 route-level smoke / E2E。

## Owner / Status

- Owner：Admin Web / Platform governance
- Status：待處理
