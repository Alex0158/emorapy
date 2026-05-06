# Repo 平台分層與共享規範

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：正式規格
**覆蓋範圍**：工作區結構、共享層與工程約束：Repo平台分層與共享規範
**取證代碼入口**：`package.json`、`scripts/start-dev.sh`、`frontend/tsconfig.app.json`、`frontend-admin/tsconfig.app.json`、`backend/tsconfig.json`、`mobile/package.json`、`mobile/tsconfig.json`、`packages/contracts/package.json`、`packages/api-client/package.json`、`backend/src`、`frontend/src`、`frontend-admin/src`、`mobile/app`、`mobile/src/platform`
**最後核驗 Commit**：`1295216`
**最後核驗日期**：`2026-05-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 目的

本文件將 `mother-bear-court` 的平台分層正式定義為三個層次：

- `apps/*`：面向使用者的前端應用
- `services/*`：後端服務與基礎服務
- `packages/*`：可跨平台共用的契約、資料層核心與純邏輯

這份規範先建立「分類心智」與新代碼的落點原則，不要求一次性搬動既有大量目錄，也不等於現有目錄已全部進入同一 root workspace。

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

- 預設所有功能放在跨平台共用檔案
- 只有在必要時才建立 `*.ios.ts`、`*.android.ts`、`*.ios.tsx`、`*.android.tsx`
- 平台差異優先收斂在 `mobile/` 內的平台適配層；`mobile/src/platform` 已有 storage、notifications、upload 的 types-only 骨架，但 runtime adapter 尚未落地
- 業務流程、路由結構、型別契約與資料層邏輯應盡量共用

App 的路由結構不得直接照搬 Web route。`mobile/app` 的模板替換、Deep Link、session restore 與原生能力入口以 [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md) 為 gate；若同時牽動 Backend / API / DB / shared package，以 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md) 作工程對照。

## 6. 推進順序

1. 先把重複的型別與 API 契約收斂到 `packages/contracts`
2. 再把 Web 既有 request 層可抽離部分拆成 `packages/api-client` 與 Web adapter
3. 最後再逐步讓 `mobile` 消費共享層

## 7. 本次落地範圍

本次只做以下事情：

- 建立 `packages/contracts`
- 建立 `packages/api-client`
- 保持 `mobile/`、`backend/` 不進 root workspace；`packages/*` 已進入 root workspace，但不做大規模 app 目錄搬移
- App 只保留 Expo Router 模板與 `mobile/src/platform` types-only 骨架，不在本輪建立 CJ mobile feature 或 runtime platform adapter

這代表 repo 已開始進入平台分層模式，但仍保留既有目錄穩定性。

## 8. 第二階段落地狀態

目前已完成：

- `frontend/tsconfig.app.json` 已接上 `@cj/contracts` 與 `@cj/api-client` alias
- `frontend/package.json` 已聲明 `@cj/contracts` workspace dependency
- `frontend/src/types/*` 與 `frontend/src/services/api/auth.ts` 已開始消費 `@cj/contracts`
- `backend/tsconfig.json` 已指向共享 package declaration artifact，避免直接引用 `packages/*/src` 穿越 `rootDir`
- `frontend-admin/tsconfig.app.json` 已接上 `@cj/contracts` 與 `@cj/api-client` alias
- `frontend-admin/package.json` 已聲明 `@cj/contracts` 與 `@cj/api-client` workspace dependencies
- `mobile/tsconfig.json` 已預留共享 package alias
- `mobile/src/platform/storage/types.ts`、`mobile/src/platform/notifications/types.ts`、`mobile/src/platform/upload/types.ts` 已建立平台 adapter 型別邊界，但沒有 runtime 實作
- `frontend/` 與 `frontend-admin/` 不保留 app-local package-lock；CI/Vercel 必須從 root workspace 安裝
- Vercel build 必須先跑 shared artifacts，再執行 `npm run build --workspace frontend-admin`
- root 腳本若以 bare import 使用工具，必須由 root manifest 聲明依賴

目前尚未完成：

- `frontend-admin/` 只接入了 `@cj/contracts` 的局部 DTO，且 `frontend-admin/` 仍維持本地 domain API request stack，僅使用 `@cj/api-client` 的 transport baseline
- `packages/api-client` 已建立 transport baseline，但現行 app 尚未形成穩定 domain API client 消費面
- `backend/` 只消費共享 declaration artifact，不直接以共享原始碼作為編譯來源

## 9. 暫緩事項

以下項目是刻意延後，而不是遺漏：

- `backend/src` 目前仍有 `rootDir` 限制，不能直接安全地引用 `packages/contracts` 原始碼作為正式來源；應消費 `types/` declaration artifact
- `frontend/src/types/common.ts` 目前只做部分共享對齊，仍保留相容性包裝，避免一次影響既有大量 API 使用點
- `mobile/` 尚未正式消費共享 contracts，目前只保留既有 Expo 目錄、alias 準備與 types-only 平台骨架
- `frontend-admin/` 仍維持本地 domain API request stack，僅局部接入共享 contracts DTO 與 shared transport baseline

## 10. 下一步建議

建議下一輪依序推進：

1. 讓 `packages/contracts` 產生穩定的 declaration/build 輸出，供 backend 安全引用
2. 繼續把 `frontend/src/services/request.ts` 可抽離部分下沉到 `packages/api-client`
3. 為 `mobile/src/platform` 補齊 SecureStore、Push notification、upload / ImagePicker 等 runtime adapter；動手前先對齊 `20-App端/01-App導航與平台Adapter基線.md`，並在 `50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md` 與 Parity 待辦中裁決 API / DB / shared 影響
4. 建立 `packages/domain`，開始收斂 query keys、formatter、permission 與純業務邏輯
