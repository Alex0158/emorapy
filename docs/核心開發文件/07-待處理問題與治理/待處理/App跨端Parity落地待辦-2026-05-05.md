# App 跨端 Parity 落地待辦（2026-05-05）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App 版承接跨端產品核心、共享 contracts / api-client、原生能力與 Web 基線 Parity 的待處理任務
**取證代碼入口**：`mobile/package.json`、`mobile/tsconfig.json`、`mobile/app/_layout.tsx`、`mobile/app/modal.tsx`、`mobile/src/platform`、`mobile/scripts/check-release-completion-audit.mjs`、`mobile/scripts/check-app-feature-coverage-contracts.mjs`、`mobile/scripts/check-app-true-service-smoke-contracts.mjs`、`packages/contracts/src`、`packages/api-client/src`、`frontend/src/router/index.tsx`、`backend/src/routes`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：進行中（M0-M5 普通用戶 App 工程 baseline 已具備；M6 外部 release sign-off 待補）
**Owner**：Mobile / Frontend / Backend / Ops
**關聯核心文件**：`20-App端/00-App端總覽.md`、`20-App端/01-App導航與平台Adapter基線.md`、`20-App端/03-App完整版本開發Roadmap.md`、`50-跨端Mapping與Parity/00-跨端Parity總覽.md`、`50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`、`08-測試規範與驗收/03-App測試與證據接入基線.md`

---

## 1. 現狀

核心文件已把 Web 版與 App 版定位為同一產品核心的不同平台投影。當前現碼事實如下：

1. `mobile/app` 已從 Expo template 轉為 Emorapy public / authenticated route group、普通用戶 M0-M5 screen、root provider、root error boundary 與 `modal`。
2. `mobile/src/platform` 已建立 API、SecureStore、SSE / AI stream、upload、notifications、linking、lifecycle、telemetry runtime adapter，且 `platform:check` 會阻止 screen / feature 層直接調 native side effect。
3. App 已消費 `@emorapy/contracts` / `@emorapy/api-client`；M1-M5 shared domain client、screen action、backend route、DB/schema 影響與 App adapter 由 `features:check`、`true-service:check`、`routes:check` 與 `08/03` 的測試基線守護。2026-06-20 已把 `routes:check` / `features:check` 從硬要求 route file 內中文 literal 調整為 i18n-aware contract：route 必須使用對應 i18n key，zh-TW / en-US catalog 必須保留正式 tab label 與 M2/M3 狀態文案。
4. release DB parity 與 telemetry runtime 已有 structured pass evidence，可作 release audit 證據槽；後續若 backend schema、release-blocking migration、backend version 或 telemetry runtime 路徑變更，仍需重新取證。
5. `npm --prefix mobile run release:completion:audit` 與 `npm --prefix mobile run goal:completion:audit` 仍判定 App release sign-off 未完成；M6 strict completion 仍受 Apple / App Store Connect credentials、EAS iOS artifact、TestFlight、physical device、push provider delivery 與 production native crash runtime evidence 約束，最終必須以 `release:completion:audit:strict` / `goal:completion:audit:strict` 通過為準。
6. 外部 status / handoff 的最新 canonical 索引為 `App-External-Evidence-Status-2026-06-20T11-58-54-050Z.json` 與 `App-External-Evidence-Handoff-2026-06-20T11-58-57-287Z.json`；它們只固定 owner 交接、env-file provenance 與 normalized blocker，不解除 M6 strict blocker。

本待辦只保留長期治理真相與剩餘缺口；單次命令輸出、機型、耗時、artifact 檔名、runner 演進與歷史修復過程應回到 `90-證據與盤點/`、`文件收斂/` 或對應已處理任務。

## 2. 待處理範圍

後續執行、驗收與狀態更新一律按 `20-App端/03-App完整版本開發Roadmap.md` 的 M0-M6 追蹤。

