# 接口 × 功能 × 頁面 Mapping（全量 API 粒度）

本文件以 `全接口清單-主文檔.md` 的「已使用 API」為唯一 API 來源，將接口、功能特性、頁面路由與業務流程做全量對照，用於影響分析與回歸測試範圍判定。

## 1. 口徑與欄位

### 1.1 對照來源

- API 基準：`核心文件/全接口清單-主文檔.md`（僅納入「已使用」條目）
- 功能基準：`核心文件/功能特性清單.md`
- 頁面基準：`核心文件/頁面清單.md`
- 流程基準：`核心文件/業務流程整合.md`

### 1.2 關係口徑

- `主要`：單一端核心主流程接口
- `管理端`：以管理端治理操作為核心
- `跨端共用`：同一 API 同時被多端或多頁場景使用
- `次要`：輔助型接口（配置、字典、日誌、輔助查詢）

### 1.3 模組主映射規則

| 模組 | 功能特性（對應功能特性清單） | 主流程節點（對應業務流程整合） |
|------|-----------------------------|--------------------------------|
| 認證與註冊 | 登入、註冊、帳號狀態檢查、個人資料管理 | 流程 1：註冊與登入 |
| 職位管理 | 首頁與職位探索、發布與管理職位、職位審核 | 流程 2/3/4/5 |
| 申請管理 | 職位申請、申請處理、申請審閱中繼 | 流程 2/3/5 |
| 收藏管理 | 職位收藏 | 流程 2 |
| 學生信息 | 個人資料管理、用戶管理（學生） | 流程 1/4/5 |
| 僱主信息 | 帳號狀態檢查、用戶管理（僱主） | 流程 1/4 |
| 企業管理（含直連） | 企業瀏覽、企業中心、企業審核、僱主儀表板 | 流程 2/3/4/5 |
| 文件與資源 | 企業中心、企業審核、企業瀏覽 | 流程 2/3/4/5 |
| 審核管理 | 企業審核、職位審核、申請審核、學生審核 | 流程 4/5 |
| 簡歷管理/附件 | 簡歷管理、職位申請（投遞準備） | 流程 2 |
| 求職信管理 | 求職信管理、職位申請（投遞準備） | 流程 2 |
| 統計與分析 | 首頁與職位探索、僱主儀表板、管理員儀表板、數據分析 | 流程 3/4 |
| 系統管理/系統設定 | 用戶管理、系統設置、用戶設置、公告 | 流程 4 |
| 通知與消息 | 消息與通知、申請審閱中繼 | 流程 2/3 |
| 字典數據 | 字典數據 | 跨流程支撐 |
| 富文本配置 | 用戶設置（隱私政策）、條款與免責聲明 | 跨流程支撐 |
| 敏感詞管理 | 敏感詞管理、發布與管理職位（合規） | 流程 3/4 |

## 2. 全量主映射（已使用 API）

說明：以下每個模組小節均繼承「模組主映射規則」中的功能特性與流程節點；如有特例，寫在備註欄。

### 2.1 認證與註冊

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `GET /api/oauth/Login` | 公共 | `/login` | 主要 | 帳密登入入口 |
| `GET /api/oauth/CurrentUser` | 學生端、僱主端、管理端、公共 | `/login`、`/sso-callback`、`/profile`、`/user-settings`、`/company-center` | 跨端共用 | 登入後會話與角色判定主接口 |
| `GET /api/openApi/qwgw/register/sendMail` | 公共 | `/register` | 次要 | 註冊驗證碼發送 |
| `GET /api/openApi/qwgw/forgotPasswd/sendMail` | 公共 | `/login` 忘記密碼彈窗 | 次要 | 忘記密碼驗證碼發送（`account + addr`） |
| `POST /api/openApi/qwgw/register/verifyCode` | 公共 | `/register/student` | 主要 | 學生註冊驗證碼校驗 |
| `GET /api/openApi/qwgw/ResetAuthentication` | 公共 | `/login` 忘記密碼流程 | 次要 | 重設密碼流程（驗證 `timestampId + email + username/email 綁定`） |
| `POST /api/jp/auth/register/student` | 公共 | `/register/student` | 主要 | 觸發學生審核流程；`/register-success` 目前列候選廢棄保留路由 |
| `POST /api/jp/auth/register/employer` | 公共 | `/register/employer` | 主要 | 觸發企業審核流程；企業識別採 BRN/Tax ID 二選一；有 BRN 時執照必傳、無 BRN 時執照可選；`/register-success` 目前列候選廢棄保留路由 |
| `GET /api/azure/auth/redirect/v2` | 公共 | `/sso-callback`、`/auth/azure/callback` | 主要 | Azure SSO 回調 |
| `GET /api/jp/student/ais/rest/student/{studentId}` | 學生端、公共 | `StudentProfile.personal`、學生註冊 | 次要 | AIS 同步支撐註冊與資料維護 |
| `PUT /api/jp/auth/user/info` | 學生端 | `/profile` | 主要 | 當前用戶資料更新 |
| `GET /api/jp/auth/student/info` | 學生端 | `/profile` | 主要 | Auth 域學生資料讀取 |

