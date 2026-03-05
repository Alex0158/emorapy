# 前端狀態管理與 API 設計（代碼對齊版）

**文檔版本**：v4.0  
**最後更新**：2026-03-05  
**對齊基準**：`frontend/src/store/*`、`frontend/src/services/*`、`frontend/src/pages/Admin/*`

---

## 1. 狀態管理總覽

目前採「**Zustand（業務狀態）+ React Query（Admin 查詢）+ Axios/fetch API 層**」混合模式。

### 1.1 Zustand Store（主業務流）

實際存在：

- `authStore`
- `sessionStore`（快速體驗 session）
- `caseStore`
- `judgmentStore`
- `reconciliationStore`
- `executionStore`
- `interviewStore`
- `psychProfileStore`

### 1.2 React Query（目前集中在 Admin）

主要用於：

- Admin Users / Configs / Jobs / Health / AuditLogs / Reports
- hooks：`useAdminMe`、`useAdminSession`、`useAdminJobStats`

---

## 2. Store 設計（按實作）

## 2.1 `authStore`

關鍵狀態：

- `user`
- `token`
- `isAuthenticated`
- `isLoading`
- `_hasHydrated`

關鍵行為：

- `login/register`：依 `rememberMe` 把 token 存 `localStorage` 或 `sessionStorage`
- `checkAuth`：啟動時讀 token，再打 `getProfile`
- `logout`：會重置 `interviewStore` / `psychProfileStore` / `caseStore` 並 `cancelAllRequests`
- 透過 `requestAuthBridge` 接收全局 401 登出觸發

持久化規則：

- Zustand persist 只持久化 `user`
- `token` 由 `onRehydrateStorage` 重新從 storage 恢復（避免 rememberMe 語義錯位）

## 2.2 `sessionStore`（快速體驗）

關鍵狀態：

- `session`
- `isLoading`
- `error`

關鍵行為：

- `createSession`（`POST /sessions/quick`）
- `refreshSession`（`POST /sessions/refresh`）
- `checkSessionExpiry`（提前 5 分鐘視為過期）
- 內建 in-flight 去重（create/refresh 各自單飛）

## 2.3 `caseStore`

範圍偏「快速體驗鏈路」：

- `createQuickCase`
- `submitCase`
- `getCase`
- `currentCase` 管理

有序請求保護：

- `_reqSeq` 防止舊請求覆蓋新狀態

## 2.4 `judgmentStore`

- `generateJudgment`
- `getJudgment`
- `getJudgmentByCaseId`
- `currentJudgment` 管理
- 同樣用 `_reqSeq` 避免競態覆蓋

## 2.5 `reconciliationStore`

- `getPlans`
- `generatePlans`
- `selectPlan`
- `selectedPlan` 管理

## 2.6 `executionStore`

- `confirmExecution`
- `checkin`
- `getExecutionStatus`
- `currentExecution` 管理

## 2.7 `interviewStore`（SSE 核心）

關鍵狀態：

- `currentSession`
- `turns`
- `streamingText`
- `isStreaming`
- `shouldEnd`
- `safetyAlert`
- `error/errorCode`

關鍵行為：

- `startSession`
- `checkResume`
- `respond`（SSE）
- `skipTurn`（SSE）
- `endSession`
- `getSession`
- `retryFailed`
- `cancelStream`

SSE 事件落地：

- `token` -> 累積 `streamingText`
- `metadata` -> 保存回合意圖等元數據
- `safety_alert` -> 設置 `safetyAlert`
- `complete` -> 合併 session 狀態與 domains
- `error` -> `error/errorCode`

## 2.8 `psychProfileStore`

- `fetchProfile`
- `fetchFeedbackHistory`
- `giveConsent`
- `deleteAllData`（會同步 reset `interviewStore`）

---

## 3. API 層設計

## 3.1 `request.ts`（Axios 核心）

基礎能力：

- `baseURL = env.apiBaseURL`
- 30s timeout
- 全局 request/response interceptor

請求攔截：

- 自動附 `Authorization`（非 admin API）
- 自動附 `X-Session-Id`（快速體驗）
- 自動附 `X-Locale`
- 每個請求註冊 `AbortController`（可取消）

響應攔截（重點）：

- 400/401 對 session 類錯誤會自動 refresh
- 401 普通 API：清 token + 觸發 logout + 跳 `/auth/login`
- 401 admin API：走 admin token 清理與 admin 登入導轉
- 404/409 針對特定快速體驗場景抑制全局彈窗，交由頁面處理

## 3.2 `sseRequest.ts`（訪談流式）

- 使用 `fetch` + `ReadableStream`
- 事件：`token` / `metadata` / `safety_alert` / `complete` / `error`
- 超時：
  - 首 token 30s
  - 連線無事件 60s

## 3.3 API 模塊（實際檔案）

- `auth.ts`
- `user.ts`
- `session.ts`
- `pairing.ts`
- `case.ts`
- `judgment.ts`
- `reconciliation.ts`
- `execution.ts`
- `interview.ts`
- `psychProfile.ts`
- `chat.ts`
- `admin.ts`

---

## 4. 併發與一致性策略（前端）

- Store 層普遍使用 `_reqSeq` 防 stale response 覆蓋
- Session 建立/刷新使用 in-flight 去重
- HTTP 請求可被單請求或全局取消（登出時會全 cancel）
- SSE 支援 `AbortController`，離開頁面可中斷流

---

## 5. 邊界與已知現況

