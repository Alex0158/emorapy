# Web Pending Tasks Completion Audit（2026-05-14）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據文檔
**來源時間**：2026-05-14
**上下文**：Web / Admin 相關待處理任務、prompt-to-artifact 完成審計、外部證據 blocker
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-16`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v2.0
**最後更新**：2026-05-16
**對應範圍**：`docs/核心開發文件/07-待處理問題與治理/已處理/Web全量A11Y與ScreenReader外部證據缺口待辦-2026-05-11.md`、`docs/核心開發文件/07-待處理問題與治理/已處理/AI請求Ledger與Notification狀態Schema同步待辦-2026-05-04.md`、`scripts/check-web-pending-completion-audit.mjs`、`scripts/check-web-pending-completion-audit-contract.mjs`、`scripts/check-web-a11y-manual-evidence.mjs`、`scripts/generate-web-a11y-manual-evidence.mjs`、`backend/scripts/check-ai-pricing-catalog.ts`、`backend/scripts/check-release-db-parity.ts`、`package.json`、`docs/核心開發文件/90-證據與盤點/環境與發版驗證/README.md`

本文件把「處理所有 Web 版相關待處理任務」拆成可核驗 checklist。2026-05-16 已取得正式 A11Y manual pass artifact、AI pricing release pass artifact 與 release DB parity pass artifact；strict completion gate 已通過，兩個 Web / Admin 相關待辦已移入 `已處理/`。

完成 handoff JSON 見 [./Web-Pending-Tasks-Handoff-2026-05-14.json](./Web-Pending-Tasks-Handoff-2026-05-14.json)。該 handoff 現在只列正式 completion artifacts 與 non-claims，不保存 secrets。

## 0. Gate 入口

| 命令 | 用途 | 完成口徑 |
| --- | --- | --- |
| `npm run web:pending:completion:audit` | non-strict Web 相關待辦 completion audit | 通過並輸出 `complete=true`，同時驗證 handoff JSON 的 `status=complete`、`complete=true` 與 completion artifacts |
| `npm run web:pending:completion:audit:strict` | strict 完成 gate | 已通過；正式 `Web-A11Y-Manual-*.json` pass artifact 與 `AI-Pricing-Release-Env-*.json` release pass artifact 都存在且符合最低結構 |
| `npm run web:pending:completion:audit -- --json` | 結構化 audit record | 輸出 `blocker_ids`、candidate artifacts、required files 與 completion boolean |
| `npm run web:pending:completion:audit:contract` | audit contract gate | 驗證 non-strict JSON schema、checked files、handoff path、completion artifacts，以及 strict gate 在完成後必須為 zero |

該 gate 不替代 `npm run web:a11y:manual-evidence:check`、`npm --prefix backend run ops:ai-pricing:check` 或 release DB evidence runner；它只阻止兩個 Web 相關待辦在缺正式 artifact 時被誤判完成。AI pricing release pass artifact 可從 [./AI-Pricing-Release-Env-Pass-Template.json](./AI-Pricing-Release-Env-Pass-Template.json) 複製產生，但 Template 本身被 gate 排除，不能當作 pass candidate。

## 1. Audit 目標

目標拆解為以下交付：

1. 找出所有仍在 `待處理/` 且與 Web / Admin Web 有關的任務。
2. 逐項驗證問題是否真存在，不接受過期描述或只靠待辦標題。
3. 若問題存在，對照現有代碼、核心文件與業務鏈路做至少五輪不同角度方案分析。
4. 可由 repo 內工程解決的部分必須落地修復、補 gate、補測試或補 runbook。
5. 修復後至少兩輪檢查是否偏離問題重心、是否引入新阻塞。
6. 核心文件與證據索引必須同步回寫。
7. 完成判定必須依賴真實 artifact / gate / command output，不能用 proxy signal 替代外部證據。

## 2. 任務範圍裁決

2026-05-14 復核 `docs/核心開發文件/07-待處理問題與治理/待處理/` 後，活躍文件共 4 份：

| 文件 | 是否 Web 相關 | 裁決 |
| --- | --- | --- |
| `Web全量A11Y與ScreenReader外部證據缺口待辦-2026-05-11.md` | 是 | Web / Admin A11Y 外部證據 blocker |
| `AI請求Ledger與Notification狀態Schema同步待辦-2026-05-04.md` | 是，廣義 Admin Web / release governance | Admin costs / pricing / release DB evidence blocker，不是純前台 UI bug |
| `App跨端Parity落地待辦-2026-05-05.md` | 否，App 為主 | 只含 Web 配合段落，不作本輪 Web 待辦完成對象 |
| `已知風險清單-2026-03-17.md` | 否，風險口徑 | `R-01` 是 provider-level release note / SLA 風險，不是 Web UI / Admin UI 待修任務 |

因此本 audit 的直接處理對象為 2 份。

## 3. Prompt-to-artifact checklist

| 要求 | 對應證據 | 狀態 | 不可替代項 |
| --- | --- | --- | --- |
| 找出所有 Web 相關待辦 | `find docs/核心開發文件/07-待處理問題與治理/待處理 -maxdepth 1 -type f`、本文件第 2 節 | 已完成 | 不能把 App parity 或一般風險清單誤算為 Web 待修代碼 |
| 驗證 A11Y 問題真存在 | `npm run web:a11y:manual-evidence:check` 已對 `Web-A11Y-Manual-2026-05-16T06-14-43-528Z.json` strict passed；歷史 blocker artifact `Web-A11Y-Manual-Preflight-Blocked-2026-05-12T19-45-00+08-00.json` | 已驗證並完成 | 模板、runbook、automated axe pass、blocked artifact 不能替代 manual pass artifact；正式 artifact 已補齊 |
| A11Y 五輪方案分析 | `Web全量A11Y...` 第 3.1 節產品 / 工程 / QA / 發版 / 業務五輪分析 | 已完成 | 不得把 route-level axe 命名為全量 WCAG / screen reader 驗收 |
| A11Y 工程可修部分 | `scripts/check-web-a11y-manual-evidence.mjs`、`Web-A11Y-Manual-Evidence-Template.json`、`Web-A11Y-Manual-Evidence-Runbook-2026-05-12.md`、`README.md` | 已落地 | 已補 `scripts/generate-web-a11y-manual-evidence.mjs` 與正式 manual evidence artifact |
| A11Y 修後兩輪檢查 | strict gate 補強 `interactive_surfaces`；runbook / README / 測試基線回寫；`docs:check` 與 `git diff --check` | 已完成本地可檢查部分 | 正式 pass artifact 已取得，待辦已移入已處理 |
| 驗證 AI pricing / Admin costs 問題真存在 | Railway production `ops:ai-pricing:check` 已通過；歷史 blocker artifact `AI-Pricing-Release-Env-Blocked-2026-05-12T14-38-24Z.json` | 已驗證並完成 | 本機 `.env`、AI mock、organization-level usage API 不能替代 release pricing env；production env 已補齊 |
| AI pricing 五輪方案分析 | `AI請求Ledger...` 的業務成本 / Admin Web / Release Ops / DB Parity / 對外聲明五輪分析 | 已完成 | Admin Web 不補價格、不假分攤 OpenAI org usage |
| AI pricing 工程可修部分 | `backend/scripts/check-ai-pricing-catalog.ts`、`ops:ai-pricing:check`、`ops:release:gate`、`AI-Pricing-Release-Env-Runbook-2026-05-12.md`、`AI-Pricing-Release-Env-Pass-Template.json`、03 管理端治理文件引用 | 已落地 | Railway production env 配置、user-authorized pricing approval 與 non-local DB evidence 已完成 |
| AI pricing 修後兩輪檢查 | focused backend tests、`docs:check`、`git diff --check`、release env blocker artifact / runbook / README 回寫 | 已完成本地可檢查部分 | `ops:release-db:evidence` 已產出 14/14 pass artifact |
| 核心文件同步 | `07-待處理...`、`03-管理端與平台治理/01-環境與部署基線.md`、`03-管理端與平台治理/05-運維連接與調用Runbook.md`、`08-測試規範與驗收/05-可訪問性本地化驗收基線.md`、`90-證據.../README.md` | 已回寫 | 外部 pass evidence 已取得，待辦狀態已回寫 |
| completion audit gate | `scripts/check-web-pending-completion-audit.mjs`、`scripts/check-web-pending-completion-audit-contract.mjs`、`npm run web:pending:completion:audit`、`npm run web:pending:completion:audit:strict`、`npm run web:pending:completion:audit:contract` | 已建立；strict 與 contract gate 均通過 | non-strict audit 仍需搭配正式 artifacts 解讀 |
| external handoff | `Web-Pending-Tasks-Handoff-2026-05-14.json`、`scripts/check-web-pending-completion-audit.mjs` handoff validator | 已更新為 complete 並納入 audit gate | handoff 指向 pass evidence，不保存 secrets |
| 完成判定 | 本文件第 6 節 | 已完成 | 仍保留 non-claims，不宣稱 WCAG 2.2 AA 或保存 raw secrets |

## 4. 當前完成度

| 任務 | 本地工程 / 文檔處理 | 發版或外部證據狀態 | 完成裁決 |
| --- | --- | --- | --- |
| Web / Admin A11Y | automated baseline、manual evidence schema、interactive surface strict gate、runbook、證據索引已完成 | `Web-A11Y-Manual-2026-05-16T06-14-43-528Z.json` strict passed | 已完成 |
| AI request ledger / Admin costs pricing | ledger / Admin costs / pricing validator / release gate / runbook / 治理正文已完成 | Railway production pricing gate passed；release DB parity 14/14 passed；formal pass artifact 已保存 | 已完成 |

## 5. 最近核驗命令

| 命令 | 結果 | 覆蓋 |
| --- | --- | --- |
| `npm run docs:check` | passed | 核心文件結構、truth、path-reference、metadata 與正式台賬一致性 |
| `git diff --check` | passed | 目前 diff 無 whitespace / patch 格式錯誤 |
| `npm run web:pending:completion:audit` | passed，輸出 `complete=true` | Web 相關待辦 completion audit |
| `npm run web:pending:completion:audit:strict` | passed | 正式 artifact 完成 gate |
| `npm run web:pending:completion:audit:contract` | passed | 驗證 audit JSON / strict exit-code / completion artifact contract |
| `npm run web:a11y:manual-evidence:template:check` | passed | manual evidence 模板 schema 可解析 |
| `npm run web:a11y:manual-evidence:check` | passed | 正式 Web A11Y manual evidence strict gate |
| `railway run -e production -s mother-bear-court -- npm --prefix . run ops:ai-pricing:check` | passed | Railway production pricing release env gate
| `npm --prefix backend run ops:release-db:evidence` | passed，產出 `App-Release-DB-Parity-2026-05-16T06-01-03-039Z.json` | non-local release DB parity evidence |
| `npm --prefix backend test -- --runInBand tests/unit/services/ai-cost-pricing.service.test.ts tests/unit/scripts/check-ai-pricing-catalog.test.ts tests/unit/services/cost-monitoring.service.test.ts` | passed，3 suites / 17 tests | pricing catalog validator 與 Admin costs ledger breakdown |

## 6. 完成判定

本 audit 判定：**已完成**。

完成依據：

1. `Web-A11Y-Manual-2026-05-16T06-14-43-528Z.json` 已存在，`npm run web:a11y:manual-evidence:check` strict mode 通過。
2. Railway production `AI_COST_PRICING_JSON` 已配置，`railway run -e production -s mother-bear-court -- npm --prefix . run ops:ai-pricing:check` 通過。
3. `App-Release-DB-Parity-2026-05-16T06-01-03-039Z.json` 回報 `ok=true`、`appliedRequiredMigrationCount=14/14`。
4. `AI-Pricing-Release-Env-production-2026-05-16T06-16-01Z.json` 已保存正式 release pass evidence，且不保存 API key、DB URL、raw env 或 DB host。
5. `npm run web:pending:completion:audit:strict` 已通過，兩個 Web / Admin 相關待辦已移入 `已處理/`。

仍保留的 non-claims：不得宣稱 WCAG 2.2 AA、完整 screen reader 覆蓋、完整全狀態矩陣；不得把 artifact 當作 raw pricing values 或 secret 存放位置。
