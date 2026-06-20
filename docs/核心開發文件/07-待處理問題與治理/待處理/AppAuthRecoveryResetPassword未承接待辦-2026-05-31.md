# App Auth Recovery Reset Password 未承接待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web / Backend / shared auth recovery 與 App Auth screen 的跨端承接差異
**取證代碼入口**：`backend/src/routes/auth.routes.ts`、`backend/src/controllers/auth.controller.ts`、`packages/api-client/src/m1.ts`、`frontend/src/router/index.tsx`、`frontend/src/pages/Auth/ForgotPassword/index.tsx`、`mobile/scripts/check-app-route-contracts.mjs`、`mobile/app/(public)/_layout.tsx`、`mobile/app/(public)/auth/index.tsx`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 現狀

Backend 已提供 `POST /api/v1/auth/reset-password` 與 `POST /api/v1/auth/reset-password-confirm`；`packages/api-client/src/m1.ts` 也提供 `resetPassword()` / `confirmResetPassword()` shared client。Web 版有 `/auth/forgot-password` route、`frontend/src/pages/Auth/ForgotPassword/index.tsx` 與對應測試。

App 端目前 `mobile/scripts/check-app-route-contracts.mjs` 只固定 `(public)/index.tsx`、`(public)/auth/index.tsx` 與 Quick routes；`mobile/app/(public)/_layout.tsx` 只註冊 `auth/index`，而 `mobile/app/(public)/auth/index.tsx` 只提供 login / register / claim-session / clear local session。App 尚未有 forgot-password / reset-password screen 或 route contract。

## 代碼依據

- `backend/src/routes/auth.routes.ts`、`backend/src/controllers/auth.controller.ts`：reset-password / reset-password-confirm 後端路由存在。
- `packages/api-client/src/m1.ts`：shared M1 client 提供 reset password API 消費入口。
- `frontend/src/router/index.tsx`、`frontend/src/pages/Auth/ForgotPassword/index.tsx`：Web 有 forgot-password route / page。
- `mobile/scripts/check-app-route-contracts.mjs`、`mobile/app/(public)/_layout.tsx`、`mobile/app/(public)/auth/index.tsx`：App public auth route 只固定現有 auth screen，未承接 forgot-password / reset-password screen。

## 文件偏差

`20-App端/02-App完整版本工程PRD.md` 曾在 `(public)` 首輪 screen 中列出 `forgot password`，容易讓讀者誤認為 App 已承接 Web 的 auth recovery UX。現碼只能證明 Backend / shared client / Web 已具備 reset-password 流程，不能證明 App screen 已落地。

## 風險

1. App Auth 被寫成完整承接時，設計與測試可能漏掉 mobile reset-password UX、Deep Link / auth resume 與 native form/accessibility 分支。
2. Web / Backend / shared client 已有能力，但 App route contract 未釘住，後續可能在 screen 中臨時手寫 reset-password API shape。
3. 若忘記密碼被視為 F09 通用身份生命週期能力，App 缺口不應藏在 PRD 表格內。

## 目標狀態

1. App 明確決定是否在 M1 Auth 承接 reset-password / forgot-password。
2. 若承接，新增 App route / screen、`routes:check` contract、RNTL / feature contract、shared M1 client consumption 與 copy/accessibility 覆蓋。
3. 若不承接，`20-App端/`、`50-跨端Mapping與Parity/` 與 RTM 持續標記為 Web/API 已有、App pending，不得用完成語氣描述。

## 需要修改的文件

- `docs/核心開發文件/20-App端/02-App完整版本工程PRD.md`
- `docs/核心開發文件/20-App端/03-App完整版本開發Roadmap.md`
- `docs/核心開發文件/50-跨端Mapping與Parity/00-跨端Parity總覽.md`
- `docs/核心開發文件/50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`
- 必要時同步 `docs/核心開發文件/08-測試規範與驗收/04-需求驗證矩陣.md`

## 驗證命令

```bash
npm --prefix mobile run routes:check
npm --prefix mobile run features:check
npm run test:m1 --workspace @emorapy/api-client
npm run docs:check
```

## Owner / Status

- Owner：App / Cross-platform Auth
- Status：待處理
