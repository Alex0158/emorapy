# 正式案件安全聲明 Shared DTO 未暴露待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：正式案件安全聲明在 Backend、shared contract、Web 與 App typed create path 的一致性
**取證代碼入口**：`backend/src/utils/validation.ts`、`backend/src/services/case.service.ts`、`packages/contracts/src/case.ts`、`packages/api-client/src/m4.ts`、`frontend/src/services/api/case.ts`、`frontend/src/pages/Case/Create/index.tsx`、`mobile/app/(app)/case/index.tsx`、`mobile/src/platform/upload`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 現狀

Backend `POST /api/v1/cases` 的 route schema 與 `CaseService.createCase` 已接受 `safety_assertion` / `safetyAssertion` 與 inline safety fields，並可把通過的聲明寫入 `Case.safety_metadata`；同批 `evidence_urls` 也會沿用該 metadata。

但 `packages/contracts/src/case.ts` 的 `CreateCaseDto` 尚未包含這些字段；`packages/api-client/src/m4.ts` 的 `cases.create()` 以該 DTO 作 typed payload；Web `/case/create` 與 App Case screen 目前也沒有正式案件安全聲明輸入。App 已在 evidence upload path 透過 `mobile/src/platform/upload` 送出 `safety_assertion`，但這不等於 formal case create path 已具備同等能力。

## 代碼依據

- `backend/src/utils/validation.ts`、`backend/src/services/case.service.ts`：backend formal case create 已接受 safety assertion / inline safety fields，並可寫入 `Case.safety_metadata`。
- `packages/contracts/src/case.ts`：`CreateCaseDto` 尚未暴露 formal case safety assertion 欄位。
- `packages/api-client/src/m4.ts`：formal case create typed payload 依賴 `CreateCaseDto`。
- `frontend/src/services/api/case.ts`、`frontend/src/pages/Case/Create/index.tsx`、`mobile/app/(app)/case/index.tsx`：Web / App formal create UX 未暴露 safety assertion input。
- `mobile/src/platform/upload`：App evidence upload path 可送 `safety_assertion`，但該能力不等於 formal case create path 已完成。

## 文件偏差

正式 case 文件若只寫「`POST /cases` 支持 safety assertion」會把 backend additive support 誤讀成 shared DTO、Web create UX 與 App create UX 已同時具備。現行正式規格應持續區分「backend additive support 已存在」與「shared contract / 端側 create UX 待補」。

## 風險

1. 接口正文若只寫「正式建案可帶 safety assertion」，讀者會誤以為 Web / App typed client 都能直接送出同一契約。
2. App / Web 後續若要加入正式案件安全聲明 UX，可能需要用 `as any` 或繞過 shared DTO，造成通用契約分叉。
3. shared contract 落後於 backend additive capability，會削弱 `packages/contracts` 作為跨端開發依據的可信度。

## 目標狀態

1. `CreateCaseDto` 補齊 formal case safety assertion 欄位，與 backend route schema / service policy 對齊。
2. `@emorapy/api-client` M4 formal case client tests 覆蓋 safety assertion payload pass-through。
3. Web / App 若暫不提供 UX，需在平台文檔明確寫成「backend / shared contract ready；端側 UX 未暴露」，不得宣稱已完成端側輸入。
4. `06-接口描述/03-case.md`、`20-App端/` 與 `50-跨端Mapping與Parity/` 保持相同邊界口徑。

## 需要修改的文件

- `packages/contracts/src/case.ts`
- `packages/api-client/src/m4.ts` 與 M4 tests
- `frontend/src/services/api/case.ts`、`frontend/src/pages/Case/Create/index.tsx`
- `mobile/app/(app)/case/index.tsx`
- `docs/核心開發文件/06-接口描述/03-case.md`
- `docs/核心開發文件/20-App端/`、`docs/核心開發文件/50-跨端Mapping與Parity/`

## 驗證命令

- shared contract type test 或 compile fixture：`CreateCaseDto` 可接受 `safety_assertion` / inline safety fields。
- `@emorapy/api-client` M4 case create test：payload 不被過濾。
- Web / App 若新增 UX，需補相應 screen / service test；若不新增 UX，文檔只能說 typed contract ready。

## Owner / Status

- Owner：Cross-platform contract / Web / App
- Status：待處理
