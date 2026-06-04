# Backend Repair Respond Plan Message 本地化缺口待辦（2026-06-05）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend reconciliation `respondPlan` success message、responseFormatter backend i18n、Web/App repair journey response display
**取證代碼入口**：`backend/src/controllers/reconciliation.controller.ts`、`backend/src/i18n/index.ts`、`backend/src/middleware/responseFormatter.ts`、`backend/tests/unit/utils/backend-i18n.test.ts`
**最後核驗 Commit**：`eae3b9d`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理
**Owner**：Backend / Shared
**關聯核心文件**：`04-共用機制/00-共用機制總覽.md`、`06-接口描述/05-reconciliation-execution.md`、`20-App端/01-App導航與平台Adapter基線.md`、`50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`

---

## 1. 問題

`backend/src/controllers/reconciliation.controller.ts` 的 `respondPlan()` 會根據 action 回傳 success `message`。其中 `declined`、`deferred`、`viewed` 三個分支使用後端中文文案：

1. `已記下你暫時不加入的選擇`
2. `已記下你需要一點時間`
3. `已同步你已查看這個邀請`

成功響應會經 `responseFormatter` 以 request locale 呼叫 `translateBackendMessage()`。但這三個文案未登記在 `backend/src/i18n/index.ts` 的 `directEnUSMap`，因此英文使用者在 `x-locale: en-US` 下仍會收到繁中 success message。

## 2. 影響

1. Web / App 若展示 API success toast 或狀態提示，會在英文介面混入繁中修復旅程文案。
2. 同一 controller 內 `committed` / `paused` / replan / resume 已有英文映射，但 partner response 三個 action 沒有，形成局部不一致。
3. 後續新增 backend-owned success message 若未同步測試，容易再次漏 map。

## 3. 目標

1. 補齊 `declined`、`deferred`、`viewed` 三個 response message 的 en-US 映射。
2. 保持 zh-TW 行為不變，由 `translateBackendMessage('zh-TW', message)` 原文返回。
3. 新增 focused unit test，直接覆蓋這三個 backend-owned repair journey response message。
4. 不改 `respondPlan()` 業務流程、不改 API schema、不改資料庫。

## 4. 邊界與注意事項

1. 本輪只修 backend response message localization，不處理 AI 生成的 plan 正文翻譯。
2. `responseFormatter` 已是統一成功響應翻譯入口；不應在 controller 手動依 locale 分支。
3. 對 App / Web 而言，這些 message 是 backend-owned display string；端側不應自行建立修復旅程 action 翻譯表覆蓋後端結果。

## 5. 驗收

```bash
npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand
npm --prefix backend run build -- --noEmit
npm run docs:check
```

## 6. 修復紀錄

2026-06-05 已修復：

1. `backend/src/i18n/index.ts` 補齊 `respondPlan(declined/deferred/viewed)` 三個 success message 的 en-US 映射。
2. `backend/tests/unit/utils/backend-i18n.test.ts` 新增 focused 測試，確保修復旅程回應 action 文案不再以繁中 fallback 暴露給英文 locale。
3. 核心文件補充：backend-owned repair journey success message 必須由 `responseFormatter` + `translateBackendMessage()` 統一翻譯，Web / App 不應端側覆蓋。

本輪已通過：

```bash
npm --prefix backend test -- tests/unit/utils/backend-i18n.test.ts --runInBand
npm --prefix backend run build -- --noEmit
```