### 2.2 職位管理

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `GET /api/jp/jobs/{id}` | 學生端、管理端 | `/job-detail/:id`、`/admin-dashboard` | 跨端共用 | 學生看詳情、管理端快捷查看 |
| `GET /api/jp/jobs/search` | 公共 | `/`、`/job-search` | 主要 | 首頁/搜索主入口 |
| `GET /api/jp/employer/job/{id}` | 僱主端、管理端 | `/post-job`、`/manage-jobs`、`/employer-applications`、`/job-audit` | 跨端共用 | 僱主與管理端共用詳情 |
| `GET /api/jp/employer/job/checkLimit` | 僱主端 | `/post-job`、`/manage-jobs` | 主要 | 發布額度檢查 |
| `POST /api/jp/employer/job/checkSensitive` | 僱主端 | `/post-job` | 主要 | 發布前敏感詞檢測 |
| `POST /api/jp/employer/job/publish` | 僱主端、管理端 | `/post-job`、`/manage-jobs`、`/job-audit` | 跨端共用 | 發布後進入職位審核流 |
| `POST /api/jp/employer/job/draft` | 僱主端 | `/post-job` | 主要 | 草稿保存，不進審核 |
| `DELETE /api/jp/employer/job/{id}` | 僱主端 | `/manage-jobs` | 主要 | 職位刪除 |
| `GET /api/jp/employer-information/jobs` | 僱主端 | `/manage-jobs` | 主要 | 企業職位列表 |
| `GET /api/jp/admin/jobs` | 管理端 | `/job-audit` | 管理端 | 管理端職位列表 |
| `POST /api/jp/admin/jobs/{jobId}/activate` | 僱主端、管理端 | `/job-audit`、`/manage-jobs` | 跨端共用 | 上下架治理 |
| `POST /api/jp/admin/jobs/{jobId}/deactivate` | 僱主端、管理端 | `/job-audit`、`/manage-jobs` | 跨端共用 | 上下架治理 |
| `POST /api/jp/admin/jobs/{jobId}/pin` | 管理端 | `/job-audit` | 管理端 | 職位置頂 |
| `POST /api/jp/admin/jobs/{jobId}/unpin` | 管理端 | `/job-audit` | 管理端 | 取消置頂 |
| `POST /api/jp/jobs/{jobId}/external-apply` | 學生端 | `/job-detail/:id` | 主要 | 外部投遞記錄，不觸發申請審核 |

### 2.3 申請管理

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `POST /api/jp/applications` | 學生端 | `/job-detail/:id` | 主要 | 平台內投遞並觸發 application audit |
| `GET /api/jp/applications/{id}` | 學生端、僱主端 | `StudentProfile.applications`、`ApplicationManagement` | 跨端共用 | 申請詳情 |
| `GET /api/jp/employer/applications` | 僱主端 | `/employer-applications`、`ApplicationManagement` | 主要 | 僱主申請列表 |
| `GET /api/jp/employer/applications/export` | 僱主端 | `ApplicationManagement` | 次要 | 導出能力 |
| `GET /api/jp/applications/{id}/resume` | 僱主端 | `ApplicationManagement` | 次要 | 申請關聯簡歷 |
| `GET /api/jp/applications/{id}/resume/attachments` | 僱主端 | `ApplicationManagement` | 次要 | 申請關聯附件列表 |
| `GET /api/jp/applications/{id}/resume/attachments/{attachmentId}/download` | 僱主端 | `ApplicationManagement` | 次要 | 附件下載 |
| `GET /api/jp/cover-letters` | 學生端 | `/job-detail/:id`、`StudentProfile.coverLetter` | 跨端共用 | 申請場景取求職信，且支撐個人中心 |
| `GET /api/jp/audit/myApplications` | 學生端 | `StudentProfile.applications` | 主要 | 我的申請主列表 |

