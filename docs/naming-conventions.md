# 命名規範

本文件整合後端與前端的命名約定，供 PDCA 審查與新代碼參考。

## 後端 (TypeScript/Node)

| 類別 | 規範 | 範例 |
|------|------|------|
| 檔案 | kebab-case | `user.service.ts`, `case.controller.ts` |
| 類別 | PascalCase | `UserService`, `CaseController` |
| 函數/方法 | camelCase | `createUser`, `getCaseById` |
| 常數 | UPPER_SNAKE_CASE | `MAX_FILE_SIZE`, `CASE_STATUS` |
| 介面 | PascalCase，I 前綴可選 | `UserPayload`, `CreateCaseDto` |
| 變數 | camelCase | `sessionId`, `caseType` |

## 前端 (React/TypeScript)

| 類別 | 規範 | 範例 |
|------|------|------|
| 元件檔案 | PascalCase | `ActionsSection.tsx`, `ResultHeader.tsx` |
| 頁面/目錄 | PascalCase | `QuickExperience/`, `Case/Detail/` |
| Hook | camelCase，use 前綴 | `usePolling`, `useAuth` |
| i18n 鍵 | dot.case | `result.title`, `error.fetch.title` |

## v2.0 個人化判決系統命名範例

### 後端新增

| 類別 | 範例 |
|------|------|
| 服務 | `interview.service.ts` → `InterviewService` |
| 服務 | `async-pipeline.service.ts` → `AsyncPipelineService` |
| 服務 | `narrative.service.ts` → `NarrativeService` |
| 服務 | `insight-extraction.service.ts` → `InsightExtractionService` |
| 服務 | `profile-snapshot.service.ts` → `ProfileSnapshotService` |
| 服務 | `profile-richness.service.ts` → `ProfileRichnessService` |
| 控制器 | `interview.controller.ts` → `InterviewController` |
| 控制器 | `psych-profile.controller.ts` → `PsychProfileController` |
| 路由 | `interview.routes.ts`、`psych-profile.routes.ts` |
| 枚舉 | `PsychDomain`、`InterviewStatus`、`InterviewTrigger`、`InsightType` |
| DB 表 | `interview_sessions`、`interview_turns`、`profile_narratives`、`profile_insights`、`profile_snapshots` |

### 前端新增

| 類別 | 範例 |
|------|------|
| 頁面 | `Interview/Chat/`、`Interview/Result/` |
| Store | `interviewStore.ts`、`psychProfileStore.ts` |
| API | `services/api/interview.ts`、`services/api/psychProfile.ts` |
| 工具 | `services/sseRequest.ts` |
| 組件 | `ChatBubble/`、`InterviewInput/`、`RichnessRing/`、`FeedbackCard/`、`ConsentModal/`、`SafetyAlert/` |
| Hook | `useInterview`（如需） |

### SSE 事件命名

| 事件名 | 用途 |
|--------|------|
| `token` | 逐字文本流 |
| `metadata` | AI 元數據（intent、domains、should_end） |
| `safety_alert` | 安全風險警報 |
| `complete` | 本輪完成 |
| `error` | 錯誤 |

## 通用原則

- **單一職責**：每個類/函數只做一件事
- **DRY**：避免重複，提取共用工具
- **可讀性**：命名應能表達意圖，避免縮寫（除非廣為人知如 `id`, `url`）

## 參考

- 後端：`後端設計/01-後端架構設計.md`
- 接口：`後端設計/12-接口建設規範.md`
- v2.0 升級方案：`UPGRADE_PLAN_PERSONALIZED_JUDGMENT.md`
