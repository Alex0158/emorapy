# Repo 平台分層與共享規範

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：正式規格
**覆蓋範圍**：工作區結構、共享層與工程約束：Repo平台分層與共享規範
**取證代碼入口**：`package.json`、`scripts/start-dev.sh`、`frontend/tsconfig.app.json`、`frontend-admin/tsconfig.app.json`、`backend/tsconfig.json`、`mobile/package.json`、`mobile/tsconfig.json`、`packages/contracts/package.json`、`packages/api-client/package.json`、`backend/src`、`frontend/src`、`frontend-admin/src`、`mobile/app`、`mobile/src/platform`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 目的

本文件將 `mother-bear-court` 的平台分層正式定義為三個層次：

- `apps/*`：面向使用者的前端應用
- `services/*`：後端服務與基礎服務
- `packages/*`：可跨平台共用的契約、資料層核心與純邏輯

這份規範先建立「分類心智」與新代碼的落點原則，不要求一次性搬動既有大量目錄，也不等於現有目錄已全部進入同一 root workspace。

若本文件中的平台分層、共享 package、workspace、Backend 消費 shared artifact、App adapter、DB / API / shared 互操作或 release gate 口徑被修改，必須同步更新 [02-架構決策與ADR治理基線.md](./02-架構決策與ADR治理基線.md)；不能只把架構取捨寫成目錄說明。

## 2. 目前對應關係

目前 repo 實體目錄仍維持現狀，但後續新增代碼與文檔請依下列心智理解：

| 現有目錄 | 對應心智分類 | 說明 |
| --- | --- | --- |
| `frontend/` | `apps/web` | 主 Web 使用者端 |
| `frontend-admin/` | `apps/admin-web` | 管理端 Web |
| `mobile/` | `apps/mobile` | Expo App，單一 codebase 支援 iOS/Android |
| `backend/` | `services/backend` | API 與業務服務 |
| `packages/` | `packages/*` | 新增的共享層 |

## 3. 共享原則

應放入 `packages/*` 的內容：

- API contracts：DTO、enum、response shape、error code
- API client core：純 HTTP/SSE/upload transport，不碰 UI 與 storage
- domain core：純函式商業邏輯、normalize、permission、query key、state machine
- 設計 token、常數、文案 key

不應放入 `packages/*` 的內容：

- React DOM / React Native UI 元件
- `react-router-dom`、Expo Router、導航副作用
- `localStorage`、`sessionStorage`、`SecureStore` 等平台儲存細節
- 相機、推播、檔案選擇、deep link、背景任務
- 任何直接依賴瀏覽器或原生執行環境的程式碼

## 4. Web / Mobile 邊界

### 4.1 Web

`apps/web` 應承擔：

- Web-only UI、瀏覽器互動與 Tailwind / shadcn 現行視覺系統投影
- Browser router
- Web storage adapter
- 瀏覽器事件與頁面導轉

### 4.2 Mobile

`apps/mobile` 應承擔：

- React Native / Expo UI
- Expo Router
- SecureStore 與 native permissions
- 相機、推播、deep link、裝置能力

## 5. iOS / Android 策略

不建立 `ios-app` 與 `android-app` 兩個平行 repo。

統一使用單一 `mobile/`，並遵循以下規則：

- 完整 App 版正式採用 Expo + React Native + TypeScript，iOS 優先，Android 兼容。
- 預設所有功能放在跨平台共用檔案
- 只有在必要時才建立 `*.ios.ts`、`*.android.ts`、`*.ios.tsx`、`*.android.tsx`
- 平台差異優先收斂在 `mobile/` 內的平台適配層；`mobile/src/platform` 已有 API、SecureStore、SSE、upload、notifications、linking、lifecycle、telemetry runtime adapter 與 M0-M5 baseline gate，但完整 App 完成仍取決於 M6 外部 release sign-off；release DB parity 屬可刷新證據槽，不等於真機 / provider / native crash 已完成
- 業務流程、路由結構、型別契約與資料層邏輯應盡量共用

App 的路由結構不得直接照搬 Web route。`mobile/app` 的模板替換、Deep Link、session restore 與原生能力入口以 [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md) 為 gate；若同時牽動 Backend / API / DB / shared package，以 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md) 作工程對照。

完整 App 工程 PRD 與 Roadmap 以 [../20-App端/02-App完整版本工程PRD.md](../20-App端/02-App完整版本工程PRD.md) 與 [../20-App端/03-App完整版本開發Roadmap.md](../20-App端/03-App完整版本開發Roadmap.md) 為準；若改變技術路線、M0-M6 順序、EAS release policy 或 Android readiness 口徑，必須更新 ADR。

## 5.1 App 共享層持續收斂要求

App 後續開發需要 Web 配合的是共享層抽離，不是改變 Web UI 或對外流程：

| 類型 | 目標落點 | 規則 |
| --- | --- | --- |
| Domain API client | `packages/api-client` | 從 `frontend/src/services/api/*` 抽出 auth、session、quick、case、chat、interview、notification 等平台無關 API shape |
| Contracts | `packages/contracts` | DTO、enum、response shape、AI stream event / snapshot 與 notification payload 以 shared type 為準 |
| Pure domain logic | future `packages/domain` | 只放 reducer、query key、status normalize、permission predicate、phase helper，不放 UI / router / storage |
| Platform adapter | `frontend/src` / `mobile/src/platform` | Web 保留 browser adapter；App 保留 SecureStore、Expo Router、ImagePicker、Notifications、Linking adapter |