- React Query 目前主要服務 Admin，不是全站 server-state 標準層
- 業務主流程（快速體驗/訪談/判決）主要由 Zustand + API wrappers 驅動
- 文檔中的 store/API 若與代碼衝突，一律以 `frontend/src/store` 與 `frontend/src/services` 為準
# 熊媽媽法庭 - 狀態管理與API設計

**項目名稱**：熊媽媽法庭（Mother Bear Court）  
**設計階段**：MVP開發階段  
**文檔版本**：v3.2

---

## 🗄️ 狀態管理設計

### 狀態管理架構

**技術選型**：
- **Zustand**：輕量級狀態管理，用於客戶端狀態
- **TanStack React Query**：服務器狀態管理，用於 API 數據緩存和同步

**狀態分類**：
1. **客戶端狀態**：UI 狀態、表單狀態、本地配置
2. **服務器狀態**：用戶數據、案件數據、判決數據

**實現對齊**：當前 Store 為 `authStore`、`sessionStore`（快速體驗）、`caseStore`、`judgmentStore`、`reconciliationStore`、`executionStore`；無獨立 `userStore`/`uiStore`，用戶資料可經 `authStore` 或 API 直接獲取。

---

## 📦 Zustand Store設計

### 1. AuthStore 認證狀態

#### 1.1 Store結構

```typescript
interface AuthState {
  // 狀態
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // 操作
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}
```

#### 1.2 狀態說明

**token**：
- **類型**：`string | null`
- **用途**：存儲JWT Token
- **存儲**：`localStorage`（勾選「記住我」）或 `sessionStorage`（未勾選，關閉瀏覽器即失效）
- **過期時間**：24小時（後端 JWT 配置）；前端依據儲存位置控制會話持續性
- **注意**：Zustand persist 只持久化 `user`，不持久化 `token`，避免 rememberMe 語義被繞過。App 啟動時透過 `onRehydrateStorage` 從對應 Storage 重新讀取 token。

**user**：
- **類型**：`User | null`
- **用途**：存儲當前登錄用戶信息
- **結構**：
  ```typescript
  interface User {
    id: string;
    email: string;
    nickname: string;
    avatarUrl?: string;
    relationshipStatus: string;
  }
  ```

**isAuthenticated**：
- **類型**：`boolean`
- **用途**：標記用戶是否已登錄
- **計算**：基於token和user是否存在

**isLoading**：
- **類型**：`boolean`
- **用途**：標記認證操作是否進行中

**error**：
- **類型**：`string | null`
- **用途**：存儲認證錯誤信息

#### 1.3 操作方法

**login**：
- **參數**：`email: string, password: string, rememberMe?: boolean`
- **流程**：
  1. 設置isLoading為true
  2. 調用登錄API
  3. 保存token和user
  4. 如果rememberMe，保存到localStorage
  5. 設置isAuthenticated為true
  6. 設置isLoading為false
- **錯誤處理**：設置error，顯示Toast提示

**logout**：
- **流程**：
  1. 清除token和user
  2. 清除localStorage
  3. 設置isAuthenticated為false
  4. 跳轉到首頁

**register**：
- **參數**：`data: RegisterData`
- **流程**：
  1. 設置isLoading為true
  2. 調用註冊API
  3. 自動登錄
  4. 設置isLoading為false
- **錯誤處理**：設置error，顯示Toast提示

---

### 2. UserStore 用戶狀態

#### 2.1 Store結構

```typescript
interface UserState {
  // 狀態
  profile: UserProfile | null;
  pairing: Pairing | null;
  isLoading: boolean;
  error: string | null;
  
  // 操作
  fetchProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  createPairing: () => Promise<Pairing>;
  joinPairing: (inviteCode: string) => Promise<void>;
  cancelPairing: () => Promise<void>;
}
```

#### 2.2 狀態說明

**profile**：
- **類型**：`UserProfile | null`
- **用途**：存儲用戶詳細資料
- **結構**：
  ```typescript
  interface UserProfile {
    id: string;
    email: string;
    nickname: string;
    avatarUrl?: string;
    gender?: string;
    age?: number;
    relationshipStatus: string;
    language: string;
    timezone?: string;
    notificationEnabled: boolean;
    privacyLevel: string;
  }
  ```

**pairing**：
- **類型**：`Pairing | null`
- **用途**：存儲配對信息
- **結構**：
  ```typescript
  interface Pairing {
    id: string;
    user1Id: string;
    user2Id?: string;
    inviteCode: string;
    status: 'pending' | 'active' | 'cancelled';
    createdAt: string;
    confirmedAt?: string;
  }
  ```

---

### 3. CaseStore 案件狀態

#### 3.1 Store結構

```typescript
interface CaseState {
  // 狀態
  currentCase: Case | null;
  cases: Case[];
  isLoading: boolean;
  error: string | null;
  
  // 操作
  createCase: (data: CreateCaseData) => Promise<Case>;
  fetchCase: (id: string) => Promise<Case>;
  fetchCases: (filters?: CaseFilters) => Promise<Case[]>;
  updateCase: (id: string, data: Partial<Case>) => Promise<Case>;
  submitCase: (id: string) => Promise<void>;
}
```

#### 3.2 狀態說明

**currentCase**：
- **類型**：`Case | null`
- **用途**：存儲當前查看/編輯的案件
- **結構**：
  ```typescript
  interface Case {
    id: string;
    pairingId: string;
    title: string;
    type: string;
    subType?: string;
    plaintiffId: string;
    defendantId: string;
    plaintiffStatement: string;
    defendantStatement?: string;
    status: 'draft' | 'submitted' | 'in_progress' | 'completed' | 'cancelled';
    mode: 'remote' | 'collaborative';
    createdAt: string;
    updatedAt: string;
    submittedAt?: string;
    completedAt?: string;
  }
  ```

