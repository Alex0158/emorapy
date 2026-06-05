# AIRequestLedger Metadata 白名單待補待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：AI request ledger metadata 最小化、prompt 原文防保存、資料治理與 RTM 證據口徑
**取證代碼入口**：`backend/prisma/schema.prisma`、`backend/src/services/ai-request-ledger.service.ts`、`backend/src/services/ai.service.ts`、`backend/src/services/chat-ai-orchestrator.service.ts`、`backend/src/services/interview-ai-response-consumer.ts`、`backend/tests/unit/services/ai-request-ledger.service.test.ts`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 現狀

`backend/prisma/schema.prisma` 的 `AIRequestLedger` 沒有 prompt / content 類欄位。現有主要 callers 也只傳 `prompt_chars`、stream、max_tokens、temperature、request kind、prompt version、parent request id、strategy、route 等衍生資料或分類標籤；目前未看到 caller 把 prompt 原文、完整聊天文本或可直接重建私密敘事的內容寫入 ledger metadata。

但 `backend/src/services/ai-request-ledger.service.ts` 的 `metadata` 是 `Record<string, unknown>`，`sanitizeMetadata()` 只做 JSON serialization。它會丟掉 `undefined`、保證可 JSON 化，但不限制 key，不移除 `prompt` / `messages` / `chat_text` 類敏感字段，也不阻止 caller 傳入完整文本。

## 代碼依據

- `backend/prisma/schema.prisma`：`AIRequestLedger` 有 `metadata Json?`，無 prompt / content 欄位。
- `backend/src/services/ai-request-ledger.service.ts`：`AIRequestLedgerStartInput.metadata` 與 `finish()` metadata 都可接收任意 JSON；`sanitizeMetadata()` 沒有白名單或敏感 key redaction。
- `backend/src/services/ai.service.ts`、`backend/src/services/interview-ai-response-consumer.ts`、`backend/src/services/chat-ai-orchestrator.service.ts`：現有 ledger metadata 以 `prompt_chars`、stream、request kind、strategy 等衍生資料為主，未把 prompt 原文傳入 metadata。
- `backend/tests/unit/services/ai-request-ledger.service.test.ts`：現有測試可證明 metadata JSON sanitize 與 pricing metadata 合併，不能證明 service 會拒收或移除 prompt / full text。

## 文件偏差

`04-共用機制/03-AI風險與安全治理基線.md` 與 `04-共用機制/04-資料治理與隱私風險基線.md` 曾把 AI ledger 描述為「不保存 prompt 原文」或把 `AIRequestLedgerService` 寫成不保存 prompt。這對「schema + 現有 callers」是準確的，但對 service contract 過強：service 本身仍會保存 caller 傳入的任意 metadata。

正式文件應改成分層口徑：現有 callers 已遵守 no-prompt metadata 最小化；service-level metadata 白名單 / redaction gate 尚未落地。

## 目標狀態

1. 為 `AIRequestLedgerService` 定義 metadata allowlist，至少固定允許的 key、value 類型與最大大小。
2. 對 prompt / messages / full chat text / narrative content / system prompt 類 key 或可疑值做拒收、移除或 fail-safe sanitize，並補 regression tests。
3. 新增 caller 時，必須能通過 ledger metadata guard；不能只靠人工 caller review。
4. 完成後回寫 AI 風險基線、資料治理基線、RTM 與文件收斂台賬，把本待辦移入 `已處理/`。

## 需要修改的文件

- `backend/src/services/ai-request-ledger.service.ts`
- `backend/tests/unit/services/ai-request-ledger.service.test.ts`
- `docs/核心開發文件/04-共用機制/03-AI風險與安全治理基線.md`
- `docs/核心開發文件/04-共用機制/04-資料治理與隱私風險基線.md`
- `docs/核心開發文件/08-測試規範與驗收/04-需求驗證矩陣.md`
- `docs/核心開發文件/文件收斂/03-CJ-核心開發文件逐文件代碼校驗總台賬-2026-04-18.md`

## 驗證命令

```bash
npm --prefix backend test -- --runTestsByPath tests/unit/services/ai-request-ledger.service.test.ts
npm run docs:check
git diff --check
```

## Owner / Status

- Owner：Backend / AI governance / Data governance
- Status：待處理
- Notes：這不是現有 caller 已洩露 prompt 的證據；目前偏差是正式文件把 caller-level 事實寫成 service-level 強保證。補 gate 前只能宣稱 schema / current callers no-prompt 已核對。
