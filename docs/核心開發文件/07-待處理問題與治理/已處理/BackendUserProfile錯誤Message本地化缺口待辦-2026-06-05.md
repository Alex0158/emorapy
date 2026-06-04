# Backend User Profile 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend user profile/avatar API 錯誤訊息、Web profile/settings error 顯示、backend i18n message map
**取證代碼入口**：`backend/src/controllers/user.controller.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend/src/services/api/user.ts`、`frontend/src/pages/Profile/Settings/index.tsx`
**最後核驗 Commit**：`75ef284`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/controllers/user.controller.ts` 的 profile update 與 avatar upload flow 仍有多個 backend-owned 中文錯誤 message：

- `用戶不存在`
- `沒有可更新的字段`
- `頭像域名不被允許`
- `頭像URL格式無效`
- `缺少頭像文件`
- `頭像僅支持圖片格式`

這些錯誤會經 `errorHandler` / `responseFormatter` 進入 API error payload；Web Profile Settings / user service 會把 backend error message 顯示給使用者。當 request locale 為 `en-US` 時，目前 `translateBackendMessage()` 沒有覆蓋這批 controller-level fallback message，因此英文使用者仍可能看到中文錯誤。

## 影響範圍

- Backend：user profile / avatar API error payload。
- Web：Profile Settings 更新資料與 avatar upload error。
- Shared/API client：沿用 backend `error.message`，不應在端側另建中文 message 翻譯表。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋 `資料更新成功`、`頭像更新成功` 與 multer file upload error，但 user controller 自有 profile/avatar validation fallback message 未覆蓋。

## 目標行為

1. `zh-TW` locale 下保持既有中文 canonical message，不改 profile/avatar validation、上傳、簽名 URL 或 allowlist 行為。
2. `en-US` locale 下，user profile/avatar controller-level error message 必須翻譯為英文。
3. `URL` 等技術詞保持清楚英文語義。
4. 修復集中在 backend i18n 層，Web/shared client 不新增 ad hoc 中文 message 對照表。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 user profile/avatar controller-level exact message 的 en-US 翻譯。
2. `URL` 等技術詞保留清楚英文語義。
3. Profile/avatar validation、受信任 avatar host allowlist、file validation、image processing 與 signed URL 行為不變。
4. Web/shared client 不新增端側 user profile error 中文對照表，仍統一消費 backend locale layer。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，14 tests。
- `npm --prefix backend run build`：通過。
- `npm run docs:check`：通過。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
