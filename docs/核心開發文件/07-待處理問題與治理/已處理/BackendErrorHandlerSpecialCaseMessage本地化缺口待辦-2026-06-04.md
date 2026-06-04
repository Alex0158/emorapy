# Backend ErrorHandler 特殊錯誤訊息本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend `errorHandler` 特殊錯誤分支、Prisma / Multer 錯誤訊息、Web / Admin / App API error 顯示語言
**取證代碼入口**：`backend/src/middleware/errorHandler.ts`、`backend/src/i18n/index.ts`、`backend/tests/unit/middleware/errorHandler.test.ts`
**最後核驗 Commit**：`ff6e8b0`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/middleware/errorHandler.ts` 的一般 `AppError` 分支會用 `translateErrorByCode(locale, code, message)`，已知 code 在 `en-US` 下會回到英文 code catalog，不會直接外露中文 fallback。

但同一 middleware 內的特殊錯誤分支仍直接呼叫 `translateBackendMessage(locale, literal)`：

1. Prisma `P2002` email duplicate：`該郵箱已被註冊`
2. Multer `LIMIT_FILE_SIZE`：`文件大小超出限制`
3. Multer `LIMIT_FILE_COUNT`：`文件數量超出限制`
4. Multer `LIMIT_UNEXPECTED_FILE`：`無效的文件字段`
5. Multer fallback：`文件上傳失敗`

目前 `backend/src/i18n/index.ts` 的 `directEnUSMap` 未覆蓋上述字串。英文語系請求若觸發這些特殊分支，API response 的 `error.message` 可能仍是繁中，Web / Admin / App 顯示時就沒有完整按使用者所選語言呈現。

## 影響範圍

- Backend：直接受影響。`errorHandler` 特殊錯誤分支未被既有 `Backend回傳訊息英文語系翻譯Map缺口` 完全覆蓋。
- Web：受影響。上傳、註冊或其他 API error boundary 可能消費 backend `error.message`。
- Admin：受影響。Admin API request service 仍會收到 backend envelope；即使前端有 fallback，network inspector / typed client 邊界仍應正確。
- App：受影響。App 會送 locale header，backend 特殊錯誤也應以 request locale 回傳。
- Shared：間接受影響。`packages/api-client` 保留 `RequestErrorLike.code/details`，但 backend message 邊界仍需正確。

## 目前語言處理缺口

1. `translateBackendMessage('en-US', '該郵箱已被註冊')` 回傳原文。
2. `translateBackendMessage('en-US', '文件大小超出限制')` 等 Multer message 回傳原文。
3. `backend/tests/unit/middleware/errorHandler.test.ts` 只驗證 zh-TW 或 `expect.any(String)`，未釘住 `en-US` 特殊錯誤分支。

## 目標行為

1. `req.locale = 'en-US'` 時，Prisma duplicate email 與 Multer upload error response 不得包含繁中 user-facing message。
2. `req.locale = 'zh-TW'` 時，現有繁中回應保持不變。
3. 修復邊界留在 backend i18n map，不在 Web / Admin / App 增加 ad hoc 中文轉譯。
4. 保持錯誤 code 不變：`EMAIL_EXISTS`、`FILE_TOO_LARGE`、`TOO_MANY_FILES`、`INVALID_FILE_FIELD`、`UPLOAD_ERROR`。

## 修復前分析

- 目標改動點：`backend/src/i18n/index.ts` 補齊 errorHandler special-case literals；`backend/tests/unit/middleware/errorHandler.test.ts` 補 `en-US` regression tests；必要時補 `backend-i18n.test.ts` 確認 map 覆蓋。
- 替代方案 A：把 `errorHandler` 特殊分支改成 `translateErrorByCode()`。不適合本輪，因為 `INVALID_FILE_FIELD` / `UPLOAD_ERROR` 不在 code catalog，且 Prisma email duplicate 的文案比 generic code 更具體。
- 替代方案 B：前端完全忽略 backend `error.message`。已在多個 runtime boundary 收斂，但 backend 作為 API message source 仍應按 locale 正確輸出，否則會造成跨端與除錯工具看到不一致語言。
- 本輪方案：沿用既有 `translateBackendMessage()` exact map，補齊五個特殊分支 literal，並用 middleware test 直接驗證 `req.locale='en-US'` 的實際 response。
- fallback 邏輯：zh-TW 原文；en-US exact map；未覆蓋訊息仍保留原文作診斷，但本輪已知 user-facing literal 必須覆蓋。
- UI/UX：使用者看到的註冊重複 email 與上傳錯誤應按語言一致顯示；不改變表單流程、HTTP status 或 code。
- 可維護性：集中在 backend i18n map，避免三端各自維護同一組 special-case 文案。
- 風險：翻譯 map 只新增 exact strings，低風險；測試可防止 errorHandler future branch 再次漏出繁中。
- 回滾點：回滾 `backend/src/i18n/index.ts` 與 `backend/tests/unit/middleware/errorHandler.test.ts` 本輪改動即可。

## 驗證方式

1. `npm --prefix backend test -- tests/unit/middleware/errorHandler.test.ts tests/unit/utils/backend-i18n.test.ts --runInBand`
2. `npm --prefix backend run build -- --pretty false`
3. 靜態核對 `translateBackendMessage('en-US', ...)` 對五個 special-case literals 不再回傳原文。
4. `npm run docs:check`

## Owner / Status Notes

- Owner：agent
- Status：已處理
- 注意：本任務只覆蓋 `errorHandler` 已知特殊錯誤 response。AppError 自訂中文 fallback 是否需保留精準語義，另屬「錯誤 code catalog 是否應細化」問題，不在本輪把它擴大處理。

## 2026-06-04 本輪結果

已完成：

1. `backend/src/i18n/index.ts` 已補齊 `errorHandler` special-case literals 的 en-US exact map：
   - `該郵箱已被註冊`
   - `文件大小超出限制`
   - `文件數量超出限制`
   - `無效的文件字段`
   - `文件上傳失敗`
2. `backend/tests/unit/utils/backend-i18n.test.ts` 已新增 map-level regression test，確保五個 literal 在 `en-US` 不再回傳原文。
3. `backend/tests/unit/middleware/errorHandler.test.ts` 已新增 response-level regression test，直接驗證 `req.locale='en-US'` 時 Prisma duplicate email 與 Multer upload error response 會回英文 message。

已驗證：

1. `npm --prefix backend test -- tests/unit/middleware/errorHandler.test.ts tests/unit/utils/backend-i18n.test.ts --runInBand`：passed，2 suites / 22 tests。
2. `npm --prefix backend run build -- --pretty false`：passed。
3. 靜態核對五個 special-case literals：全部已在 `directEnUSMap` mapped。

剩餘邊界：

1. `AppError` 已知 code 分支目前以 generic code catalog 輸出英文，不會外露中文 fallback；是否要為每個 custom fallback 建立精準英文文案屬另一輪產品/錯誤模型細化，不在本輪擴大。
2. 開發環境未知 500 error 仍可能回 raw diagnostic；此為既有 dev diagnostics 行為，不作 production user-facing 語言缺口處理。
