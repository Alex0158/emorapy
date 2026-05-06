# App 首輪能力與工程落點 Mapping

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：跨端映射
**覆蓋範圍**：跨端能力到 Web / App / Backend / API / DB / 共享層的映射與缺口：01-App首輪能力與工程落點Mapping
**取證代碼入口**：`backend/src/routes`、`backend/prisma/schema.prisma`、`frontend/src/router/index.tsx`、`frontend-admin/src/router.tsx`、`mobile/app`、`mobile/tsconfig.json`、`mobile/src/platform`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`1295216`
**最後核驗日期**：`2026-05-06`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 定位

本文件承接 `20-App端/01-App導航與平台Adapter基線.md`，把 App 首輪 screen 分組映射回跨端產品能力、Web 凍結基線、Backend/API、DB / shared packages 與待處理缺口。

它不裁決 App UI 長相，也不重新定義產品能力。它只回答：當 App 開始替換 Expo 模板時，每一組 screen 應對照哪些 Web/Backend 事實來源，哪些差異必須記成 Parity 缺口。

## 2. 狀態口徑

| 狀態 | 定義 |
| --- | --- |
| Template | 現碼仍是 Expo 模板或僅有 types-only 骨架 |
| Candidate | 已有建議落點，但尚未有 CJ App screen / runtime adapter |
| Blocked | 必須先裁決 API / DB / shared contract / platform adapter |
| Ready for implementation | 文件、映射與待辦已閉環，可進入 App 代碼實作 |
| Implemented | App 端已有可追溯 screen / adapter / API 消費與驗收入口 |

當前所有 App 首輪能力均不得標為 `Implemented`。

## 3. 首輪能力 Mapping

| App 分組 | 跨端能力 | Web / Admin 對照 | Backend / API 對照 | DB / Shared 對照 | App 現況 | 裁決 |
| --- | --- | --- | --- | --- | --- | --- |
| Auth / Session | 認證、會話、匿名 session 升格 | Web login / register / route guard | auth routes、session routes | user / session schema、`@cj/contracts` auth/session DTO | Template | Candidate；先建立 App auth/session adapter，不改 backend gate |
| Quick | 快速判斷、匿名 quick flow、claim | Web quick experience / collaborative quick | quick session、case、judgment 相關 routes | quick session / case mode / judgment schema、case DTO | Template | Candidate；高優先級，但必須復用 quick/session/case 語義 |
| Case | 正式處理、配對、提交案件、判決、修復旅程 | Web case / pairing / judgment / reconciliation / execution | pairing、case、judgment、reconciliation、execution routes | case / pairing / judgment / repair schema、contracts case DTO | Template | Candidate；分階段承接，不一次塞滿正式處理全鏈路 |
| Chat | 先聊再判、chat handoff | Web chat room / chat-to-judgment | chat、message、stream、judgment handoff routes | chat room / message / judgment source tracking | Template | Candidate；可做 App 高頻入口，但 chat -> case/judgment 歸屬不能改 |
| Profile | 心理訪談、個人/關係檔案 | Web interview / profile / pairing profile | interview、psych profile、profile routes | interview session / psych profile / profile schema | Template | Candidate；適合移動端，但 profile schema 不分叉 |
| Notification | in-app notification、Push entry、Deep Link landing | Web notification / Admin notification governance | notification/content routes、deep-link target rules | notification schema、content/media provider、platform push token 待裁決 | Types-only platform boundary | Blocked；Push token / read sync / logout cleanup 未裁決 |
| Media / Upload | evidence / profile media | Web browser upload / media provider | evidence / media provider routes | evidence schema、media provider contract | Types-only platform boundary | Blocked；ImagePicker / upload adapter 與授權歸屬未裁決 |
| Telemetry / Error Context | App error / runtime observability | Admin health / audit / metrics | health / metrics / audit / logs | release/version metadata、audit log schema | Not started | Candidate；不進普通 App UI，只回傳必要 context |

## 4. 必須同步的差異類型

以下任何一項發生時，必須同步更新本文件並建立或更新待辦：

1. App 新增 screen 分組或改變首輪分組優先級。
2. App 需要新增 API、修改 response shape、修改 shared enum 或新增 App-only DTO。
3. App 需要新增 DB 欄位、migration、Push token 儲存、device identity 或 media metadata。
4. App route / Deep Link 引入 Web 沒有的授權失敗回退或 session restore 行為。
5. App runtime adapter 從 types-only 推進到實作狀態。
6. App smoke / regression / CI / evidence 入口建立或變更；此時必須同步符合 [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md)。

## 5. 與 App 端文件的分工

| 問題 | 文件來源 |
| --- | --- |
| App 端目錄、模板現況、platform adapter 規則 | `20-App端/01-App導航與平台Adapter基線.md` |
| App screen 分組對應哪個跨端能力、Web/Backend/DB/shared 來源 | 本文件 |
| Web / Admin 已落地基線 | `10-Web端/00-Web端凍結基線總覽.md` |
| 產品能力與狀態機最高裁決 | `00-跨端產品核心/00-跨端產品核心總覽.md` |
| 尚未實作但必須閉環的任務 | `07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md` |
| App smoke / regression / CI / evidence 接入規則 | `08-測試規範與驗收/03-App測試與證據接入基線.md` |

## 6. 進入實作前 Gate

任一 App 分組進入代碼實作前，至少要完成：

1. 在本文件中標明對應跨端能力、Web 對照、Backend/API 對照與 shared contract 狀態。
2. 在 `20-App端/01-App導航與平台Adapter基線.md` 中確認 navigation / adapter 落點。
3. 若 API / DB / shared contract 不足，建立待辦，不以 App local workaround 作長期方案。
4. 若涉及 Push、Deep Link、Upload、SecureStore，確認 platform adapter 路徑與 backend 副作用。
5. 實作後按 `08-測試規範與驗收/03-App測試與證據接入基線.md` 補回測試 / 證據入口，或明確記錄測試缺口。
