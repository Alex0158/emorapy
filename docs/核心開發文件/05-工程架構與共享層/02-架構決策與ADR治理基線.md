# 架構決策與 ADR 治理基線

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：正式規格
**覆蓋範圍**：架構視圖、架構決策記錄、跨端工程變更 gate、schema migration 相容性與 ADR 缺口治理
**取證代碼入口**：`package.json`、`frontend/tsconfig.app.json`、`frontend-admin/tsconfig.app.json`、`backend/tsconfig.json`、`backend/prisma/schema.prisma`、`backend/prisma/migrations`、`backend/scripts/check-release-db-parity.ts`、`mobile/tsconfig.json`、`packages/contracts/src`、`packages/api-client/src`、`backend/src/app.ts`、`backend/src/routes`、`mobile/app`、`mobile/src/platform`
**最後核驗 Commit**：`95fa8a9`
**最後核驗日期**：`2026-07-12`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 定位

本文把 Emorapy 的工程架構從「目錄怎樣分」提升為「架構決策為什麼成立、由誰影響、如何驗證、何時需要重審」。它對標 ISO/IEC/IEEE 42010:2022 的架構描述思想與 C4 model 的多視圖表達方式，但不宣稱 Emorapy 已形成完整 Architecture Description 或 C4 圖集。

本文只新增文件治理口徑，不新增 runtime 行為。若本文記錄的決策與現碼衝突，以現碼為準並回寫本文或建立待辦。

## 2. 外部工程基線參考

| 基線 | 採用原因 | Emorapy 採用方式 |
| --- | --- | --- |
| ISO/IEC/IEEE 42010:2022 Architecture description | 要求架構描述能回答 stakeholder、concern、viewpoint、view、decision rationale 與 architecture correspondence | 用於要求架構文件不能只列目錄，還要說清關注點、視圖、約束、取捨與追溯 |
| C4 model | 用 Context / Container / Component / Code 分層描述軟件架構，便於跨產品、工程、運維角色共同理解 | 用於建立 Emorapy 的文字版架構視圖層級；正式圖集待建立 |
| NIST SP 800-218 SSDF | 要求安全開發流程中保留設計、架構與風險治理證據 | 用於要求高風險架構變更需要 ADR、驗證與回滾口徑 |

外部來源：