**cases**：
- **類型**：`Case[]`
- **用途**：存儲案件列表
- **緩存**：使用React Query緩存

---

### 4. JudgmentStore 判決狀態

#### 4.1 Store結構

```typescript
interface JudgmentState {
  // 狀態
  currentJudgment: Judgment | null;
  isLoading: boolean;
  error: string | null;
  
  // 操作
  generateJudgment: (caseId: string) => Promise<Judgment>;
  fetchJudgment: (id: string) => Promise<Judgment>;
  acceptJudgment: (id: string, accepted: boolean, rating?: number) => Promise<void>;
}
```

#### 4.2 狀態說明

**currentJudgment**：
- **類型**：`Judgment | null`
- **用途**：存儲當前判決
- **結構**：
  ```typescript
  interface Judgment {
    id: string;
    caseId: string;
    judgmentContent: string; // Markdown格式
    summary?: string;
    responsibilityRatio: {
      plaintiff: number; // 0-100
      defendant: number; // 0-100
    };
    aiModel: string;
    user1Acceptance?: boolean;
    user2Acceptance?: boolean;
    user1Rating?: number;
    user2Rating?: number;
    createdAt: string;
  }
  ```

---

### 5. UIStore UI狀態

#### 5.1 Store結構

```typescript
interface UIState {
  // 狀態
  theme: 'light' | 'dark';
  language: 'zh' | 'en';
  sidebarCollapsed: boolean;
  loading: boolean;
  globalError: string | null;
  
  // 操作
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (lang: 'zh' | 'en') => void;
  toggleSidebar: () => void;
  setLoading: (loading: boolean) => void;
  setGlobalError: (error: string | null) => void;
}
```

#### 5.2 狀態說明

**theme**：
- **類型**：`'light' | 'dark'`
- **用途**：主題模式（MVP階段僅支持light）
- **存儲**：localStorage

**language**：
- **類型**：`'zh' | 'en'`
- **用途**：語言設置（MVP階段僅支持zh）
- **存儲**：localStorage

**sidebarCollapsed**：
- **類型**：`boolean`
- **用途**：側邊欄摺疊狀態
- **存儲**：localStorage

**loading**：
- **類型**：`boolean`
- **用途**：全局加載狀態

**globalError**：
- **類型**：`string | null`
- **用途**：全局錯誤信息

---

## 🌐 React Query設計

### Query Keys規範

**命名規範**：`[entity, id?, filters?]`

**示例**：
```typescript
// 用戶資料
['user', 'profile']
['user', 'pairing']

// 案件
['cases']
['cases', caseId]
['cases', 'list', filters]

// 判決
['judgments', judgmentId]
['judgments', 'case', caseId]

// 和好方案
['reconciliation-plans', judgmentId]
['reconciliation-plans', judgmentId, planId]
```

### Query配置

**默認配置**：
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5分鐘
      cacheTime: 10 * 60 * 1000, // 10分鐘
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true, // 網絡重連時重新獲取
      refetchOnMount: true, // 組件掛載時重新獲取
    },
  },
});
```

**根據數據類型調整配置**：

**用戶資料（重要數據）**：
```typescript
{
  staleTime: 5 * 60 * 1000, // 5分鐘
  cacheTime: 10 * 60 * 1000, // 10分鐘
  refetchOnWindowFocus: true, // 窗口聚焦時重新獲取
}
```

**案件列表（實時數據）**：
```typescript
{
  staleTime: 1 * 60 * 1000, // 1分鐘
  cacheTime: 5 * 60 * 1000, // 5分鐘
  refetchOnWindowFocus: true,
}
```

**判決結果（靜態數據）**：
```typescript
{
  staleTime: 30 * 60 * 1000, // 30分鐘
  cacheTime: 60 * 60 * 1000, // 1小時
  refetchOnWindowFocus: false,
}
```

**臨時數據（表單草稿）**：
```typescript
{
  staleTime: 0, // 立即過期
  cacheTime: 5 * 60 * 1000, // 5分鐘
  refetchOnWindowFocus: false,
}
```

### 常用Query Hooks

**useUserProfile**：
```typescript
const useUserProfile = () => {
  return useQuery(
    ['user', 'profile'],
    () => api.user.getProfile(),
    {
      enabled: !!authStore.isAuthenticated,
    }
  );
};
```

**useCases**：
```typescript
const useCases = (filters?: CaseFilters) => {
  return useQuery(
    ['cases', 'list', filters],
    () => api.case.getList(filters),
    {
      enabled: !!authStore.isAuthenticated,
    }
  );
};
```

**useJudgment**：
```typescript
const useJudgment = (judgmentId: string) => {
  return useQuery(
    ['judgments', judgmentId],
    () => api.judgment.get(judgmentId),
    {
      enabled: !!judgmentId,
    }
  );
};
```

### Mutation Hooks

**useCreateCase**：
```typescript
const useCreateCase = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    (data: CreateCaseData) => api.case.create(data),
    {
      onSuccess: (newCase) => {
        // 更新案件列表緩存
        queryClient.invalidateQueries(['cases', 'list']);
        // 設置當前案件
        caseStore.setCurrentCase(newCase);
      },
    }
  );
};
```

**useGenerateJudgment**：
```typescript
const useGenerateJudgment = () => {
  const queryClient = useQueryClient();
  
  return useMutation(
    (caseId: string) => api.judgment.generate(caseId),
    {
      onSuccess: (judgment) => {
        // 更新判決緩存
        queryClient.setQueryData(['judgments', judgment.id], judgment);
        // 更新案件狀態
        queryClient.invalidateQueries(['cases', caseId]);
      },
    }
  );
};
```

---

## 🔌 API設計

### API基礎配置

**Base URL**：
- 開發環境：`http://localhost:3001/api/v1`
- 生產環境：`https://api.motherbearcourt.com/api/v1`

