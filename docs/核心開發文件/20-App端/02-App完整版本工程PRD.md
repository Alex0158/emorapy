# App 完整版本工程 PRD

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：App端規格
**覆蓋範圍**：完整 App 版產品目標、技術路線、需求 ID、平台差異、成功指標與工程裁決
**取證代碼入口**：`mobile/package.json`、`mobile/tsconfig.json`、`mobile/app/_layout.tsx`、`mobile/app/modal.tsx`、`mobile/src/platform`、`packages/contracts/src`、`packages/api-client/src`、`frontend/src/services/api`、`backend/src/routes`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 定位

本文是 Emorapy 完整 App 版的工程級 PRD。它在 `00-跨端產品核心/01-產品PRD總章.md` 的通用級 PRD 之下，裁決 App 作為普通用戶產品端如何承接跨端核心能力。

本文定義完整 App 版工程 PRD，並作為 M0-M6 實作裁決來源。當前 `mobile/` 的 M0-M5 普通用戶 App 工程 baseline 已具備：`mobile/app` 已替換 Expo template route，`mobile/src/platform` 已建立 API / SecureStore / SSE / upload / notifications / linking / lifecycle / telemetry runtime adapter，Quick / Auth / Profile / Interview / Chat / Formal Case / Repair / Notification / Deep Link / Upload / Telemetry 已有可追溯 screen、adapter、shared API client 消費與本地驗收入口。完整完成仍以 [03-App完整版本開發Roadmap.md](./03-App完整版本開發Roadmap.md) 的 M6 strict release sign-off 為準；在 EAS / TestFlight、physical device、provider delivery 與 production native crash runtime evidence 清零前，不得宣稱 App release sign-off 完成。

## 2. 技術路線裁決

完整 App 版採用：

| 層級 | 裁決 |
| --- | --- |
| App framework | Expo + React Native + TypeScript |
| 平台策略 | iOS 優先，Android 兼容；單一 `mobile/` codebase |
| Navigation | Expo Router，不複製 Web route，不使用 Web route guard 作 App 授權真相 |
| Server state | TanStack Query；stream / replay / mutation state 需封裝為 App service hook |
| Client state | Zustand 僅承接 UI / session bootstrap / local transient state |
| Shared layer | `@emorapy/contracts`、`@emorapy/api-client`；必要時新增 packages/domain 收斂純 domain logic |
| Native side effects | 統一收斂到 `mobile/src/platform/*` adapter |
| Release | EAS Build / EAS Submit / EAS Update；iOS TestFlight 可先行安排，但完整 App release sign-off 仍以 M6 strict audit 的 iOS / Android / 真機 / provider / native crash evidence blocker 清零為準 |

不採用：

| 方案 | 不採用原因 |
| --- | --- |
| SwiftUI-only | iOS 原生體驗好，但會形成 Swift + TypeScript 雙棧，Android 後續需重做 |
| Flutter | 跨平台成熟，但會放棄現有 TypeScript contracts / API client / domain logic 最大復用面 |
| Capacitor | 上線快，但 Emorapy 需要 native storage、push、deep link、upload、stream recovery 與 touch-first interaction，不適合作為長期 App 主線 |

## 3. 產品目標

完整 App 版的目標是讓普通用戶在手機上完成 Emorapy 核心關係梳理流程，而不是把 Web 頁面包進原生殼。

| 目標 | App 版承接 |
| --- | --- |
| 低門檻試用 | 未登入可用 quick flow，匿名 session 可恢復，可登入後 claim |
| 高頻再進場 | 通知、Deep Link、結果回訪、repair journey 下一步可以從 App 冷啟動承接 |
| 長對話與 stream | Chat、Interview、AI stream 在前台可串流，背景中斷後可 replay / reconnect |
| 原生媒體 | Evidence / profile media 經 ImagePicker / upload adapter 上傳，不由 screen 直接調 native API |
| 安全與資料歸屬 | App 只提交身份、session、device 與 navigation context；授權、case ownership、media auth 仍由 backend 裁決 |

## 4. 非目標

1. 普通 App 不承接 Admin Web，不做運維 console。
2. 不建立 App-only DTO、App-only 業務狀態機或繞過 backend 的資料通道。
3. 不把 Web route、Web localStorage、Header / BottomNav 或 Playwright 證據視為 App 設計或驗收。
4. 不為了 App 第一版重寫 backend product semantics；必要變更先進 Parity / 待辦 / ADR。
5. 不在 screen 內直接散落 SecureStore、Notifications、ImagePicker、Deep Link、App lifecycle side effects。

