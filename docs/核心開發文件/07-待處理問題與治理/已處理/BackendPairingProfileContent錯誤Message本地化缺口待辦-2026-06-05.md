# Backend Pairing/Profile/Content 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend pairing / profile / content API 錯誤訊息、Web pairing/profile 操作 toast、shared API client error payload
**取證代碼入口**：`backend/src/services/pairing.service.ts`、`backend/src/services/profile.service.ts`、`backend/src/services/content.service.ts`、`backend/src/controllers/content.controller.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`
**最後核驗 Commit**：`191dde6`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/services/pairing.service.ts`、`backend/src/services/profile.service.ts`、`backend/src/services/content.service.ts` 與 `backend/src/controllers/content.controller.ts` 仍有多個 backend-owned 中文錯誤 message：

- Pairing：`無法生成唯一邀請碼`、`邀請碼無效`、`邀請碼已過期`、`邀請碼已使用`、`不能與自己配對`、`當前沒有可解除的配對`、`無權限解除此配對`、`臨時配對數量達到上限，請稍後重試`
- Profile：`配對不存在`、`無權訪問此配對檔案`
- Content：`內容不存在`、`需要認證`、`case_id、content_id 為必填`、`relation 只能是 recommend, similar, waiting`

這些錯誤會經 `errorHandler` / `responseFormatter` 輸出到 API error payload；Web Profile Pairing 頁面會把 pairing/profile API 錯誤交給 `getErrorMessage()` / toast 顯示，shared API client 也會把 backend error message 作為錯誤內容向端側傳遞。當 request locale 為 `en-US` 時，目前 `translateBackendMessage()` 沒有覆蓋這批 message，因此英文使用者仍可能看到中文錯誤。

## 影響範圍

- Backend：pairing / profile / content API error payload。
- Web：Profile Pairing、relationship profile 與內容關聯操作失敗提示。
- Shared/API client：沿用 backend `error.message`，不應在前端另建中文 message 翻譯表。
- App：目前 pairing/profile screen 主要通過 shared M2/M4 client 消費同類 backend error payload；需維持同一 backend locale 規則。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋 pairing success message 與通用 code fallback，但未覆蓋 pairing/profile/content service-level 自有錯誤 message。這會讓 `en-US` locale 下的 API error fallback 回原中文 message。

## 目標行為

1. `zh-TW` locale 下保持既有中文 canonical message，不改錯誤碼、狀態碼或業務流程。
2. `en-US` locale 下，pairing/profile/content service-level error message 必須翻譯為英文。
3. `case_id`、`content_id`、`relation`、`recommend`、`similar`、`waiting` 等 API 欄位和值必須原樣保留。
4. 修復集中在 backend i18n 層，Web/App/shared client 不新增 ad hoc 中文 message 對照表。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 pairing / profile / content service-level exact message 的 en-US 翻譯。
2. `translateDynamicBackendMessage()` 已補齊 `relation 只能是 {allowedValues}` 的受限 dynamic pattern，保留 `recommend, similar, waiting` 等 API 值原文。
3. Web Profile Pairing、relationship profile 與 content link 不新增端側錯誤 message 翻譯表，仍由 backend locale layer 依 request locale 輸出。
4. `zh-TW` locale 維持原中文 canonical message，未改 pairing、profile、content 的 service/controller 業務分支。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，10 tests。
- `npm --prefix backend run build`：通過。
- `npm run docs:check`：通過。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
