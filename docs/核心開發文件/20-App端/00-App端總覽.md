# App 端總覽

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：正式規格
**覆蓋範圍**：Expo App 當前基線、跨端承接原則、原生能力邊界與 App 開發待閉環事項
**取證代碼入口**：`mobile/package.json`、`mobile/tsconfig.json`、`mobile/app/_layout.tsx`、`mobile/app/(tabs)/_layout.tsx`、`mobile/components/Themed.tsx`、`mobile/constants/Colors.ts`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`adda512`
**最後核驗日期**：`2026-05-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 當前 App 基線

App 版正式承載目錄為 `mobile/`。目前它是 Expo / React Native 專案，已存在：

1. `mobile/package.json`：Expo、Expo Router、React Native、React Native Paper、React Query、Zustand、Axios、SecureStore、Notifications、ImagePicker 等依賴。
2. `mobile/app/_layout.tsx` 與 `mobile/app/(tabs)/_layout.tsx`：Expo Router 初始路由骨架。
3. `mobile/components/*` 與 `mobile/constants/Colors.ts`：模板級 UI / theme 基線。
4. `mobile/tsconfig.json`：已預留 `@cj/contracts`、`@cj/api-client` alias。

目前 App 尚未正式消費共享 contracts，也尚未承接 CJ 主產品流程。這是待開發狀態，不是產品能力已完成狀態。

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

這些能力只屬平台投影。若需要新增 API、DB 欄位或共享 enum，必須回寫跨端核心與 Parity 待辦。

## 4. 與 Web 的差異

| 類型 | Web 基線 | App 投影 |
| --- | --- | --- |
| 路由 | React Router / browser URL | Expo Router / Deep Link |
| 本地儲存 | localStorage / sessionStorage 類 adapter | SecureStore / native storage adapter |
| 通知 | Web notification / in-app notification | Push notification + in-app notification |
| 媒體 | Browser upload / media provider | ImagePicker / camera + media provider |
| 認證恢復 | Browser refresh / route guard | cold start restore / app lifecycle refresh |
| UI | Web responsive layout | native navigation / touch-first layout |

## 5. 待閉環事項

App 開發啟動前至少要補齊以下任務：

1. 建立 App API adapter，讓 `mobile/` 正式消費 `@cj/contracts` 與 `@cj/api-client`。
2. 裁決 App 首輪路由與 Web 能力矩陣的對應關係。
3. 定義 SecureStore token / session refresh 策略。
4. 定義 Push token 註冊、失效、登出清理與 notification read 狀態同步。
5. 定義 Deep Link 到 case / chat / judgment / repair journey 的授權失敗回退。
6. 補齊 App e2e / smoke / manual regression 入口。

以上若影響 backend 或 Web，一律同步記錄到 `50-跨端Mapping與Parity/` 與 `07-待處理問題與治理/待處理/`。

