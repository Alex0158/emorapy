# 大檔服務拆分設計（可選，待後續觸發）

**日期**：2026-02-06  
**關聯**：[per-file-audit-20260206.md](per-file-audit-20260206.md) §5、§7  
**結論**：目前文檔接受 case.service / ai.service 行數現狀；本設計供「當檔案繼續膨脹或新增子域時」再決策使用。

---

## 1. 現狀

| 檔案 | 約略行數 | 公開方法 | 職責摘要 |
|------|----------|----------|----------|
| backend/src/services/case.service.ts | ~601 | 7 | 快速/完整創建、列表、提交、更新、詳情、依 Session 查詢 |
| backend/src/services/ai.service.ts | ~535 | 6 | 通用 generateText、案件類型、判決、摘要、和好方案、配額重置 |

兩檔邊界清晰、單一業務域，與 [global-audit-20260201](global-audit-20260201.md) 結論一致。

---

## 2. 建議觸發條件

- 單檔超過 **約 700 行**，或
- 新增明顯子域（例如案件「協作編輯」、AI「多輪對話」）導致職責變多時。

未達條件前可維持現狀，避免過早拆分增加維護成本。

---

## 3. case.service 可選拆分方案

**方案 A（按用例拆）**

- **CaseCreateService**：`createQuickCase`、`createCase`（Session/配對/驗證/AI 類型/標題）
- **CaseReadService**：`getCaseList`、`getCaseById`、`getCaseBySessionId`（查詢、權限、normalizeJudgment）
- **CaseUpdateService**：`submitCase`、`updateCase`

對外仍保留 **CaseService** 作為 facade，內部委派上述三類，控制器與路由不改。

**方案 B（維持單一 CaseService）**

- 僅在方法內按「段落註釋」分區（建立 / 查詢 / 更新），不新增檔案。

建議：未達觸發條件時採方案 B；達標後再考慮方案 A。

---

## 4. ai.service 可選拆分方案

**方案 A（按能力拆，共用底層）**

- **共用**：`generateText`、每日配額與 cache、`useMock`，保留於 AIService 或抽出 `AIBaseService`。
- **JudgmentAI**（或 AIService 內 private 區塊）：`generateJudgment`、`buildJudgmentPrompt`、`extractResponsibilityRatio`、`generateSummary`。
- **ReconciliationAI**：`generateReconciliationPlans` 及相關 prompt。
- **CaseTypeAI**：`detectCaseType`。

對外仍保留 **AIService** 為單一入口，內部委派上述能力；judgment.service / reconciliation.service 等呼叫方式不變。

**方案 B（維持單一 AIService）**

- 僅以區塊註釋區分：通用 / 案件類型 / 判決 / 和好方案 / 配額。

建議：未達觸發條件時採方案 B；達標後再考慮方案 A 或僅先拆出「和好方案」一類（體積最大）。

---

## 5. 依賴與風險

- **case.service** 依賴：sessionService、pairingService、aiService、fileService、ValidationUtils、normalizeJudgment、helpers。拆分後 facade 或各子服務需繼續使用同一批依賴，避免循環依賴。
- **ai.service** 依賴：openai、env、retry、cache、lock。若拆出子模組，子模組應依賴 AIService 或共用層的 generateText/配額，不直接依賴 openai 多份。

---

## 6. 小結

| 項目 | 建議 |
|------|------|
| 當前 | 不實施拆分，維持現有 case.service / ai.service 結構 |
| 觸發後 | 優先考慮 facade + 內部委派，再視需要拆檔案 |
| 記錄 | 本設計納入審計後續，需時可與 [per-file-audit-20260206.md](per-file-audit-20260206.md) 一併複查 |