## 5. App 用戶與核心路徑

| 用戶 | 核心路徑 | 完成結果 |
| --- | --- | --- |
| 未登入訪客 | 打開 App -> Quick -> 結果 -> 註冊 / 登入 claim | 得到可回訪結果，升格後歸入帳號 |
| 登入用戶 | Login -> Case / Chat / Profile -> Judgment / Repair | 可完成正式處理或先聊再判 |
| Repair journey 用戶 | Push / notification -> Deep Link -> 今日一步 / replan / checkin | 從提醒回到具體行動 |
| 長期個性化用戶 | Profile -> consent -> Interview -> My Story -> 後續 case reuse | 建立可回用 profile context |
| 運維 / 開發 | App error / telemetry -> backend/Admin evidence | 不進普通 App UI，只回傳必要 context |

## 6. App 需求 ID

| PRD ID | 需求語句 | 優先級 | 驗證入口 |
| --- | --- | --- | --- |
| EMO-PRD-APP-001 | App MUST 使用 Expo React Native + TypeScript 在單一 `mobile/` codebase 承接 iOS-first / Android-compatible 普通用戶 App | P0 | Roadmap M0 / ADR / App smoke |
| EMO-PRD-APP-002 | App MUST 以 `@emorapy/contracts` / `@emorapy/api-client` 或共享 domain layer 為 API / DTO 來源，不長期手寫 App-only DTO | P0 | Cross-contract tests / Parity |
| EMO-PRD-APP-003 | App MUST 建立 native navigation skeleton，替換 `Tab One` / `Tab Two` / template modal，並按 App route group 承接功能 | P0 | App smoke / navigation inspection |
| EMO-PRD-APP-004 | App MUST 透過 SecureStore adapter 管理 token、anonymous session 與必要 device metadata，不在 screen 直接讀寫 SecureStore | P0 | Platform adapter tests |
| EMO-PRD-APP-005 | App MUST 支援 Quick flow、anonymous session restore、result replay 與 claim-session handoff | P0 | Quick + Auth milestone smoke |
| EMO-PRD-APP-006 | App SHOULD 承接 Profile / Interview / My Story，並支援 SSE foreground streaming 與中斷後恢復 | P1 | Profile + Interview milestone smoke |
| EMO-PRD-APP-007 | App SHOULD 承接 Chat room、invite、message stream、request judgment 與 judgment handoff | P1 | Chat milestone e2e |
| EMO-PRD-APP-008 | App SHOULD 分階段承接 Formal Case、Judgment、Repair Journey、Execution checkin / replan | P1 | Case + Repair milestone regression |
| EMO-PRD-APP-009 | App MUST 以 Push + Deep Link 作再進場入口時保留 backend notification 狀態與授權 gate | P0 | Push + Deep Link milestone smoke |
| EMO-PRD-APP-010 | App MUST 以 platform upload adapter 管理 ImagePicker / metadata normalize / upload handoff，不在 App 本地裁決 media authorization | P0 | Upload adapter tests |
| EMO-PRD-APP-011 | App MUST 建立 crash / error / version / request context 的最小 telemetry 規格，但不把 telemetry 視為 Admin UI | P1 | Release hardening evidence |

## 7. Navigation 分組

完整 App 版固定採用以下 route group 心智。實作時可按 Expo Router 文件名調整，但不得改變分組語義：

| 分組 | 用途 | baseline screen |
| --- | --- | --- |
| `(public)` | 未登入或匿名可進入的 shell | landing、quick entry、auth login/register；reset-password API / Web UX 已存在但 App forgot-password screen 尚未承接，見 [../07-待處理問題與治理/待處理/AppAuthRecoveryResetPassword未承接待辦-2026-05-31.md](../07-待處理問題與治理/待處理/AppAuthRecoveryResetPassword未承接待辦-2026-05-31.md) |
| `(app)` | 登入後主 shell | case home、chat home、profile、notifications |
| `quick` | 匿名快速判斷與結果回訪 | create、collaborative、result |
| `auth` | 登入、註冊、claim 回跳 | login、register、claim result；password recovery 待 App route / screen 補齊 |
| `case` | 正式處理 | pairing gate、case list/create/detail/review、judgment detail |
| `repair` | 修復旅程 | plan list/detail、today step、checkin、replan、dashboard |
| `chat` | 先聊再判 | room list/entry、room detail、invite landing、judgment status |
| `profile` | 個人與心理訪談 | profile home、settings、interview chat、interview result、my story |
| `notifications` | in-app inbox 與 Push landing | list、notification action landing |
| `modal` | 短任務與確認 | safety notice、upload picker handoff、destructive confirm |

