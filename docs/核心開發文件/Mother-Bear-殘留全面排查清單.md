# Mother-Bear 殘留全面排查清單

**文檔版本**：v1.0  
**最後更新**：2026-03-05  
**掃描範圍**：`/Users/alex/Desktop/CJ/mother-bear-court`（前端、後端、文件、配置、CI、腳本、暫存資料）  
**掃描關鍵字**：`Mother Bear`、`mother-bear`、`mother_bear`、`motherbearcourt`、`mbc`、`BearJudge`、`bear-judge`、`熊媽媽法庭`、`熊熊法官`  

---

## 1) 口徑與判定規則

- `需清除`：會對外露出舊品牌、或會誤導新開發/部署的現行文件與配置。
- `可保留（歷史）`：歷史方案/報告/品牌探索文檔，可封存但不應作現行 SSOT。
- `誤報`：命中 `bear` 但屬技術術語（例如 `Bearer token`），不屬 Mother-Bear 品牌殘留。
- `遷移相容性`：改名可能影響 CI、DB 連線、監控查詢、部署腳本或現網服務識別。

---

## 2) 高優先：產品露出與對外訊息（需清除）

| 類別 | 檔案 | 命中摘要 | 風險 | 建議處理 | 遷移相容性 |
|---|---|---|---|---|---|
| 前端 i18n | `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/assets/i18n/en-US.ts` | `Mother Bear Court`、`Bear Judge`、`Chat with Bear` 等對外字串 | 高 | 先整包替換對外文案，再做 key 重命名（如有） | 否 |
| 前端 i18n | `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/assets/i18n/zh-TW.ts` | `熊熊法官`、`與熊熊聊聊` 等對外字串 | 高 | 與英文本同步替換，避免多語系殘留 | 否 |
| 前台首頁 | `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/pages/Home/components/FlowSimulation.tsx` | 內文含 `Mother Bear` | 高 | 改為新品牌文案，並核對動畫/假資料文本 | 否 |
| 前端 SEO | `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/App.tsx` | SEO image path 含 `/images/bear-judge/mother-bear-judge-large.png` | 中 | 改路徑與檔名，避免對外 metadata 洩漏舊命名 | 否 |
| Admin SEO | `/Users/alex/Desktop/CJ/mother-bear-court/frontend-admin/src/App.tsx` | （已清理）不再引用舊 `mother-bear-judge` SEO 圖片路徑 | 低 | 維持現狀，後續僅檢查是否回流 | 否 |
| Admin HTML | `/Users/alex/Desktop/CJ/mother-bear-court/frontend-admin/index.html` | `<title>Mother Bear Court Admin</title>` | 高 | 直接替換標題與品牌詞 | 否 |
| 郵件服務 | `/Users/alex/Desktop/CJ/mother-bear-court/backend/src/services/email.service.ts` | 郵件主旨/寄件顯示含 `熊媽媽法庭` | 高 | 優先改（會直接觸達用戶） | 否 |
| 告警服務 | `/Users/alex/Desktop/CJ/mother-bear-court/backend/src/services/ops-alerts.service.ts` | `Mother Bear Court Ops Alert` | 高 | 改告警標題與通知模板 | 否 |
| logger 服務名 | `/Users/alex/Desktop/CJ/mother-bear-court/backend/src/config/logger.ts` | `service=mother-bear-court-backend` | 高 | 改 service tag 並同步 observability 查詢 | 是（監控查詢） |
| 根 README | `/Users/alex/Desktop/CJ/mother-bear-court/README.md` | 標題/內文仍為 Mother Bear Court | 高 | 改為新品牌入口說明 | 否 |
| 後端 README | `/Users/alex/Desktop/CJ/mother-bear-court/backend/README.md` | 標題仍為 Mother Bear Court | 中 | 同步替換 | 否 |
| 文件入口 | `/Users/alex/Desktop/CJ/mother-bear-court/docs/backend/README.md` | 文件標題含 Mother Bear Court | 中 | 若仍被引用為現行文檔，需替換 | 否 |
| 文件入口 | `/Users/alex/Desktop/CJ/mother-bear-court/docs/frontend/README.md` | 文件標題含 Mother Bear Court | 中 | 同上 | 否 |

---

## 3) 中優先：工程命名耦合（元件/樣式/鍵名/儲存鍵）

