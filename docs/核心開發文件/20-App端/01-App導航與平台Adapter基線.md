# App 導航與平台 Adapter 基線

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：App端規格
**覆蓋範圍**：Expo App 基線、原生能力邊界與 App 開發投影：01-App導航與平台Adapter基線
**取證代碼入口**：`mobile/package.json`、`mobile/tsconfig.json`、`mobile/app/_layout.tsx`、`mobile/app/(tabs)/_layout.tsx`、`mobile/app/(tabs)/index.tsx`、`mobile/app/(tabs)/two.tsx`、`mobile/app/modal.tsx`、`mobile/components/Themed.tsx`、`mobile/constants/Colors.ts`、`mobile/src/platform`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`1295216`
**最後核驗日期**：`2026-05-06`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 定位

本文件承接 App 端從 Expo 模板骨架走向 CJ App 的工程落點規則。它不重新定義產品能力，只回答兩件事：

1. `mobile/app` 的 navigation / screen skeleton 如何從模板狀態替換成 CJ App 首輪路由。
2. `mobile/src/platform` 的 types-only adapter 邊界如何推進到可運行的 SecureStore、Push notification、upload / ImagePicker 等平台實作。

產品能力、角色、流程與狀態仍以 `00-跨端產品核心/` 為準；Web 已落地狀態與 App 缺口仍以 `50-跨端Mapping與Parity/` 為準。

## 2. 現碼基線

| 區域 | 現碼狀態 | 裁決 |
| --- | --- | --- |
| `mobile/app/_layout.tsx` | Expo Router root stack，載入 font、theme、splash、`(tabs)` 與 `modal` | 可作 App root layout 起點，但尚未接入 auth/session restore、QueryClient、API client、error telemetry |
| `mobile/app/(tabs)/_layout.tsx` | 兩個模板 tabs：`index`、`two`，title 為 `Tab One`、`Tab Two` | 只能視為模板 navigation，不能直接當 CJ 主 navigation |
| `mobile/app/(tabs)/index.tsx` | 模板 `Tab One` 頁，展示 `EditScreenInfo` | 未承接任何 CJ screen |
| `mobile/app/(tabs)/two.tsx` | 模板 `Tab Two` 頁，展示 `EditScreenInfo` | 未承接任何 CJ screen |
| `mobile/app/modal.tsx` | 模板 modal，展示 `EditScreenInfo` | 未承接任何 CJ modal / flow |
| `mobile/src/platform/storage/types.ts` | token / session storage adapter interface | 只有型別邊界，未接 Expo SecureStore |
| `mobile/src/platform/notifications/types.ts` | push permission / token payload type | 只有型別邊界，未接 Expo Notifications |
| `mobile/src/platform/upload/types.ts` | upload asset / image picker option type | 只有型別邊界，未接 ImagePicker 或 upload provider |

因此，當前 App 端可以稱為「Expo template + platform type boundary」，不能稱為 CJ App MVP、CJ App route、CJ App screen 或 App runtime adapter 已完成。

## 3. Navigation 替換規則

替換 `mobile/app` 模板時，必須遵守以下規則：

1. 不在 `Tab One` / `Tab Two` 命名下堆 CJ 功能；開始 App 功能前應先裁決 route group 與 screen 名稱。
2. App route 不直接複製 Web URL。Web route 是對照來源，App route 要按 mobile navigation、Deep Link 與 session restore 重新投影。
3. 所有進入 case、chat、judgment、repair journey、profile、notification 的 App screen，都只能提交上下文；最終授權仍由 backend gate 裁決。
4. 首輪 navigation 應先建立可追溯骨架，再逐步接功能，不應讓單頁臨時 navigation 成為事實標準。
5. Admin Web 不進普通 App navigation；若需要運營事件回傳，只能走 telemetry / error context，不做 App admin console。

## 4. 首輪 Screen 分組建議

首輪 CJ App navigation 可按以下平台投影分組；這是待落地建議，不代表現碼已實作：

| 分組 | 承接能力 | 最低後端依賴 | 狀態 |
| --- | --- | --- | --- |
| Auth / Session | login、register、session restore、logout | auth / session routes | 待承接 |
| Quick | 快速判斷、匿名 session、claim | quick session / case / judgment | 待承接 |
| Case | 配對、正式案件、判決、修復旅程 | pairing / case / judgment / reconciliation / execution | 待承接 |
| Chat | 聊天室、先聊再判、chat handoff | chat / message / stream / judgment handoff | 待承接 |
| Profile | 心理訪談、個人檔案、關係檔案 | interview / psych profile / profile | 待承接 |
| Notification | in-app notification、Push entry、Deep Link landing | notification / content / deep-link target | 待承接 |

任何分組如果需要新增 API response、DB 欄位、shared enum 或 backend side effect，必須先更新 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md) 並建立或更新待處理任務。若該分組要進入 smoke / regression / CI 或證據留存，還必須符合 [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md)。

## 5. Platform Adapter 推進規則

`mobile/src/platform` 應作為平台副作用的唯一收斂層。後續實作時，業務 screen 不應直接散落調用 Expo API。

| Adapter | 現有型別 | Runtime 目標 | 不得做的事 |
| --- | --- | --- | --- |
| Storage | `TokenStorageAdapter`、`SessionStorageAdapter` | 封裝 Expo SecureStore，支援 token / session restore / clear | 不得在 screen 中直接讀寫 SecureStore |
| Notifications | `PushPermissionResult`、`PushTokenPayload` | 封裝 permission、push token 取得、登出清理與 token sync | 不得讓 Push 狀態繞過 backend notification 狀態 |
| Upload | `UploadAsset`、`PickImageOptions` | 封裝 ImagePicker / file metadata normalize / upload provider handoff | 不得在 App 本地裁決 evidence / media 授權 |

若新增 Deep Link、App lifecycle、device info、background task 等 adapter，也應先落在 `mobile/src/platform/<domain>/`，再由 screen 或 service adapter 消費。

## 6. 與共享層的接線規則

App 正式功能不得手寫第二套 DTO。接線順序固定如下：

1. 先確認 `packages/contracts` 是否已有對應 enum / DTO / response shape。
2. 再確認 `packages/api-client` 是否已有可重用 transport 或 domain client。
3. App 端只補 platform adapter、query/cache adapter、navigation handoff，不在 screen 裡硬編 API shape。
4. 若 contracts / api-client 不足，先補共享層或建立待辦，不以 App local type 長期替代。

## 7. 驗收口徑

以下條件全部滿足前，App 端仍不得標為 CJ App 主流程已落地：

1. `mobile/app` 不再保留 `Tab One` / `Tab Two` / template modal 作為主入口。
2. 至少一組 CJ App screen 能對應到 `50-跨端Mapping與Parity/` 的能力矩陣。
3. App API adapter 正式消費 `@cj/contracts` 或 `@cj/api-client`，沒有新增長期 App-only DTO 分叉。
4. Storage / Notifications / Upload 若被功能使用，必須經 `mobile/src/platform` runtime adapter，不直接散落 Expo API。
5. App smoke / regression / CI / evidence 入口已按 [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md) 進入 `08-測試規範與驗收/`、`測試/` 或 `90-證據與盤點/`。
