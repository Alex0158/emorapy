# Backend Validation Utils 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend ValidationUtils API 錯誤訊息、Case/Evidence/Auth/Judgment validation visible error、Web/App 表單錯誤 fallback、backend i18n dynamic message pattern
**取證代碼入口**：`backend/src/utils/validation.ts`、`backend/src/services/case.service.ts`、`backend/src/controllers/evidence.controller.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend/src/pages/Case`、`mobile/app/(app)/case`、`mobile/app/(public)/quick`
**最後核驗 Commit**：`eeae5f3`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/utils/validation.ts` 的 ValidationUtils 仍有多個 backend-owned 中文錯誤 message 未被 `translateBackendMessage()` 覆蓋：

- `${fieldName}不能為空`
- `${fieldName}長度必須至少${minLength}字`
- `${fieldName}長度不能超過${maxLength}字`
- `證據URL必須是數組`
- `最多只能上傳3張圖片`
- `證據URL[${index}]格式錯誤`
- `證據URL[${index}]格式無效`
- `證據URL[${index}]僅支持 HTTPS`
- `${fieldName}格式無效`
- `郵箱格式錯誤`
- `密碼不能為空`
- `密碼長度至少8位`
- `密碼必須包含字母`
- `密碼必須包含數字`
- `責任分比例必須是數字`
- `責任分比例不能為負數`
- `責任分比例總和必須為100%`

這些錯誤被 `case.service.ts` 用於 quick/formal/collaborative case statement 與 evidence URL validation，也可被 auth / judgment 相關 validation helper 使用。Web/App 表單雖有端側 validation，但 backend validation 仍是最終防線；當 request locale 為 `en-US` 時，後端 fallback error 仍可能直出繁中。

## 影響範圍

- Backend：case statement、evidence URL、UUID、email、password、responsibility ratio validation。
- Web：Case create / detail / retry / evidence upload backend fallback error。
- App：Case screen / Quick result backend fallback error。
- Shared/API client：只傳遞 backend error message，不應在端側新增中文 message 對照表。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已有多個 exact map 與受限 dynamic pattern，但 ValidationUtils 的 `${fieldName}`、`${minLength}`、`${maxLength}`、`證據URL[${index}]` 類動態文案未被覆蓋。這類 message 不能只靠 exact map，否則不同 fieldName / index / length 仍會漏翻。

## 目標行為

1. `en-US` locale 下，ValidationUtils 自有錯誤 message 必須經 backend locale layer 輸出英文。
2. `zh-TW` locale 下，原繁中 canonical message 保持不變，不改 validation 規則。
3. `fieldName`、index、min/max length、`HTTPS`、`100%` 等動態值需保留，不被誤改為錯誤數值或丟失欄位語義。
4. Web/App/shared client 不新增端側中文錯誤翻譯表，仍統一消費 backend locale layer。

## 分析與方案

1. **業務邏輯輪**：`ValidationUtils.validateStatement()` 是正式案件與協作案件陳述長度/空值最終 gate；`validateEvidenceUrls()` 是 evidence URL 數量、格式與 HTTPS gate；責任分比例 validation 保護 AI / judgment 結構資料。本輪只補 i18n，不改 validation gate。
2. **i18n 資料流輪**：這些錯誤經 `Errors.VALIDATION_ERROR()` / `Errors.TOO_MANY_FILES()` 等進入 backend `errorHandler`，由 `translateBackendMessage()` 翻譯；因此應在 backend i18n 層新增 exact + dynamic pattern。
3. **邊界輪**：`fieldName` 可能是繁中 user-facing label（如 `角色A陳述`、`回應方陳述`），本輪先保留原 fieldName，不嘗試端側或後端猜測欄位翻譯，避免錯譯業務角色；英文句式翻譯規則本身，動態 label 原樣保留。
4. **UI/UX 輪**：英文錯誤需簡短適合表單/toast 顯示，例如 `角色A陳述 cannot be empty`，雖保留中文 label 但避免整句中文直出；後續若需要 fieldName catalog，應另開明確跨端 terminology 任務。
5. **維護性輪**：用 `translateDynamicBackendMessage()` 添加受限 regex；新增 regression 覆蓋 default fieldName、角色 fieldName、evidence index、password 與 responsibility ratio；新增靜態比對掃 `validation.ts` 中中文 `Errors.*()` message。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，24 tests。
- 靜態比對 `backend/src/utils/validation.ts` 的 backend-owned 中文 error message 是否已被 backend i18n exact / dynamic map 覆蓋：通過。
- `npm --prefix backend run build`：通過。
- `npm run docs:check`：通過。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 ValidationUtils 固定文案的 en-US exact map，包含 evidence URL、email、password 與 responsibility ratio validation。
2. `translateDynamicBackendMessage()` 已新增 fieldName / minLength / maxLength / UUID format / evidence URL index 的受限 dynamic pattern，且 evidence-specific pattern 排在 generic format pattern 之前。
3. `backend/tests/unit/utils/backend-i18n.test.ts` 已新增 validation utility regression，覆蓋 role statement、dynamic length、evidence URL index、password 與 responsibility ratio。
4. 未改 ValidationUtils validation 規則、Case/Evidence/Auth/Judgment 業務流程或 Web/App/shared client 消費方式。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
