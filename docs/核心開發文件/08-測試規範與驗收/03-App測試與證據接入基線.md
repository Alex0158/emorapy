# App 測試與證據接入基線

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：測試規範
**覆蓋範圍**：App smoke / regression / CI / evidence 接入前置規則
**取證代碼入口**：`mobile/package.json`、`mobile/app`、`mobile/src/platform`、`mobile/tsconfig.json`、`packages/contracts/src`、`packages/api-client/src`、`backend/src/routes`、`backend/prisma/schema.prisma`
**最後核驗 Commit**：`1295216`
**最後核驗日期**：`2026-05-06`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本文定義 App 測試進入正式測試體系前的基線。它不宣稱 App 已完成，也不新增尚未存在的測試命令。

當前現碼事實：

1. `mobile/` 已存在 Expo 專案。
2. `mobile/app` 仍是 Expo Router 模板 tabs / modal，不是 CJ App navigation。
3. `mobile/src/platform/storage`、`mobile/src/platform/notifications`、`mobile/src/platform/upload` 只有 types-only 邊界，尚未形成 SecureStore、Push、upload runtime adapter。
4. `mobile/tsconfig.json` 已預留 `@cj/contracts` 與 `@cj/api-client` alias，但 App 尚未正式消費共享 contracts / api-client。
5. 倉庫現有自動化測試與手動回歸主要覆蓋 Backend、Web、Admin Web、跨站真服務與發布腳本，不覆蓋 App 原生能力。

## 1. 進場條件

App smoke / regression / CI 進入 `08-測試規範與驗收/`、`測試/` 或 `90-證據與盤點/` 前，必須先滿足以下條件：

1. 對應能力已在 [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md) 找到 screen、navigation 或 platform adapter 落點。
2. 對應 Backend / API / DB / shared package 影響已在 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md) 標清。
3. 若 API、DB、shared enum、Push token、Deep Link、upload 授權或 session restore 尚未閉環，必須更新 [../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md](../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md) 或新增更細待辦。
4. 測試名稱、證據名稱與 case id 必須使用跨端產品能力語義，不得沿用 `Tab One` / `Tab Two` 等模板名稱作正式測試主體。

## 2. 最小測試分層

App 測試落地後，至少分為四層：

| 層級 | 覆蓋對象 | 可進入條件 | 文件落點 |
| --- | --- | --- | --- |
| App smoke | App 啟動、root layout、auth/session restore、至少一條 CJ 主流程入口 | `mobile/app` 已替換模板主入口 | `測試/回歸與驗收/` |
| Platform adapter tests | SecureStore、Push token、upload/ImagePicker、Deep Link parse / fallback | `mobile/src/platform/<domain>` 已有 runtime adapter | `08-測試規範與驗收/` 補規範，`測試/` 補案例 |
| Cross-contract tests | App API adapter 對 `@cj/contracts` / `@cj/api-client` 的消費 | App 不再長期手寫分叉 DTO | `50-跨端Mapping與Parity/` + `測試/` |
| App evidence | 真機 / 模擬器截圖、錄屏、CI log、manual regression record | 對應測試已能重跑或有清楚環境說明 | `90-證據與盤點/` |

只有「App screen 可以啟動」不足以宣稱 App parity 完成；必須同時說明它對 API、DB、shared contract、platform adapter 與跨端產品語義的影響。

## 3. 不得替代

以下情況不能被視為 App 已驗收：

1. Web / Admin Web 單元測試、Playwright 或手動回歸通過。
2. `mobile/` Expo 模板可以啟動。
3. `mobile/src/platform` 只有型別檔存在。
4. App 使用本地 mock DTO 跑通，但沒有對齊 `packages/contracts` 或 `packages/api-client`。
5. App 截圖或錄屏沒有對應可追溯的能力分組、測試步驟、API / DB / shared 影響說明。

## 4. 證據命名與回寫

新增 App 證據時，必須同時標明：

1. 對應跨端能力組：Auth、Quick、Case、Chat、Profile、Notification、Media、Telemetry。
2. 對應 App screen / adapter。
3. 對應 Backend route / DB schema / shared package，若沒有影響需明確寫「無新增後端/DB/shared 影響」。
4. 測試方式：unit、integration、simulator、device、manual regression、CI。
5. 尚未閉環項：直接鏈接待辦，不得只在證據中口頭保留。

若 App 測試結果暴露產品語義或 schema/runtime 差異，必須回寫 `00-跨端產品核心/`、`20-App端/`、`50-跨端Mapping與Parity/` 或 `07-待處理問題與治理/待處理/`，不能只留在測試證據中。
