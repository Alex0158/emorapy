# Backend Feature Flags Config 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend Admin managed config feature.flags validation error、Admin Settings visible error、backend i18n dynamic pattern
**取證代碼入口**：`backend/src/services/admin-config-rules.ts`、`backend/src/controllers/admin.controller.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend-admin/src/pages/Admin/Settings/index.tsx`、`frontend-admin/src/services/api/admin.ts`
**最後核驗 Commit**：`54dba22`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/services/admin-config-rules.ts` 的 `normalizeFeatureFlags()` 仍有 Admin 可見的中文動態錯誤 message 未被 `translateBackendMessage()` 完整覆蓋：

- `feature.flags key 長度不可超過 80: ${key}`
- `feature.flags key 格式不合法: ${key}`
- `feature.flags.${key} 只允許 string/number/boolean`

這些錯誤會在 Admin Settings 保存 `feature.flags` 配置時經 backend response message 顯示。當 Admin locale 為 `en-US` 時，未覆蓋的動態校驗錯誤仍可能直出繁中。

## 影響範圍

- Backend：Admin managed config `feature.flags` validation。
- Admin Web：Settings feature flags config 保存失敗 toast / alert。
- Shared/API client：只傳遞 backend message，不應新增端側中文錯誤對照。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋 `feature.flags 必須為 object`、`keys 不可超過 200`、`key 不可為空字串`，但未覆蓋 key 長度、key 格式與 value type 三條動態錯誤。這些 message 帶 feature flag key，需保留 key 原文。

## 目標行為

1. `en-US` locale 下，feature flags 動態 validation error 必須由 backend locale layer 輸出英文。
2. `zh-TW` locale 下，原繁中 canonical message 保持不變。
3. `feature.flags`、flag key、`string/number/boolean` 等技術值不被本地化或誤改。
4. 不改 feature flag key 規則、數量上限、value type 規則或 Admin Settings 操作流程。

## 分析與方案

1. **業務邏輯輪**：`normalizeFeatureFlags()` 只接受 object、最多 200 keys、key 非空、長度 <= 80、格式 `/^[a-zA-Z][a-zA-Z0-9_.-]*$/`、value 僅 string/number/boolean。修復只補翻譯，不改規則。
2. **i18n 資料流輪**：Admin Settings 保存經 admin API 返回 backend message，應集中由 backend locale layer 翻譯。
3. **邊界輪**：dynamic pattern 必須限制 key 字元，保留非法 key 原文但不吞掉任意中文；value type message 要保留 `feature.flags.${key}` 路徑。
4. **UI/UX 輪**：英文錯誤需可直接用於 Admin toast / form error，清楚指出 key 長度、格式或 value type。
5. **維護性輪**：新增 backend i18n regression 與 focused static coverage scan。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，25 tests。
- Focused static coverage scan：比對 `admin-config-rules.ts` 的 feature flags 中文 dynamic error 是否被 backend i18n exact / dynamic map 覆蓋：通過。
- `npm --prefix backend run build`：通過。
- `npm run docs:check`：待本輪文檔回寫後執行。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 feature flag key length、key format、value type 三條 dynamic pattern。
2. `backend/tests/unit/utils/backend-i18n.test.ts` 已新增 Admin managed config feature flags regression。
3. `feature.flags`、flag key、`string/number/boolean` 保持技術值原樣，不被本地化或改寫。
4. 未改 feature flag key 規則、數量上限、value type 規則、Admin Settings 保存流程或 Admin API client。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