| 類別 | 檔案 | 命中摘要 | 風險 | 建議處理 | 遷移相容性 |
|---|---|---|---|---|---|
| 元件命名 | `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/components/business/BearJudge/index.tsx` | `BearJudge`、`BearJudgeProps`、`appearance='bear'`、`bearJudge.*` i18n key | 中 | 規劃一次 rename（元件名 + props + i18n key） | 是（前端引用） |
| 元件樣式 | `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/components/business/BearJudge/BearJudge.less` | `.bear-judge`、`.appearance-bear` | 中 | CSS class 與 JSX 同步改名 | 是（樣式選擇器） |
| 頁面樣式 | `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/pages/Home/Home.less` | `.hero-image .bear-judge` | 中 | 跟元件 class 批次替換 | 是 |
| 頁面樣式 | `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/pages/QuickExperience/Create/Create.less` | `.bear-judge` 引用 | 中 | 同上 | 是 |
| 頁面樣式 | `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/pages/QuickExperience/Result/Result.less` | `.bear-judge` 引用 | 中 | 同上 | 是 |
| i18n key 註解 | `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/assets/i18n/en-US.ts` | `bearJudge.aria.*` key 與註解 | 中 | 改成中性命名空間，保留過渡映射 | 是（語系 key） |
| i18n key 註解 | `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/assets/i18n/zh-TW.ts` | `bearJudge.aria.*` key 與註解 | 中 | 同上 | 是 |
| aria/圖示 | `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/components/business/Interview/ChatBubble/index.tsx` | `aria-label='bear'` + 🐻 | 中 | 若去熊化，改 icon 與 aria 語意 | 否 |
| storage key | `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/utils/i18n.ts` | `LOCALE_STORAGE_KEY='mbc_locale'` | 中 | 先讀舊寫新（雙 key 過渡） | 是（使用者偏好） |
| storage key | `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/utils/constants.ts` | `SESSION_STORAGE_KEY='mbc_session_id'` | 中 | 新增 v2 key + 遷移策略 | 是（session 相容） |

### 3.1 BearJudge 前端使用點（需一併改名）

- `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/pages/Home/index.tsx`
- `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/pages/Case/Create/index.tsx`
- `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/pages/Case/Review/index.tsx`
- `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/pages/Judgment/Detail/index.tsx`
- `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/pages/Reconciliation/List/index.tsx`
- `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/pages/QuickExperience/Create/index.tsx`
- `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/pages/QuickExperience/Collaborative/index.tsx`
- `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/pages/QuickExperience/Result/components/ResultHeader.tsx`
- `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/pages/Auth/Login/index.tsx`
- `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/pages/Auth/Register/index.tsx`
- `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/pages/Auth/ForgotPassword/index.tsx`

---

## 4) 高/中優先：配置、CI、資料與運維腳本

| 類別 | 檔案 | 命中摘要 | 風險 | 建議處理 | 遷移相容性 |
|---|---|---|---|---|---|
| env 範本 | `/Users/alex/Desktop/CJ/mother-bear-court/backend/.env.example` | `DATABASE_URL` 使用者/DB 名稱含 `mbc`、`mbc_dev`；檔頭含品牌 | 高 | 先定新 DB 命名，再改範本 | 是（DB 連線） |
| CI workflow | `/Users/alex/Desktop/CJ/mother-bear-court/.github/workflows/ci.yml` | `mbc`、`mbc_dev`、`mbc_flow_test` | 高 | CI DB 命名與測試初始化同步更名 | 是（CI/migration） |
| 測試 DB | `/Users/alex/Desktop/CJ/mother-bear-court/backend/tests/setup.ts` | fallback DB `mother_bear_court_test` | 中 | 與 CI/本地測試統一新命名 | 是 |
| 開發文檔 | `/Users/alex/Desktop/CJ/mother-bear-court/backend/DEVELOPMENT.md` | `DATABASE_URL` 範例含 `mbc`、`mbc_dev` | 低 | 與 `.env.example` 改名策略同步 | 否（文件層） |
| 開發文檔 | `/Users/alex/Desktop/CJ/mother-bear-court/docs/backend/DEVELOPMENT.md` | `DATABASE_URL` 範例含 `mbc`、`mbc_dev` | 低 | 與 `.env.example` 改名策略同步 | 否（文件層） |
| 前端 env 範本 | `/Users/alex/Desktop/CJ/mother-bear-court/frontend/.env.example` | `VITE_APP_TITLE` 註解含品牌 | 低 | 文案替換 | 否 |
| admin env 範本 | `/Users/alex/Desktop/CJ/mother-bear-court/frontend-admin/.env.example` | 檔頭含品牌 | 低 | 文案替換 | 否 |
| 根 package | `/Users/alex/Desktop/CJ/mother-bear-court/package.json` | `"name":"mother-bear-court-root"` | 中 | 改名前先盤點 CI cache 與腳本依賴 | 可能 |
| 後端 package | `/Users/alex/Desktop/CJ/mother-bear-court/backend/package.json` | `"name":"mother-bear-court-backend"` | 中 | 同步改部署/監控標識 | 可能 |
| e2e package | `/Users/alex/Desktop/CJ/mother-bear-court/e2e/package.json` | `"name":"mbc-admin-e2e"` | 中 | 更名並同步報表/pipeline 標籤 | 可能 |
| 部署腳本 | `/Users/alex/Desktop/CJ/mother-bear-court/scripts/deploy.sh` | PM2 名稱 `mother-bear-court-backend` + 品牌文案 | 中 | 改 process name 與輸出文案 | 是（部署一致性） |
| 健康腳本 | `/Users/alex/Desktop/CJ/mother-bear-court/scripts/health-check.sh` | `grep "mother-bear-court"` | 中 | 改為新服務名或可配置變數 | 是（監控腳本） |
| 驗證腳本 | `/Users/alex/Desktop/CJ/mother-bear-court/scripts/verify-deployment.sh` | 文案含品牌 | 低 | 文案替換 | 否 |
| 驗證腳本 | `/Users/alex/Desktop/CJ/mother-bear-court/scripts/validate-env.sh` | 文案含品牌 | 低 | 文案替換 | 否 |
| 生產腳本 | `/Users/alex/Desktop/CJ/mother-bear-court/scripts/setup-production.sh` | 文案含品牌 | 低 | 文案替換 | 否 |
| git 腳本 | `/Users/alex/Desktop/CJ/mother-bear-court/scripts/setup-git.sh` | 預設 commit message 含 `熊媽媽法庭` | 低 | 替換模板 | 否 |