**請求頭**：
```typescript
{
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`, // 需要認證的請求
}
```

**響應格式**：
```typescript
// 成功響應
{
  success: true,
  data: T,
  message?: string,
}

// 錯誤響應
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: any,
  },
}
```

### API端點設計

#### 認證相關

**POST /auth/register**
- **用途**：用戶註冊
- **請求體**：
  ```typescript
  {
    email: string;
    password: string;
    nickname?: string;
  }
  ```
- **響應**：
  ```typescript
  {
    user: User;
    token: string;
  }
  ```

**POST /auth/login**
- **用途**：用戶登錄
- **請求體**：
  ```typescript
  {
    email: string;
    password: string;
    rememberMe?: boolean;
  }
  ```
- **響應**：同註冊

**POST /auth/verify-email**
- **用途**：驗證郵箱驗證碼
- **請求體**：
  ```typescript
  {
    email: string;
    code: string;
  }
  ```

**POST /auth/reset-password**
- **用途**：發送重置密碼郵件
- **請求體**：
  ```typescript
  {
    email: string;
  }
  ```

#### 用戶相關

**GET /user/profile**
- **用途**：獲取用戶資料
- **認證**：需要
- **響應**：`UserProfile`

**PUT /user/profile**
- **用途**：更新用戶資料
- **認證**：需要
- **請求體**：`Partial<UserProfile>`

#### 配對相關

**POST /pairing/create**
- **用途**：創建配對邀請
- **認證**：需要
- **響應**：
  ```typescript
  {
    pairing: Pairing;
  }
  ```

**POST /pairing/join**
- **用途**：加入配對
- **認證**：需要
- **請求體**：
  ```typescript
  {
    inviteCode: string;
  }
  ```

#### 案件相關

**POST /cases**
- **用途**：創建案件
- **認證**：需要（完整模式）或不需要（快速體驗模式）
- **請求體**：
  ```typescript
  {
    pairingId?: string; // 完整模式需要
    title: string;
    type?: string; // AI自動判斷，可選
    plaintiffStatement: string;
    defendantStatement: string;
    evidenceUrls?: string[];
  }
  ```
- **響應**：`Case`

**GET /cases**
- **用途**：獲取案件列表
- **認證**：需要
- **查詢參數**：
  ```typescript
  {
    status?: string;
    type?: string;
    page?: number;
    pageSize?: number;
    sort?: string;
    search?: string;
  }
  ```
- **響應**：
  ```typescript
  {
    cases: Case[];
    total: number;
    page: number;
    pageSize: number;
  }
  ```

**GET /cases/:id**
- **用途**：獲取案件詳情
- **認證**：需要（檢查權限）
- **響應**：`Case`

**PUT /cases/:id**
- **用途**：更新案件
- **認證**：需要（檢查權限）
- **請求體**：`Partial<Case>`

**POST /cases/:id/submit**
- **用途**：提交案件
- **認證**：需要（檢查權限）

#### 判決相關

**POST /judgments/generate/:id**
- **用途**：生成判決
- **認證**：需要（檢查權限）
- **響應**：`Judgment`

**GET /judgments/:id**
- **用途**：獲取判決詳情（統一接口，符合RESTful規範）
- **認證**：完整模式需要（檢查權限），快速體驗模式使用session_id驗證
- **響應**：`Judgment`

**POST /judgments/:id/accept**
- **用途**：接受/拒絕判決
- **認證**：需要（檢查權限）
- **請求體**：
  ```typescript
  {
    accepted: boolean;
    rating?: number; // 1-5
  }
  ```

#### 和好方案相關

**POST /judgments/:id/reconciliation-plans**
- **用途**：生成和好方案
- **認證**：需要（檢查權限）
- **響應**：
  ```typescript
  {
    plans: ReconciliationPlan[];
  }
  ```

**GET /judgments/:id/reconciliation-plans**
- **用途**：獲取和好方案列表
- **認證**：需要（檢查權限）
- **響應**：`ReconciliationPlan[]`

**POST /reconciliation-plans/:id/select**
- **用途**：選擇和好方案
- **認證**：需要（檢查權限）

#### 執行相關

**POST /execution/confirm**
- **用途**：確認執行和好方案
- **認證**：需要（檢查權限）
- **請求體**：
  ```typescript
  {
    planId: string;
  }
  ```

**POST /execution/checkin**
- **用途**：執行打卡
- **認證**：需要（檢查權限）
- **請求體**：
  ```typescript
  {
    planId: string;
    notes?: string;
    photos?: string[];
  }
  ```

**GET /execution/dashboard**
- **用途**：獲取執行看板
- **認證**：需要
- **響應**：
  ```typescript
  {
    activePlans: ExecutionRecord[];
    completedPlans: ExecutionRecord[];
    statistics: {
      totalPlans: number;
      completedPlans: number;
      completionRate: number;
    };
  }
  ```

#### 管理員後台（運維）相關

**Admin 前端模組分層（已實作）**：
- `services/api/admin.ts`：集中管理 admin API、token 存取、標準化器。
- `hooks/useAdminSession.ts`：登入/登出會話管理（login mutation + token 寫入）。
- `hooks/useAdminMe.ts`、`hooks/useAdminAccess.ts`：身份與 RBAC 取用。
- `components/common/AdminPermissionRoute.tsx`：路由層權限守衛。
- `components/common/AdminSectionLayout.tsx`：管理端導航骨架。

**已覆蓋 Admin API（前端可操作）**：
- 認證：`POST /admin/login`、`GET /admin/me`
- 健康：`GET /admin/health/detailed`
- 任務：`GET /admin/jobs`、`GET /admin/jobs/stats`、`POST /admin/jobs/:jobKey/trigger`
- 配置：`GET/PUT /admin/configs`、`GET /admin/runtime/interview`
- 用戶：`GET /admin/users`、`GET /admin/users/:userId`、`PATCH /admin/users/:userId/status`
- 審計：`GET /admin/audit-logs`、`GET /admin/audit-logs.csv`
- 報表：`GET /admin/reports/overview`、`GET /admin/reports/funnel`、`POST /admin/reports/custom`
- 治理：`PUT /admin/alerts/rules`、`PUT /admin/feature-flags`
- 管理員：`GET/POST /admin/admin-users`、`PATCH /admin/admin-users/:adminUserId`
- 管理員（刪除）：`DELETE /admin/admin-users/:adminUserId`（軟刪除）

**權限模式（混合策略）**：
- 一般管理頁：`any`（具備任一 required permission 即可）
- 高敏頁面/端點：`all`（需具備全部 required permissions）
- 目前高敏示例：`/admin/audit-logs`（`users:read` + `ops:read`）、`PUT /admin/alerts/rules`（`alerts:write` + `ops:execute`）

**GET /admin/jobs/stats**
- **用途**：Cron 執行統計看板（運維）
- **認證**：需要 Admin JWT + `ops:read`
- **查詢參數**：
  ```typescript
  interface AdminJobStatsQuery {
    days?: number;                 // 1~90，默認 7
    includeRunning?: boolean;      // 默認 true
    maxRows?: number;              // 100~20000，默認 5000
  }
  ```
- **響應（核心字段）**：
  ```typescript
  type RateBase = 'total_runs' | 'completed_runs';

  interface AdminJobStatsRow {
    totalRuns: number;
    successRuns: number;
    failedRuns: number;
    runningRuns: number;
    completedRuns: number;
    successRate: number;
    failureRate: number;
    successRateCompleted: number;
    failureRateCompleted: number;
  }

  interface AdminJobStatsResponse {
    days: number;
    since: string;
    totals: AdminJobStatsRow & { avgDurationMs: number };
    perJob: Array<AdminJobStatsRow & {
      jobKey: string;
      avgDurationMs: number;
      totalAffectedCount: number;
      lastRunAt: string;
    }>;
    dailyBuckets: Array<AdminJobStatsRow & { date: string }>;
    rateBase: RateBase;
    statsMeta: {
      maxRows: number;
      returnedRows: number;
      sampled: boolean;
      sampleStrategy: string;
    };
  }
  ```

**前端落地模板（建議放 `src/services/admin/jobStats.ts`）**：
```typescript
type RateBase = 'total_runs' | 'completed_runs';

