# Emorapy 業務缺陷報告：validation 工具傳入 null/undefined 時崩潰

日期：2026-03-07  
缺陷編號：`VALIDATION-BUG-001`  
狀態：`已修復`  
嚴重度：`低`（validation.ts 目前僅被 validation.test.ts 引用，未見業務頁面直接使用）

## 1. 缺陷摘要

`frontend/src/utils/validation.ts` 的 `validateStatement`、`validatePassword` 在傳入 `null` 或 `undefined` 時會拋錯。`validateEmail` 經 regex.test 強制轉換不拋錯，但為一致性一併補防禦。

## 2. 關聯失敗測試

- `validateStatement`：null 或 undefined 應視為空字串不拋錯
- `validatePassword`：null 或 undefined 應視為無效不拋錯（F09 邊界）
- `validateEmail`：null 或 undefined 應視為無效不拋錯（F09 邊界）

## 3. 業務邏輯梳理與實際代碼行為

- `validateStatement` 使用 `statement.trim()`，null 時拋錯
- `validatePassword` 使用 `password.length`，null 時拋錯
- `validateEmail` 使用 `emailRegex.test(email)`，coerce 後不拋錯，但補防禦以保持一致性

## 4. 問題判定

驗證工具在異常輸入（null/undefined）時未做防禦性處理，與 `validate.ts` 慣例不一致，未來若被登入/註冊表單引用時可能導致崩潰。

## 5. 修復方案

- `validateStatement`：`(statement ?? '').trim()`，型別改為 `string | null | undefined`
- `validatePassword`：`const p = password ?? ''`，使用 `p` 取代 `password`，型別改為 `string | null | undefined`
- `validateEmail`：`emailRegex.test(email ?? '')`，型別改為 `string | null | undefined`

## 6. 修復後驗證

- 上述測試通過
- 全前端 Vitest 無回歸