### 4.1 暫存資料與報表（Data/Other）

| 類別 | 檔案 | 命中摘要 | 風險 | 建議處理 | 遷移相容性 |
|---|---|---|---|---|---|
| bench/tmp 資料 | `/Users/alex/Desktop/CJ/mother-bear-court/backend/tmp/bench-reports/ops-alert-check.json` | `apiBaseUrl` 指向 `mother-bear-court-production...` | 低 | 歸檔或重跑生成新報表 | 否 |
| test/tmp 資料 | `/Users/alex/Desktop/CJ/mother-bear-court/backend/tmp/test-reports/gate-unknown-bool.json` | 報表路徑含專案舊命名 | 低 | 視為歷史資料，可清空 tmp | 否 |
| test/tmp 資料 | `/Users/alex/Desktop/CJ/mother-bear-court/backend/tmp/test-reports/gate-empty-bool.json` | 報表路徑含專案舊命名 | 低 | 同上 | 否 |
| bench/tmp 資料 | `/Users/alex/Desktop/CJ/mother-bear-court/backend/tmp/bench-reports/chat-concurrency-gate-report.json` | 報表路徑含專案舊命名 | 低 | 同上 | 否 |
| bench/tmp 資料 | `/Users/alex/Desktop/CJ/mother-bear-court/backend/tmp/bench-reports/chat-active-roles-fix-plan.json` | `outputSqlPath` 含專案舊命名 | 低 | 同上 | 否 |

---

## 5) 文檔層殘留（需分「現行」與「歷史」）

### 5.1 現行/運維參考文檔（建議清除）

| 檔案 | 命中摘要 | 風險 | 建議處理 |
|---|---|---|---|
| `/Users/alex/Desktop/CJ/mother-bear-court/docs/backend/DEPLOYMENT.md` | `mother-bear-court-backend` 映像/PM2 名稱 | 中 | 與實際部署腳本同步改名 |
| `/Users/alex/Desktop/CJ/mother-bear-court/backend/DEPLOYMENT.md` | 同上 | 中 | 同上 |
| `/Users/alex/Desktop/CJ/mother-bear-court/docs/backend/JWT_SECRET_ROTATION_RUNBOOK.md` | Railway service `mother-bear-court` | 中 | 改 Runbook 指令參數 |
| `/Users/alex/Desktop/CJ/mother-bear-court/docs/後端設計/11-部署和運維.md` | `motherbearcourt.com`、`EMAIL_FROM` 舊域名 | 中 | 替換網域與寄件設定 |
| `/Users/alex/Desktop/CJ/mother-bear-court/docs/前端設計/06-狀態管理與API設計.md` | `api.motherbearcourt.com` | 中 | 更新 API 範例 |
| `/Users/alex/Desktop/CJ/mother-bear-court/docs/功能特性清單.md` | 舊品牌命名仍存在 | 低 | 若仍給團隊參考，建議改為新品牌版 |