interface StatsMeta {
  maxRows: number;
  returnedRows: number;
  sampled: boolean;
  sampleStrategy: 'latest_runs_desc';
}

interface JobStatsPayload {
  rateBase?: RateBase; // 舊版後端可能缺少
  statsMeta?: Partial<StatsMeta>;
  // ...其餘字段沿用 API 契約
  [key: string]: unknown;
}

interface NormalizedJobStatsPayload extends JobStatsPayload {
  rateBase: RateBase;
  statsMeta: StatsMeta;
}

export function normalizeJobStatsPayload(raw: JobStatsPayload): NormalizedJobStatsPayload {
  const rateBase: RateBase =
    raw.rateBase === 'completed_runs' ? 'completed_runs' : 'total_runs';

  const meta = raw.statsMeta ?? {};
  const maxRows = Number(meta.maxRows ?? 5000);
  const returnedRows = Number(meta.returnedRows ?? 0);
  const sampled = Boolean(meta.sampled);

  return {
    ...raw,
    rateBase,
    statsMeta: {
      maxRows: Number.isFinite(maxRows) ? maxRows : 5000,
      returnedRows: Number.isFinite(returnedRows) ? returnedRows : 0,
      sampled,
      sampleStrategy:
        meta.sampleStrategy === 'latest_runs_desc' ? 'latest_runs_desc' : 'latest_runs_desc',
    },
  };
}

export function getRateDenominatorLabel(rateBase: RateBase): 'totalRuns' | 'completedRuns' {
  return rateBase === 'completed_runs' ? 'completedRuns' : 'totalRuns';
}