### 2.4 收藏管理

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `POST /api/jp/favorites` | 學生端 | `/job-detail/:id` | 主要 | 添加收藏 |
| `DELETE /api/jp/favorites` | 學生端 | `/job-detail/:id` | 主要 | 依職位取消收藏 |
| `GET /api/jp/favorites/check` | 學生端 | `/job-detail/:id` | 次要 | 收藏狀態檢查 |
| `GET /api/jp/favorites` | 學生端 | `StudentProfile.favorites` | 主要 | 收藏列表 |
| `DELETE /api/jp/favorites/{favoriteId}` | 學生端 | `StudentProfile.favorites` | 主要 | 依收藏ID取消收藏 |

### 2.5 學生信息

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `GET /api/jp/student/{userId}` | 學生端、管理端、公共 | `/login`、`/sso-callback`、`/user-management`、`StudentProfile.personal` | 跨端共用 | 帳號狀態與學生資料查詢 |
| `PUT /api/jp/auth/student/info` | 學生端、管理端 | `StudentProfile.personal`、`/user-management` | 跨端共用 | 學生資料更新 |
| `GET /api/jp/auth/student/list` | 管理端 | `/user-management` | 管理端 | 學生列表治理 |

### 2.6 僱主信息

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `GET /api/jp/auth/employer/info` | 管理端、公共 | `/login`、`/sso-callback`、`/user-management` | 跨端共用 | 僱主信息查詢/狀態核驗 |
| `GET /api/jp/auth/employer/list` | 管理端 | `/user-management` | 管理端 | 僱主列表治理 |

### 2.7 企業管理（直連）

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `POST /api/jp/employer/account/create` | 僱主端 | `/company-center`、`CompanyCenter.account` | 主要 | 企業子帳號建立 |
| `GET /api/jp/employer/employer-information` | 僱主端 | `/company-center` | 主要 | 當前僱主企業資料 |
| `PUT /api/jp/employer/employer-information/{id}` | 僱主端、管理端 | `/company-center`、`/company-audit` | 跨端共用 | 僱主提交資料更新，進企業審核 |

### 2.8 企業管理

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `GET /api/jp/employer/overview` | 僱主端 | `/employer-dashboard` | 主要 | 僱主儀表板 |
| `GET /api/jp/employer/contexts` | 僱主端 | `/post-job` | 次要 | 當前僱主上下文 |
| `GET /api/jp/employer-information/search` | 公共 | `/company-search` | 主要 | 企業搜索（多關鍵字 OR、industry/location/size 篩選、排序與分頁） |
| `GET /api/jp/employer-information/{id}` | 學生端、僱主端、管理端 | `/company/:id`、`/company-center`、`/company-audit`、`/post-job` | 跨端共用 | 企業詳情主接口（`/company` 目前列候選廢棄保留路由） |
| `GET /api/jp/employer-information/{id}/jobs` | 學生端、僱主端 | `/company/:id` | 跨端共用 | 企業職位列表（`/company` 目前列候選廢棄保留路由） |
| `GET /api/jp/employer-information` | 管理端 | `/company-audit` | 管理端 | 管理端企業列表 |
| `POST /api/jp/employer-information` | 管理端 | `/company-audit` | 管理端 | 新增企業 |
| `PUT /api/jp/employer-information/{id}` | 管理端 | `/company-audit` | 管理端 | 管理員直改企業資料 |
| `GET /api/jp/employer-information-record/{id}` | 管理端 | `/company-audit` | 管理端 | 企業審核記錄詳情 |
| `GET /api/jp/admin/employer/proxy-mappings/users/{userId}` | 管理端 | `/company-audit` | 管理端 | 代理公司映射查詢 |
| `POST /api/jp/admin/employer/proxy-mappings/bind` | 管理端 | `/company-audit` | 管理端 | 代理公司映射綁定 |
| `DELETE /api/jp/admin/employer/proxy-mappings/{employerId}` | 管理端 | `/company-audit` | 管理端 | 代理公司映射解除 |

