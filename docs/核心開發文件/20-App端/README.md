# App 端

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：域索引
**覆蓋範圍**：20-App端 子域入口與閱讀順序
**取證代碼入口**：`mobile/package.json`、`mobile/tsconfig.json`、`mobile/app/_layout.tsx`、`mobile/app/modal.tsx`、`mobile/src/platform`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本目錄是 App 版開發入口。App 版以現有 `mobile/` Expo 專案為承載位置，與 Web 共用產品核心、後端 API、DB schema 與共享 contracts 方向。

App 工程裁決固定為 Expo + React Native + TypeScript，iOS 優先、Android 兼容、單一 `mobile/` codebase。現行穩定口徑是：`mobile/app` 已從 Expo template 轉為 CJ route group 與普通用戶業務 screen；`mobile/src/platform` 已建立 API / SecureStore / SSE / upload / notifications / linking / lifecycle / telemetry runtime adapter；M0-M5 普通用戶 App 工程已能對應 Quick/Auth、Profile/Interview、Chat、Formal Case/Repair、Notification/Deep Link/Upload/Telemetry 的 screen、shared client、backend route / schema 與驗收入口。這代表 App foundation 與 M1-M5 主流程已有 M0-M5 工程 baseline；完整 App release completion 仍需 M6 strict release sign-off，包含 EAS/TestFlight、physical device、真 provider delivery 與 production native crash runtime。長期 crash-free / external tracing baseline 屬 post-release / SLO baseline，不替代也不擴張當前 strict release blocker。

## 閱讀順序

1. [00-App端總覽.md](./00-App端總覽.md)
2. [01-App導航與平台Adapter基線.md](./01-App導航與平台Adapter基線.md)
3. [02-App完整版本工程PRD.md](./02-App完整版本工程PRD.md)
4. [03-App完整版本開發Roadmap.md](./03-App完整版本開發Roadmap.md)
5. [../00-跨端產品核心/00-跨端產品核心總覽.md](../00-跨端產品核心/00-跨端產品核心總覽.md)
6. [../00-跨端產品核心/01-產品PRD總章.md](../00-跨端產品核心/01-產品PRD總章.md)
7. [../00-跨端產品核心/03-成功指標與產品健康.md](../00-跨端產品核心/03-成功指標與產品健康.md)
8. [../10-Web端/00-Web端凍結基線總覽.md](../10-Web端/00-Web端凍結基線總覽.md)
9. [../50-跨端Mapping與Parity/00-跨端Parity總覽.md](../50-跨端Mapping與Parity/00-跨端Parity總覽.md)
10. [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)
11. [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md)

## 維護規則

1. App 端文件只能描述 `mobile/` 的平台投影與原生差異。
2. App 不另建獨立產品規則；跨端 PRD 需求、成功指標與產品能力以 `00-跨端產品核心/` 為準。
3. App 尚未實現但 Web 已存在的能力，先記入 Parity 缺口，不在 App 文件中假裝已完成。
4. `mobile/app` 的 CJ route group 與 M0-M5 screen 已可作 M0-M5 普通用戶 App flow 入口；是否可宣稱完整完成，仍以 Roadmap 的 native / external evidence 與 M6 strict release sign-off 為準。
5. `mobile/src/platform` 的 runtime adapter 只能證明平台副作用已有收斂入口；未有 physical device、provider delivery 與 production native crash runtime evidence 前，不得當作 Push delivery、selected-media upload、SSE native runtime 或 production native crash runtime 已完整驗收；長期 crash-free telemetry 另屬 post-release / SLO baseline；release DB parity 與 telemetry runtime 是 release audit 證據槽，後續 backend schema、version 或 telemetry runtime 變更後必須刷新。
6. App 對 DB schema、API contract、Push、Deep Link、SecureStore 的需求若影響 Web 或 backend，一律同步建立待處理任務。
7. App screen 或 adapter 進入實作前，必須先在 `50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md` 補齊 Backend / API / DB / shared package 對照與缺口裁決。
8. App smoke / regression / CI 或證據留存進場前，必須先符合 `08-測試規範與驗收/03-App測試與證據接入基線.md`；不得用 Expo 模板可啟動或 Web/Admin 測試通過替代 App 驗收。
9. App 開發順序固定以 `03-App完整版本開發Roadmap.md` 的 M0-M6 為主控；若需要調整順序，必須同步更新 Roadmap、Parity、待辦與 RTM。
