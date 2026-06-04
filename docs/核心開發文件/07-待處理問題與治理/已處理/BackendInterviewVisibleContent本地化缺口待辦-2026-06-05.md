# Backend Interview Visible Content 本地化缺口待辦（2026-06-05）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Interview seed question、personalized seed question、async pipeline feedback card、Web/App interview visible content display
**取證代碼入口**：`backend/src/controllers/interview.controller.ts`、`backend/src/services/interview.service.ts`、`backend/src/types/interview.types.ts`、`backend/src/services/interview-seed-question-loader.ts`、`backend/src/services/interview-seed-question-utils.ts`、`backend/src/services/async-pipeline-feedback-card.ts`、`backend/src/services/async-pipeline.service.ts`、`backend/src/services/async-pipeline-steps.ts`、`frontend/src/pages/Interview/Result/index.tsx`、`mobile/app/(app)/profile/interview.tsx`、`mobile/app/(app)/profile/story.tsx`
**最後核驗 Commit**：`d226766`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理
**Owner**：Backend / Shared / App
**關聯核心文件**：`04-共用機制/00-共用機制總覽.md`、`06-接口描述/06-interview-psych-profile.md`、`20-App端/01-App導航與平台Adapter基線.md`、`50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`

---

## 1. 問題

Interview flow 有多個 backend-owned visible content 會寫入資料後被 Web / App 原樣顯示，但原本未完整承接 request locale：

1. `InterviewController.startSession()` 未把 `req.locale` 傳入 `InterviewService.startSession()`。
2. `getSeedQuestion()` / `SEED_QUESTIONS` 只有繁中文案，第一輪 AI 問題會在英文介面直出繁中。
3. `buildPersonalizedSeedQuestion()` 固定用繁中句型包裝 seed insight hint。
4. `generatePipelineFeedbackCard()` 的 summary prompt、system prompt、fallback summary、encouragement、continuation hint 固定繁中；`feedback_card` 會被 Web `Interview/Result` 與 App `profile/story` 原樣顯示。
5. `endSession()` / `retryFailed()` 觸發 async pipeline 時未傳入 request locale，feedback generation 無法按使用者選定語言輸出。

## 2. 影響

1. 英文使用者開始訪談時，第一題可能是繁中。
2. 英文使用者完成訪談後，feedback card 可能混入繁中 summary / encouragement / continuation hint。
3. Web / App 都遵守「後端寫入內容原樣顯示」邊界，因此端側不能補救這類後端 stored visible content。

## 3. 目標

1. `startSession`、`endSession`、`retryFailed`、async pipeline process / resume 支援 BackendLocale 傳遞。
2. Seed question 與 personalized seed wrapper 支援 zh-TW / en-US。
3. Feedback card summary prompt、system prompt、richness description、domain label、fallback copy、encouragement、continuation hint 支援 zh-TW / en-US。
4. 既有 zh-TW 行為保持不變；en-US 不再使用繁中 backend-owned visible copy。
5. 補 focused backend unit tests。

## 4. 邊界與注意事項

1. 不翻譯使用者輸入、profile insight value、AI 已生成歷史資料；本輪只保證新寫入的 backend-owned visible content 按 request locale 生成。
2. 不新增 DB 欄位；pipeline 的 locale 由當次 request 傳入，無 request context 的背景 cleanup 仍回退 zh-TW。
3. Web / App 不建立端側 feedback card 翻譯表，繼續只顯示 backend 已產出的內容。

## 5. 驗收

```bash
npm --prefix backend test -- tests/unit/services/interview-seed-question-utils.test.ts tests/unit/services/interview-seed-question-loader.test.ts tests/unit/services/async-pipeline-feedback-card.test.ts tests/unit/services/async-pipeline-steps.test.ts tests/unit/services/interview.service.test.ts --runInBand
npm --prefix backend run build -- --noEmit
npm run docs:check
```

## 6. 修復紀錄

2026-06-05 已修復：

1. `InterviewController.startSession/endSession/retryFailed` 已傳入 request locale。
2. `InterviewService`、`AsyncPipelineService`、`runAsyncPipeline()`、`buildAsyncPipelineSteps()` 已把 locale 傳入 feedback generation。
3. `SEED_QUESTIONS`、`getSeedQuestion()`、`buildPersonalizedSeedQuestion()`、`loadPersonalizedInterviewSeedQuestion()` 已支援 `zh-TW` / `en-US`。
4. `generatePipelineFeedbackCard()` 的 prompt、system prompt、domain label、richness description、fallback summary、encouragement、continuation hint 已支援 `zh-TW` / `en-US`。
5. Focused tests 已覆蓋英文 seed wrapper、feedback fallback / prompt、pipeline locale propagation。

修復驗證：

```bash
npm --prefix backend test -- tests/unit/services/interview-seed-question-utils.test.ts tests/unit/services/interview-seed-question-loader.test.ts tests/unit/services/async-pipeline-feedback-card.test.ts tests/unit/services/async-pipeline-steps.test.ts tests/unit/services/interview.service.test.ts --runInBand
```
