# Backend Judgment 錯誤 Message 本地化與術語缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend judgment generation / detail / repair / metrics API 錯誤訊息、Web/App 梳理結果 error 顯示、backend i18n message map
**取證代碼入口**：`backend/src/services/judgment.service.ts`、`backend/src/controllers/judgment.controller.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend/src/pages/Judgment`、`mobile/app/(app)/case`
**最後核驗 Commit**：`90d90ca`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/services/judgment.service.ts` 的梳理結果生成、詳情、修復回應與臨床品質指標 flow 仍有多個 backend-owned 中文錯誤 message 未被 `translateBackendMessage()` 覆蓋，例如：

- `無權限生成判決`
- `請稍後再重試生成判決`
- `判決不存在`
- `無權限修復此判決`
- `無權限提交此判決指標`
- `無權限訪問此判決`
- `判決生成失敗，請點擊重試`
- `責任分比例必須為非負且總和 100`
- `回饋內容過短`

這些錯誤會經 `errorHandler` / `responseFormatter` 進入 API error payload；Web / App 梳理結果頁與修復回應 flow 會把 backend error message 顯示給使用者。當 request locale 為 `en-US` 時，目前未覆蓋的 judgment service fallback message 仍可能直出中文。同時，部分繁中 source message 仍沿用舊對外術語「判決」，即使 `zh-TW` locale 也會顯示不符合現行術語治理的文案。

## 影響範圍

- Backend：judgment generation、judgment detail、repair response、clinical metrics API error payload。
- Web：Judgment detail、repair response、case detail / retry flow 顯示 backend error。
- App：Case / 梳理結果詳情、repair response、retry flow 顯示 backend error。
- Shared/API client：沿用 backend `error.message`，不應在端側另建中文 message 翻譯表。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋部分 judgment response message 與 AI stream failure fallback，但 judgment service 自有 permission / retry / ratio / repair / metrics fallback message 未全量覆蓋。繁中 canonical message 也仍有「生成判決 / 此判決 / 訪問此判決」等舊詞。

## 目標行為

1. `zh-TW` locale 下，user-facing error 使用現行術語「梳理結果」，不再顯示「生成判決 / 此判決 / 訪問此判決」。
2. `en-US` locale 下，judgment service error message 必須翻譯為英文，且使用 `Analysis` 對應梳理結果。
3. `AI`、`Session`、責任分比例與 clinical metrics 欄位語義不被誤改。
4. 修復集中在 backend i18n / canonical message 層，Web/App/shared client 不新增 ad hoc 中文 message 對照表。

## 修復結果

1. `backend/src/services/judgment.service.ts` 已將 judgment generation / detail / repair / metrics user-facing error 的繁中 canonical message 收斂為「梳理結果」術語。
2. `backend/src/i18n/index.ts` 已補齊 judgment service permission、retry、ratio validation、repair feedback、metrics 與 AI fallback error 的 en-US exact message map。
3. `AI`、`Session`、責任分比例與 clinical metrics 語義保留，不改 service 行為、資料模型或內部 domain 命名。
4. Web/App/shared client 不新增端側中文錯誤翻譯表，仍統一消費 backend locale layer。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，18 tests。
- `npm --prefix backend run build`：通過。
- `rg -n "無權限生成判決|重試生成判決|判決不存在|此判決|訪問此判決|操作此判決|判決生成失敗，請點擊重試" backend/src/services/judgment.service.ts`：無殘留。
- `npm run docs:check`：通過。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