### 5.2 歷史文檔可保留（建議標註 archived）

- `/Users/alex/Desktop/CJ/mother-bear-court/docs/00-項目總覽.md`
- `/Users/alex/Desktop/CJ/mother-bear-court/docs/01-項目概述.md`
- `/Users/alex/Desktop/CJ/mother-bear-court/docs/02-產品設計.md`
- `/Users/alex/Desktop/CJ/mother-bear-court/docs/03-市場分析.md`
- `/Users/alex/Desktop/CJ/mother-bear-court/docs/04-心理學分析.md`
- `/Users/alex/Desktop/CJ/mother-bear-court/docs/05-商業模式.md`
- `/Users/alex/Desktop/CJ/mother-bear-court/docs/06-國際市場.md`
- `/Users/alex/Desktop/CJ/mother-bear-court/docs/07-IP形象設計.md`
- `/Users/alex/Desktop/CJ/mother-bear-court/docs/08-品牌規範.md`
- `/Users/alex/Desktop/CJ/mother-bear-court/docs/09-和好方案設計.md`
- `/Users/alex/Desktop/CJ/mother-bear-court/docs/10-MVP開發計劃.md`
- `/Users/alex/Desktop/CJ/mother-bear-court/docs/單聊轉群聊再判決-v1設計方案.md`
- `/Users/alex/Desktop/CJ/mother-bear-court/docs/文件結構說明.md`
- `/Users/alex/Desktop/CJ/mother-bear-court/docs/reports/環境報告_06_CI全棧管理台E2E環境_2026-03-05.md`
- `/Users/alex/Desktop/CJ/mother-bear-court/docs/reports/平台控制台環境變數清單_2026-03-05.md`
- `/Users/alex/Desktop/CJ/mother-bear-court/docs/reports/平台實際部署執行結果_2026-03-05.md`
- `/Users/alex/Desktop/CJ/mother-bear-court/docs/reports/會話報告_2026-03-01.md`
- `/Users/alex/Desktop/CJ/mother-bear-court/docs/reports/聊天室會話報告_2026-03-01.md`
- `/Users/alex/Desktop/CJ/mother-bear-court/UPGRADE_PLAN_PERSONALIZED_JUDGMENT.md`

建議：此批不必即刻刪除，但應明確標註「歷史品牌資料，不作現行決策依據」。

---

## 6) 測試與報表層命名殘留（低優先）

| 類別 | 代表檔案 | 命中摘要 | 建議處理 |
|---|---|---|---|
| 前端測試 mock | `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/pages/Auth/Login/index.test.tsx` 等多檔 | `data-testid='bear-judge'`、`BearJudge` mock | 元件改名時同批替換測試選擇器 |
| 常量測試 | `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/utils/constants.test.ts` | 斷言 `mbc_session_id` | 與 storage key 遷移策略同步調整 |
| 語系測試 | `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/test/setup.ts` | 測試預設 `mbc_locale` | 讀舊寫新策略落地後調整 |
| lock/coverage/tmp | `package-lock`、`backend/coverage-*`、`backend/tmp/*` | 舊字串多為歷史生成內容 | 可接受，待批次重建/清理時自然消失 |

---

## 7) 誤報與排除規則（不屬品牌殘留）

以下命中 `bear`，但屬技術術語 `Bearer`，不應列為 Mother-Bear 品牌殘留：

- `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/services/request.ts`
- `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/services/api/chat.ts`
- `/Users/alex/Desktop/CJ/mother-bear-court/frontend/src/services/api/admin.ts`
- `/Users/alex/Desktop/CJ/mother-bear-court/backend/src/middleware/auth.ts`
- `/Users/alex/Desktop/CJ/mother-bear-court/backend/src/middleware/adminAuth.ts`
- `/Users/alex/Desktop/CJ/mother-bear-court/docs/後端設計/05-中間件和安全.md`

---

## 8) 優先清理順序（建議執行）

1. **第一批（立即）**  
   對外露出：i18n、首頁文案、Admin title、郵件模板、告警標題、README 入口。
2. **第二批（風險控制）**  
   配置與基礎設施：CI DB 命名、`.env.example`、package/service 名稱、部署健康腳本。
3. **第三批（重構）**  
   `BearJudge` 元件與樣式命名、i18n key namespace、測試選擇器與快照。
4. **第四批（收尾）**  
   歷史文檔加 archive 標註、清理 tmp/coverage/報表再生成。

---

## 9) 最小回歸檢查清單

