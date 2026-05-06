# App 端總覽

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：App端規格
**覆蓋範圍**：Expo App 基線、原生能力邊界與 App 開發投影總覽
**取證代碼入口**：`mobile/package.json`、`mobile/tsconfig.json`、`mobile/app/_layout.tsx`、`mobile/app/(tabs)/_layout.tsx`、`mobile/app/(tabs)/index.tsx`、`mobile/app/(tabs)/two.tsx`、`mobile/app/modal.tsx`、`mobile/components/Themed.tsx`、`mobile/constants/Colors.ts`、`mobile/src/platform`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`1295216`
**最後核驗日期**：`2026-05-06`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 當前 App 基線

App 版正式承載目錄為 `mobile/`。目前它是 Expo / React Native 專案，已存在：

1. `mobile/package.json`：Expo、Expo Router、React Native、React Native Paper、React Query、Zustand、Axios、SecureStore、Notifications、ImagePicker 等依賴。
2. `mobile/app/_layout.tsx` 與 `mobile/app/(tabs)/_layout.tsx`：Expo Router 初始路由骨架。
3. `mobile/app/(tabs)/index.tsx`、`mobile/app/(tabs)/two.tsx`、`mobile/app/modal.tsx`：仍是 Expo 模板頁與模板 modal，畫面文案仍為 `Tab One`、`Tab Two`、`Modal`，不代表 CJ 產品 route / screen 已落地。
4. `mobile/components/*` 與 `mobile/constants/Colors.ts`：模板級 UI / theme 基線。
5. `mobile/tsconfig.json`：已預留 `@cj/contracts`、`@cj/api-client` alias。
6. `mobile/src/platform/storage/types.ts`、`mobile/src/platform/notifications/types.ts`、`mobile/src/platform/upload/types.ts`：types-only 的平台 adapter 邊界，定義 token/session storage、push permission/token、upload asset / image picker option 的最小型別。

目前 App 尚未正式消費共享 contracts，也尚未承接 CJ 主產品流程。`mobile/app` 只代表 Expo Router 模板骨架，`mobile/src/platform` 只代表平台差異開始有型別邊界；兩者都不能被解讀為 SecureStore、Push、upload adapter、Deep Link、CJ navigation 或任何 CJ 主產品能力已完成。

## 2. App 版本產品定位

App 不是 Web 的截圖式重做，而是同一產品核心在移動端的承載：

| 能力組 | App 首輪承接原則 |
| --- | --- |
| 快速判斷 | 優先承接低門檻 quick flow，保留匿名 session / claim / quick case 語義 |
| 正式處理 | 承接登入、配對、案件、判決、修復旅程，但避免首輪一次塞入完整 Admin 能力 |
| 先聊再判 | 可作為 App 高頻入口，但 chat -> judgment / case 的後端歸屬與授權不能改寫 |
| 讓系統更懂你 | 適合承接心理訪談、個人檔案與關係檔案，但 schema 必須與 backend 保持一致 |
| 通知與提醒 | App 可使用 Push / Deep Link 提升到達率，但 notification 狀態與業務副作用仍由 backend 裁決 |

## 3. 原生能力邊界

App 端可新增以下平台適配層：

1. SecureStore：保存 token / session 相關本地憑證，但不得替代 backend 授權。
2. Push notification：承接提醒與召回，但 notification 狀態以 backend 為準。
3. Deep Link：進入 case、chat、judgment、repair journey 等目標，但進入後仍需 backend gate。
4. Camera / ImagePicker：承接 evidence 或 profile media，但上傳授權與 media provider 仍以 backend 為準。
5. App lifecycle：處理冷啟動、恢復、前後台切換與 token refresh。

這些能力只屬平台投影。現碼只有 storage / notifications / upload 的型別邊界，尚未接入 Expo SecureStore、Expo Notifications、ImagePicker 或真實 upload service。若需要新增 API、DB 欄位或共享 enum，必須回寫跨端核心與 Parity 待辦。

## 4. 與 Web 的差異

| 類型 | Web 基線 | App 投影 |
| --- | --- | --- |
| 路由 | React Router / browser URL | Expo Router / Deep Link；現碼仍是模板 tabs / modal，不是 CJ navigation |
| 本地儲存 | localStorage / sessionStorage 類 adapter | SecureStore / native storage adapter |
| 通知 | Web notification / in-app notification | Push notification + in-app notification |
| 媒體 | Browser upload / media provider | ImagePicker / camera + media provider |
| 認證恢復 | Browser refresh / route guard | cold start restore / app lifecycle refresh |
| UI | Web responsive layout | native navigation / touch-first layout |

## 5. 待閉環事項

App 開發啟動前至少要補齊以下任務：

1. 建立 App API adapter，讓 `mobile/` 正式消費 `@cj/contracts` 與 `@cj/api-client`。
2. 將 `mobile/app/(tabs)/index.tsx`、`mobile/app/(tabs)/two.tsx`、`mobile/app/modal.tsx` 從 Expo 模板替換為 CJ App 首輪 navigation / screen 骨架，並裁決 App 首輪路由與 Web 能力矩陣的對應關係。
3. 將 `mobile/src/platform/storage` 從 type boundary 推進到 SecureStore runtime adapter，並定義 token / session refresh 策略。
4. 將 `mobile/src/platform/notifications` 從 type boundary 推進到 Push token 註冊、失效、登出清理與 notification read 狀態同步方案。
5. 將 `mobile/src/platform/upload` 從 type boundary 推進到 ImagePicker / upload provider adapter，並裁決 evidence / profile media 的後端授權與資料歸屬。
6. 定義 Deep Link 到 case / chat / judgment / repair journey 的授權失敗回退。
7. 按 [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md) 補齊 App e2e / smoke / manual regression / evidence 入口。

以上若影響 backend 或 Web，一律同步記錄到 `50-跨端Mapping與Parity/` 與 `07-待處理問題與治理/待處理/`。

## 6. 關聯正文

1. App navigation 與 platform adapter 的具體落點規則，見 [01-App導航與平台Adapter基線.md](./01-App導航與平台Adapter基線.md)。
2. App 與 Web / Backend / API / DB / shared packages 的一致性缺口總覽，見 [../50-跨端Mapping與Parity/00-跨端Parity總覽.md](../50-跨端Mapping與Parity/00-跨端Parity總覽.md)。
3. App 首輪 screen 到 Backend / API / DB / shared package 的工程落點，見 [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)。
4. App 測試、回歸、CI 與證據接入規則，見 [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md)。
5. App 尚未落地的工程任務，見 [../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md](../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md)。
