# Backend Admin JWT 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend Admin JWT token API 錯誤訊息、Admin Web auth error display、backend i18n message map
**取證代碼入口**：`backend/src/utils/admin-jwt.ts`、`backend/src/middleware/adminAuth.ts`、`backend/src/services/admin.service.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend-admin/src/services/request.ts`、`frontend-admin/src/pages/Admin/Login`
**最後核驗 Commit**：`671e902`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/utils/admin-jwt.ts` 仍有 Admin token 相關中文錯誤 message 未被 `translateBackendMessage()` 覆蓋：

- `管理員 JWT 過期時間配置缺失`
- `管理員 JWT 配置缺失`
- `管理員 Token 已過期`
- `管理員 Token 無效`

這些錯誤會經 Admin auth middleware / Admin login token helper 進入 Admin Web API error。當 request locale 為 `en-US` 時，Admin Web 仍可能顯示繁中 fallback error。

## 影響範圍

- Backend：Admin token generate / verify。
- Admin Web：login、session restore、protected admin API auth error。
- Shared/API client：Admin request adapter 傳遞 backend message，不應端側新增中文 message 對照表。

## 目前語言處理缺口

先前已修復 Admin auth middleware 層錯誤，但 `admin-jwt.ts` helper 自有 token config / expired / invalid message 尚未納入 backend direct map。

## 目標行為

1. `en-US` locale 下，Admin JWT helper 自有錯誤 message 必須經 backend locale layer 輸出英文。
2. `zh-TW` locale 下，原繁中 canonical message 保持不變。
3. `JWT`、`ADMIN_JWT_SECRET`、`ADMIN_JWT_EXPIRES_IN` 等技術語義不被誤譯或改名。
4. Admin Web 不新增端側中文錯誤翻譯表。

## 分析與方案

1. **業務邏輯輪**：`getAdminTokenExpiresIn()` / `getAdminSecret()` enforcing production config，`verifyAdminToken()` 區分 expired vs invalid token。本輪只補 backend message map，不改 token expiry、secret fallback 或 algorithm。
2. **i18n 資料流輪**：Admin API error 仍走 `errorHandler` / `responseFormatter`，由 `translateBackendMessage()` 按 locale 翻譯。
3. **邊界輪**：JWT/Token 保留技術詞；production config gate 仍保持原規則。
4. **維護性輪**：新增 backend i18n regression 與 admin-jwt static coverage scan。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，25 tests。
- 靜態比對 `backend/src/utils/admin-jwt.ts` 中文 error message 是否已被 backend i18n map 覆蓋：通過。
- `npm --prefix backend run build`：通過。
- `npm run docs:check`：通過。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 Admin JWT expiry config、secret config、expired token 與 invalid token 的 en-US exact map。
2. `backend/tests/unit/utils/backend-i18n.test.ts` 已在 Admin auth regression 中覆蓋 admin-jwt helper 自有錯誤。
3. 未改 Admin JWT expiry、secret fallback、algorithm、Admin auth middleware 或 Admin Web request adapter。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