### 2.9 文件與資源

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `GET /api/jp/employer-information/registrationNo` | 僱主端 | `/company-center` | 次要 | 當前僱主執照 |
| `GET /api/jp/employer-information/logo` | 僱主端 | `/company-center` | 次要 | 當前僱主 Logo |
| `GET /api/jp/employer-information/{id}/registrationNo` | 管理端 | `/company-audit` | 管理端 | 指定企業執照 |
| `GET /api/jp/employer-information/{id}/logo` | 學生端、僱主端、管理端 | `/company/:id`、`/job-detail/:id`、`/company-audit`、`/post-job` | 跨端共用 | 指定企業 Logo（`/company` 目前列候選廢棄保留路由） |

### 2.10 審核管理

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `GET /api/jp/audit/processing` | 學生端、僱主端、管理端 | `/admin-dashboard`、`/company-audit`、`/job-audit`、`/employer-applications`、`StudentProfile.applications` | 跨端共用 | 待處理審核列表 |
| `GET /api/jp/audit/processed` | 學生端、僱主端、管理端 | `/company-audit`、`/job-audit`、`/employer-applications`、`StudentProfile.applications` | 跨端共用 | 已處理審核列表 |
| `POST /api/jp/audit/{auditId}/action` | 學生端、僱主端、管理端 | `/company-audit`、`/job-audit`、`/employer-applications`、`StudentProfile.applications` | 跨端共用 | 核心審核操作 |
| `POST /api/jp/audit/entity/action` | 學生端、管理端 | `/user-management`、`StudentProfile.applications` | 跨端共用 | 實體維度審核（學生審核/撤回）；在無 auditId 或以 businessId 維度操作時使用 |
| `POST /api/jp/admin/jobs/{jobId}/violation` | 管理端 | `/job-audit` | 管理端 | 標記違規 |
| `POST /api/jp/admin/jobs/{jobId}/violation/cancel` | 管理端 | `/job-audit` | 管理端 | 取消違規 |

### 2.11 簡歷管理

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `GET /api/jp/resume/page` | 學生端 | `/job-detail/:id`、`ResumeManager`、`StudentProfile.resume` | 主要 | 簡歷分頁列表 |
| `GET /api/jp/resume/detail/{resumeId}` | 學生端 | `ResumeManager`、`StudentProfile.resume` | 主要 | 簡歷詳情 |
| `POST /api/jp/resume/add` | 學生端 | `ResumeManager` | 主要 | 新增簡歷 |
| `PUT /api/jp/resume/update` | 學生端 | `ResumeManager` | 主要 | 更新簡歷 |
| `DELETE /api/jp/resume/delete` | 學生端 | `ResumeManager` | 主要 | 刪除簡歷 |
| `PUT /api/jp/resume/setDefault` | 學生端 | `ResumeManager` | 主要 | 設置默認簡歷 |

### 2.12 簡歷附件

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `POST /api/jp/resume/attachment/upload` | 學生端 | `ResumeManager` | 主要 | 附件上傳 |
| `GET /api/jp/resume/attachment/list/{resumeId}` | 學生端 | `ResumeManager`、`StudentProfile.resume` | 次要 | 附件列表 |
| `DELETE /api/jp/resume/attachment/delete/{id}` | 學生端 | `ResumeManager` | 主要 | 刪除附件 |
| `GET /api/jp/resume/attachment/download/{id}` | 學生端 | `ResumeManager`、`StudentProfile.resume` | 次要 | 附件下載 |
| `GET /api/jp/resume/completion/{resumeId}` | 學生端 | `ResumeManager` | 次要 | 簡歷完成度 |

### 2.13 求職信管理

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `POST /api/jp/cover-letters` | 學生端 | `StudentProfile.coverLetter` | 主要 | 新增求職信 |
| `PUT /api/jp/cover-letters/{id}` | 學生端 | `StudentProfile.coverLetter` | 主要 | 更新求職信 |
| `DELETE /api/jp/cover-letters/{id}` | 學生端 | `StudentProfile.coverLetter` | 主要 | 刪除求職信 |
| `PUT /api/jp/cover-letters/{id}/default` | 學生端 | `StudentProfile.coverLetter` | 主要 | 設為預設求職信 |

