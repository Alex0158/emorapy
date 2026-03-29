# Source Map

## 核心產品與流程文檔

- `README.md`
- `docs/快速體驗優化說明.md`
- `docs/前端設計/07-交互流程與用戶體驗設計.md`
- `docs/測試/02-專項測試設計/Emorapy-F01-快速體驗建案與結果測試設計與開發拆解-20260307.md`
- `docs/測試/01-基線與總覽/Emorapy-測試明細清單-按模組分組-20260307.md`

## 前端核心文件

### Create 與 session

- `frontend/src/pages/QuickExperience/Create/index.tsx`
- `frontend/src/store/sessionStore.ts`
- `frontend/src/store/caseStore.ts`
- `frontend/src/services/api/session.ts`
- `frontend/src/services/api/case.ts`

### Result 與回訪

- `frontend/src/pages/QuickExperience/Result/index.tsx`
- `frontend/src/services/request.ts`
- `frontend/src/utils/storage.ts`
- `frontend/src/services/api/judgment.ts`

### 責任比例呈現

- `frontend/src/components/business/ResponsibilityRatio/index.tsx`
- `frontend/src/utils/markdown.ts`

## 後端核心文件

### Quick case / session

- `backend/src/services/session.service.ts`
- `backend/src/controllers/session.controller.ts`
- `backend/src/routes/session.routes.ts`
- `backend/src/services/case.service.ts`
- `backend/src/controllers/case.controller.ts`
- `backend/src/routes/case.routes.ts`
- `backend/src/utils/validation.ts`

### Judgment / responsibility ratio

- `backend/src/services/judgment.service.ts`
- `backend/src/services/ai.service.ts`
- `backend/src/utils/judgment.ts`
- `backend/src/routes/judgment.routes.ts`

### 升格與 claim-session

- `backend/src/services/auth.service.ts`
- `backend/src/controllers/auth.controller.ts`
- `backend/src/routes/auth.routes.ts`
- `frontend/src/store/authStore.ts`

## 高價值測試

### F01 主鏈路

- `backend/tests/integration/quick-experience.flow.test.ts`
- `frontend/e2e/chat/quick-experience-flow.e2e.ts`

### 前端重點

- `frontend/src/pages/QuickExperience/Create/index.test.tsx`
- `frontend/src/pages/QuickExperience/Result/index.test.tsx`
- `frontend/src/services/request.test.ts`
- `frontend/src/store/sessionStore.test.ts`
- `frontend/src/utils/storage.test.ts`

### API / judgment

- `frontend/src/services/api/case.test.ts`
- `frontend/src/services/api/session.test.ts`
- `frontend/src/services/api/judgment.test.ts`
- `backend/tests/unit/services/judgment.service.test.ts`

## 推薦閱讀順序

1. `docs/快速體驗優化說明.md`
2. `docs/測試/02-專項測試設計/Emorapy-F01-快速體驗建案與結果測試設計與開發拆解-20260307.md`
3. `frontend/src/pages/QuickExperience/Result/index.tsx`
4. `frontend/src/services/request.ts`
5. `frontend/src/store/sessionStore.ts`
6. `frontend/src/utils/storage.ts`
7. `backend/src/services/judgment.service.ts`
8. `backend/src/services/ai.service.ts`

## 快速排查對照

| 問題類型 | 先看哪裡 |
|---|---|
| session 過期、回訪失敗 | `request.ts`、`sessionStore.ts`、`storage.ts` |
| 被告可否留空 | `validation.ts`、`case.service.ts`、Create 頁測試設計文檔 |
| 責任比例不合理 | `ai.service.ts`、`judgment.service.ts`、Result 頁、ResponsibilityRatio |
| 補證據邊界 | Result 頁、`case.service.ts`、F01 測試設計文檔 |
| 註冊後資料是否接續 | `auth.service.ts`、`authStore.ts`、`claim-session` 相關測試 |
