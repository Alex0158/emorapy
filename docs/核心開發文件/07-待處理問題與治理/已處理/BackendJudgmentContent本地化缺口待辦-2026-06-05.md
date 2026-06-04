---
owner: backend
status: resolved
created_at: 2026-06-05
resolved_at: 2026-06-05
source: global-i18n-audit
---

# BackendJudgmentContent 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend judgment content / summary / emotional analysis 本地化缺口
**取證代碼入口**：`backend/src/services/ai.service.ts`、`backend/src/services/judgment.service.ts`、`backend/src/controllers/judgment.controller.ts`、`backend/tests/unit/services/ai.service.test.ts`、`backend/tests/unit/services/judgment.service.test.ts`、`frontend/src/pages/Judgment/Detail/index.tsx`、`mobile/app/(app)/case/index.tsx`、`mobile/app/(public)/quick/result.tsx`
**最後核驗 Commit**：`f05c239`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題

全局語言排查發現，判決生成入口雖然已由 `judgment.controller` 將 `req.locale` 傳入 `judgmentService.generateJudgment`，但服務層未把語言繼續傳給 `aiService.generateJudgment`。因此以下後端生成並持久化、且 Web/App 直接渲染的可見內容仍可能固定繁中：

- `judgment.judgment_content`
- `judgment.summary`
- `judgment.emotional_analysis` 內的可見描述欄位
- mock AI 模式下的判決內容與摘要

Web/App 的判決詳情、案件頁、快速結果頁會直接顯示這些欄位。前端不應也無法安全翻譯已生成的長文本，因此生成端必須依請求語言輸出。

## 目標

- 判決草稿、摘要、情感分析可見字串在新生成時依 `req.locale` 輸出。
- JSON 欄位名、枚舉值、結構化責任比例等機器契約不因語言切換而改變。
- 既有已持久化判決內容不做批量重寫，避免改寫歷史 AI 輸出。
- Web/App 繼續只渲染後端返回內容，不在展示層翻譯判決正文。

## 已處理方案

1. `judgmentService.generateJudgment` 會將 `options.locale ?? 'zh-TW'` 傳入 `aiService.analyzeEmotionalDynamics` 與 `aiService.generateJudgment`。
2. `aiService.analyzeEmotionalDynamics`、`generateJudgment`、`generateSummary` 已加入統一輸出語言要求：`en-US` 下用戶可見自然語言輸出必須為英文，JSON 欄位名、枚舉值與機器契約保持不變。
3. `emotionalAnalysis` cache key 納入 locale，避免英文請求命中繁中分析緩存。
4. mock AI 判決與摘要已按 locale 分流，`en-US` 本機開發版不再返回繁中可見判決內容。
5. Web/App 維持只顯示後端已生成判決內容，不端側翻譯已儲存長文本。

## 邊界與注意事項

- 不翻譯用戶原始輸入；AI 可引用或概括用戶輸入，但新生成的說明、標題、建議應遵守輸出語言。
- 不改動前端判決 Viewer 的渲染責任，因為正文是後端生成內容。
- 不修改歷史資料 migration。
- 安全、危機、分手方向等提示不能因本地化而被刪除或弱化。

## 驗收

- `en-US` 生成鏈路的 AI prompt 明確要求英文可見輸出。
- mock AI 模式下 `en-US` 判決正文與摘要為英文。
- `npm --prefix backend test -- tests/unit/services/ai.service.test.ts tests/unit/services/judgment.service.test.ts tests/unit/controllers/judgment.controller.test.ts --runInBand --forceExit` 通過，3 suites / 112 tests。
- `npm --prefix backend run build -- --noEmit` 通過。