### 2.14 統計與分析

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `GET /api/jp/statistics/admin/dashboard/overview` | 管理端 | `/admin-dashboard` | 管理端 | 管理儀表板概覽 |
| `GET /api/jp/statistics/admin/dashboard/recent-activities` | 管理端 | `/admin-dashboard` | 管理端 | 最近活動 |
| `GET /api/jp/statistics/jobs/hot` | 管理端 | `/admin-dashboard` | 管理端 | 熱門職位 |
| `GET /api/jp/statistics/companies/hot` | 公共 | `/` | 次要 | 首頁熱門企業 |
| `GET /api/jp/statistics/admin/analytics/job-posting-trends` | 管理端 | `/analytics-overview`、`/analytics-*` | 管理端 | 職位發布趨勢 |
| `GET /api/jp/statistics/admin/analytics/registration-trends` | 管理端 | `/analytics-*` | 管理端 | 註冊趨勢 |
| `GET /api/jp/statistics/admin/analytics/user-engagement` | 管理端 | `/analytics-*` | 管理端 | 活躍度分析 |
| `GET /api/jp/statistics/admin/applications/summary` | 管理端 | `/analytics-*` | 管理端 | 申請聚合分析 |
| `GET /api/jp/statistics/admin/analytics/all/export` | 管理端 | `/analytics-*` | 次要 | 分析報表導出 |
| `GET /api/jp/statistics/admin/student/export` | 管理端 | `/user-management` | 次要 | 學生數據導出 |
| `GET /api/jp/employer/overview/metrics` | 僱主端 | `/manage-jobs` | 主要 | 僱主概覽指標 |

### 2.15 系統管理

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `PUT /api/permission/Users/{userId}/Actions/State` | 管理端 | `/user-management` | 管理端 | 帳號啟停用 |
| `POST /api/permission/Users/{userId}/Actions/ResetPassword` | 學生端、僱主端、管理端 | `/user-settings/security` | 跨端共用 | 密碼重置/修改 |
| `GET /api/base/user` | 管理端 | `/user-management`（管理帳號維護） | 管理端 | 平台管理員列表 |
| `POST /api/base/user` | 管理端 | `/user-management`（管理帳號維護） | 管理端 | 新增平台管理員 |
| `PUT /api/base/user/{id}` | 管理端 | `/user-management`（管理帳號維護） | 管理端 | 更新平台管理員 |
| `DELETE /api/base/user/{id}` | 管理端 | `/user-management`（管理帳號維護） | 管理端 | 刪除平台管理員 |
| `GET /api/base/user/{id}` | 管理端 | `/user-management`（管理帳號維護） | 管理端 | 管理員詳情 |
| `GET /api/base/roles` | 管理端 | `/user-management`（管理帳號維護） | 管理端 | 角色列表 |
| `GET /api/base/user/{userId}/Actions/GetRoles` | 管理端 | `/user-management`（管理帳號維護） | 管理端 | 已分配角色 |
| `GET /api/base/user/Actions/GetUsersByRoleIds` | 管理端 | `/user-management`（管理帳號維護） | 管理端 | 角色成員查詢 |
| `POST /api/base/user/{userId}/Actions/AssignRoles` | 管理端 | `/user-management`（管理帳號維護） | 管理端 | 角色分配 |

### 2.16 系統設定

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `GET /api/system/Log/{category}` | 學生端、僱主端、管理端 | `/user-settings/security` | 次要 | 登入歷史 |
| `GET /api/extend/SystemConfig` | 學生端、僱主端、管理端 | `/user-settings/systemSettings` | 跨端共用 | 系統配置列表（`/system-settings` 目前列候選廢棄保留路由） |
| `GET /api/extend/SystemConfig/{id}` | 學生端、僱主端、管理端 | `/user-settings/systemSettings` | 跨端共用 | 配置詳情（`/system-settings` 目前列候選廢棄保留路由） |
| `POST /api/extend/SystemConfig` | 學生端、僱主端、管理端 | `/user-settings/systemSettings` | 跨端共用 | 新增配置（`/system-settings` 目前列候選廢棄保留路由） |
| `PUT /api/extend/SystemConfig/{id}` | 學生端、僱主端、管理端 | `/user-settings/systemSettings` | 跨端共用 | 更新配置（`/system-settings` 目前列候選廢棄保留路由） |
| `DELETE /api/extend/SystemConfig/{id}` | 學生端、僱主端、管理端 | `/user-settings/systemSettings` | 跨端共用 | 刪除配置（`/system-settings` 目前列候選廢棄保留路由） |
| `GET /api/extend/SystemConfig/value/{configKey}` | 公共 | `/` | 次要 | 公告/前台配置值讀取（首頁及 Home/Footer 組件） |

