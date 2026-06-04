# Backend Auth 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend auth login / verification API 錯誤訊息、Web/App auth form error 顯示、backend i18n message map
**取證代碼入口**：`backend/src/services/auth.service.ts`、`backend/src/controllers/auth.controller.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`
**最後核驗 Commit**：`2feb08c`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/services/auth.service.ts` 的 login 與 verification flow 仍有多個 backend-owned 中文錯誤 message：

- `帳號已被暫時鎖定，請{remainingMin}分鐘後再試`
- `帳號未激活`
- `請先完成郵箱驗證`
- `請稍後再試`

這些 message 會經 `errorHandler` / `responseFormatter` 進入 API error payload；Web / App auth 表單通常會把 backend error message 顯示給使用者。當 request locale 為 `en-US` 時，目前 `translateBackendMessage()` 沒有覆蓋這批 service-level fallback message，因此英文使用者仍可能看到中文錯誤。

## 影響範圍

- Backend：auth login、send verification code 的 error payload。
- Web：Login/Register/Verify/Reset auth form error 顯示。
- App：Auth/recovery flow 經 platform API client 顯示 backend error message。
- Shared/API client：沿用 backend `error.message`，不應在端側另建中文 message 翻譯表。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋 auth success message、通用 error code、password strength message 與部分 rate limit message，但 auth service 自定義 fallback message 未覆蓋；尤其 lockout message 帶動態分鐘數，不能用 exact map 處理。

## 目標行為

1. `zh-TW` locale 下保持既有中文 canonical message，不改 auth 狀態碼、錯誤碼或安全語義。
2. `en-US` locale 下，auth service-level error message 必須翻譯為英文。
3. lockout message 必須保留剩餘分鐘數，不本地化為錯誤或固定值。
4. 修復集中在 backend i18n 層，Web/App/shared client 不新增 ad hoc 中文 message 對照表。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 `帳號未激活`、`請先完成郵箱驗證`、`請稍後再試` 的 en-US exact mapping。
2. `translateDynamicBackendMessage()` 已補齊 `帳號已被暫時鎖定，請{remainingMin}分鐘後再試` 的 dynamic pattern，保留 backend 計算出的剩餘分鐘數。
3. Auth service / controller 的錯誤碼、狀態碼、安全節流與帳號驗證流程不變。
4. Web/App/shared client 不新增端側 auth error 中文對照表，仍統一消費 backend locale layer。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，11 tests。
- `npm --prefix backend run build`：通過。
- `npm run docs:check`：通過。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
