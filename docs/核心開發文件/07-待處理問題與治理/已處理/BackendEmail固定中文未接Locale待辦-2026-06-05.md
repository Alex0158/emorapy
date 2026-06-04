# Backend Email 固定中文未接 Locale 待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend / Web / App outbound email locale
**取證代碼入口**：`backend/src/services/email.service.ts`、`backend/src/services/auth.service.ts`、`backend/src/controllers/auth.controller.ts`、`backend/src/services/pairing.service.ts`、`backend/prisma/schema.prisma`、`backend/tests/unit/services/email.service.test.ts`、`backend/tests/unit/services/auth.service.test.ts`、`backend/tests/unit/controllers/auth.controller.test.ts`
**最後核驗 Commit**：`d9fc84c`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 狀態

- 狀態：已處理
- 發現日期：2026-06-05
- 處理日期：2026-06-05
- 範圍：Backend / Web / App / Outbound email

## 原問題

`backend/src/services/email.service.ts` 曾把驗證碼、重設密碼、配對成功與梳理結果完成 email 全部寫死為中文，且 `backend/src/controllers/auth.controller.ts` 已有請求 locale 但未傳入 `authService`。因此 Web 或 App 使用者選擇英文時，仍可能收到中文郵件。

相關入口：

- `backend/src/controllers/auth.controller.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/services/email.service.ts`
- `backend/src/services/pairing.service.ts`

## 修復結果

- `EmailService` 建立 zh-TW / en-US email copy map。
- 註冊、驗證郵箱、重設密碼 email 使用 request locale，由 `AuthController` 傳入 `AuthService`，再傳至 `EmailService`。
- 配對成功與梳理結果完成 email 查詢收件人 `User.language`，逐位收件人渲染對應語言。
- 中文使用者面文案改用 `梳理結果`，英文使用 `Analysis`，不使用 `判決` / `Judgment` 作 email 使用者面術語。
- Web/App 不需要也不得重組 backend email 模板。

## 驗收證據

- `npm --prefix backend test -- tests/unit/services/email.service.test.ts tests/unit/controllers/auth.controller.test.ts tests/unit/services/auth.service.test.ts --runInBand`
- `npm --prefix backend run build`

## 後續維護規則

- 新增 outbound email template 時，必須在 backend 生成點承接 request / target locale。
- 收件人導向通知應優先使用收件人帳號語言；請求型驗證碼 email 應使用 request locale。
- 新 email 文案需同步核心術語，不得引入 `判決` / `Judgment` 作使用者面標籤。