### 2.17 通知與消息

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `GET /api/extend/NotificationMessageLog/v2` | 學生端、僱主端、管理端 | `/messages` 子視圖（my/log） | 跨端共用 | 通知日誌列表 |
| `GET /api/extend/NotificationMessageLog/v2/{id}` | 學生端、僱主端、管理端 | `/messages` 詳情面板、`/application-review` 跳轉 | 跨端共用 | 通知詳情 |

### 2.18 字典數據

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `GET /api/system/DictionaryData/All` | 學生端、僱主端、管理端 | `/job-search`、`/post-job`、`/manage-jobs`、`/company-center`、`/company-audit`、`/job-audit`、`/user-management`、`StudentProfile.resume`、`AdminDashboard` 等 | 跨端共用 | 登入態字典全集 |
| `GET /api/jp/dictionary/public` | 公共 | `/register`、`/register/student`、`/register/employer` | 次要 | 未登入公開字典 |

### 2.19 富文本配置

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `GET /api/extend/RichTextConfig/category/{category}` | 學生端、僱主端、管理端、公共 | `/user-settings/privacyPolicy`、註冊協議彈窗、Footer、`/login`、`/register/:role` | 跨端共用 | 協議/隱私策略讀取（policy/employerDisclaimer/StudentDisclaimer/faq/feedback） |
| `POST /api/extend/RichTextConfig` | 學生端、僱主端、管理端 | `/user-settings/privacyPolicy` | 管理端 | 富文本配置新增 |
| `PUT /api/extend/RichTextConfig/{id}` | 學生端、僱主端、管理端 | `/user-settings/privacyPolicy` | 管理端 | 富文本配置更新 |

### 2.20 敏感詞管理

| API | 端別 | 關聯頁面/子分頁 | 關係 | 備註 |
|-----|------|----------------|------|------|
| `GET /api/jp/moderation/sensitiveWords` | 管理端 | `/user-settings/sensitiveWords` | 管理端 | 敏感詞列表 |
| `POST /api/jp/moderation/sensitiveWords` | 管理端 | `/user-settings/sensitiveWords` | 管理端 | 新增敏感詞 |
| `PUT /api/jp/moderation/sensitiveWords/{id}` | 管理端 | `/user-settings/sensitiveWords` | 管理端 | 更新敏感詞 |
| `DELETE /api/jp/moderation/sensitiveWords/{id}` | 管理端 | `/user-settings/sensitiveWords` | 管理端 | 刪除敏感詞 |

## 3. 一 API 多端多場景對照（回歸優先）

**用途**：標示同一 API 被多端或多頁使用的狀況，供回歸測試與影響分析快速鎖定「修改此 API 需涵蓋哪些端別與場景」。回歸時建議對照表中每一場景均執行至少一次相關操作。

| API | 多端別 | 主要場景 |
|-----|--------|----------|
| `GET /api/oauth/CurrentUser` | 學生端、僱主端、管理端、公共 | 登入分流、Header 角色識別、路由守衛 |
| `GET /api/jp/audit/processing` | 學生端、僱主端、管理端 | 各端待辦審核列表 |
| `GET /api/jp/audit/processed` | 學生端、僱主端、管理端 | 各端已處理審核列表 |
| `POST /api/jp/audit/{auditId}/action` | 學生端、僱主端、管理端 | 企業/職位/申請審核主操作 |
| `POST /api/jp/audit/entity/action` | 學生端、管理端 | 學生審核與申請撤回兜底 |
| `GET /api/jp/employer-information/{id}` | 學生端、僱主端、管理端 | 企業詳情、企業中心、企業審核 |
| `GET /api/jp/employer-information/{id}/logo` | 學生端、僱主端、管理端 | 公司展示、職位詳情、審核查看 |
| `GET /api/system/DictionaryData/All` | 學生端、僱主端、管理端 | 多表單/篩選字典依賴 |
| `GET /api/extend/RichTextConfig/category/{category}` | 學生端、僱主端、管理端、公共 | 隱私政策、註冊協議、FAQ、反饋、免責聲明 |

## 3.1 富文本 fileType 對照（頁面補充）

| fileType | category | 主要頁面/組件 |
|----------|----------|----------------|
| `policy` | `jobportal_policy` | Footer、`/login`、`StudentRegisterForm`、`EmployerRegisterForm` |
| `StudentDisclaimer` | `jobportal_student_disclaimer` | `StudentRegisterForm` |
| `employerDisclaimer` | `jobportal_employer_disclaimer` | `EmployerRegisterForm` |
| `faq` | `jobportal_faq` | Footer |
| `feedback` | `jobportal_feedback` | Footer |

