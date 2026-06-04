# Backend Evidence 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend evidence upload/delete API 錯誤訊息、Web / App evidence upload 顯示、backend i18n message map
**取證代碼入口**：`backend/src/controllers/evidence.controller.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`packages/api-client/src/m5.ts`、`frontend/src/services/api/case.ts`、`mobile/app/(app)/case/index.tsx`
**最後核驗 Commit**：`6eb40f2`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/controllers/evidence.controller.ts` 的 upload/delete flow 仍有多個 backend-owned 中文錯誤 message：

- `Header 與 Query 的 Session ID 不一致`
- `無權限上傳證據`
- `案件狀態不允許上傳證據`
- `請選擇要上傳的文件`
- `證據安全聲明未通過`
- `每個案件最多只能上傳3張圖片`
- `證據不存在`
- `無權限刪除此證據`

這些錯誤會經 `errorHandler` / `responseFormatter` 進入 API error payload；Web Quick / Case Create / FileUpload 與 App Case screen 會把 upload/delete error message 顯示給使用者。當 request locale 為 `en-US` 時，目前 `translateBackendMessage()` 沒有覆蓋這批 controller-level fallback message，因此英文使用者仍可能看到中文錯誤。

## 影響範圍

- Backend：evidence upload/delete API error payload。
- Web：Quick Experience、Case Create、Quick Result evidence re-upload、FileUpload delete evidence。
- App：Case screen evidence upload error notice。
- Shared/API client：M5 media client 沿用 backend `error.message`，不應在端側另建中文 message 翻譯表。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋 `證據上傳成功`、`證據已刪除` 與 multer file upload error，但 evidence controller 自有 validation / permission / session mismatch / safety assertion fallback message 未覆蓋。

## 目標行為

1. `zh-TW` locale 下保持既有中文 canonical message，不改 evidence upload/delete 的狀態碼、錯誤碼、權限判斷或安全聲明邏輯。
2. `en-US` locale 下，evidence controller-level error message 必須翻譯為英文。
3. `Header`、`Query`、`Session ID` 等技術詞保持可理解且不誤改語義。
4. 修復集中在 backend i18n 層，Web/App/shared client 不新增 ad hoc 中文 message 對照表。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 evidence upload/delete controller-level exact message 的 en-US 翻譯。
2. `Header`、`Query`、`Session ID` 等技術詞保留可理解的英文語義，不改 session mismatch 判斷。
3. Evidence upload/delete 的權限、case status、安全聲明、數量限制與 cleanup 流程不變。
4. Web/App/shared client 不新增端側 evidence error 中文對照表，仍統一消費 backend locale layer。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，12 tests。
- `npm --prefix backend run build`：通過。
- `npm run docs:check`：通過。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
