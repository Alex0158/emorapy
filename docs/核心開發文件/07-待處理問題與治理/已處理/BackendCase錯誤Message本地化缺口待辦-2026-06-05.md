# Backend Case 錯誤 Message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend quick/formal/collaborative case API 錯誤訊息、Web Case flow error 顯示、App Case flow error 顯示、backend i18n message map
**取證代碼入口**：`backend/src/services/case.service.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/errorHandler.ts`、`backend/src/middleware/responseFormatter.ts`、`frontend/src/pages/Case`、`mobile/app/(app)/case`、`mobile/app/(public)/quick`
**最後核驗 Commit**：`f1d0c2f`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/services/case.service.ts` 的 quick case、formal case、case submit / update / access 與 collaborative case flow 仍有多個 backend-owned 中文錯誤 message 未被 `translateBackendMessage()` 覆蓋，例如：

- `Session創建失敗`
- `案件創建失敗，請稍後再試`
- `配對關係未激活`
- `無權限訪問此配對`
- `正式案件 mode 只能是 remote 或 collaborative`
- `協作模式需同時提供雙方陳述`
- `無權限提交此案件`
- `遠程/協作模式需等待回應方陳述後才能提交`
- `協作案件不存在`
- `Session 不匹配`
- `角色A陳述不能為空`

這些錯誤會經 `errorHandler` / `responseFormatter` 進入 API error payload；Web Case flow 與 App Case / Quick flow 會把 backend error message 顯示給使用者。當 request locale 為 `en-US` 時，目前未覆蓋的 case service fallback message 仍可能直出中文。

## 影響範圍

- Backend：quick case、formal case、collaborative case、case submit / update / detail API error payload。
- Web：Case create、submit、update、detail、quick result / formal flow 顯示 backend error。
- App：Case screen、Quick flow、collaborative case flow 顯示 backend error。
- Shared/API client：沿用 backend `error.message`，不應在端側另建中文 message 翻譯表。

## 目前語言處理缺口

`backend/src/i18n/index.ts` 已覆蓋共用 `案件不存在`、`案件已提交` 等成功 / 通用 message，但 case service 自有 pairing permission、case mode validation、submit/update permission 與 collaborative case fallback message 未全量覆蓋。

## 目標行為

1. `zh-TW` locale 下保持既有 case service canonical message，不改 case access、session-bound case、pairing 或 collaborative case 業務行為。
2. `en-US` locale 下，case service error message 必須翻譯為英文。
3. `Session`、`mode`、`remote`、`collaborative`、`角色A` 等技術或流程語義不被誤改；internal enum value 保持原樣。
4. 修復集中在 backend i18n 層，Web/App/shared client 不新增 ad hoc 中文 message 對照表。

## 修復結果

1. `backend/src/i18n/index.ts` 已補齊 case service quick/formal/collaborative case、pairing permission、submit/update/detail fallback error 的 en-US exact map。
2. `Session`、`mode`、`remote`、`collaborative`、`角色A` 等技術或流程語義保留，internal enum value 不被本地化。
3. Case access、session-bound case、pairing、submit/update 與 collaborative case 業務行為不變。
4. Web/App/shared client 不新增端側中文錯誤翻譯表，仍統一消費 backend locale layer。

## 驗證方式

- `npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand`：通過，19 tests。
- `npm --prefix backend run build`：通過。
- 靜態比對 `backend/src/services/case.service.ts` 的 backend-owned 中文 message 是否已被 backend i18n map 覆蓋：通過。
- `npm run docs:check`：通過。

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。
