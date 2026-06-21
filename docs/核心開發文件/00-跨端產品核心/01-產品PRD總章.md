# 產品 PRD 總章

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：跨端PRD
**覆蓋範圍**：Emorapy 通用級產品意圖、需求編碼、四條主線、範圍邊界與平台分層規則
**取證代碼入口**：`backend/src/routes`、`backend/prisma/schema.prisma`、`frontend/src/router/index.tsx`、`frontend-admin/src/router.tsx`、`mobile/app`、`mobile/src/platform`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 定位

本文是 Emorapy 的通用級 PRD 入口，回答「為什麼做、給誰做、做成什麼、哪些不做」。它不替代功能、頁面、接口、流程或測試文檔；它為那些文檔提供上游產品依據。

分層固定如下：

| 層級 | 定義 | 承接位置 |
| --- | --- | --- |
| 通用級 | Web / App 共同成立的用戶問題、產品目標、需求與成功指標 | `00-跨端產品核心/` |
| Web級 | 主站 Web / Admin Web 如何承載通用產品需求 | `10-Web端/`、根層頁面/API/流程文檔 |
| App級 | App 如何承載通用產品需求，以及 SecureStore / Push / Deep Link / upload 等原生差異 | `20-App端/`、`50-跨端Mapping與Parity/` |
| 共用機制級 | 信任安全、AI 可靠性、隱私、性能、可觀測性、共享契約 | `04-共用機制/`、`05-工程架構與共享層/` |
| 驗收級 | 需求到功能、流程、API、頁面、測試與證據的追溯 | `08-測試規範與驗收/`、`測試/`、`90-證據與盤點/` |

任何平台投影文件不得重新定義通用級需求；若 Web 或 App 平台限制導致語義差異，必須回到 Parity 文件記錄為平台差異或待裁決項。

## 2. 產品一句話

Emorapy 是面向親密關係衝突的 AI 關係梳理與修復工具。它把反覆爭執從情緒對撞，轉成可提交、可分析、可回看、可行動的結構化流程，並在高風險情境下優先走安全與保護邏輯。

這裡的「AI 關係梳理」不是臨床治療、法律裁決或危機干預服務。內部代碼仍可能使用 `judgment`、`case` 等歷史命名；對外產品語義應以「梳理結果」「這件事」「修復旅程」等低對抗表述為準。

## 3. 目標用戶與核心問題

| 用戶 / 主體 | 核心問題 | Emorapy 應提供的結果 |
| --- | --- | --- |
| 未登入訪客 | 想低門檻試一次，不確定是否要建立帳號或正式處理 | 可匿名完成一次 quick flow，得到可理解的梳理結果，並可在登入後升格 |
| 登入用戶 | 想和伴侶正式處理一件反覆爭執的事 | 可完成配對、正式提交、梳理結果、修復方案與執行追蹤 |
| 雙方當事人 | 各自敘事衝突，缺少第三方結構化框架 | 雙方視角都能被保留，授權與資料歸屬由 backend 裁決 |
| 高頻溝通用戶 | 不想先填表，想先把話說清楚 | 可先聊天，再在明確觸發時轉為 case / judgment 材料 |
| 需要長期個性化的用戶 | 想讓系統理解自身、關係背景與互動模式 | 可通過訪談、個人檔案與關係檔案形成可回用上下文 |
| 平台運維者 | 需要治理 AI 成本、安全風險、異步任務、發布狀態 | 可通過 Admin / health / metrics / ledger / release gate 追溯平台狀態 |

## 4. 通用級需求主線

| PRD ID | 主線 | 通用級需求 | 現有承接 |
| --- | --- | --- | --- |
| EMO-PRD-COM-001 | 快速判斷 | 用戶無需登入即可提交一次低門檻衝突材料，獲得可回訪、可升格的梳理結果 | F01 / F02、P01 |
| EMO-PRD-COM-002 | 正式處理 | 登入用戶可基於配對與正式資料歸屬，完成案件、梳理結果、修復方案與執行追蹤 | F03 / F04 / F05 / F08 / F09、P02 |
| EMO-PRD-COM-003 | 先聊再判 | 用戶可先建立聊天語境，只有在明確請求時才把對話材料轉入梳理結果生成 | F07 / F04、P04 |
| EMO-PRD-COM-004 | 讓系統更懂你 | 用戶可選擇提供訪談、個人與關係背景，讓後續梳理更貼近關係脈絡 | F06 / F08 / F09、P03 |
| EMO-PRD-COM-005 | 平台治理 | 平台必須能治理身份、AI 成本、通知、異步狀態、發布版本與高風險鏈路 | F10 / P05 |

`F01-F10` 是工程功能分層；`P01-P05` 是流程分層；`EMO-PRD-*` 是產品需求上游。三者不互相替代。

## 5. In Scope

通用級產品範圍包括：