export function shouldShowSampledHint(payload: NormalizedJobStatsPayload): boolean {
  return payload.statsMeta.sampled === true;
}
```

**前端渲染防呆（必做）**：
- 一律使用 `payload.rateBase` 決定成功率/失敗率解讀分母。
- `payload.statsMeta.sampled=true` 時，圖表顯示「資料已採樣」提示。
- `dailyBuckets` 直接渲染，不做前端二次補洞，避免和後端補零邏輯衝突。
- 若欄位缺失或型別異常，先經 `normalizeJobStatsPayload` 後再進圖表層，避免 runtime crash。

---

## 🔒 錯誤處理設計

### 錯誤類型

**網絡錯誤**：
- 超時（Timeout）
- 連接失敗（Network Error）
- 服務器錯誤（500+）
- DNS解析失敗

**業務錯誤**：
- 驗證錯誤（400）：表單驗證失敗、參數錯誤
- 認證錯誤（401）：Token過期、未登錄
- 權限錯誤（403）：無權限訪問
- 資源不存在（404）：資源已刪除、路徑錯誤
- 業務邏輯錯誤（422）：業務規則違反

### 統一錯誤格式

```typescript
interface ApiError {
  code: string;           // 錯誤代碼
  message: string;        // 錯誤消息（用戶友好）
  details?: any;          // 錯誤詳情（開發用）
  timestamp: string;      // 錯誤時間
  requestId?: string;     // 請求ID（用於追蹤）
}
```

### 錯誤處理流程

1. **API攔截器捕獲錯誤**
2. **錯誤分類和優先級**：
   - **P0（嚴重）**：401、500+（立即處理）
   - **P1（重要）**：403、404（顯示提示）
   - **P2（一般）**：400、422（表單驗證）
3. **根據錯誤類型處理**：
   - **401（認證錯誤）**：
     - 清除token和用戶信息
     - 跳轉到登錄頁
     - 顯示「登錄已過期，請重新登錄」提示
   - **403（權限錯誤）**：
     - 顯示「無權限訪問此資源」提示
     - 提供聯繫支持按鈕
   - **404（資源不存在）**：
     - 顯示「資源不存在或已刪除」提示
     - 提供返回按鈕
   - **422（業務錯誤）**：
     - 顯示具體的業務錯誤提示
     - 提供解決建議
   - **500+（服務器錯誤）**：
     - 顯示「服務器錯誤，請稍後再試」提示
     - 提供重試按鈕
     - 自動重試（最多3次，指數退避）
4. **記錄錯誤日誌**（生產環境）：
   - 上報到Sentry
   - 記錄錯誤上下文（用戶、設備、環境）
   - 錯誤聚合和分析
5. **顯示用戶友好的錯誤提示**（Toast）：
   - 錯誤圖標 + 錯誤消息
   - 可選的操作按鈕（重試、聯繫支持）

### 錯誤重試機制

**自動重試**：
- **網絡錯誤**：自動重試3次，指數退避（1s、2s、4s）
- **超時錯誤**：自動重試，增加超時時間
- **500+錯誤**：自動重試，最多3次

**不重試**：
- **業務錯誤**（400、401、403、404、422）：不重試，直接顯示錯誤
- **用戶取消**：不重試

**手動重試**：
- **重試按鈕**：顯示在錯誤提示中
- **重試邏輯**：重新發送請求

訪談與心理畫像相關錯誤碼（如 `CONSENT_REQUIRED`、`CONCURRENT_REQUEST`、`MAX_TURNS_REACHED` 等）見 [07-交互流程](./07-交互流程與用戶體驗設計.md) § 錯誤處理 及 [03-API設計](../後端設計/03-API設計.md) §訪談與心理畫像錯誤碼。

### 錯誤恢復建議

**網絡錯誤**：
- 提示：「網絡連接失敗，請檢查網絡連接」
- 建議：「檢查WiFi或移動數據是否開啟」
- 操作：提供「重試」按鈕

**服務器錯誤**：
- 提示：「服務器暫時無法響應，請稍後再試」
- 建議：「如果問題持續，請聯繫支持」
- 操作：提供「重試」和「聯繫支持」按鈕

**業務錯誤**：
- 提示：具體的錯誤原因
- 建議：提供解決建議（如「請檢查輸入格式」）
- 操作：提供「修改」按鈕（跳轉到對應表單）

---

## 📊 請求攔截器設計

### 請求攔截器

```typescript
axios.interceptors.request.use(
  (config) => {
    // 添加認證Token
    const token = authStore.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 添加請求ID（用於追蹤）
    config.headers['X-Request-ID'] = generateRequestId();
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
```

### 響應攔截器

```typescript
axios.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    // 處理錯誤
    const { response } = error;
    
    if (response) {
      switch (response.status) {
        case 401:
          authStore.logout();
          break;
        case 403:
          Toast.error('無權限訪問');
          break;
        case 404:
          Toast.error('資源不存在');
          break;
        case 422:
          Toast.error(response.data.error.message);
          break;
        case 500:
        default:
          Toast.error('服務器錯誤，請稍後再試');
      }
    } else {
      Toast.error('網絡錯誤，請檢查網絡連接');
    }
    
    return Promise.reject(error);
  }
);
```

---

## 📊 數據收集與分析

### 用戶行為追蹤

**追蹤點**：

**頁面訪問**：
- 訪問時間
- 停留時間
- 滾動深度
- 退出頁面

**按鈕點擊**：
- CTA按鈕點擊（立即開始、立即註冊）
- 功能按鈕點擊（生成和好方案、執行追蹤）
- 分享按鈕點擊（分享判決、邀請好友）

**表單填寫**：
- 填寫進度（完成度百分比）
- 完成時間
- 放棄點（在哪一步放棄）
- 表單驗證錯誤

**轉化事件**：
- 註冊轉化（訪問 → 註冊）
- 登錄轉化（訪問 → 登錄）
- 完成判決轉化（填寫 → 判決）
- 執行方案轉化（選擇方案 → 開始執行）

### A/B測試設計點

**首頁CTA**：
- **變量1**：按鈕文案（「立即開始」vs「免費試用」vs「開始審判」）
- **變量2**：按鈕顏色（溫暖橘 vs 柔和藍）
- **變量3**：按鈕位置（居中 vs 右側）
- **指標**：點擊率、轉化率

**註冊引導**：
- **變量1**：引導文案（「想要保存記錄」vs「解鎖更多功能」）
- **變量2**：彈窗樣式（居中彈窗 vs 底部橫幅）
- **變量3**：顯示時機（立即顯示 vs 延遲3秒）
- **指標**：註冊轉化率

**判決展示**：
- **變量1**：布局方式（單列 vs 雙列）
- **變量2**：顏色方案（溫暖色調 vs 冷色調）
- **變量3**：動畫效果（有動畫 vs 無動畫）
- **指標**：停留時間、分享率

**和好方案**：
- **變量1**：推薦算法（基於案件類型 vs 基於關係階段）
- **變量2**：展示方式（卡片 vs 列表）
- **變量3**：選擇流程（直接選擇 vs 查看詳情後選擇）
- **指標**：方案選擇率、執行率

### 轉化漏斗分析

**註冊轉化漏斗**：
1. **訪問首頁**（100%）
2. **點擊立即開始**（目標：>60%）
3. **填寫案件**（目標：>80%）
4. **獲得判決**（目標：>90%）
5. **點擊註冊**（目標：>30%）
6. **完成註冊**（目標：>80%）

**優化點**：
- 步驟2：優化CTA按鈕，增加吸引力
- 步驟3：簡化填寫流程，減少放棄
- 步驟4：優化判決展示，增加價值感
- 步驟5：優化註冊引導，增加轉化率
- 步驟6：簡化註冊流程，減少流失

**留存分析**：
- **次日留存**：目標 >40%
- **7日留存**：目標 >25%
- **30日留存**：目標 >15%

**優化策略**：
- 首次使用引導：幫助用戶快速上手
- 功能引導：引導用戶使用更多功能
- 成就系統：激勵用戶持續使用
- 推送通知：執行提醒、關係健康提醒

---

## 🧠 心理畫像狀態管理與 API（v3.0 新增）

> 設計依據：`UPGRADE_PLAN_PERSONALIZED_JUDGMENT.md` v10

### InterviewStore（Zustand）

> **實現對齊**：以下接口與 `frontend/src/store/interviewStore.ts` 實際代碼完全一致。

```typescript
interface InterviewState {
  // 核心狀態
  currentSession: InterviewSession | null;  // 完整 session 對象（含 id、status、trigger 等）
  turns: InterviewTurn[];
  streamingText: string;         // SSE 回應文本 buffer（對應設計中的 pendingMessage）
  isStreaming: boolean;          // SSE 進行中（對應設計中的 isInputDisabled）
  loading: boolean;              // startSession / endSession / getSession 期間
  error: string | null;
  errorCode: string | null;      // v2.0 具體錯誤碼（CONCURRENT_REQUEST, TURN_TOO_FAST 等）
  safetyAlert: { message: string; severity?: string } | null;  // safety_alert SSE 事件
  abortController: AbortController | null;
  shouldEnd: boolean;            // AI metadata.should_end 標記

