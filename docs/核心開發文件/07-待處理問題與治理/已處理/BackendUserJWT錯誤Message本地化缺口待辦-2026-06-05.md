# Backend User JWT 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend user JWT verification fallback error、Web/App auth visible error、backend i18n message map
**取證代碼入口**：`backend/src/utils/jwt.ts`、`backend/src/middleware/auth.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend/src/services/api/auth.ts`、`frontend/src/store/authStore.ts`、`mobile/app/(app)/_layout.tsx`、`packages/api-client/src`
**最後核驗 Commit**：`e6e994c`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/utils/jwt.ts` 的一般使用者 JWT 驗證工具仍有 backend-owned 中文錯誤 message 未被 `translateBackendMessage()` 覆蓋：

- `Token無效`
- `Token驗證失敗`

這些錯誤可經 `backend/src/middleware/auth.ts` 進入 Web/App auth API 的 response message。當 request locale 為 `en-US` 時，未覆蓋 message 仍可能直出繁中。

## 影響範圍

- Backend：user JWT verify / auth middleware。
- Web：登入態 API 請求、profile / interview / case 等需登入頁面。
- App：需登入 screen / shared API client auth request。
- Shared/API client：只傳遞 backend message，不應端側新增中文錯誤對照。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋 `未提供認證Token`、`Token已失效，請重新登入`、`管理員 Token 無效` 等 auth/admin message，但一般使用者 JWT invalid / verification failure fallback 尚未覆蓋。

## 目標行為

1. `en-US` locale 下，user JWT invalid / verification failure fallback error 必須由 backend locale layer 輸出英文。
2. `zh-TW` locale 下，原繁中 canonical message 保持不變。
3. 不改 JWT secret rotation、HS256 enforcement、token_version、expired token 或 middleware auth flow。
4. Web/App/shared client 不新增端側中文錯誤翻譯表。

## 分析與方案

1. **業務邏輯輪**：`Token無效` 表示 JsonWebTokenError 經所有 verification secret 嘗試後仍不可用；`Token驗證失敗` 是非 JsonWebTokenError fallback。修復只補翻譯，不改驗證策略。
2. **i18n 資料流輪**：auth middleware 丟出的 AppError 經 error handler / response formatter 按 `X-Locale` / `Accept-Language` 翻譯，因此應集中補 `directEnUSMap`。
3. **邊界輪**：expired token 已由 `TOKEN_EXPIRED` / `Token已失效，請重新登入` 覆蓋，不在本輪改文案或語義。
4. **UI/UX 輪**：英文錯誤需短句適合 toast / auth gate，不暴露 signature、secret rotation 或演算法細節。
5. **維護性輪**：新增 backend i18n regression 與 focused static coverage scan。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，25 tests。
- Focused static coverage scan：比對 `backend/src/utils/jwt.ts` 中文 user JWT error 是否被 backend i18n exact map 覆蓋：通過。
- `npm --prefix backend run build`：通過。
- `npm run docs:check`：待本輪文檔回寫後執行。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 `Token無效` 與 `Token驗證失敗` exact map。
2. `backend/tests/unit/utils/backend-i18n.test.ts` 已新增 user JWT fallback message regression。
3. Expired token、token_version 失效、secret rotation、HS256 enforcement 與 middleware auth flow 均未改動。
4. Web/App/shared client 不新增端側中文錯誤翻譯表，仍統一消費 backend locale layer。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
