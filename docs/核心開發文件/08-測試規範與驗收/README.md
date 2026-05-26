# 測試規範與驗收

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：08-測試規範與驗收 子域入口、閱讀順序、需求驗證、App 測試、可訪問性、本地化、schema migration、相容性、SLO 可觀測性與事故演練驗收
**取證代碼入口**：`backend/tests`、`backend/src/routes/health.routes.ts`、`backend/src/routes/metrics.routes.ts`、`backend/src/services/ops-alerts.service.ts`、`backend/prisma/schema.prisma`、`backend/prisma/migrations`、`backend/scripts/check-release-db-parity.ts`、`backend/package.json`、`package.json`、`frontend/src/**/*.test.tsx`、`frontend/e2e/**/*.ts`、`e2e/**/*.ts`、`frontend/src/hooks/useAccessibility.ts`、`frontend/src/utils/i18n.ts`、`frontend/src/assets/i18n`、`frontend-admin/src/utils/i18n.ts`、`frontend-admin/src/assets/i18n`、`scripts`、`mobile/app`、`mobile/src/platform`
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-11`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本目錄承接可作為長期依據的測試策略、覆蓋規則、驗收口徑與高位執行指引。

當前長期取證入口以實際倉庫結構為準：

1. `backend/tests`
2. `frontend/src/**/*.test.tsx`
3. `frontend/e2e/**/*.ts`
4. `e2e/**/*.ts`
5. `backend/scripts/web-p0-true-service-smoke.ts`（Web P0 true-service / release-like smoke；mutating runner，需顯式 opt-in）
6. `scripts/`
7. `mobile/app`、`mobile/src/platform`（僅作 App 測試缺口取證入口；尚無正式 App smoke / regression / CI gate）

上述入口目前主要覆蓋 Backend、Web、Admin Web、跨站真服務與發布/手動回歸腳本；`mobile/` 尚未形成 CJ App smoke / regression / CI 測試入口。App 測試落地前，不得把現有 Web/Admin 測試通過推斷為 App 已驗收。

本目錄不單獨定義以下產品正式語義：

1. 功能是否存在
2. 頁面哪裡是正式主入口
3. API 屬於已使用、候選廢棄或已確認廢棄
4. 業務流程的正式主鏈是什麼

若測試文檔與產品正式語義衝突，仍以 `核心開發文件/` 根層旗艦文檔、對應正式子域與現碼為準。

當前正式文檔：

1. [01-測試文檔分層與使用規則.md](./01-測試文檔分層與使用規則.md)
2. [02-AI流式與Chat治理驗收基線.md](./02-AI流式與Chat治理驗收基線.md)
3. [03-App測試與證據接入基線.md](./03-App測試與證據接入基線.md)（完整 App M0-M6 測試 gate、jest-expo、React Native Testing Library、Maestro、EAS build smoke 與真機/模擬器證據口徑）
4. [04-需求驗證矩陣.md](./04-需求驗證矩陣.md)（App PRD / Roadmap 需求到驗證條目的 RTM 入口）
5. [05-可訪問性本地化驗收基線.md](./05-可訪問性本地化驗收基線.md)
6. [06-SchemaMigration與相容性驗收基線.md](./06-SchemaMigration與相容性驗收基線.md)
7. [07-SLO可觀測性與事故演練驗收基線.md](./07-SLO可觀測性與事故演練驗收基線.md)

活躍案例、回歸包與補充證據，統一從 [../測試/README.md](../測試/README.md) 與 [../90-證據與盤點/README.md](../90-證據與盤點/README.md) 進入。歷史測試設計、缺陷分析與一次性報告一律在根級 `歸檔/` 回看。

若新增 App smoke、Deep Link、Push、SecureStore/session restore、upload 或 App API adapter 測試，必須同步回寫 [../20-App端/02-App完整版本工程PRD.md](../20-App端/02-App完整版本工程PRD.md)、[../20-App端/03-App完整版本開發Roadmap.md](../20-App端/03-App完整版本開發Roadmap.md)、[../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md)、[../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)，並在必要時更新 [../07-待處理問題與治理/README.md](../07-待處理問題與治理/README.md) 下的待辦。

若新增 AI / LLM 風險驗證、prompt injection 測試、AI output downstream gate、API contract、OpenAPI、schema contract test、schema migration、DB parity、backfill、SLO / health / metrics / incident drill、release gate evidence、狀態機 transition 驗證、錯誤模型驗證、可訪問性驗證或本地化驗證，必須同步回查 [04-需求驗證矩陣.md](./04-需求驗證矩陣.md)、[05-可訪問性本地化驗收基線.md](./05-可訪問性本地化驗收基線.md)、[06-SchemaMigration與相容性驗收基線.md](./06-SchemaMigration與相容性驗收基線.md)、[07-SLO可觀測性與事故演練驗收基線.md](./07-SLO可觀測性與事故演練驗收基線.md)、[../04-共用機制/03-AI風險與安全治理基線.md](../04-共用機制/03-AI風險與安全治理基線.md)、[../04-共用機制/06-狀態機與業務不變式治理基線.md](../04-共用機制/06-狀態機與業務不變式治理基線.md)、[../04-共用機制/07-可訪問性本地化與內容設計治理基線.md](../04-共用機制/07-可訪問性本地化與內容設計治理基線.md)、[../05-工程架構與共享層/03-資料模型SchemaMigration與相容性治理基線.md](../05-工程架構與共享層/03-資料模型SchemaMigration與相容性治理基線.md)、[../06-接口描述/11-API契約與OpenAPI缺口台賬.md](../06-接口描述/11-API契約與OpenAPI缺口台賬.md) 或 [../06-接口描述/12-錯誤模型與ProblemDetails缺口台賬.md](../06-接口描述/12-錯誤模型與ProblemDetails缺口台賬.md)，不得把單一測試通過寫成完整治理完成。

Web P0 true-service evidence 固定入口為根層 `npm run web:p0:true-service:smoke`。該命令由 `backend/scripts/web-p0-true-service-smoke.ts` 執行，必須顯式設定 `RUN_WEB_P0_TRUE_SERVICE_SMOKE=true` 才會建立測試資料，並以 `WEB_P0_SMOKE_REPORT_PATH=docs/核心開發文件/90-證據與盤點/環境與發版驗證/Web-P0-True-Service-<timestamp>.json` 留存 artifact；`AI_MOCK=true` 可用於 no-cost release-like smoke，但仍必須連到真 backend 與 target `DATABASE_URL`。若 `DATABASE_URL` 非 localhost / 127.0.0.1 / ::1，必須額外設定 `WEB_P0_SMOKE_ALLOW_REMOTE_DB=true`，表示 target owner 已確認可寫入測試資料。2026-05-12 已取得本機 local backend + local Postgres + local Redis + `AI_MOCK=true` pass artifact：`90-證據與盤點/環境與發版驗證/Web-P0-True-Service-Local-2026-05-12T19-08-00+08-00.json`；此證據不替代 release / production target artifact 或 Admin credential-backed E2E。沒有 artifact 的 raw console output、mock-backed Playwright、preflight blocker 或 credential-gated skip 不能宣稱 P0 release evidence 完成。

Admin credential-backed E2E 固定入口為 `npm --prefix e2e run test -- --reporter=json`。正式證據必須設定 `E2E_BASE_URL`、`E2E_ADMIN_EMAIL`、`E2E_ADMIN_PASSWORD`；若要覆蓋低權限拒絕流程，還必須設定 `E2E_LIMITED_ADMIN_EMAIL`、`E2E_LIMITED_ADMIN_PASSWORD`，並用 `E2E_STRICT=true` 防止 credential 缺失時 silent skip。2026-05-12 已取得本機 Admin Web + local backend + local Postgres pass artifact：`90-證據與盤點/環境與發版驗證/Web-Admin-Credential-E2E-Local-2026-05-12T19-39-30+08-00.json`，10/10 passed、0 skipped、0 unexpected；此證據不替代 release / production target credential evidence。

Web / Admin manual A11Y evidence 固定入口為根層 `npm run web:a11y:manual-evidence:check`。該命令由 `scripts/check-web-a11y-manual-evidence.mjs` 以 strict mode 驗證 `90-證據與盤點/環境與發版驗證/Web-A11Y-Manual-*.json`；正式 pass artifact 必須包含 keyboard-only quick experience、case list/detail、notifications、chat room、auth、Admin login、Admin ops jobs，至少一組 screen reader pass run，並覆蓋 modal / dropdown / toast / upload / form validation / async loading / error recovery / remaining route-state matrix 等 `interactive_surfaces`。artifact path 必須可解析，且必須保留 `non_claims`。`Web-A11Y-Manual-Evidence-Template.json` 與 `npm run web:a11y:manual-evidence:template:check` 只用於準備 evidence 形狀，不替代人工驗收。

Web / Admin 相關待處理任務的 completion audit 固定入口為根層 `npm run web:pending:completion:audit`、`npm run web:pending:completion:audit:contract` 與 `npm run web:pending:completion:audit:strict`。non-strict audit 只作盤點，contract gate 固定 JSON / blocker / strict exit-code 口徑，strict gate 在缺正式 `Web-A11Y-Manual-*.json` 與 `AI-Pricing-Release-Env-*.json` pass artifact 時必須失敗，不得被總測試綠燈替代。
