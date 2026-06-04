# App 可見文案 Hardcoded Literal Gate 缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App user-facing copy static gate、locale catalog completeness 防回流
**取證代碼入口**：`mobile/scripts/check-user-copy-contracts.mjs`、`mobile/app`、`mobile/src/ui`、`mobile/src/features`
**最後核驗 Commit**：`eb75f35`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查復核確認，production `mobile/app` / `mobile/src` 除 i18n catalog 外已無繁中 hardcoded literal，`npm --prefix mobile run copy:check` 也已通過。

但 `mobile/scripts/check-user-copy-contracts.mjs` 目前主要防止工程術語、後端狀態碼與 raw backend field 進入可見 UI；它不會把一般可見 hardcoded string literal 本身視為失敗。因此後續新增 `title="Hello"`、`placeholder="Something"`、直接 JSX text 或 visible state template 時，可能繞過 `t()` / catalog，導致語言切換後該文案不跟隨使用者所選語言。

## 影響範圍

- App screen：`mobile/app/**/*.tsx` 的 JSX text、visible prop / attribute 與 state feedback。
- App shared UI / visible copy module：`mobile/src/ui`、`mobile/src/features`。
- i18n catalog：新增可見文案必須回到 `mobile/src/i18n/catalogs/zh-TW.ts` 與 `mobile/src/i18n/catalogs/en-US.ts`，保持 key / placeholder parity。

## 目標行為與方案

1. 擴充 `check-user-copy-contracts.mjs`：對直接 JSX text、quoted visible attributes、visible attribute expression 內的 raw string literal、visible state template literal 加 hardcoded literal gate。
2. 允許非文案格式 literal，例如 email format placeholder `name@example.com`；不得把 route、status、test id 或 i18n key 誤判為 user-facing copy。
3. 保留既有 banned term / raw backend field 掃描，不降低目前 copy quality gate。
4. Gate 通過後，才可把 App umbrella 的「缺少 completeness gate」改為已完成。

## 邊界與注意事項

- 本輪不翻譯 AI / backend 生成內容；只防 App 自有 user-facing literal 回流。
- 本輪不要求把資料格式 placeholder 翻譯，例如 email placeholder。
- 若發現現碼仍有真可見 hardcoded 文案，必須先修成 catalog key，不能用 allowlist 掩蓋。

## 驗證方式

- `npm --prefix mobile run copy:check`
- `npm --prefix mobile run accessibility:check`
- `npm --prefix mobile test -- src/i18n/index.test.js`
- `npm --prefix mobile run typecheck`
- 靜態掃描確認 production `mobile/app` / `mobile/src` 除 catalog 外無繁中 hardcoded literal，且直接 visible quoted attribute 只剩資料格式 allowlist。

## Owner / Status Notes

- Owner：agent
- Status：已完成並歸檔。

## 2026-06-05 本輪結果

1. `mobile/scripts/check-user-copy-contracts.mjs` 已擴充 hardcoded visible literal gate：direct JSX text、quoted visible attributes、direct raw string visible prop expression 與 visible state template literal 都會被檢查。
2. Gate 保留既有 banned engineering/backend term 與 raw backend field 檢查；`t('key')` expression、route/status/test id 與資料格式 placeholder 不被誤判。
3. 現碼復核確認 production `mobile/app` / `mobile/src` 除 `mobile/src/i18n/catalogs/*` 外無繁中 hardcoded literal；直接 visible quoted attribute 僅剩 email 格式 placeholder `name@example.com`。
4. 已驗證：`npm --prefix mobile run copy:check` 通過，輸出已更新為 hardcoded literals / engineering terms / backend status terms 三類 gate。
5. 已驗證：`npm --prefix mobile run accessibility:check`、`npm --prefix mobile test -- src/i18n/index.test.js`、`npm --prefix mobile run typecheck` 均通過。