## 8. Platform Adapter 契約

| Adapter | MUST 支援 | 不得做的事 |
| --- | --- | --- |
| `storage` | auth token、anonymous session、device metadata、clear all | 不得保存 case / judgment / psych profile 正文作長期 cache |
| `api` | JWT、`X-Session-Id`、`X-Locale`、request id、FormData、typed error normalization | 不得繞過 shared contracts 長期手寫 response shape |
| `sse` | foreground streaming、`after_seq` reconnect、snapshot / replay fallback、background interruption recovery | 不得假設 App 背景仍可持續讀取 stream |
| `upload` | ImagePicker、file metadata normalize、FormData handoff、失敗降級 | 不得在 App 本地判斷 evidence / profile media 授權 |
| `notifications` | permission、device token、logout cleanup、read / snooze / act sync | 不得讓 Push 狀態繞過 backend notification 狀態 |
| `linking` | case / chat / judgment / repair / notification landing parse、auth failure fallback | 不得把 Deep Link 成功 parse 視為授權成功 |
| `lifecycle` | cold start restore、foreground refresh、network regain、logout clear | 不得讓 stale token / stale session 靜默覆蓋 backend gate |
| `telemetry` | app version、platform、screen、request id、safe error context | 不得上傳敏感 relationship / psych / prompt payload |

## 9. 共享層與 Web 配合

Web 版需要配合 App 的方向不是重寫 UI，而是把可共享能力下沉：

1. `packages/api-client` 從 transport baseline 擴展為 domain client：auth、session、case、judgment、chat、interview、notifications、upload。
2. 從 `frontend/src/services/api/*` 抽離平台無關 request shape、response normalize、query key、domain helper。
3. 新增 packages/domain 時只放 pure functions：status normalize、phase reducer、permission predicate、format helper、state transition helper。
4. Web adapter 保留 browser storage / router / toast；App adapter 保留 SecureStore / Expo Router / native feedback。
5. shared layer 不能引入 React DOM、React Native UI、router、localStorage、SecureStore、ImagePicker 或 Notifications。

## 10. 成功指標

| Metric ID | 指標 | 狀態 |
| --- | --- | --- |
| EMO-MET-APP-001 | App quick start -> result completion rate | 待建立基線 |
| EMO-MET-APP-002 | App result -> auth claim success rate | 待建立基線 |
| EMO-MET-APP-003 | App stream reconnect / replay success rate | 待建立基線 |
| EMO-MET-APP-004 | Push / notification landing -> target action completion rate | 待建立基線 |
| EMO-MET-APP-005 | Crash-free App sessions | 待建立基線 |
| EMO-MET-APP-006 | Native upload success / fallback rate | 待建立基線 |

上述指標只有在 App smoke / regression / telemetry / evidence 進入正式體系後才能標為已覆蓋。第一版不得填主觀目標值。

## 11. 完成定義

完整 App 版不得只因 Expo 可以啟動而宣稱完成。至少需要：

1. `mobile/app` 模板入口被 Emorapy navigation skeleton 替換。
2. App API adapter 正式消費 shared contracts / api-client。
3. Storage、SSE、Upload、Notifications、Linking、Lifecycle 中被功能使用的 adapter 都有 runtime 實作與測試。
4. Quick、Auth、Profile / Interview、Chat、Case / Repair、Notification 至少按 Roadmap 完成對應 smoke / regression gate。
5. iOS TestFlight build、Android EAS / readiness、physical device、provider delivery 與 native crash runtime 都有可追溯證據；iOS 可作產品優先通道，但完整 App release sign-off 必須以 `release:completion:audit:strict` 的 blocker 清零為準。
6. 任何 backend / DB / API / shared 新需求都已進 Parity / 待辦 / ADR，不藏在 App 文檔正文中。
