# 全局單元測試補充 - 覆蓋報告

## 執行摘要

依計畫完成後端重複檔清理、前端未覆蓋模組補測，以及組件與頁面淺層測試。

---

## 一、Backend

- **清理**：已刪除 `backend/tests/unit/utils/cache.test 2.ts`。
- **覆蓋率**：執行 `npm run test:coverage` 已達門檻（All files: 94.34% statements, 86.44% branches, 92.12% functions, 94.66% lines；門檻 90/80/87/90）。
- **測試**：`npm run test:unit` 通過，65 個 suite、738 個 test。

---

## 二、Frontend 新增測試檔案清單

### Utils（3）
- `frontend/src/utils/accessibility.test.ts`
- `frontend/src/utils/animations.test.ts`
- `frontend/src/utils/cache.test.ts`

### Hooks（3）
- `frontend/src/hooks/usePollingJudgment.test.ts`
- `frontend/src/hooks/useAccessibility.test.tsx`
- `frontend/src/hooks/useAnimation.test.tsx`

### Store（4）
- `frontend/src/store/authStore.test.ts`
- `frontend/src/store/judgmentStore.test.ts`
- `frontend/src/store/reconciliationStore.test.ts`
- `frontend/src/store/sessionStore.test.ts`

### Services（1）
- `frontend/src/services/request.test.ts`

### Config（3）
- `frontend/src/config/api.test.ts`
- `frontend/src/config/env.test.ts`
- `frontend/src/config/validation.test.ts`

### Components（16）
- `frontend/src/components/business/BearJudge/index.test.tsx`
- `frontend/src/components/business/FileUpload/index.test.tsx`
- `frontend/src/components/business/JudgmentViewer/index.test.tsx`
- `frontend/src/components/business/ResponsibilityRatio/index.test.tsx`
- `frontend/src/components/business/StatementInput/index.test.tsx`
- `frontend/src/components/common/AnimatedCard/index.test.tsx`
- `frontend/src/components/common/AnimatedWrapper/index.test.tsx`
- `frontend/src/components/common/GuideTooltip/index.test.tsx`
- `frontend/src/components/common/KeyboardShortcuts/index.test.tsx`
- `frontend/src/components/common/ScrollToTop/index.test.tsx`
- `frontend/src/components/feedback/Toast/index.test.ts`
- `frontend/src/components/layout/AppLayout.test.tsx`
- `frontend/src/components/layout/AuthLayout.test.tsx`
- `frontend/src/components/layout/Footer.test.tsx`
- `frontend/src/components/layout/Header.test.tsx`
- `frontend/src/components/layout/SimpleLayout.test.tsx`

### Pages（11）
- `frontend/src/pages/Case/Detail/index.test.tsx`
- `frontend/src/pages/Case/Review/index.test.tsx`
- `frontend/src/pages/Execution/CheckIn/index.test.tsx`
- `frontend/src/pages/Judgment/Detail/index.test.tsx`
- `frontend/src/pages/Profile/Index/index.test.tsx`
- `frontend/src/pages/Profile/Pairing/index.test.tsx`
- `frontend/src/pages/Profile/Settings/index.test.tsx`
- `frontend/src/pages/QuickExperience/Create/index.test.tsx`
- `frontend/src/pages/QuickExperience/Result/index.test.tsx`
- `frontend/src/pages/Reconciliation/Detail/index.test.tsx`
- `frontend/src/pages/Reconciliation/List/index.test.tsx`

---

## 三、如何執行覆蓋率與測試

- **全部單元測試（後端必跑，前端若已安裝依賴則跑）**：專案根目錄執行 `./scripts/run-all-unit-tests.sh`
- **Backend**：`cd backend && npm run test:unit` 或 `npm run test:coverage`
- **Frontend**：`cd frontend && npm run test:run` 或 `npm run test:coverage`
  - 若出現 `vitest: command not found` 或 `ERR_MODULE_NOT_FOUND: vitest`，請先安裝依賴：
    - 專案根目錄執行：`./scripts/fix-frontend-deps.sh`（會刪除 `frontend/node_modules` 並重新 `npm install`）
    - 或手動：`cd frontend && rm -rf node_modules && npm install`
  - 前端已設定覆蓋率門檻（`vitest.config.ts`）：statements 60%、branches 50%、functions 55%、lines 60%，可依需要調整

---

## 四、Confidence

- **Backend**：**high** — 覆蓋率已達 jest 門檻，關鍵路徑有單元測試。
- **Frontend**：**medium** — 新增 utils/hooks/store/services/config 與多數組件、頁面之單元/淺層測試；部分組件與頁面為「可掛載、不崩潰」等級，未達 100% 行/分支覆蓋，可依 `npm run test:coverage` 再補用例。

---

## 五、實施完成摘要與後續步驟

- **已完成**：後端重複檔清理、後端覆蓋率達標、前端 41 個新測試檔（utils/hooks/store/services/config/components/pages）、`fix-frontend-deps.sh`、`run-all-unit-tests.sh`、README 與覆蓋報告說明。
- **本機前端測試**：若 `npm run test:run` 報 `vitest: command not found`，請在專案根目錄執行 `./scripts/fix-frontend-deps.sh`，完成後執行 `./scripts/run-all-unit-tests.sh` 可一併跑後端與前端單元測試。
- **CI**：`.github/workflows/ci.yml` 已包含後端與前端單元測試步驟；CI 環境會執行 `npm ci`，前端依賴安裝正常時會跑 `npm run test:run`。