  // Actions
  startSession: (trigger?: string) => Promise<InterviewSession>;   // 返回完整 session
  checkResume: () => Promise<{ has_pending: boolean; session_id?: string; last_ai_message?: string; turn_count?: number; has_failed?: boolean; failed_session_id?: string }>;
  respond: (sessionId: string, message: string) => Promise<void>;  // SSE（sseRequest 直接調用）
  skipTurn: (sessionId: string) => Promise<void>;                  // SSE（sseRequest 直接調用）
  endSession: (sessionId: string) => Promise<void>;
  getSession: (sessionId: string) => Promise<void>;                // 合併了原 getResult + loadHistory
  retryFailed: (sessionId: string) => Promise<void>;
  cancelStream: () => void;
  dismissSafetyAlert: () => void;  // 清除 safetyAlert state
  reset: () => void;
}
```

> **`trigger` 用途**：反饋卡片上的主按鈕文案根據 `currentSession.trigger` 切換——`pre_case` → [繼續提交案件]、`post_judgment` → [查看判決]、`onboarding` → [回到首頁]、`organic` → [繼續聊聊]。
>
> **設計名稱映射**：`sessionId` → `currentSession.id`、`status` → `currentSession.status`、`feedbackCard` → `currentSession.feedback_card`、`pendingMessage` → `streamingText`、`isInputDisabled` → `isStreaming`。不在 Store 中的屬性（`consentRequired`、`richnessScore`）由 PsychProfileStore 提供。

**SSE 處理邏輯**（`respond` / `skipTurn` action；與 [03-核心頁面詳細設計](03-核心頁面詳細設計.md) §4.5 和 [後端 03-API設計](../後端設計/03-API設計.md) §SSE 對齊）：

1. **前置校驗**（由頁面組件負責）：`text.trim()` 為空 → 不發送；超過 2000 字 → 不發送
2. 建立 `AbortController` → 調用 `sseRequest('/interview/${sessionId}/respond', { message })` 直接處理 SSE（不經過 `interviewApi`）
3. 立即 `isStreaming = true`、`streamingText = ''`、`error = null`
4. 收到 `onToken` callback → 追加文本到 `streamingText`
5. 收到 `onMetadata` callback → 暫存 turn_order、intent、target_domains、should_end
6. 收到 `onSafetyAlert` callback → ✅ 寫入 `safetyAlert` state（InterviewChat 渲染 SafetyAlert 組件；severity=critical 時顯示危機熱線）
7. 收到 `onError` callback → 設置 `error`
8. 收到 `onComplete` callback → **將 `streamingText` 構建為 `InterviewTurn` 加入 `turns`**（附加 turn_order 和 metadata）→ 清空 `streamingText` → `isStreaming = false` → 更新 `shouldEnd`
9. 頁面組件偵測 `shouldEnd === true` → 自動調 `endSession()` → 導向結果頁
10. **SSE 中斷**：AbortError 被過濾；其他錯誤設 `error` → 用戶可手動「重新整理」→ 調 `getSession()` 恢復

**Polling 策略**（由頁面組件驅動，非 Store action）：
- `endSession()` 後 `currentSession.status` 更新為 `processing`
- 頁面每 3 秒調 `getSession(sessionId)`（`GET /interview/:id`）
- `status === 'completed'` → 從 session 讀取 `feedback_card`、`richness_score` → 跳轉結果頁
- `status === 'processing'` → 繼續輪詢
- `status === 'processing_failed'` → 顯示「分析遇到問題」+ 重試按鈕（`retryFailed`）
- **60 秒仍為 processing** → 顯示「處理較慢，請稍候」非阻塞提示（不中斷 polling）
- ⚠️ **責任劃分**：由訪談結果頁（`pages/Interview/Result`）負責 polling `getSession`。

### PsychProfileStore（Zustand）

> **實現對齊**：以下接口與 `frontend/src/store/psychProfileStore.ts` 實際代碼完全一致。

```typescript
interface PsychProfileState {
  profile: PsychProfile | null;              // 完整畫像（含 consent_given、richness_score、narratives、insights）
  feedbackHistory: FeedbackHistoryItem[];    // 訪談反饋歷史列表
  loading: boolean;
  error: string | null;
  consentLoading: boolean;                   // giveConsent 專用 loading