## 6. 推進順序

1. 先把新增或變更的型別與 API 契約收斂到 `packages/contracts`
2. 再把 Web 既有 request 層可抽離部分拆成 `packages/api-client` 與 Web adapter
3. App 新增業務能力時直接消費 `@emorapy/api-client` / `@emorapy/contracts`，不得回到 screen 直寫分叉 fetch / DTO

## 7. 當前落地範圍

本文件固定以下現行範圍：

- 建立 `packages/contracts`
- 建立 `packages/api-client`
- 保持 `mobile/`、`backend/` 不進 root workspace；`packages/*` 已進入 root workspace，但不做大規模 app 目錄搬移
- App 已具備 M0-M5 runtime 接線，但仍保持 `mobile/` 不進 root workspace 的 repo-local 邊界；完整 release 完成仍以 M6 strict sign-off 為準

這代表 repo 已開始進入平台分層模式，但仍保留既有目錄穩定性。

## 8. 共享層落地狀態

當前已具備：

- `frontend/tsconfig.app.json` 已接上 `@emorapy/contracts` 與 `@emorapy/api-client` alias
- `frontend/package.json` 已聲明 `@emorapy/contracts` workspace dependency，並已聲明 `@emorapy/api-client` workspace dependency
- `frontend/src/services/api/*` 已把 M1-M5 可共享 domain request 下沉到 `@emorapy/api-client`；`frontend/src/utils/aiStreamState.ts` 已消費 shared AI stream pure helper；Web adapter 仍保留 token/session、toast、router、storage、FormData、SSE 等 side effect seam
- `backend/tsconfig.json` 已指向共享 package declaration artifact，避免直接引用 `packages/*/src` 穿越 `rootDir`
- `frontend-admin/tsconfig.app.json` 已接上 `@emorapy/contracts` 與 `@emorapy/api-client` alias
- `frontend-admin/package.json` 已聲明 `@emorapy/contracts` 與 `@emorapy/api-client` workspace dependencies
- `mobile/package.json` / `mobile/package-lock.json` 已以 `file:../packages/*` dependency 聲明 `@emorapy/contracts` 與 `@emorapy/api-client`，`mobile/metro.config.js` 已建立 shared package alias
- `mobile/src/platform` 已有 API / SecureStore / SSE / upload / notifications / linking / lifecycle / telemetry runtime adapter 與 M0-M5 baseline gate；physical device、provider delivery 與 native crash runtime evidence 仍屬 M6 sign-off
- `frontend/` 與 `frontend-admin/` 不保留 app-local package-lock；CI/Vercel 必須從 root workspace 安裝
- Vercel build 必須先跑 shared artifacts，再執行 `npm run build --workspace frontend-admin`
- root 腳本若以 bare import 使用工具，必須由 root manifest 聲明依賴

仍未完成：

- `frontend-admin/` 只接入了 `@emorapy/contracts` 的局部 DTO，且 `frontend-admin/` 仍維持本地 domain API request stack，僅使用 `@emorapy/api-client` 的 transport baseline
- `packages/api-client` 已建立 M1-M5 domain client 消費面；仍需繼續把 Web 可共用 domain helper / query key / reducer 收斂到 shared package
- `backend/` 只消費共享 declaration artifact，不直接以共享原始碼作為編譯來源

## 9. 暫緩事項

以下項目是刻意延後，而不是遺漏：

- `backend/src` 目前仍有 `rootDir` 限制，不能直接安全地引用 `packages/contracts` 原始碼作為正式來源；應消費 `types/` declaration artifact
- `frontend/src/types/common.ts` 目前只做部分共享對齊，仍保留相容性包裝，避免一次影響既有大量 API 使用點
- `mobile/` 已正式消費 `@emorapy/contracts` / `@emorapy/api-client`；仍需補齊 EAS / TestFlight / physical device / provider delivery / native crash runtime evidence
- `frontend-admin/` 仍維持本地 domain API request stack，僅局部接入共享 contracts DTO 與 shared transport baseline

## 10. 下一步建議

建議下一輪依序推進：

1. 讓 `packages/contracts` 產生穩定的 declaration/build 輸出，供 backend 安全引用
2. 繼續把 `frontend/src/services/request.ts` 可抽離部分下沉到 `packages/api-client`
3. 依 `20-App端/03-App完整版本開發Roadmap.md` 補齊 EAS project id、EAS iOS/Android production artifact、TestFlight、physical device、真 Push delivery、native crash runtime evidence 與 evidence pack；release / production DB parity 是 release audit 證據槽，後續 schema/migration 變更後必須刷新
4. 持續要求所有 SecureStore、API、SSE、Push notification、upload / ImagePicker、Deep Link、lifecycle、telemetry 副作用經 `mobile/src/platform` adapter；`platform:check` 已納入 release preflight，但仍不能替代真機驗收
5. 建立 `packages/domain`，開始收斂 query keys、formatter、permission、AI phase reducer 與純業務邏輯
6. 若上述任何一步改變既有架構決策，新增或更新 ADR，並同步威脅建模、安全需求、NFR 與 RTM