## 4. 流程節點追溯

| 流程 | 關鍵節點 | 對應 API（節選） | 對應頁面 |
|------|----------|------------------|----------|
| 流程 1：註冊與登入 | 學生/僱主註冊、SSO 回調、帳號狀態檢查 | `POST /api/jp/auth/register/student`、`POST /api/jp/auth/register/employer`、`GET /api/azure/auth/redirect/v2`、`GET /api/jp/student/{userId}`、`GET /api/jp/auth/employer/info` | `/register`、`/register/:role`、`/login`、`/sso-callback` |
| 流程 2：學生求職主流程 | 搜索、詳情、平台投遞、外部投遞、收藏、申請追蹤 | `GET /api/jp/jobs/search`、`GET /api/jp/jobs/{id}`、`POST /api/jp/applications`、`POST /api/jp/jobs/{jobId}/external-apply`、`POST /api/jp/favorites`、`GET /api/jp/audit/myApplications` | `/`、`/job-search`、`/job-detail/:id`、`/student-applications`、`/favorites` |
| 流程 3：僱主招聘主流程 | 發布草稿/發布、申請處理、企業維護 | `POST /api/jp/employer/job/draft`、`POST /api/jp/employer/job/publish`、`GET /api/jp/employer/applications`、`PUT /api/jp/employer/employer-information/{id}` | `/post-job`、`/manage-jobs`、`/employer-applications`、`/company-center` |
| 流程 4：管理端治理流程 | 企業審核、職位審核、用戶治理、系統配置 | `POST /api/jp/audit/{auditId}/action`、`GET /api/jp/admin/jobs`、`PUT /api/permission/Users/{userId}/Actions/State`、`GET /api/extend/SystemConfig` | `/admin-dashboard`、`/company-audit`、`/job-audit`、`/user-management`、`/user-settings/systemSettings` |
| 流程 5：Audit 機制 | student/employer_info/job/application 全鏈路狀態流轉 | `POST /api/jp/audit/entity/action`、`GET /api/jp/audit/processing`、`GET /api/jp/audit/processed`、`POST /api/jp/audit/{auditId}/action` | `/user-management`、`/company-audit`、`/job-audit`、`/employer-applications`、`StudentProfile.applications` |
| 流程 6：定時任務（後台） | 職位截止下架、學生帳號到期預警/停用 | `GET /api/extend/SystemConfig`、`GET /api/extend/SystemConfig/value/{configKey}` | `/user-settings/systemSettings`（配置維護主入口） |

## 5. 差異與待確認

1. 本文僅納入「已使用 API」，不納入 `全接口清單-主文檔.md` 的「候選廢棄」與「已確認廢棄」。
2. `POST /api/jp/auth/register/employer/no-invite` 已確認前端未使用，主清單列候選廢棄；業務流程整合已註記，本文件不納入。
3. `/register-success`、`/company`、`/analytics-realtime`、`/analytics-pages`、`/analytics-behavior`、`/analytics-system`、`/system-settings` 統一列為候選廢棄保留路由，不作主映射入口。
4. `messageApi` 對話鏈路（`/messages*` 與 `GET /api/jp/auth/user/info/{userId}`）目前無路由掛載，按「前端可操作口徑」不列入主映射，改由主接口清單候選廢棄區管理。
5. 流程 6 為後台調度流程，前端不直接觸發任務執行；Mapping 僅追溯到配置維護主入口（`/user-settings/systemSettings`）與配置讀取 API。
6. 企業資料建立/更新口徑：`jp_employer_information` 使用 BRN/Tax ID 作為機構唯一識別，建立與更新均不得雙空；審核通過覆寫主表前需先校驗識別合法性。
7. 若後續新增 API 或調整子分頁命名，需同步回寫：`全接口清單-主文檔.md`、`功能特性清單.md`、`頁面清單.md`、本文件。

## 6. 維護規則

1. 新增 API 時，先更新 `全接口清單-主文檔.md` 狀態，再回寫本 Mapping。
2. `method + path` 在本文件必須唯一，禁止重複或跨狀態混入。
3. 同一 API 若被新增到多頁，必須同步更新「一 API 多端多場景對照」。
4. 流程節點有變更（尤其 Audit 流轉）時，必須同步更新第 4 節追溯表。
