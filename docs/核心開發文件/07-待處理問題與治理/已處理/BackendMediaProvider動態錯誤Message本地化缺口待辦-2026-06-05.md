# Backend Media Provider 動態錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend media provider HTTP / video task error、Web/Admin/App media generation visible error、backend i18n dynamic pattern
**取證代碼入口**：`backend/src/services/media-providers/base-media-provider.ts`、`backend/src/services/media-providers/seedance-video-provider.ts`、`backend/src/services/media-provider.service.ts`、`backend/src/controllers/media-provider.controller.ts`、`backend/src/routes/media-provider.routes.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend-admin/src/pages/Admin/Settings/index.tsx`、`frontend-admin/src/pages/Admin/Settings/MediaProviderSettingsCard.tsx`、`frontend-admin/src/services/api/admin.ts`
**最後核驗 Commit**：`8e267e6`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/services/media-providers/base-media-provider.ts` 與 `backend/src/services/media-providers/seedance-video-provider.ts` 仍有 provider-owned 中文動態錯誤 message 未被 `translateBackendMessage()` 完整覆蓋：

- `${this.displayName} 請求逾時`
- `${this.displayName} 請求過頻，請稍後再試`
- `${this.displayName} 服務異常 (${status})`
- `${this.displayName} 任務完成但未回傳影片 URL`
- `${this.displayName} 影像任務失敗${failure ? ...}`
- `${this.displayName} 任務輪詢逾時${lastError ? ...}`

這些錯誤會經 media generation / provider test API 返回 Web/Admin/App。當 request locale 為 `en-US` 時，未覆蓋的動態 provider error 仍可能直出繁中。

## 影響範圍

- Backend：media provider request wrapper、Seedance video task create / poll / failure path。
- Admin Web：Media provider test / config 管理流程。
- Web/App：媒體生成任務失敗、影片任務輪詢失敗、provider 超時或 429/5xx 錯誤提示。
- Shared/API client：只傳遞 backend message，不應端側猜測 provider 中文錯誤。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋 provider connection test、授權失敗、video-only/image-only、video task creation failure 與 missing URL/taskId，但尚未覆蓋 BaseMediaProvider 的 timeout/rate-limit/5xx，以及 Seedance poll 成功無影片 URL、任務失敗、輪詢逾時。這些 message 帶 provider displayName、HTTP status 或下游錯誤細節，需用受限 dynamic pattern 保留原始技術值。

## 目標行為

1. `en-US` locale 下，media provider 自有 HTTP / video task error 必須由 backend locale layer 輸出英文。
2. `zh-TW` locale 下，原繁中 canonical message 保持不變。
3. Provider displayName、HTTP status、影片 URL、taskId、API Key 等技術值不被本地化或誤改。
4. 下游錯誤 detail 若本身可被 backend i18n 覆蓋，應遞迴翻譯；未知 detail 保持原文，避免捏造。
5. Web/Admin/App/shared client 不新增端側中文錯誤翻譯表。

## 分析與方案

1. **業務邏輯輪**：BaseMediaProvider 封裝 HTTP timeout / status mapping；SeedanceVideoProvider 封裝影片任務建立、直接 asset、taskId 輪詢與 failure message。修復只補翻譯，不改 provider retry、poll interval、timeout、status 判斷或 payload candidates。
2. **i18n 資料流輪**：provider error 會以 AppError / generic Error 進入 error handler，再由 response formatter 按 `X-Locale` / `Accept-Language` 翻譯，因此應集中補 `translateDynamicBackendMessage()`。
3. **邊界輪**：新增 pattern 必須錨定 provider displayName 後的固定中文片段，避免泛化吞掉任意中文；帶 detail 的 pattern 需對 detail 呼叫 `translateBackendMessage('en-US', detail)`。
4. **UI/UX 輪**：英文錯誤需適合 toast / alert，描述下一步但不暴露過量內部資訊；rate-limit 使用 “please try again later”，timeout / 5xx 使用 provider service wording。
5. **維護性輪**：新增 backend i18n regression 與 focused static coverage scan，確保 provider dynamic message 不再漏翻。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，25 tests。
- Focused static coverage scan：比對 `base-media-provider.ts` / `seedance-video-provider.ts` 中文 provider error 是否被 backend i18n dynamic pattern 與 regression test 覆蓋：通過。
- `npm --prefix backend run build`：通過。
- `npm run docs:check`：待本輪文檔回寫後執行。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 provider timeout、rate-limit、5xx service error，以及 Seedance task completed without URL、task failure、task polling timeout dynamic pattern。
2. 帶 detail 的 Seedance task failure / polling timeout 會遞迴翻譯已知 backend message；未知下游 detail 保持原文。
3. Provider displayName、HTTP status、影片 URL、taskId、API Key 等技術值不被本地化或誤改。
4. `backend/tests/unit/utils/backend-i18n.test.ts` 已新增 provider HTTP / video task regression，包含 nested detail 不半翻譯案例。
5. 未改 provider retry、poll interval、timeout、status 判斷、payload candidates、media generation business flow 或 Web/Admin/App/shared client。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