  fetchProfile: () => Promise<void>;
  fetchFeedbackHistory: () => Promise<void>;
  giveConsent: () => Promise<void>;          // 不傳 body；拒絕 = 關閉彈窗不調 API
  deleteAllData: () => Promise<void>;        // 刪除後重置 profile + feedbackHistory
  reset: () => void;
}
```

> **數據來源釐清**：`fetchProfile`（`GET /psych-profile`）返回 `consent_given`、`consent_at`、`richness_score`、`narratives[]`（含 `ai_summary`、`domain`、`completeness`）、`insights[]`。前端從 `profile.narratives` 中衍生域完整度和語義標籤。`fetchFeedbackHistory`（`GET /psych-profile/feedback`）返回 `history[]`（每條含 `session_id`、`feedback_card`、`domains_touched`、`created_at`），存入 `feedbackHistory` 供 FeedbackCard 組件消費。
>
> **設計名稱映射**：`richnessScore` → `profile.richness_score`、`consentGiven` → `profile.consent_given`、`domainCompleteness` → 從 `profile.narratives` 衍生、`richnessLabel` → 由頁面組件根據 `richness_score` 計算。

### API 端點（前端 service 層）

> **實現對齊**：以下端點已與後端 [03-API設計](../後端設計/03-API設計.md) v2.1 對齊。路由使用 `:id`（非 `:sessionId`）。

> **實現對齊**：以下 API 與 `frontend/src/services/api/interview.ts` 和 `psychProfile.ts` 實際代碼完全一致。

```typescript
// services/api/interview.ts
export const interviewApi = {
  startSession: (trigger: string = 'organic') =>
    request.post('/interview/start', { trigger }),
  checkResume: () => request.get('/interview/resume'),
  getSession: (sessionId: string) => request.get(`/interview/${sessionId}`),
  endSession: (sessionId: string) => request.post(`/interview/${sessionId}/end`),
  retryFailed: (sessionId: string) => request.post(`/interview/${sessionId}/retry`),
};
// 注意：respond 和 skip 由 Store 直接調用 sseRequest，不在此 API 層

// services/api/psychProfile.ts
export const psychProfileApi = {
  getProfile: () => request.get('/psych-profile'),
  getFeedbackHistory: () => request.get('/psych-profile/feedback'),
  giveConsent: () => request.post('/psych-profile/consent'),
  deleteAllData: () => request.delete('/psych-profile'),
};
```

**API 實現說明**：
- `respond` / `skip` 由 InterviewStore 直接調用 `sseRequest('/interview/${sessionId}/respond', { message })` 處理 SSE，不經過 `interviewApi`
- `startSession` 返回完整 session 對象（含 `id`、`status`、`trigger`、`turns[]`）
- `getSession`（`GET /:id`）合併了原 `getResult` 和 `getHistory`——返回完整 session 含 turns、status、feedback_card
- `retryFailed`（`POST /:id/retry`）用於重試 `processing_failed` 的 session
- `giveConsent` 不傳 body；`deleteAllData` 清除所有畫像數據並重置 consent

**SSE 請求工具**（`sseRequest` 函數）：
- 使用 `fetch` + `ReadableStream`（非 EventSource，因需 POST + Bearer token）
- 接受 callback 配置：`onToken`、`onMetadata`、`onSafetyAlert`、`onComplete`、`onError`
- 支持 `AbortController` 取消請求
- **注意**：後端當前發送完整回應文本（非逐字流式），前端可選擇模擬打字效果或一次性展示

> 與後端 [03-API設計](../後端設計/03-API設計.md) §心理畫像與 AI 訪談 API 對齊。`getSession` 響應中的 `partial_success` 由頁面組件讀取，作為 route state 傳遞給結果頁。

---

**文檔版本**：v3.2  
**創建日期**：2024年  
**最後更新**：2026-02-21（v3.2：新增管理員運維 `/admin/jobs/stats` 前端接入模板：型別、normalize 回退策略、渲染防呆；v3.1：InterviewStore 補充 errorCode/safetyAlert/dismissSafetyAlert；onSafetyAlert 改為 store 寫入；checkResume 補充 has_failed/failed_session_id）