1. 匿名 quick flow、session 恢復與登入後 claim。
2. 登入、配對、正式案件、梳理結果、修復方案與執行追蹤。
3. Chat room、邀請、消息與 chat -> judgment handoff。
4. 心理訪談、個人檔案、關係檔案與後續上下文使用。
5. 通知、內容、AI stream、AI request ledger、成本與運維治理。
6. Web 與 App 共享的狀態機、授權、API contract、DB schema 與錯誤語義。

## 6. Out of Scope

以下不屬於 Emorapy 通用級產品承諾：

1. 不提供臨床診斷、心理治療、法律代理、司法裁決或緊急危機救援。
2. 不保證 AI 結果完全正確；必須保留用戶判斷、申訴、重試或安全分流邊界。
3. 不允許 App 建立 App-only 業務狀態機、App-only DTO 或繞過 backend 的業務資料通道。
4. 不把 Web route、Web localStorage、Web Header / BottomNav、Admin Web 入口直接視為 App navigation 設計。
5. 不把營銷素材、單次驗收記錄、歷史方案或 dated 排查稿升格為產品真相。

## 7. 需求編碼規則

後續新增產品需求時使用以下 ID：

`EMO-*` 是現行 governance ID namespace，用於需求、驗收、ADR、風險與治理追溯，不代表 App Store / native / release external identifier。`CJ-*` 是歷史 governance ID namespace，已於 2026-06-21 經 mapping evidence 遷移；不得在 current docs 新增完整 `CJ-*` ID。若未來再次遷移到其他 namespace，必須先建立 ID mapping、引用遷移策略、更新文檔結構 / truth / naming gate 與所有引用。

| ID 前綴 | 用途 |
| --- | --- |
| `EMO-PRD-COM-*` | 通用級產品需求 |
| `EMO-PRD-WEB-*` | Web / Admin Web 平台投影需求 |
| `EMO-PRD-APP-*` | App 平台投影需求 |
| `EMO-NFR-*` | 共用非功能、信任安全與可靠性需求 |
| `EMO-RTM-*` | 需求驗證矩陣條目 |

新增或修改需求時，必須同步判斷是否需要更新：

1. `功能特性清單.md`
2. `業務流程整合.md`
3. `頁面清單.md`
4. `接口-功能-頁面-Mapping.md`
5. `50-跨端Mapping與Parity/`
6. `08-測試規範與驗收/04-需求驗證矩陣.md`

## 8. 工程級需求語句與屬性規則

需求語句與需求屬性以 [05-工程級PRD對標與治理缺口台賬.md](./05-工程級PRD對標與治理缺口台賬.md) 為對標依據。新增或修改 `EMO-PRD-*` 時，必須至少補齊下列判斷：

| 屬性 | 規則 |
| --- | --- |
| 需求語句 | 應寫清 actor、condition、expected outcome，不把平台實作細節混入通用級需求 |
| 強制程度 | MUST / MUST NOT 只用於安全、資料歸屬、跨端一致性、發布阻斷或互操作硬約束；SHOULD / MAY 需能解釋例外 |
| 來源與理由 | 必須能追到用戶場景、產品假設、現碼、運維風險、外部標準或明確裁決 |
| 優先級 | P0 阻斷安全、資料歸屬、發布或核心流程；P1 影響主流程價值；P2 影響體驗、效率或後續擴展 |
| 驗證方式 | 必須能追到測試、分析、檢查、release gate、手動證據或「待建立基線」 |
| 平台投影 | Web / App / Backend / Admin / shared package 差異必須在平台文件或 Parity 文件中可追溯 |

若需求涉及 AI / LLM runtime、prompt、AI output downstream action 或模型依賴，必須同步 `04-共用機制/03-AI風險與安全治理基線.md`。若需求涉及 API contract、typed client、schema、SDK、OpenAPI 或第三方接入，必須同步 `06-接口描述/11-API契約與OpenAPI缺口台賬.md`。這兩類需求不得只停留在通用 PRD 文本。

### 8.1 PRD 主線屬性補充

| PRD ID | 強制程度 | 優先級 | 來源 / 理由 | 驗證入口 |
| --- | --- | --- | --- | --- |
| `EMO-PRD-COM-001` | MUST | P0 | 匿名 quick flow 是低門檻試用與 session-bound 資料歸屬的核心入口 | `功能特性清單.md`、`業務流程整合.md`、`08-測試規範與驗收/04-需求驗證矩陣.md` |
| `EMO-PRD-COM-002` | MUST | P0 | 正式處理牽涉登入、配對、case 歸屬、judgment visibility 與 repair journey | `業務流程整合.md`、`接口-功能-頁面-Mapping.md`、`50-跨端Mapping與Parity/` |
| `EMO-PRD-COM-003` | SHOULD | P1 | Chat 是高頻入口，但 chat -> judgment 必須保留顯式 handoff 和授權限制 | `06-接口描述/`、`業務流程整合.md`、chat e2e / 手動回歸證據 |
| `EMO-PRD-COM-004` | SHOULD | P1 | 訪談與 profile 提供長期個性化上下文，但不得強迫所有流程依賴 profile | `02-用戶場景與假設台帳.md`、profile / interview API 與測試 |
| `EMO-PRD-COM-005` | MUST | P0 | 平台治理保護發布、AI 成本、安全、metrics、health 與 Admin 操作可追溯 | `03-管理端與平台治理/`、release gate、Admin reports、metrics |

