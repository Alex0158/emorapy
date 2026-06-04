# Backend Media Provider 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend media provider API 錯誤訊息、Admin Web provider 測試/生成錯誤顯示、backend i18n message map
**取證代碼入口**：`backend/src/services/media-provider.service.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`
**最後核驗 Commit**：`de6c983`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/services/media-provider.service.ts` 的 provider catalog、provider type、registry implementation 與 API Key 缺失錯誤仍以中文 canonical message 拋出：

- `Provider catalog 不存在`
- `Provider {displayName} 不支援圖片生成`
- `Provider {displayName} 不支援影片生成`
- `Provider 實作尚未部署：{providerKey}`
- `不支援的 providerKey`
- `{displayName} 缺少 API Key，請先以 system config 寫入 {configKey} 或於測試輸入中提供 apiKey`

這些錯誤會經 `errorHandler` / `responseFormatter` 外顯到 Admin Web 的 provider 測試、估價、圖片生成與影片生成流程；當 request locale 為 `en-US` 時，目前 `translateBackendMessage()` 只覆蓋連線測試成功/失敗等 provider result message，沒有覆蓋上述 service-level error message，因此英文使用者仍可能看到中文錯誤。

## 影響範圍

- Backend：media provider API error payload。
- Admin Web：provider catalog/test/generate 操作失敗時顯示 API error message。
- Shared/API client：沿用 backend `message`，不應在前端另建二次翻譯表。
- Web/App：目前不直接操作 media provider 管理端點，但同一 backend i18n 規則需保持一致。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已有 provider 連線測試與生成 provider result 的 dynamic message translator，但缺少 service-level media provider 錯誤的 exact/dynamic mapping。這使 `en-US` request locale 下的錯誤 fallback 回原中文 message。

## 目標行為

1. `zh-TW` locale 下保持既有中文 canonical message，不改現有錯誤語義與錯誤碼。
2. `en-US` locale 下，media provider service-level error message 必須翻譯為英文。
3. provider display name、providerKey、system config key、`apiKey` 等技術識別字必須原樣保留，不本地化。
4. 修復應集中在 backend i18n 層，避免 Admin Web / Web / App 建立 ad hoc API message 對照表。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 media provider service-level exact message：
   - `Provider catalog 不存在`
   - `不支援的 providerKey`
2. `translateDynamicBackendMessage()` 已補齊 provider type、registry implementation 與 API Key 缺失的 dynamic pattern：
   - `Provider {displayName} 不支援圖片生成`
   - `Provider {displayName} 不支援影片生成`
   - `Provider 實作尚未部署：{providerKey}`
   - `{displayName} 缺少 API Key，請先以 system config 寫入 {configKey} 或於測試輸入中提供 apiKey`
3. provider display name、providerKey、system config key 與 `apiKey` 保持原樣，不被本地化。
4. Admin Web / Web / App 不新增端側 API message 翻譯表，仍統一消費 backend locale layer 輸出的 response message。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，9 tests。
- `npm --prefix backend run build`：通過。
- `npm run docs:check`：通過。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