| Roadmap | 當前裁決 | 剩餘缺口 | 驗收 / 守衛 |
| --- | --- | --- | --- |
| M0 Foundation | App shell、route group、provider、root error boundary、API / storage adapter 與 route topology 已成 baseline | physical device native side-effect evidence、EAS / TestFlight release evidence 仍歸 M6 | `routes:check`、provider / adapter tests、native readiness gates |
| M1 Quick + Auth | Quick / Auth / result / claim-session / stream replay 已成 baseline；App password recovery screen 未承接 | reset-password / forgot-password App UX、native stream reconnect physical-device evidence | `features:check`、`true-service:check`、App Auth recovery 待辦 |
| M2 Profile + Interview | Profile / Interview / My Story、AI stream recovery、failed retry / partial-success UI 已成 baseline | native lifecycle interruption / recovery evidence | `features:check`、`true-service:check`、M2 screen / stream tests |
| M3 Chat | Chat Home / Room / Invite、room event stream、AI draft replay / recovery、request judgment gate 已成 baseline | native stream reconnect、true push invite landing evidence | `features:check`、`true-service:check`、Chat screen / parser / stream tests |
| M4 Formal Case + Repair | Case / Repair screen、formal evidence upload、repair plan select、execution confirm、replan stream replay 已成 baseline | formal case safety assertion shared DTO / typed create UX、native selected-media / profile media evidence、repair 全狀態 native evidence | `features:check`、`true-service:check`、formal safety DTO 待辦 |
| M5 Push + Deep Link + Upload + Telemetry | token register / revoke、notification state sync、Deep Link auth resume、upload handoff、safe telemetry ingest 已成 baseline | provider delivery、APNs sandbox、真機 notification lifecycle、production native crash runtime evidence | `features:check`、`platform:check`、release evidence runners |
| M6 Release Hardening | readiness / evidence runner / audit tooling、Android emulator boot smoke、Android release APK install/launch smoke 已成 baseline；release DB parity、telemetry runtime 與 EAS Android production artifact 為可刷新證據槽 | release completion blockers 未清零：Apple / ASC credentials、EAS iOS artifact、TestFlight、physical device、push provider delivery、production native crash runtime | `release:completion:audit`、`release:completion:audit:strict`、`App外部ReleaseSignoff待辦` |

2026-06-20：`npm --prefix mobile run routes:check` 與 `npm --prefix mobile run features:check` 已恢復通過。修復方式是讓 gate 驗證 App route 使用 `t('appTabs.*')`、`t('profileInterview.syncStatus')`、`t('chatRoom.aiDraftStatus')`，並同步驗證 zh-TW / en-US catalog 內保留「案件 / 對話 / 個人 / 提醒 / 修復」、「同步狀態」、「協調草稿」與英文對應文案；未改動 API、DB、shared contract、App route topology 或使用者流程。

## 3. Web 配合任務

| 任務 | 優先級 | 當前裁決 |
| --- | --- | --- |
| 把平台無關 API shape 下沉到 `packages/api-client` | P0 | 主站 Web M1-M5 domain client 與 AI stream pure helper 已收斂；Admin domain API 仍按實際接線逐步下沉 |
| 把 AI stream event / snapshot reducer、`after_seq` replay helper 收斂為 shared pure logic | P1 | Web / App 已共用 `packages/api-client/src/aiStreamState.ts` 的純 helper；平台 lifecycle、AbortController、header、token、locale、storage 留在各端 adapter |
| 規劃 packages/domain | P1 | 仍是後續架構治理項；不能因 shared api-client 已存在就宣稱 domain layer 完成 |
| 統一 upload contract 與 error normalize | P1 | evidence upload 已進 `packages/api-client` 與 App platform FormData adapter；profile media、真機 selected asset 與完整 App-native upload evidence 仍待 M6 / 專項待辦補齊 |

## 4. 驗收口徑

1. `20-App端/` 只能把 M0-M5 寫成普通用戶 App 工程 baseline；完整 App / release-ready / TestFlight / 真機 / provider delivery / production native crash runtime 只能由 M6 strict sign-off 裁決。
2. `50-跨端Mapping與Parity/` 必須對每個 App 能力標清 Web / Backend / API / DB / shared package / platform adapter 落點與剩餘差異。
3. App 新增 API、DB、shared enum、Push token、Deep Link、upload 授權或 session restore 時，若任一側未完成，必須新增或更新 `07-待處理問題與治理/待處理/` 的單問題待辦。
4. App 測試與 smoke gate 必須按 `08-測試規範與驗收/03-App測試與證據接入基線.md` 進入 `08-測試規範與驗收/`、`測試/` 或 `90-證據與盤點/` 的正式入口。

## 5. 風險

1. 若 App 直接複製 Web 頁面、storage、guard 或 DTO，會形成第二套產品語義。
2. 若 Push / Deep Link / SecureStore / upload / telemetry 不經 platform adapter，會在 auth/session、notification、case visibility、隱私與 evidence 留存上產生跨端不一致。
3. 若把 local smoke、simulator / emulator、dry-run runner、structured blocked JSON 或 evidence runner 存在寫成 release pass，會誤導 App completion 判定。
4. 若 shared contracts / api-client 停在 M1-M5 現狀，後續 App Release、Telemetry report、Push device token、Admin report 仍可能分叉 API 與狀態枚舉。
5. 若本待辦重新累積單次操作流水，將失去作為活躍治理入口的可讀性；細節應回到 evidence / 已處理任務 / 文件收斂。

## 6. 驗證命令

```bash
npm run docs:check
npm --prefix mobile run routes:check
npm --prefix mobile run features:check
npm --prefix mobile run true-service:check
npm --prefix mobile run platform:check
npm --prefix mobile run release:completion:audit
npm --prefix mobile run goal:completion:audit
npm --prefix mobile run release:completion:audit:strict
npm --prefix mobile run goal:completion:audit:strict
```