### 8.2 模糊語句禁止規則

以下寫法不得單獨作為需求驗收依據：

1. 「體驗更好」「更穩定」「更安全」「更智能」但沒有指標、證據或 NFR。
2. 「App 也支持」但沒有 screen、adapter、API 消費、smoke 或 Parity 狀態。
3. 「AI 應該正確」但沒有 prompt version、ledger、fallback、安全分流或失敗處理。
4. 「快速完成」但沒有等待、timeout、重試、耗時基線或待建立基線標記。
5. 「已完成」但只能追到一次手動截圖，不能追到穩定規格或測試入口。

## 9. App 平台需求組

完整 App 版的 App 級需求由 [../20-App端/02-App完整版本工程PRD.md](../20-App端/02-App完整版本工程PRD.md) 裁決，Roadmap 由 [../20-App端/03-App完整版本開發Roadmap.md](../20-App端/03-App完整版本開發Roadmap.md) 裁決。App 級需求不改寫 `EMO-PRD-COM-*`，只描述移動端如何承接通用級需求。

| PRD ID | App 平台需求 | 對應通用主線 | 狀態 |
| --- | --- | --- | --- |
| EMO-PRD-APP-001 | Expo React Native + TypeScript、iOS-first / Android-compatible、單一 `mobile/` codebase | 全主線 | 已作為 App 工程基線；`mobile/` 承接 Expo RN runtime 與 iOS / Android compatible codebase。release 完成仍由 M6 的 EAS / TestFlight / physical device 與 `release:completion:audit:strict` 裁決 |
| EMO-PRD-APP-002 | App API / DTO 必須消費 shared contracts / api-client，不長期手寫 App-only DTO | 全主線 | 已作為基線；M1-M5 domain client 已下沉到 `@emorapy/api-client`，新增契約仍需按 Parity / API governance 回寫 |
| EMO-PRD-APP-003 | App navigation skeleton 必須替換 Expo template，並按 App route group 承接功能 | 全主線 | 已作為基線；Expo template tabs 已移除，route topology、selector 與 route smoke gate 作為導航核驗入口 |
| EMO-PRD-APP-004 | Token、anonymous session、device metadata 必須經 SecureStore / platform storage adapter | 快速判斷、正式處理、先聊再判 | 已作為基線；auth/session bootstrap、logout cleanup、token rotation revoke 與 platform boundary gate 已建立，physical device sign-off 歸入 M6 |
| EMO-PRD-APP-005 | App 必須優先承接 Quick flow、result replay、claim-session handoff | EMO-PRD-COM-001 | 已作為 M1 基線；Quick/Auth/result/claim-session、stream replay 與 expired anonymous session recovery 已有 App 工程承接，release 級真機證據仍待 M6 |
| EMO-PRD-APP-006 | App 應承接 Profile / Interview / My Story，並支援 SSE 中斷恢復 | EMO-PRD-COM-004 | 已作為 M2 基線；Profile / Interview / My Story、AI stream recovery、failed / partial-success UI 已有 App 工程承接，native lifecycle evidence 歸入 M6 |
| EMO-PRD-APP-007 | App 應承接 Chat room、invite、message stream、request judgment 與 handoff | EMO-PRD-COM-003 | 已作為 M3 基線；Chat room / invite / message / request judgment / auth resume 已有 App 工程承接，真 provider delivery 與 native push landing 歸入 M6 |
| EMO-PRD-APP-008 | App 應分階段承接 Formal Case、Judgment、Repair Journey、Execution | EMO-PRD-COM-002 | 已作為 M4-M5 基線；Formal Case / Repair / evidence upload / repair replan stream / DB-backed replay 已有 App 工程承接，repair 全狀態與真機 selected-media evidence 仍待 M6 / Parity 補齊 |
| EMO-PRD-APP-009 | Push / Deep Link 必須保留 backend notification 狀態與授權 gate | EMO-PRD-COM-005 | 部分實作；backend/schema registration/revoke、logout cleanup、Expo push dispatch 與 receipt polling 已落地，native landing / 真 provider delivery 待 M6 sign-off |
| EMO-PRD-APP-010 | Native upload 必須經 platform upload adapter，不在 App 本地裁決 media 授權 | EMO-PRD-COM-002 / EMO-PRD-COM-004 | 部分實作；platform upload adapter、Case safety assertion 與 backend upload handoff 已建立，真機 picker-selected asset / profile media evidence 仍待 M6 |
| EMO-PRD-APP-011 | App telemetry 只回傳必要 safe context，不承接 Admin Web | EMO-PRD-COM-005 | 部分實作；safe telemetry / OTLP / Admin aggregate report / 30d cleanup 已作為 release 排障基線，telemetry runtime evidence 可作 completion gate 輸入；native crash runtime、external tracing backend、長期 crash-free / SLO baseline 仍不得宣稱完成 |
