# Backend Admin 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend Admin auth / users / config / ops / notification governance API 錯誤訊息、Admin Web error 顯示、backend i18n message map
**取證代碼入口**：`backend/src/controllers/admin.controller.ts`、`backend/src/services/admin.service.ts`、`backend/src/services/admin-config-rules.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend-admin/src/services/api/admin.ts`、`frontend-admin/src/pages/Admin`
**最後核驗 Commit**：`3e0b668`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

Admin backend 仍有多個 backend-owned 中文錯誤 message 未被 `translateBackendMessage()` 覆蓋，例如：

- `limit/offset 必須為數字`
- `from 必須為合法 ISO 日期`
- `email/password/name 為必填`
- `管理員帳號已存在，請改用登入`
- `管理員帳號或密碼錯誤`
- `不可停用自己的管理員帳號`
- `敏感基礎密鑰不可由後台配置管理`
- `feature.flags 必須為 object`
- `admin.alert.rules[0].threshold 必須為 >= 0 的數字`
- `media.provider.nanobananapro 的 apiKey 需為非空字串`

這些錯誤會經 `errorHandler` / `responseFormatter` 進入 Admin API error payload；`frontend-admin` 會把 backend error message 顯示給管理員。當 request locale 為 `en-US` 時，目前未覆蓋的 Admin controller / service / config validation message 仍可能直出中文。

## 影響範圍

- Backend：Admin bootstrap / login / users / audit logs / ops jobs / managed config / notification governance / AI stream API error payload。
- Admin Web：管理員登入、帳號管理、配置管理、通知治理、AI stream 盤點等頁面的 error toast / inline error。
- Shared/API client：沿用 backend `error.message`，不應在 Admin Web 端另建中文 message 翻譯表。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋部分 Admin auth middleware fallback message 與 notification governance success message，但 Admin controller/service/config rules 自有 validation / permission / not-found fallback message 未全量覆蓋。`admin-config-rules.ts` 還包含受限動態 message：config key、provider key、array index、min/max 範圍需要保留原值，只翻譯固定語義。

## 目標行為

1. `zh-TW` locale 下保持既有 Admin canonical message，不改 Admin 權限、bootstrap token、配置白名單或通知治理行為。
2. `en-US` locale 下，Admin controller/service/config validation error message 必須翻譯為英文。
3. `ADMIN_BOOTSTRAP_TOKEN`、`super_admin`、`feature.flags`、`media.provider.*`、`apiKey`、`baseUrl`、`timeoutMs`、`ISO`、`streamId` 等技術語義與配置 key 不被本地化。
4. 修復集中在 backend i18n 層，Admin Web/shared client 不新增 ad hoc 中文 message 對照表。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 Admin controller/service 固定錯誤 message 的 en-US exact map。
2. `backend/src/i18n/index.ts` 已新增 Admin managed config 受限 dynamic pattern，覆蓋 config key、provider key、array index、min/max range、object / array / boolean / numeric validation。
3. `ADMIN_BOOTSTRAP_TOKEN`、`super_admin`、`feature.flags`、`media.provider.*`、`apiKey`、`baseUrl`、`timeoutMs`、`ISO`、`streamId` 等技術詞與配置 key 保持原樣。
4. Admin Web/shared client 不新增端側中文錯誤翻譯表，仍統一消費 backend locale layer。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，17 tests。
- `npm --prefix backend run build`：通過。
- 靜態比對 Admin controller/service/config rules 的 backend-owned 中文 message 是否已被 exact map 或受限 dynamic pattern 覆蓋：通過。
- `npm run docs:check`：通過。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
