# Backend File Service 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend file upload validation error、Evidence / Avatar / Check-in photo upload visible error、Web/App upload fallback、backend i18n message map
**取證代碼入口**：`backend/src/services/file.service.ts`、`backend/src/controllers/evidence.controller.ts`、`backend/src/controllers/user.controller.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend/src/components/business/FileUpload`、`frontend/src/pages/Profile`、`frontend/src/pages/Execution/CheckIn`、`mobile/app/(app)/case`、`packages/api-client/src/m5.ts`
**最後核驗 Commit**：`94e63a5`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/services/file.service.ts` 的 upload filter / validateFile 仍有 backend-owned 中文錯誤 message 未被 `translateBackendMessage()` 覆蓋：

- `文件大小不能超過${env.MAX_FILE_SIZE / 1024 / 1024}MB`
- `只支持JPG、PNG、GIF、MP4格式`
- `不支持的文件類型`
- `不支持的文件擴展名`
- `文件類型驗證失敗：文件內容與聲稱的類型不匹配`

這些錯誤可能經 evidence upload、avatar upload、execution check-in photo upload 進入 Web/App 可見 error。當 request locale 為 `en-US` 時，未覆蓋的 file service fallback error 仍可能直出繁中。

## 影響範圍

- Backend：multer file filter、file size/type/signature validation。
- Web：Case evidence upload、Quick evidence upload、Profile avatar upload、Execution check-in photo upload。
- App：Case evidence upload。
- Shared/API client：M5 media client 傳遞 backend message，不應端側新增中文 message 對照表。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋 generic upload failures 與 evidence controller errors，但 file service 內部 file size、extension、mime/signature mismatch message 尚未覆蓋。`文件大小不能超過...MB` 是動態 message，需用受限 pattern 保留 MB 數值。

## 目標行為

1. `en-US` locale 下，file service 自有錯誤 message 必須經 backend locale layer 輸出英文。
2. `zh-TW` locale 下，原繁中 canonical message 保持不變。
3. `JPG`、`PNG`、`GIF`、`MP4`、`MB` 等格式/單位值不被誤改。
4. Web/App/shared client 不新增端側中文錯誤翻譯表。

## 分析與方案

1. **業務邏輯輪**：file service 先做 size / extension / expected mime / magic number validation；修復只補翻譯，不改允許副檔名、mime 判斷、簽名驗證或刪除無效檔案邏輯。
2. **i18n 資料流輪**：`Errors.FILE_TOO_LARGE` / `Errors.INVALID_FILE_TYPE` 進入 error handler；multer filter 的 `Error('不支持的文件類型')` 也可能被 error middleware 顯示，因此同一 map 需覆蓋。
3. **邊界輪**：dynamic file size 用 regex 保留數值；格式清單保持技術值原樣。
4. **UI/UX 輪**：英文錯誤需短句適合 toast / alert；signature mismatch 需說明內容與聲稱類型不匹配，但不暴露過多內部細節。
5. **維護性輪**：新增 backend i18n regression 與 file.service static coverage scan。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，25 tests。
- 靜態比對 `backend/src/services/file.service.ts` 的中文 upload error message 是否已被 backend i18n exact / dynamic map 覆蓋：通過。
- `npm --prefix backend run build`：通過。
- `npm run docs:check`：通過。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 file size dynamic pattern，以及 supported formats、unsupported type / extension、signature mismatch exact map。
2. `backend/tests/unit/utils/backend-i18n.test.ts` 已新增 file service upload validation regression。
3. 未改 file size limit、allowed extension / mime list、magic number validation、invalid file deletion、Evidence / Avatar / Check-in photo upload flow 或 shared M5 client。
4. Web/App/shared client 不新增端側中文錯誤翻譯表，仍統一消費 backend locale layer。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