- 前台/管理台頁面標題、導航、SEO 文案不再出現 Mother-Bear 相關詞。
- 郵件主旨、寄件名稱、告警標題已換新品牌。
- CI 可正常跑 migration + test（DB 名稱改動後）。
- PM2/部署腳本/健康檢查使用新服務名仍可正常監測。
- `mbc_*` storage key 改動後，舊用戶語言與 session 行為可平滑過渡。
- `BearJudge` 重命名後，關聯頁面與測試全部通過。

---

## 10) 備註

- 本清單已去重並明確區分「需清除」與「可保留（歷史）」。
- 若要進入實際清理，建議建立對應執行文檔：`品牌去耦-執行清單.md`，逐批次跟蹤 PR 與回歸結果。

---

## 11) 可執行清理批次表（Batch-1~4）

> 目標：讓工程可直接依批次派工。每一批都包含「範圍、風險、回滾點、驗收門檻」。

| 批次 | 變更範圍 | 核心檔案 | 主要動作 | 風險級別 | 回滾點 | 驗收門檻 |
|---|---|---|---|---|---|---|
| Batch-1 對外露出清理 | 文案與對外可見品牌詞 | `frontend/src/assets/i18n/*.ts`、`frontend/src/pages/Home/components/FlowSimulation.tsx`、`frontend-admin/index.html`、`backend/src/services/email.service.ts`、`backend/src/services/ops-alerts.service.ts`、`README.md` | 替換所有 Mother-Bear 對外字串；保持功能邏輯不變 | 中 | 保留替換前文案快照；如發現漏字可整批回退到前一版文案檔 | 前台/後台頁面、郵件模板、告警標題均不再出現舊品牌詞 |
| Batch-2 配置與運維識別名 | CI、env 範例、部署腳本、服務標識 | `.github/workflows/ci.yml`、`backend/.env.example`、`backend/tests/setup.ts`、`scripts/deploy.sh`、`scripts/health-check.sh`、`backend/src/config/logger.ts`、`package*.json` | 調整 `mbc_*`/`mother-bear-*` 命名，統一新服務識別策略 | 高 | 先保留舊命名 alias（至少一版）；CI 失敗時可切回舊 DB 名稱與舊 process 名 | CI migration+test 全綠；部署後健康檢查可讀；監控查詢可定位新 service tag |
| Batch-3 元件與前端命名去耦 | `BearJudge` 命名與樣式命名 | `frontend/src/components/business/BearJudge/*` + 所有引用頁 + 對應測試檔 | 元件/樣式/testid/i18n key 命名重構，必要時加過渡 alias | 高 | 先引入過渡層（舊 export re-export 新元件）；逐頁切換後再刪 alias | 前端編譯通過；關聯頁面 UI 正常；單測與快照更新完成 |
| Batch-4 歷史資料與收尾 | 歷史 docs、tmp/coverage/reports | `docs/reports/*`、`backend/tmp/*`、歷史設計文檔 | 歷史文檔加 archive 標註；清理/重建暫存報表 | 低 | 保留原報表壓縮包或 git tag；需要追溯時可恢復 | 現行文檔不再混用舊品牌；暫存資料不影響開發與判讀 |

### 11.1 批次執行守門規則

- 每批完成前必做：關鍵詞掃描（`mother-bear|Mother Bear|熊媽媽|BearJudge|mbc_`）差異比對。
- 任何涉及命名變更的批次，必須附「相容策略」：舊鍵讀取、舊服務名 alias、過渡 export。
- Batch-2 與 Batch-3 禁止同一 PR 同時落地，避免故障定位困難。

### 11.2 建議 PR 切分

- PR-A：Batch-1（純文案與對外露出）
- PR-B：Batch-2（配置/CI/部署）
- PR-C：Batch-3（前端重構）
- PR-D：Batch-4（收尾與歸檔）

---

## 12) 執行進度（2026-03-05）

- Batch-1：已完成（對外文案、郵件、告警、README 入口替換）
- Batch-2：已完成（CI/env/腳本/服務識別名更新，保留必要過渡兼容）
- Batch-3：已完成（`MediatorAvatar` 全量切換 + 已移除 `BearJudge` 相容層）
- Batch-4：已完成（歷史文檔/報告加 `ARCHIVED` 標註；`backend/tmp`、`*/test-results`、`backend/coverage-auth-only` 可重建產物已清理）
- 追加收斂：已完成 `frontend-admin/src/App.tsx` SEO 圖片路徑去舊命名、前端 locale/session key 改為 `cj_*` 並保留讀舊寫新遷移
- 驗證結果：關鍵詞回掃後，程式碼中僅保留預期兼容殘留（`logger` legacy service、`health-check` 舊服務名 regex、`frontend` storage legacy key 過渡）。
