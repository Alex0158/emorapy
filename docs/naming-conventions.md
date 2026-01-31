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

## 通用原則

- **單一職責**：每個類/函數只做一件事
- **DRY**：避免重複，提取共用工具
- **可讀性**：命名應能表達意圖，避免縮寫（除非廣為人知如 `id`, `url`）

## 參考

- 後端：`後端設計/01-後端架構設計.md`
- 接口：`後端設計/12-接口建設規範.md`
