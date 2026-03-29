# Emorapy 優化報告 - getAuthUserId 拋錯應為 UNAUTHORIZED

日期：2026-03-07  
編號：`AUTH-OPT-001`  
狀態：`已修復`  
嚴重度：`低`

## 1. 摘要

`backend/src/utils/request.ts` 的 `getAuthUserId` 在 `req.user?.id` 缺失時拋出 plain `Error('User not authenticated')`，導致 errorHandler 回傳 500 INTERNAL_ERROR，而非 401 UNAUTHORIZED。

## 2. 觸發條件

理論上 `getAuthUserId` 僅於已通過 `authenticate` 的路由上被呼叫，`req.user` 應已存在。若因中間件順序錯誤或誤用（例如漏掛 authenticate），會觸發此路徑。

## 3. 實際行為

- 拋出 `new Error('User not authenticated')`
- errorHandler 無法辨識為 AppError，回傳 500 + `INTERNAL_ERROR`
- 與 authenticate 的 401 語義不一致

## 4. 預期行為

應拋出 `Errors.UNAUTHORIZED`，使 errorHandler 回傳 401 + `UNAUTHORIZED`，與認證流程一致。

## 5. 修復方案

`getAuthUserId` 改為拋出 `Errors.UNAUTHORIZED('未提供認證Token')`，與 `authenticate` 中間件訊息對齊。

## 6. 修復後驗證

- `utils/request.test.ts` 增補：應在 user 為 undefined 時拋 UNAUTHORIZED（含 code、statusCode 斷言）
- 後端單元測試全通過
