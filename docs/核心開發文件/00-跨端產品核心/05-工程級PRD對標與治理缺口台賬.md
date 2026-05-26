# 工程級 PRD 對標與治理缺口台賬

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：跨端PRD
**覆蓋範圍**：工程級 PRD / SRS / NFR / RTM 對標口徑、需求屬性規則、資料模型、schema migration、相容性、SLO 可觀測性、incident drill 與治理缺口台賬
**取證代碼入口**：`backend/src/routes`、`backend/src/routes/health.routes.ts`、`backend/src/routes/metrics.routes.ts`、`backend/src/services/ops-alerts.service.ts`、`backend/src/services/ops-metrics.service.ts`、`backend/src/middleware/requestId.ts`、`backend/prisma/schema.prisma`、`backend/prisma/migrations`、`backend/scripts/check-release-db-parity.ts`、`backend/src/services/safety-routing.service.ts`、`backend/src/services/ai-request-ledger.service.ts`、`scripts/ops-release-gate.sh`、`scripts/ops-release-gate-evidence.sh`、`frontend/src/router/index.tsx`、`frontend-admin/src/router.tsx`、`mobile/app`、`mobile/src/platform`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-07`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 定位

本文用於把 CJ 的核心產品文件對標工程級 PRD / SRS / NFR / RTM 標準，並把缺口落到可維護的治理規則。它不是外部合規認證，不宣稱 CJ 已符合 ISO、IEEE、OWASP 或任何第三方審計要求。

本輪採用的外部參考基線如下：

| 基線 | 採用原因 | CJ 採用方式 |
| --- | --- | --- |
| ISO/IEC/IEEE 29148:2018 Requirements engineering | 需求工程生命週期、需求信息項與需求內容格式的通用標準 | 用於校準需求 ID、來源、屬性、驗證、狀態與追溯規則 |
| IEEE/ISO/IEC 29148-2018 摘要 | 明確「良好需求」的構造、屬性、特徵與迭代管理 | 用於要求每條 `CJ-PRD-*` / `CJ-NFR-*` 能被驗證、被追溯、被變更治理 |
| RFC 2119 | 定義 MUST / SHOULD / MAY 等需求強度語義 | 用於區分硬約束、建議與可選平台投影，避免模糊承諾 |
| RFC 8174 | 補充 RFC 2119 關鍵詞只在全大寫時具規範語義 | 用於避免把普通英文 may / should 誤讀為需求強制詞 |
| ISO/IEC 25010:2023 Product quality model | 提供產品質量屬性的分類參考 | 用於校準 NFR 分類：可靠性、安全、性能、可維護性、可用性、兼容性等 |
| ISO/IEC/IEEE 42010:2022 Architecture description | 提供架構描述、stakeholder、concern、viewpoint、view 與 correspondence 的標準化口徑 | 用於校準架構決策、架構視圖與 ADR 追溯，不把目錄說明當架構描述 |
| C4 model | 提供 Context / Container / Component / Code 的工程溝通層級 | 用於校準 CJ 架構視圖與後續圖集缺口，不宣稱已有完整 C4 圖 |
| OWASP Threat Modeling | 提供資產、信任邊界、威脅、控制與驗證的安全建模方法 | 用於校準 `CJ-SEC-*`、trust boundary 與高風險流程 threat model |
| OWASP ASVS 5.0 | Web 應用安全驗證需求的開放標準 | 用於 Web / API 安全需求分類與證據口徑，不直接聲稱 ASVS level |
| OWASP MASVS | Mobile App 安全控制組標準 | 用於 App SecureStore、Push、Deep Link、Network、Platform interaction 等 App 級安全投影 |
| NIST AI RMF 1.0 / Generative AI Profile | AI 風險治理、生成式 AI 風險識別、量測與處置框架 | 用於校準 AI 資產清單、風險矩陣、人工介入、量測與缺口治理 |
| ISO/IEC 42001:2023 | AI management system 要求 | 用於借鑑 AI 資產、責任邊界、變更管理與持續改善，不建立完整 AIMS 模板 |
| OWASP Top 10 for LLM Applications | LLM 應用常見安全風險 | 用於 prompt injection、sensitive disclosure、improper output handling、overreliance 對照 |
| OpenAPI Specification | REST API machine-readable contract 事實標準 | 用於校準 API 契約、schema、error model、security scheme 與 typed client 缺口 |
| RFC 9110 HTTP Semantics | HTTP status code 與語義標準 | 用於校準 API failure contract 中 4xx / 5xx / 409 / 422 / 429 / 503 等狀態碼語義 |
| RFC 9457 Problem Details for HTTP APIs | HTTP API 錯誤格式標準 | 用於校準錯誤 envelope、problem type、instance、OpenAPI error schema 與缺口口徑 |
| OMG UML State Machines | 狀態、事件、guard、entry / exit action 建模語義 | 用於校準核心狀態機、非法轉移與 side effect 追溯 |
| W3C SCXML 1.0 | State machine execution model | 用於校準「enum 不等於狀態機」與 machine-readable statechart 缺口 |
| OMG BPMN 2.0.2 | 業務流程、事件、任務與異常路徑建模方法 | 用於校準跨流程狀態、人工恢復任務與 failure path |
| NIST Privacy Framework 1.0 | 企業隱私風險管理框架 | 用於校準 data inventory、consent、retention、communicate、protect 與資料治理缺口 |
| ISO/IEC 27701:2025 | Privacy Information Management System 要求與指引 | 用於借鑑 PII controller / processor、accountability、隱私風險處理與持續改善，不建立完整 PIMS |
| NIST Cybersecurity Framework 2.0 | 治理、識別、防護、偵測、回應、恢復的資安風險框架 | 用於校準事故治理、release gate、偵測/回應/恢復鏈路 |
| NIST SP 800-61 Rev. 3 | incident response recommendations / CSF 2.0 profile | 用於校準事故分級、偵測、處置、恢復、postmortem 與改進 |
| Google SRE SLO | SLI / SLO / error budget 的工程實踐 | 用於校準 SLO 待建立基線與告警門檻，不對外承諾 SLA |
| Google SRE Alerting on SLOs | 以 error budget threat、burn-rate、多窗口和低流量 caveat 校準告警品質 | 用於區分 alert threshold、page-worthy incident 與正式 error budget |
| OpenTelemetry Signals | traces、metrics、logs、baggage 的可觀測性信號模型 | 用於校準 CJ request id / logs / metrics 已有能力與 distributed tracing 缺口 |
| Prometheus Alerting | alerting rules、`for` duration、Alertmanager / notification chain | 用於校準 `/metrics` 到告警閉環的必要條件 |
| NIST SP 800-218 SSDF | secure software development framework | 用於校準 release gate、證據、變更控制與安全開發檢查 |
| WCAG 2.2 | Web 可訪問性成功準則 | 用於校準鍵盤、focus、語言、name / role / value、status message 與可測驗收，不宣稱 WCAG conformance |
| WAI-ARIA / ARIA APG | 複雜 Web 元件的 role、state、property 與 keyboard pattern | 用於校準 dialog、menu、tabs、select、tooltip、status 等元件語義與互動規則 |
| ISO 9241-210 | human-centred design for interactive systems | 用於校準內容設計、用戶情境、可理解性、迭代證據與高敏關係文案審查 |
| W3C Internationalization Authoring | Web 語言標記、方向、字元編碼與 authoring 指南 | 用於校準 `lang`、locale switch、fallback、語音朗讀與跨語言內容治理 |
| Unicode CLDR | locale data 與國際化資料來源 | 用於校準日期、數字、時間、百分比與區域格式，不以硬編字串長期治理 |
| Android / React Native Accessibility | Native App accessibility label、role、hint、screen reader 與 touch target 指南 | 用於校準 App 級可訪問性，Web ARIA / role tests 不得替代 App native 證據 |
| ISO/IEC 11179 Metadata Registries | 資料元素、名稱、定義與 metadata registry 的治理框架 | 用於校準資料字典、欄位語義、owner、敏感度、相容性狀態與資料模型變更追溯 |
| Prisma Migrate migration histories / expand-and-contract | Prisma 官方 migration history、production migration 與 expand / contract 資料遷移指南 | 用於校準 migration folder、`_prisma_migrations`、schema drift、backfill 與 release DB parity |
| PostgreSQL Data Definition | PostgreSQL DDL、constraint、index、enum、FK 與 raw SQL 行為 | 用於校準 DB-level 變更、lock / rewrite / constraint 風險，不只依賴 Prisma schema |
| Google AIP-180 / 181 / 185 | API backwards compatibility、stability levels、versioning | 用於校準 DB/API/shared contract 對舊 client、舊資料與 App 的相容性承諾 |
| Semantic Versioning 2.0.0 | 用版本號表達 public API 與相容性語義 | 用於校準 contracts / api-client / package 版本與 breaking schema / DTO 變更的發布口徑 |

外部來源鏈接：

1. [ISO/IEC/IEEE 29148:2018](https://www.iso.org/standard/72089.html)
2. [IEEE/ISO/IEC 29148-2018](https://standards.ieee.org/ieee/29148/6937/)
3. [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)
4. [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)
5. [ISO/IEC 25010:2023](https://www.iso.org/standard/78176.html)
6. [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
7. [OWASP MASVS](https://mas.owasp.org/MASVS/)
8. [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework)
9. [NIST AI RMF Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
10. [ISO/IEC 42001:2023](https://www.iso.org/standard/42001)
11. [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
12. [OpenAPI Specification](https://spec.openapis.org/oas/latest)
13. [NIST Privacy Framework](https://www.nist.gov/privacy-framework/privacy-framework)
14. [ISO/IEC 27701:2025](https://www.iso.org/standard/85819.html)
15. [NIST Cybersecurity Framework 2.0](https://www.nist.gov/cyberframework)
16. [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final)
17. [Google SRE Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)
18. [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
19. [ISO/IEC/IEEE 42010:2022](https://www.iso.org/standard/74393.html)
20. [C4 model](https://c4model.com/)
21. [OWASP Threat Modeling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html)
22. [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)
23. [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)
24. [OMG UML](https://www.omg.org/spec/UML/)
25. [W3C SCXML](https://www.w3.org/TR/scxml/)
26. [OMG BPMN](https://www.omg.org/spec/BPMN)
27. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
28. [WAI-ARIA Overview](https://www.w3.org/WAI/standards-guidelines/aria/)
29. [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
30. [ISO 9241-210:2019](https://www.iso.org/standard/77520.html)
31. [W3C Internationalization: Authoring web pages](https://www.w3.org/International/techniques/authoring-html)
32. [Unicode CLDR](https://cldr.unicode.org/)
33. [Android Build accessible apps](https://developer.android.com/guide/topics/ui/accessibility)
34. [React Native Accessibility](https://reactnative.dev/docs/accessibility)
35. [ISO/IEC 11179-1:2023](https://www.iso.org/standard/78914.html)
36. [Prisma Migrate: migration histories](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories)
37. [Prisma expand-and-contract migrations](https://docs.prisma.io/docs/guides/database/data-migration)
38. [PostgreSQL Data Definition](https://www.postgresql.org/docs/current/ddl.html)
39. [Google AIP-180 Backwards compatibility](https://google.aip.dev/180)
40. [Google AIP-181 Stability levels](https://google.aip.dev/181)
41. [Google AIP-185 API Versioning](https://google.aip.dev/185)
42. [Semantic Versioning 2.0.0](https://semver.org/)
43. [Google SRE Workbook: Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)
44. [OpenTelemetry Signals](https://opentelemetry.io/docs/concepts/signals/)
45. [Prometheus Alerting Overview](https://prometheus.io/docs/alerting/latest/overview/)
46. [Prometheus Alerting Rules](https://prometheus.io/docs/prometheus/2.53/configuration/alerting_rules/)

## 1.1 外部基線版本風險

| 基線 | 版本 / 狀態口徑（2026-05-07 核對） | CJ 文件治理要求 |
| --- | --- | --- |
| ISO/IEC/IEEE 29148:2018 | ISO 頁面顯示 Published，但 lifecycle 已進入 to be revised | 本文只能標「參考 29148:2018」，不得寫成永久最新版本；標準更新後需重審需求屬性 |
| RFC 2119 / RFC 8174 | RFC 8174 補充關鍵詞大小寫語義 | CJ 只把全大寫 MUST / SHOULD / MAY 當需求強制詞 |
| ISO/IEC/IEEE 42010 | ISO 頁面顯示 2022 edition 已 published | CJ 用於架構描述與 ADR 對標，不宣稱已形成完整 Architecture Description |
| C4 model | 官方作為架構溝通模型，不是合規認證 | CJ 用於架構視圖層級，不把缺圖的文字矩陣宣稱為完整 C4 圖集 |
| OWASP Threat Modeling | OWASP Cheat Sheet 作工程方法參考 | CJ 用於 threat model / security requirement gate，不宣稱完整威脅建模已完成 |
| UML / SCXML / BPMN | 官方規格可作狀態機與業務流程建模參考 | CJ 目前只有文字狀態基線，未建立 machine-readable statechart、BPMN 圖集或形式化驗證 |
| RFC 9110 / RFC 9457 | RFC 9457 取代 RFC 7807，RFC 9110 定義 HTTP 語義 | CJ 目前使用自有 JSON envelope；未導入 `application/problem+json` 前只能標 Problem Details gap |
| OWASP ASVS | 官方頁面顯示最新 stable 為 5.0.0 | CJ 僅作安全需求分類參考，不宣稱 ASVS level |
| OWASP MASVS | 仍作 App 安全控制組參考 | App M0-M5 本地 gate 已落地後，MASVS 映射仍只能標「部分覆蓋」；真機 / provider / native crash / release evidence 完成前不得標完整 |
| NIST AI RMF / GenAI Profile | AI 風險框架仍是治理參考 | CJ 用於 AI risk inventory / measure / manage，不作合規認證 |
| OpenAPI Specification | 官方 latest 作 API contract 對標 | CJ 目前沒有 OpenAPI 文件；只能標 OpenAPI gap，不得宣稱 OAS 完成 |
| NIST Privacy Framework | Version 1.0 仍是隱私工程治理參考 | CJ 用於資料分類與隱私風險治理，不作法律合規聲明 |
| ISO/IEC 27701 | ISO 頁面顯示 2025 edition 已 published，取代 2019 edition | CJ 文件需標明採用 2025 參考口徑；不宣稱 PIMS 完成 |
| NIST CSF 2.0 / SP 800-61r3 | CSF 2.0 final，SP 800-61r3 final published April 2025 | 事故治理應用最新 r3 口徑，不再沿用 r2 life cycle 作唯一依據 |
| Google SRE SLO | 作工程實踐參考，不是標準認證 | 沒有長期 SLI 數據前不得設定對外 SLA |
| Google SRE Alerting / OpenTelemetry / Prometheus Alerting | 官方工程資料仍持續演進，且各工具只覆蓋可觀測性的一部分 | CJ 必須區分 metric、log、trace、alert、incident drill 與 release evidence；不能把任一單點信號寫成完整 SLO / tracing / on-call 成熟度 |
| NIST SSDF | SP 800-218 final 作 secure SDLC 參考 | release gate 證據不等於完整 SSDF attestation |
| WCAG 2.2 / WAI-ARIA / ARIA APG / ISO 9241-210 | W3C / ISO 官方頁作可訪問性與 human-centred design 參考 | CJ 目前只建立治理基線；沒有 axe、screen reader、人工審查與完整流程證據前不得宣稱 WCAG / accessibility conformance |
| W3C i18n / Unicode CLDR / Android / React Native Accessibility | 官方頁作 Web authoring、locale data 與 native accessibility 參考 | Web/Admin i18n catalog、Radix 元件或 role tests 不代表雙語完整或 App accessibility 完成 |
| ISO 11179 / Prisma Migrate / PostgreSQL DDL / Google AIP / SemVer | 官方標準與工程規範作資料字典、migration history、相容性、版本語義參考 | CJ 目前只建立 schema / compatibility governance；不宣稱完整 data dictionary、零停機 migration 或 automated compatibility checker |

## 2. CJ 工程級需求記錄最低屬性

新增或修改 `CJ-PRD-*`、`CJ-NFR-*`、`CJ-PRD-WEB-*`、`CJ-PRD-APP-*` 時，至少應能回答下列欄位。欄位可以分散在 PRD、NFR、RTM、功能、流程、頁面或 Parity 文件中，但必須能互相追溯。

| 屬性 | 必填口徑 | 目前承接 |
| --- | --- | --- |
| ID | 全局唯一，不能複用舊語義 | `01-產品PRD總章.md`、`04-需求驗證矩陣.md` |
| 層級 | 通用級 / Web級 / App級 / 共用機制級 / 驗收級 | `01-產品PRD總章.md`、`術語表.md` |
| 需求語句 | 描述 actor、condition、expected outcome，不混入無關解法 | `01-產品PRD總章.md` 待強化 |
| 強制程度 | MUST / SHOULD / MAY 或不使用強制詞 | 本文與治理規則補齊 |
| 來源 | 場景、假設、現碼、運維風險、外部標準或產品裁決 | `02-用戶場景與假設台帳.md`、本文 |
| 理由 | 為什麼是需求，而不是想法、任務或營銷敘事 | 本文與 PRD 主表補齊 |
| 優先級 | P0 / P1 / P2；P0 代表安全、資料歸屬、發布或核心流程阻斷 | RTM 補齊 |
| 狀態 | 已覆蓋 / 部分覆蓋 / 待承接 / 待建立基線 / 待裁決 / 不承接 | RTM、假設台帳、Parity 文件 |
| 平台投影 | Web、App、Backend、Admin、shared package 的承接差異 | `10-Web端/`、`20-App端/`、`50-跨端Mapping與Parity/` |
| 驗證方式 | 測試、分析、檢查、演練、release gate、手動證據或待建立基線 | `08-測試規範與驗收/04-需求驗證矩陣.md` |
| 指標 / 證據 | 對應 `CJ-MET-*`、測試、e2e、smoke、ledger、metrics 或證據路徑 | `03-成功指標與產品健康.md`、`90-證據與盤點/` |
| 依賴 / 風險 | API、DB、shared enum、平台 adapter、第三方服務、合規或安全限制 | Parity、待處理任務、NFR |
| 變更 gate | 修改需求時必須同步哪些文件與守衛 | `文件收斂/00-CJ-文檔治理與同步規則.md` |

## 3. 需求語句規則

1. 單條需求只描述一個可驗證行為或結果。
2. 需求語句應包含「誰 / 在什麼條件下 / 必須或應該達成什麼結果」。
3. 產品級 PRD 不直接指定 UI 元件、代碼類名或資料表欄位；若必須指定，應說明它是既有現碼約束還是新設計約束。
4. 模糊形容詞如「快速、穩定、友好、可靠」必須連到指標、證據或 NFR；否則只能作描述，不得作驗收條件。
5. MUST / MUST NOT 只用於安全、資料歸屬、跨端一致性、發布阻斷或互操作性硬約束。
6. SHOULD 用於強建議，但允許有明確理由的例外；例外必須回寫 Parity 或待裁決項。
7. MAY 只用於可選平台能力，不得被理解為核心產品承諾。

## 4. 本輪對標缺口台賬

| 缺口 ID | 對標標準 | 現狀 | 風險 | 本輪處置 |
| --- | --- | --- | --- | --- |
| CJ-GAP-PRD-001 | ISO/IEC/IEEE 29148 / RFC 2119 | PRD 主線已存在，但需求語句、強制程度、來源、理由和優先級尚未形成固定欄位 | 後續需求會退化成描述性文字，難以驗證 | 補本文第 2-3 節，並回寫 PRD 總章與 RTM |
| CJ-GAP-PRD-002 | ISO/IEC/IEEE 29148 | 場景與假設已有，但假設信心、反證門檻與決策動作仍偏粗 | 產品假設無法被證偽或關閉 | 在假設台帳補狀態口徑與後續回寫規則，暫不編造數值門檻 |
| CJ-GAP-MET-001 | ISO/IEC 25010 / 需求驗證 | 指標列表已有，但資料來源、基線狀態、發布用途未完全拆清 | 指標容易被當作目標值或發布 gate | 在成功指標文檔補資料來源和可用性分級 |
| CJ-GAP-NFR-001 | ISO/IEC 25010 / OWASP ASVS / MASVS | NFR 已列出，但未清楚標註質量屬性與 Web/App 安全標準映射 | 安全與非功能需求難以按平台審查 | 在 NFR 文檔補質量模型與 ASVS/MASVS 對照 |
| CJ-GAP-RTM-001 | ISO/IEC/IEEE 29148 | RTM 已有，但驗證方式還停留在文字描述，缺少標準化驗證類型 | PRD 到測試和證據的鏈路不夠可審計 | 在 RTM 補驗證類型、優先級和證據入口規則 |
| CJ-GAP-APP-001 | OWASP MASVS / 跨端 Parity | App M0-M5 runtime adapter、screen、smoke 與 local evidence 已落地，但 MASVS / 真機 / provider / native crash runtime / release DB parity 證據未清零 | 可能把 App 本地 gate 誤解為 release 級 App 安全或原生能力已完整完成 | 維持 App 部分覆蓋口徑，要求 MASVS 類需求只能在 strict release sign-off 後升級為完整 |
| CJ-GAP-APP-002 | ISO/IEC/IEEE 29148 / 跨端 Parity | 完整 App 版工程 PRD / Roadmap、M0-M5 runtime 與 completion audit 已落地，但 M6 strict release sign-off 未完成 | 可能把「本地開發已完成」誤寫為 App release / TestFlight / 真機完成 | 保留 `20-App端/02-App完整版本工程PRD.md` 與 `20-App端/03-App完整版本開發Roadmap.md` 主控，並要求 RTM / Parity / 待辦同步 release blockers |
| CJ-GAP-GOV-001 | 需求治理 | 文件治理已管 code/docs sync，但 PRD 標準對標尚未進 PR 自檢 | 需求層變更可能漏掉 NFR / RTM / 指標 | 回寫文件治理規則與台賬 |
| CJ-GAP-AI-001 | NIST AI RMF / ISO 42001 / OWASP LLM | AI 能力已有 prompt version、ledger、safety routing，但缺少統一 AI asset inventory 與 LLM 風險矩陣 | 新 AI runtime 可能漏接 prompt fencing、ledger、版本、人工介入與 App 差異 | 新增 `04-共用機制/03-AI風險與安全治理基線.md` |
| CJ-GAP-API-001 | OpenAPI / 29148 traceability / ASVS | 接口已有主冊、模組文檔與 truth guard，但沒有 machine-readable OpenAPI / schema contract | typed client、App 接入、第三方審查與契約測試缺少自動化基礎 | 新增 `06-接口描述/11-API契約與OpenAPI缺口台賬.md`，明確不得宣稱 OAS 完成 |
| CJ-GAP-DATA-001 | NIST Privacy Framework / ISO/IEC 27701 | 有 consent、部分 delete、cleanup、log masking，但缺少資料分類、retention、archive、DSAR 與 App telemetry 統一基線 | 隱私聲明、證據、App storage 與 AI archive 容易出現誤導或過度保存 | 新增 `04-共用機制/04-資料治理與隱私風險基線.md` |
| CJ-GAP-OPS-001 | Google SRE SLO / NIST CSF 2.0 / SP 800-61r3 | 有 health、metrics、ops alerts、release gate，但缺少 SLI/SLO/error budget、事故分級與 postmortem 模板 | 團隊難以區分健康、降級、事故與可發布狀態 | 新增 `03-管理端與平台治理/06-SLO可觀測性與事故治理基線.md` |
| CJ-GAP-OPS-002 | Google SRE Alerting on SLOs / OpenTelemetry / Prometheus Alerting | 有 request id、logs、metrics、Redis ratio、Prometheus text 與 release evidence，但缺 signal taxonomy、incident drill 驗收、trace/span 關聯與 alert runtime 證據 | `/metrics` 存在、request id 存在或單次 gate pass 可能被誤寫為完整可觀測性、tracing、SLA 或事故流程已驗收 | 新增 `08-測試規範與驗收/07-SLO可觀測性與事故演練驗收基線.md`，並回寫 SLO / NFR / RTM |
| CJ-GAP-SEC-001 | OWASP Threat Modeling / ASVS / MASVS / NIST SSDF | 有 CORS、Helmet、JWT、Admin RBAC、media auth、metrics protection、rate limit、consent 與 log masking，但缺少統一 trust boundary、`CJ-SEC-*` 與高風險流程 threat model | 安全治理可能停留在中間件清單，App native 安全也可能被 Web 證據誤覆蓋 | 新增 `04-共用機制/05-威脅建模與安全需求基線.md` |
| CJ-GAP-ADR-001 | ISO/IEC/IEEE 42010 / C4 / NIST SSDF | 有 repo 分層與 shared package 規則，但缺少架構視圖、ADR 最低格式、架構決策登記與重審條件 | workspace、API/DB/shared、AI runtime、安全邊界、App adapter 或 release gate 變更難以追溯取捨 | 新增 `05-工程架構與共享層/02-架構決策與ADR治理基線.md` |
| CJ-GAP-STATE-001 | UML / SCXML / BPMN / ISO 29148 | 有 schema enum、contracts 與 service guard，但缺少正式狀態圖、machine-readable statechart、transition / invariant 矩陣 | 新狀態容易只加 enum，不補 trigger、guard、side effect、非法轉移與恢復策略 | 新增 `04-共用機制/06-狀態機與業務不變式治理基線.md` |
| CJ-GAP-ERR-001 | RFC 9110 / RFC 9457 / OpenAPI | 有 `AppError`、error handler、response envelope 與 request id，但沒有 Problem Details、OpenAPI error schema、field-level validation schema 或 Retry-After contract | Web / App / SDK / 第三方 client 的錯誤處理可能分叉，失敗路徑難以契約測試 | 新增 `06-接口描述/12-錯誤模型與ProblemDetails缺口台賬.md` |
| CJ-GAP-A11Y-001 | WCAG 2.2 / WAI-ARIA / ISO 9241-210 / W3C i18n / CLDR / React Native Accessibility | 有局部 i18n catalog、ARIA / focus hooks 與 role tests；缺 `html[lang]` 一致性、axe / WCAG gate、i18n completeness、screen reader 與 App native accessibility 證據 | 可訪問性、本地化與高敏內容文案會在 Web / Admin / App 間漂移，且容易把局部代碼存在誤判為合規 | 新增 `04-共用機制/07-可訪問性本地化與內容設計治理基線.md` 與 `08-測試規範與驗收/05-可訪問性本地化驗收基線.md` |
| CJ-GAP-SCHEMA-001 | ISO 11179 / Prisma Migrate / PostgreSQL DDL / AIP-180 / SemVer | 有 Prisma schema、migration history、release DB parity gate、deprecated 欄位註記與待辦；缺集中 data dictionary、schema diff 分級、expand/contract、backfill 與 compatibility gate | schema commit、Dev DB 套用、舊 client 相容與 release DB parity 可能被混淆；破壞性變更可能單版本進入 | 新增 `05-工程架構與共享層/03-資料模型SchemaMigration與相容性治理基線.md` 與 `08-測試規範與驗收/06-SchemaMigration與相容性驗收基線.md` |

## 5. CJ 採納與不採納

本項目採納：

1. 使用需求 ID、NFR ID、RTM ID 做跨文檔追溯。
2. 使用需求屬性表和變更 gate 管控 PRD 變更。
3. 使用 RFC 2119 語義區分硬約束與建議。
4. 使用 ISO/IEC 25010 作 NFR 分類參考。
5. 使用 OWASP ASVS / MASVS 作 Web / App 安全驗證分類參考。
6. 所有未量測項保持「待建立基線」，不憑空填目標值。
7. 使用 NIST AI RMF、ISO/IEC 42001 與 OWASP LLM Top 10 作 AI / LLM 風險治理參考。
8. 使用 OpenAPI 作 API 契約缺口對標，但在未產生 `openapi.yaml/json` 前只標 gap。
9. 使用 NIST Privacy Framework 與 ISO/IEC 27701 作資料治理與隱私風險缺口對標，但不宣稱隱私合規。
10. 使用 Google SRE SLO、NIST CSF 2.0、NIST SP 800-61r3 與 NIST SSDF 作運維成熟度、事故治理與 release evidence 對標，但不宣稱 SLA / CSIRT / SSDF attestation。
11. 使用 OWASP Threat Modeling、OWASP ASVS 與 OWASP MASVS 作信任邊界、安全需求與 Web/App 安全投影對標，但不宣稱 ASVS / MASVS 等級。
12. 使用 ISO/IEC/IEEE 42010 與 C4 model 作架構視圖、ADR 與架構描述成熟度對標，但不宣稱完整架構圖集或標準合規。
13. 使用 UML / SCXML / BPMN 作狀態機、業務流程、異常路徑與人工恢復任務對標，但在未建立 statechart / diagram 前只標治理缺口。
14. 使用 RFC 9110、RFC 9457 與 OpenAPI 作錯誤契約、Problem Details 與 machine-readable error schema 對標，但不改寫現有 envelope 為已符合 Problem Details。
15. 使用 WCAG 2.2、WAI-ARIA / APG、ISO 9241-210、W3C i18n、Unicode CLDR、Android / React Native Accessibility 作可訪問性、本地化、內容設計與 App native accessibility 對標，但只作治理基線與驗收缺口。
16. 使用 ISO 11179、Prisma Migrate、PostgreSQL DDL、Google AIP 與 SemVer 作資料模型、migration history、schema compatibility、棄用與版本語義對標，但只建立治理基線與驗收缺口。
17. 使用 Google SRE Alerting、OpenTelemetry Signals 與 Prometheus Alerting 作可觀測性信號、告警閉環、incident drill 與 trace gap 對標，但不宣稱已完成 OTel tracing、burn-rate alerting 或 on-call maturity。

本項目暫不採納：

1. 不把核心文檔改成完整 ISO 模板全文；目前保留本倉庫現有分層，以免破壞可讀性。
2. 不宣稱任何第三方合規等級；只有正式審計或測試證據後才能標註。
3. 不為了對標標準新增 runtime 行為；代碼變更另立任務。
4. 不把 Web 已覆蓋推導為 App 已覆蓋；App 仍需獨立 screen / adapter / smoke / evidence。
5. 不把 AI prompt fencing、ledger 或 safety routing 單點控制宣稱為完整 AI 安全或 AI 管理體系。
6. 不把人工接口表格宣稱為 OpenAPI、SDK contract 或 schema contract tests。
7. 不把心理畫像 delete endpoint、session cleanup 或 log masking 宣稱為完整 DSAR、全域 retention 或隱私合規。
8. 不把 `/health` 200、Prometheus metrics 存在或單次 release gate 通過宣稱為正式 SLA、error budget 或完整事故響應成熟度。
9. 不把 CORS、Helmet、JWT、RBAC、rate limit 或 media auth 任一控制點宣稱為完整安全治理、ASVS / MASVS 覆蓋或 threat model 完成。
10. 不把 repo 目錄、package list 或 workspace 說明宣稱為完整架構描述；架構取捨需回到 ADR、視圖與重審條件。
11. 不把 schema enum、contract union 或 service if 分支宣稱為完整狀態機；狀態機需要 trigger、guard、side effect、非法轉移、恢復策略與驗證證據。
12. 不把 CJ 自有 `{ success, error, meta }` envelope 宣稱為 RFC 9457 Problem Details；未有 OpenAPI error schema 前不得宣稱 typed SDK 可完整依賴錯誤契約。
13. 不把 i18n catalog、Radix / shadcn 元件、局部 `aria-label` 或 role tests 宣稱為 WCAG 合規、雙語完整或 App accessibility 完成。
14. 不把 `schema.prisma` 更新、migration commit、Dev DB 套用、`db push` 成功或 release gate 單項通過宣稱為完整 data dictionary、production-safe migration、backfill 完成或舊 client 已相容。
15. 不把 `/metrics` 可導出、request id 存在、Prometheus rule 文件存在或 Slack webhook 可發送宣稱為完整可觀測性、distributed tracing、SLO error budget 或 incident response 已驗收。

## 6. 後續維護規則

1. 新增 PRD / NFR 前，先確認是否已有相同上游場景或假設。
2. 新增 P0 需求時，必須同步 RTM、NFR 或待辦，且不得只停留在 PRD 文本。
3. 涉及安全、身份、授權、資料歸屬、AI ledger、成本、發布 gate 的需求，默認按 MUST 級別審查；若降級為 SHOULD，需寫明例外理由。
4. 涉及 App 原生能力的需求，必須標明 MASVS 控制組或明確說明不適用。
5. 涉及完整 App 版的需求，必須回查 `20-App端/02-App完整版本工程PRD.md`、`20-App端/03-App完整版本開發Roadmap.md`、`50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md` 與 `08-測試規範與驗收/03-App測試與證據接入基線.md`；不得只在 PRD 總章新增描述。
6. 涉及 AI / LLM runtime、prompt、AI output downstream action 或模型依賴的需求，必須回查 `04-共用機制/03-AI風險與安全治理基線.md`。
7. 涉及接口契約、typed client、schema、SDK 或第三方接入的需求，必須回查 `06-接口描述/11-API契約與OpenAPI缺口台賬.md`。
8. 涉及個人資料、關係資料、心理推斷、安全風險、AI stream archive、log/evidence 或 App telemetry/storage 的需求，必須回查 `04-共用機制/04-資料治理與隱私風險基線.md`。
9. 涉及 health、metrics、alert、SLO、incident、postmortem、release gate、production smoke、request id、logs、trace 或 incident drill 的需求，必須回查 `03-管理端與平台治理/06-SLO可觀測性與事故治理基線.md` 與 `08-測試規範與驗收/07-SLO可觀測性與事故演練驗收基線.md`。
10. 涉及信任邊界、auth/session/admin、media、metrics、rate limit、consent、App native security 或高風險流程 threat model 的需求，必須回查 `04-共用機制/05-威脅建模與安全需求基線.md`。
11. 涉及 workspace、shared package、API/DB/shared 互操作、AI runtime、安全邊界、App adapter、release gate 或架構取捨的需求，必須回查 `05-工程架構與共享層/02-架構決策與ADR治理基線.md`。
12. 涉及核心狀態、enum、狀態轉移、非法轉移、業務不變式、人工恢復任務或 App server-state 承接的需求，必須回查 `04-共用機制/06-狀態機與業務不變式治理基線.md`。
13. 涉及錯誤碼、HTTP status、validation details、retry policy、Problem Details、OpenAPI error schema 或跨端錯誤 UX 的需求，必須回查 `06-接口描述/12-錯誤模型與ProblemDetails缺口台賬.md`。
14. 涉及可見文案、錯誤/等待/刪除/安全分流文案、ARIA、keyboard/focus、`html[lang]`、i18n catalog、locale formatting、screen reader 或 App native accessibility 的需求，必須回查 `04-共用機制/07-可訪問性本地化與內容設計治理基線.md` 與 `08-測試規範與驗收/05-可訪問性本地化驗收基線.md`。
15. 涉及 Prisma schema、migration history、release DB parity、backfill、棄用、enum / DTO / API response 相容性、shared package version 或 App storage schema 的需求，必須回查 `05-工程架構與共享層/03-資料模型SchemaMigration與相容性治理基線.md` 與 `08-測試規範與驗收/06-SchemaMigration與相容性驗收基線.md`。
16. 每輪文檔治理都應先跑 `npm run docs:check`，若只做 metadata / 台賬預檢，再跑 `npm run docs:audit:dry-run:current`。
