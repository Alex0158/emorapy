# Backend Auth Middleware 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend JWT / Admin auth / media access middleware 錯誤訊息、Web/Admin/App API error 顯示、backend i18n message map
**取證代碼入口**：`backend/src/middleware/auth.ts`、`backend/src/middleware/adminAuth.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`
**最後核驗 Commit**：`9f7d73b`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/middleware/auth.ts` 與 `backend/src/middleware/adminAuth.ts` 仍有多個 backend-owned 中文錯誤 message：

- User auth：`未提供認證Token`、`用戶不存在或未激活`、`Token已失效，請重新登入`
- Media access：`訪問被拒絕`、`生產環境不允許公開訪問上傳資源`、`公開模式僅允許讀取請求`、`當前文件路徑未在 PUBLIC_UPLOAD_PATHS 白名單`、`簽名已失效`、`未授權的資源訪問`
- Admin auth：`未提供管理員認證 Token`、`管理員帳號不存在或未啟用`、`管理員 Token 已失效，請重新登入`、`管理員未認證`、`管理員權限不足`

這些錯誤會經 `errorHandler` / `responseFormatter` 進入 API error payload 或受保護 media access response；當 request locale 為 `en-US` 時，目前 `translateBackendMessage()` 沒有覆蓋這批 middleware-level fallback message，因此英文使用者或 Admin 操作者仍可能看到中文錯誤。

## 影響範圍

- Backend：auth、admin auth、media access middleware error payload。
- Web / App：登入失效、未登入、受保護資源訪問失敗。
- Admin Web：Admin token 缺失、失效、權限不足。
- Shared/API client：沿用 backend `error.message`，不應在端側另建中文 message 翻譯表。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋通用 `UNAUTHORIZED` / `FORBIDDEN` error code，但 middleware 傳入的自定義 fallback message 會優先作為使用者可見 message；這些 fallback message 未被 direct map 覆蓋。

## 目標行為

1. `zh-TW` locale 下保持既有中文 canonical message，不改 middleware 權限、token、media access 判斷。
2. `en-US` locale 下，user auth、Admin auth 與 media access middleware error message 必須翻譯為英文。
3. `Token`、`PUBLIC_UPLOAD_PATHS`、`GET/HEAD` 等技術詞保持原樣或清楚英文語義。
4. 修復集中在 backend i18n 層，Web/Admin/App/shared client 不新增 ad hoc 中文 message 對照表。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 user auth、Admin auth 與 media access middleware exact message 的 en-US 翻譯。
2. `Token`、`PUBLIC_UPLOAD_PATHS`、`GET/HEAD` 等技術詞保持原樣或清楚英文語義。
3. JWT、Admin token、media signature、public upload allowlist 與 session-bound media access 判斷不變。
4. Web/Admin/App/shared client 不新增端側 middleware error 中文對照表，仍統一消費 backend locale layer。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，13 tests。
- `npm --prefix backend run build`：通過。
- `npm run docs:check`：通過。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
