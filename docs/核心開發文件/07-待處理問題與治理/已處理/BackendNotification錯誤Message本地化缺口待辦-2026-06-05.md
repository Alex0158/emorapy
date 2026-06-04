# Backend Notification 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend notification controller/service API 錯誤訊息、Admin notification governance error、Web/App notification API visible error、backend i18n message map
**取證代碼入口**：`backend/src/controllers/notification.controller.ts`、`backend/src/controllers/admin.controller.ts`、`backend/src/services/notification.service.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend/src/pages/Notifications`、`frontend-admin/src/pages/Admin`、`mobile/app/(app)/notifications`、`packages/api-client/src/m5.ts`
**最後核驗 Commit**：`155ab87`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/services/notification.service.ts` 與 `backend/src/controllers/notification.controller.ts` 仍有 backend-owned 中文錯誤 message 未被 `translateBackendMessage()` 覆蓋：

- `notification payload.path 必須為已允許的前台相對路由`
- `批量取消通知必須提供至少一個篩選條件`
- `只有 pending 通知可以取消`
- `已由 Admin 取消的通知不可重送`
- `只有 failed 通知可以重送`
- `token 或 device_id 至少需要一項`
- `template_code 為必填欄位`

這些錯誤會經 notification API、Admin notification governance API 或 App push token revoke/register API 進入 `error.message`。當 request locale 為 `en-US` 時，目前未覆蓋的 notification fallback error 仍可能直出繁中。

## 影響範圍

- Backend：notification create path validation、Admin bulk cancel / cancel / resend、device token revoke、notification template validation。
- Admin Web：notification governance 操作錯誤顯示。
- Web：notifications page / API error fallback。
- App：notifications screen push token lifecycle / API error fallback。
- Shared/API client：M5 client 傳遞 backend message，不應在端側新增中文 message 對照表。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋 notification success message 與 render payload localized templates，但 controller/service 自有 validation / admin governance / device token fallback error 未全量覆蓋。這會造成通知列表 render payload 可按 locale 顯示，但通知治理錯誤仍在 en-US 下保留繁中。

## 目標行為

1. `en-US` locale 下，notification controller/service 自有錯誤 message 必須經 backend locale layer 輸出英文。
2. `zh-TW` locale 下，原繁中 canonical message 保持不變。
3. `notification payload.path`、`template_code`、`token`、`device_id`、`pending`、`failed` 等 API 欄位和值不被本地化。
4. Web/Admin/App/shared client 不新增端側中文錯誤翻譯表，仍統一消費 backend locale layer。

## 分析與方案

1. **業務邏輯輪**：notification path validation 保護 deep link allowlist；Admin cancel/resend 依 notification status 做治理；device token revoke 至少需要 token 或 device_id。修復只補 message map，不改 allowlist、狀態機、push token、Admin audit log 或 render payload。
2. **i18n 資料流輪**：錯誤經 `errorHandler` / `responseFormatter` 依 `X-Locale` / `Accept-Language` 翻譯；M5 shared client 與 App/Web/Admin 消費 backend message。
3. **邊界輪**：API 欄位和值保留英文/技術字面值，不把 `pending`、`failed`、`token`、`device_id` 翻譯成自然語言；英文 message 只翻譯周邊說明。
4. **UI/UX 輪**：Admin 操作錯誤需短句可行；App push token 錯誤需避免暴露內部實作細節。
5. **維護性輪**：集中在 `backend/src/i18n/index.ts` exact map 與 `backend-i18n.test.ts` regression；用靜態比對掃 notification controller/service 中文 `Errors.*()` message 防回流。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，23 tests。
- 靜態比對 notification controller/service 的 backend-owned 中文 error message 是否已被 backend i18n map 覆蓋：通過。
- `npm --prefix backend run build`：通過。
- `npm run docs:check`：通過。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 notification path validation、Admin bulk cancel / cancel / resend、device token revoke 與 template code validation 的 en-US exact map。
2. `backend/tests/unit/utils/backend-i18n.test.ts` 已新增 notification controller/service regression，固定 API 欄位和值不被本地化。
3. 未改 notification deep link allowlist、Admin cancel/resend 狀態機、push token lifecycle、render payload 或 shared M5 client。
4. Web/Admin/App 不新增端側中文錯誤翻譯表，仍統一消費 backend locale layer。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
