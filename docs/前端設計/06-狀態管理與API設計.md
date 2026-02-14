# 熊媽媽法庭 - 狀態管理與API設計

**項目名稱**：熊媽媽法庭（Mother Bear Court）  
**設計階段**：MVP開發階段  
**文檔版本**：v2.1

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
- **存儲**：localStorage（如果選擇記住我）或內存
- **過期時間**：7天（記住我）或會話結束

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

**文檔版本**：v2.1  
**創建日期**：2024年  
**最後更新**：2026-02（Store 列表與實現對齊說明）
