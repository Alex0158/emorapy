# Emorapy 優化報告 - F10 useAdminAccess admin 為 null 時防禦

日期：2026-03-10  
編號：`F10-OPT-002`  
狀態：`已修復`  
類型：`防禦性優化`（API 回傳不完整時防禦）

## 1. 摘要

**F10-OPT-002**：`useAdminAccess` 在讀取 `adminMeQuery.data?.admin.permissions` 時，若 `admin` 為 `null`，會因 `null.permissions` 導致 `TypeError` 崩潰。

`adminApi.getMe()` 在 `payload?.admin?.id` 為 falsy 時會拋錯，故正常流程不會返回 `admin: null`。但在以下情境仍可能觸發：
- React Query 快取遭污染或結構異常
- 未來 API 契約變更
- 其他非預期資料路徑

## 2. 業務影響

1. Admin 權限守衛頁面（AdminPermissionRoute）在異常資料下可能白屏崩潰
2. 與 useAdminAccess 其他邊界防禦（permissions 非陣列、null、含非字串）不一致

## 3. 修復方案

**useAdminAccess.ts**：
- 將 `adminMeQuery.data?.admin.permissions` 改為 `adminMeQuery.data?.admin?.permissions`，對 `admin` 增加 optional chaining，避免 `admin` 為 `null` 時讀取 `.permissions` 崩潰

## 4. 修復後驗證

- useAdminAccess 新增測試：`admin 為 null 時應正規化為空陣列不崩潰（F10 邊界：API 回傳不完整時防禦）`
- `npm run test -- --run src/hooks/useAdminAccess.test.ts` 全數通過（10 例）