1. [ISO/IEC/IEEE 42010:2022](https://www.iso.org/standard/74393.html)
2. [C4 model](https://c4model.com/)
3. [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)

## 3. 架構視圖層級

Emorapy 後續描述架構時，至少按以下層級表達。沒有圖時可以先用文字矩陣，但不得只寫「見目錄」。

| 視圖 | 必須回答 | 當前 Emorapy 入口 |
| --- | --- | --- |
| System Context | Emorapy 與使用者、Admin、瀏覽器、App、AI provider、DB、Redis、部署平台、告警通道的關係 | `README.md`、`03-管理端與平台治理/`、`04-共用機制/` |
| Container | `frontend`、`frontend-admin`、`backend`、`mobile`、`packages/contracts`、`packages/api-client`、Postgres、Redis、uploads 的責任邊界 | `05-工程架構與共享層/00-工程架構與共享層總覽.md` |
| Component | auth/session、case/judgment、chat、interview、repair、notification、admin、AI stream、media、metrics 的服務邊界 | `02-用戶端核心流程/`、`03-管理端與平台治理/`、`06-接口描述/` |
| Runtime / Sequence | session refresh、claim-session、AI stream、chat handoff、media access、release gate 的時序與失敗分支 | `04-共用機制/`、`08-測試規範與驗收/`、`90-證據與盤點/` |
| Deployment / Ops | local、staging-like、production-like、Vercel/Railway/Supabase/Redis、health/metrics/release gate 的部署與運維口徑 | `03-管理端與平台治理/` |
| Security / Privacy | 信任邊界、身份來源、資料分類、media、metrics、AI provider、App native storage / Push / Deep Link | `04-共用機制/05-威脅建模與安全需求基線.md`、`04-資料治理與隱私風險基線.md` |

## 4. ADR 最低格式

凡需要 ADR 的變更，至少記錄以下欄位。可以集中在本文，也可以後續拆成 `ADR-xxxx.md`；未拆分前，本文是架構決策主入口。

| 欄位 | 必填口徑 |
| --- | --- |
| ADR ID | `EMO-ADR-###`，不得複用舊語義 |
| 標題 | 一句話描述架構決策 |
| 狀態 | Proposed / Accepted / Superseded / Deprecated / Rejected |
| 日期 | 決策日期或最後重審日期 |
| 背景 | 觸發問題、約束、現碼事實、外部標準或平台限制 |
| 決策 | 採用什麼方案，不採用什麼方案 |
| 被排除選項 | 至少列出主要替代方案與排除理由；簡單變更可標不適用 |
| 影響面 | Web / App / Admin / Backend / DB / shared package / ops / docs |
| 安全與隱私影響 | 是否新增信任邊界、資料類別、身份來源、外部 provider 或本地存儲 |
| 驗證方式 | Test / Analysis / Inspection / Demonstration / release gate / Baseline Pending |
| 需同步文件 | PRD、NFR、RTM、接口、Parity、待辦或治理台賬 |
| 回滾 / 重審條件 | 何時需要撤銷、替代或升級決策 |

## 5. 當前架構決策登記

| ADR ID | 狀態 | 決策 | 依據與影響面 |
| --- | --- | --- | --- |
| EMO-ADR-001 | Accepted | 採用單 repo、repo-local backend / mobile、root workspace 僅含 `frontend`、`frontend-admin`、`packages/*` | `package.json` workspaces 與 `backend/package.json`、`mobile/package.json` 現況一致；`mobile` 以 `file:../packages/*` dependency + Metro alias 消費 shared packages；影響本地安裝、CI、Vercel / EAS build 與 shared package 接線 |
| EMO-ADR-002 | Accepted | `packages/contracts` / `packages/api-client` 作共享層入口，但 backend 只消費 declaration artifact，不直接編譯共享 src | 避免 backend `rootDir` 邊界穿越；影響 contracts build、backend tsconfig 與接口契約治理 |
| EMO-ADR-003 | Accepted | App 不直接繼承 Web route / storage / guard；App navigation、SecureStore、Push、Deep Link、upload、SSE、telemetry adapter 以 `20/01` 與 `50/01` 為 gate | `mobile/app` 已從 Expo template 轉為 Emorapy route group / screen，`mobile/src/platform` 已有 runtime adapter；M6 strict release sign-off 前仍不得把 Web、simulator 或 dry-run 證據誤宣稱為 TestFlight / 真機 / provider / release DB 完成 |
| EMO-ADR-004 | Accepted | 身份、session、case ownership、media authorization 與高風險安全路由由 backend 裁決；Web/App 只能提交上下文 | `backend/src/middleware/auth.ts`、case classifier、safety routing 與 media auth 為授權真相；影響所有平台投影 |
| EMO-ADR-005 | Accepted | quick judgment、interview、chat、repair replan 歸入統一 AI stream / ledger 家族，新增 AI runtime 必須接入 prompt version、ledger 與 output gate | `backend/src/services/ai-request-ledger.service.ts`、AI stream routes、prompt version utilities 與 AI 風險基線共同承接 |
| EMO-ADR-006 | Accepted | 發布成立不只看 build / health，必須保留 release gate、version、DB parity、smoke 與 evidence wrapper 證據 | `scripts/ops-release-gate.sh`、`scripts/ops-release-gate-evidence.sh` 與 SLO / incident 基線承接 |
| EMO-ADR-007 | Accepted | 架構、共享層、API contract、DB schema、AI runtime、安全邊界或 App adapter 的變更必須觸發 ADR 或更新本文決策登記 | ADR governance gate 已建立；後續若 ADR 數量增長，應拆分為獨立 ADR 目錄 |
| EMO-ADR-008 | Accepted | DB schema、migration history、shared contracts、API response 與 App storage schema 的破壞性或 contract-sensitive 變更必須按 expand / backfill / compatibility / contract 分階段治理 | `backend/prisma/schema.prisma`、`backend/prisma/migrations`、`backend/scripts/check-release-db-parity.ts`、`05/03` 與 `08/06` 共同承接；不得把 migration commit 視作 release DB parity |
| EMO-ADR-009 | Accepted | 完整 App 版正式採用 Expo + React Native + TypeScript，iOS 優先、Android 兼容、單一 `mobile/` codebase；不採用 SwiftUI-only、Flutter 或 Capacitor 作主線 | `mobile/package.json` 已是 Expo / React Native；`20-App端/02-App完整版本工程PRD.md` 與 `20-App端/03-App完整版本開發Roadmap.md` 承接工程 PRD / Roadmap；影響 App、shared package、Web API client 下沉、測試與 release evidence |
| EMO-ADR-010 | Accepted；Production evidence 由正式 release gate 裁決 | 私密上下文採 `Private Analyst -> strict Mediation Controls -> Shared Mediator` 隔離；私人內容可改善共同流程但不得作秘密證據，只有本人批准的 versioned Context Capsule 可擴大 audience；正式梳理拆成 evidence-only Decision Core 與不可改結論的 Delivery Renderer | channel、policy、capsule、exact approval、Web/App flow、Decision Core/Renderer、persisted Judgment recovery、shared Repair containment 與 release hardening 已進入 `main@30c21bb`；本地全量測試及 fresh DB migration/backfill/audit 已通過。是否已發布只由 exact main SHA 的 `Production Deploy and Verify`、release artifacts 與線上 canary 裁決；cross-case memory 及 legacy data lifecycle 仍由 [Chat 私密上下文待辦](../07-待處理問題與治理/待處理/Chat私密上下文與共同調解隔離重構待辦-2026-07-12.md) 追蹤 |

## 5.1 App 技術路線排除選項

| 選項 | 排除理由 | 後續可用場景 |
| --- | --- | --- |
| SwiftUI-only | 會形成 Swift + TypeScript 雙棧，Android 後續需重做，降低 Codex / Claude Code 在現有 TypeScript 資產上的復用效率 | 只在必要時作 iOS native module 或小範圍 platform-specific extension |
| Flutter | 跨平台成熟，但會放棄現有 `@emorapy/contracts`、`@emorapy/api-client`、Web domain helper 與 TypeScript 測試資產 | 不作完整 App 主線 |
| Capacitor | 可快速包 Web，但 Emorapy 需要 SecureStore、Push、Deep Link、native upload、stream recovery 與 touch-first App flow | 只可作極短期 demo，不作正式產品方向 |

## 6. 需要 ADR 的變更類型

| 變更類型 | 是否必須 ADR | 同步文件 |
| --- | --- | --- |
| root workspace、package manager、CI 安裝策略、Vercel build 策略變更 | MUST | `05/00`、`05/01`、release / ops 文檔 |
| 新增 shared package、改動 contracts/api-client 消費邊界 | MUST | `05/Repo平台分層與共享規範.md`、`06/11`、Parity |
| backend auth/session/case ownership/media authorization 變更 | MUST | `01-認證與會話/`、`04/05`、接口文檔、RTM |
| DB schema 對 Web/App/API/shared 造成雙邊同步要求 | MUST | `05/03`、`08/06`、`50/01`、待處理任務、接口文檔、release DB parity |
| rename / drop 欄位、改 required、收窄 enum、unique/FK/trigger/constraint 收緊、大表 rewrite 或 production DB hotfix | MUST | `05/03`、`08/06`、NFR、RTM、release gate、post-release evidence |
| 新 AI runtime、AI provider、prompt version 或 AI output downstream action | MUST | `04/03`、`04/05`、NFR、RTM、AI 證據 |
| App navigation、SecureStore、Push、Deep Link、upload runtime adapter | MUST | `20/01`、`50/01`、`08/03`、資料治理與威脅建模 |
| 完整 App Roadmap milestone、EAS release policy、Android readiness 變更 | MUST | `20/02`、`20/03`、`50/01`、`08/03`、RTM、待辦 |
| SLO、metrics、release gate、incident workflow 變更 | SHOULD；若影響發布阻斷則 MUST | `03/06`、NFR、RTM、ops runbook |
| 單頁 UI 或文案調整且不改架構邊界 | MAY | 對應 Web / App 平台文件 |

## 7. 當前缺口

| 缺口 ID | 對標基線 | 現狀 | 風險 | 處置 |
| --- | --- | --- | --- | --- |
| EMO-ADR-GAP-001 | ISO 42010 | 有 repo 分層文件，但缺少 stakeholder / concern / viewpoint / view 的正式架構描述 | 架構文件容易退化為目錄說明，無法支撐審查與交接 | 本文先建立文字版視圖層級；正式圖集待建立 |
| EMO-ADR-GAP-002 | C4 model | 尚無 C4 Context / Container / Component 圖 | 新人、運維與安全審查難以快速定位邊界 | 後續可新增 Mermaid / C4 圖，但需與現碼核對 |
| EMO-ADR-GAP-003 | SSDF / secure design review | 高風險變更已有多份治理文件，但沒有統一 ADR 變更 gate | API、DB、AI、App adapter 變更可能只改局部文件 | 本文與文檔治理規則補 ADR 觸發矩陣 |
| EMO-ADR-GAP-004 | Architecture correspondence | PRD、NFR、RTM、接口、Parity 與架構決策仍主要靠人工鏈接 | 需求到架構取捨的可審計性不足 | 新增 `EMO-NFR-016` 與 `EMO-RTM-014` 追蹤 |
| EMO-ADR-GAP-005 | Migration compatibility | schema / migration / API / shared contract 相容性過去散落在待辦與 release gate | 破壞性 DB 變更可能缺少架構取捨、回滾 / 前滾與舊 client 影響分析 | 新增 `05/03`、`08/06`、`EMO-NFR-019` 與 `EMO-RTM-018` |

## 8. 維護規則

1. ADR 不替代 PRD、NFR、接口文檔、Parity 或測試；它只記錄架構取捨與變更理由。
2. 若 ADR 宣稱某能力已完成，必須能追到代碼、測試、release evidence 或正式規格；否則標為待承接或待建立基線。
3. 涉及安全、隱私、AI、App native storage、Push、Deep Link、media、metrics 或外部 provider 的 ADR，必須同步回查 `04-共用機制/05-威脅建模與安全需求基線.md`。
4. ADR 狀態變更為 Superseded / Deprecated / Rejected 時，需保留原決策，不得刪除歷史理由。
5. 架構圖若新增，必須能追到本文視圖層級與現碼入口，不得用理想化圖替代現狀。
6. 涉及 schema migration、release DB parity、backfill、棄用、shared contract compatibility 或 production DB hotfix 的 ADR，必須同步回查 `03-資料模型SchemaMigration與相容性治理基線.md` 與 `08-測試規範與驗收/06-SchemaMigration與相容性驗收基線.md`。
