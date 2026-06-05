# Web 端凍結基線總覽

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：正式規格
**覆蓋範圍**：Web / Admin Web 已實作能力、凍結基線、平台差異與對 App 的參照邊界
**取證代碼入口**：`frontend/src/router/index.tsx`、`frontend/src/pages`、`frontend-admin/src/router.tsx`、`frontend-admin/src/pages`、`frontend-admin/src/services/api/admin.ts`、`backend/src/routes`、`scripts/start-dev.sh`、`scripts/check-web-admin-boundary.mjs`、`scripts/check-web-product-lines-contracts.mjs`、`scripts/check-web-a11y-contracts.mjs`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 凍結口徑

Web 端基線以當前 repo 的 `frontend/`、`frontend-admin/`、`backend/`、`packages/*` 實作為準；Admin / Mobile / release evidence 仍以各自子域文件與 gate 為準。

本基線用作 App 開發對照：

1. 已在 Web 存在的產品能力，App 應判定為「需要評估是否承接」。
2. Web 已有但不適合 App 原樣搬遷的能力，應記為平台差異。
3. Web 沒有閉環但跨端產品核心或 `CJ-PRD-*` 要求存在的能力，應記為代碼待處理任務。
4. Web 平台專屬實作不得反向污染跨端核心或通用級 PRD。
5. Web -> App 轉譯必須通過 `20-App端/01-App導航與平台Adapter基線.md` 與 `50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`，不得把本基線當成 App navigation 或 native adapter 設計。

## 2. Web 應用邊界

| 應用 | 目錄 | 定位 |
| --- | --- | --- |
| 主 Web | `frontend/` | 使用者端主入口，承接快速體驗、正式案件、聊天室、心理訪談、修復旅程、通知與個人資料 |
| Admin Web | `frontend-admin/` | 管理與平台治理入口，當前路由承接 ops jobs、jobs、health、configs、users、audit logs、reports 與 settings；reports 已承接 overview / funnel / costs / AI stream，settings 已承接 admin users、alerts、feature flags、media provider 與 interview runtime config。Backend 的 app telemetry report 是 release evidence / audit 消費入口，不是現有 Admin Web 頁面；admin notification 與 product-state recovery task 端點仍屬 Admin API 待承接，不能寫成現有 Admin Web 頁面能力 |
| Backend | `backend/` | API、DB schema、授權、狀態機、AI ledger、通知、健康檢查與發布治理 |
| 共享層 | `packages/contracts`、`packages/api-client` | 主 Web 已消費 M1-M5 domain client 與 AI stream pure helper；Admin Web 仍維持局部 contracts / transport baseline；App 已透過 platform adapter 消費 shared packages，release sign-off 另計 |

## 3. Web 主能力基線

| 能力組 | Web 基線 |
| --- | --- |
| 快速判斷 | 支持 quick experience、匿名 session、session-bound case、claim / refresh 等主鏈路 |
| 正式處理 | 支持登入、配對、正式案件、判決、修復旅程與 execution 相關流程 |
| 先聊再判 | 支持 chat room、message、AI orchestration 與轉入判斷材料的後端能力 |
| 讓系統更懂你 | 支持 interview、psych profile、profile 相關接口與頁面流 |
| 通知與內容 | 支持 notification、content、media provider 相關接口與前台入口 |
| 平台治理 | 支持 Admin Web、health / metrics / version、AI cost 與 release gate 相關治理；app telemetry report 屬 Admin API / release evidence，不屬已接線 Admin Web 頁面；notification / product-state recovery task 後端端點已存在但 Admin Web UI / service 尚待承接 |

細節仍以根層旗艦文件、`01-08` 正式子域與 `06-接口描述/` 為準。本文件只固定 Web 作為 App 開發的參照基線。

Web Header / BottomNav / 首頁 CTA 的一級入口語義固定為上表四條產品主線。實作上保留既有 route 與 API：快速判斷仍承接 `/quick-experience/*`，正式處理聚合 `/case/*`、`/judgment/*`、`/reconciliation/*`、`/execution/*`，先聊再判承接 `/chat/room`，讓系統更懂你承接 `/profile/*`。根層 `npm run web:product-lines:check` 固定此入口語義，避免重新把「我的案件 / 執行追蹤 / 聊天室 / 快速體驗」作為 Web primary nav。

## 4. Web 專屬平台實作

Web 端可保留以下平台專屬實作：

1. React Router / browser route guard。
2. Browser local/session storage adapter。
3. Web Header、BottomNav、桌面/手機瀏覽器 responsive layout。
4. Vite / Vercel build pipeline。
5. Admin Web 獨立 Vite/Vercel 入口；主站 `frontend/` 的 `/admin/*` 僅允許 `AdminRedirect` 轉向 `VITE_ADMIN_LOGIN_URL`，Admin API client、Admin hooks、permission route、layout 與 pages 只允許存在於 `frontend-admin/`。
6. 主站 Admin 邊界由 `npm run web:admin-boundary:check` 固定，避免 `frontend/src` 重新出現 Admin Web 實作孤島。
7. Web 一級產品入口語義由 `npm run web:product-lines:check` 固定；Header / BottomNav 不得重新以工程功能詞取代四條產品主線。
8. 本機 Web / Admin / backend 開發 stack 由 `scripts/start-dev.sh` 啟動；腳本會確保 Redis 可用，並為 backend 進程提供 `REDIS_URL=redis://127.0.0.1:6379` 與 `ALLOW_SIMPLE_LOCK=false` fallback。根層 `npm run dev:redis-baseline:check` 固定此本機 Redis baseline；Railway dev Redis 只是可選 parity 增強。
9. 發布版 Redis / Admin token gate 由 `scripts/ops-release-gate.sh` 強制，要求 `REDIS_URL`、`ADMIN_JWT_EXPIRES_IN` 與 Redis-backed `/health` payload，且禁止 `ALLOW_SIMPLE_LOCK=true`。

以下內容不得被 App 直接照搬：

1. Browser-only storage。
2. DOM-only component 或 layout 假設。
3. Web URL guard 作為最終授權來源。
4. Admin Web 管理入口。

## 5. 對 App 的基線要求

App 開發時應優先對照：

1. 路由與頁面責任：`頁面清單.md`。
2. API 使用面：`全接口清單-主文檔.md` 與 `06-接口描述/`。
3. 功能到頁面與接口映射：`接口-功能-頁面-Mapping.md`。
4. App navigation / platform adapter：`20-App端/01-App導航與平台Adapter基線.md`。
5. 跨端差異與工程落點：`50-跨端Mapping與Parity/00-跨端Parity總覽.md` 與 `50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`。

若 App 因原生權限、推播、Deep Link、SecureStore 或離線/恢復流程需要新增平台行為，應先在 App 端文件描述，再在 Parity 文件裁決是否屬於產品核心差異。

## 6. Web 基線治理裁決

Web / Admin Web 的已處理治理任務不再作為現行功能來源；正式基線只保留可防回退的穩定 guard、平台邊界與證據分層。具體修復過程回鏈到 `07-待處理問題與治理/已處理/` 與 `90-證據與盤點/`，不在本文展開。

本基線要求：

1. Admin Web 是正式治理入口；`frontend-admin` 必須維持 lint / build / minimum test / route-level a11y gate，不能只用 build 綠燈替代品質閉環。
2. Admin Web 必須維持 workspace 級最低測試入口；credential-gated E2E 可以 skip，但 skip 條件、env keys 與真服務證據路徑必須文件化。
3. Web 對外產品行為不得因 shared API client 或 wrapper 調整而改變；任何後續遷移都必須保留既有 service export、toast、storage、router、session header、FormData boundary、SSE / fetch 與 retry 行為。
4. `/notifications` 與 Chat reply preview 是受保護主入口中的高頻互動；open、CTA、snooze、dismiss、reply preview action 必須使用可理解的 semantic control 與 keyboard/focus 行為。
5. Web / Admin 的 icon-only controls、form label / autocomplete、HTML language / locale policy 屬於 Web 基線要求，不得延後到 App 或 release hardening 才處理。
6. P0 Web flow 的 mock-backed Playwright 綠燈不得宣稱 release 完成；真服務或 release-like artifact 必須與命令、commit、env redaction、證據路徑一起回寫。

### 6.1 現行 Web 基線狀態

正式正文只保留可作開發依據的穩定結論：

1. Admin Web 是正式治理入口；`frontend-admin` 必須維持 lint / build / minimum test / route-level a11y gate，不得只用 build 綠燈替代品質閉環。
2. 主站 Web 一級入口語義已固定為四條產品主線，並由 `web:product-lines:check` 防回退。
3. 主站 `/admin/*` 只允許 redirect；Admin layout、permission route、Admin API client 與治理頁面只允許存在於 `frontend-admin/`，並由 `web:admin-boundary:check` 防回退。
4. 主站 Web 已按 adapter / strangler pattern 消費 `@cj/api-client` 的 M1-M5 domain client；Web wrapper 保留 browser storage、router、toast、FormData、SSE / fetch 等平台 side effect。
5. Web / Admin 的 icon-only controls、form label / autocomplete、hardcoded accessible name literal 與 locale policy 已納入 `web:a11y:contracts`；route/state-level axe smoke 與人工 evidence 入口只證明對應覆蓋面，不等於全量 WCAG / screen reader / release target 證據。
6. Web P0 true-service 與 Admin credential-backed E2E 已有本機 pass artifact；若 release gate 指定 non-local / release / production target，仍必須另補該 target artifact，不能把本機證據外推為 production pass。

### 6.2 證據與治理回鏈

細節過程不再堆在 Web 正式基線正文中，按以下來源追溯：

| 類型 | 追溯入口 | 正文只採用的穩定結論 |
| --- | --- | --- |
| Web 已處理治理任務 | [../07-待處理問題與治理/已處理/Web十項問題總體修復方案-2026-05-10.md](../07-待處理問題與治理/已處理/Web十項問題總體修復方案-2026-05-10.md) | 已處理任務只作歷史與證據回鏈；現行功能來源仍看本文、根層旗艦文件與對應 gate |
| Shared API client 邊界 | [../07-待處理問題與治理/已處理/Web共享ApiClient消費收斂待辦-2026-05-10.md](../07-待處理問題與治理/已處理/Web共享ApiClient消費收斂待辦-2026-05-10.md) | 主站 M1-M5 shared domain client 已接入；Chat SSE 與 Web/Admin platform APIs 保留 adapter 邊界 |
| A11Y / i18n / form gate | [../07-待處理問題與治理/已處理/Web全量A11Y與ScreenReader外部證據缺口待辦-2026-05-11.md](../07-待處理問題與治理/已處理/Web全量A11Y與ScreenReader外部證據缺口待辦-2026-05-11.md) | static / route-level / manual evidence 有分層，不得用局部 axe smoke 宣稱全量 WCAG 或 screen reader 完成 |
| P0 true-service / Admin credential evidence | [../07-待處理問題與治理/已處理/WebP0流程E2E真服務證據缺口待辦-2026-05-10.md](../07-待處理問題與治理/已處理/WebP0流程E2E真服務證據缺口待辦-2026-05-10.md)、[../90-證據與盤點/環境與發版驗證/README.md](../90-證據與盤點/環境與發版驗證/README.md) | 本機 pass artifact 可證明 local true-service 閉環；release / production target 仍需指定 target artifact |

現行 Web 基線最小守衛：

```bash
npm run web:product-lines:check
npm run web:admin-boundary:check
npm run web:a11y:contracts
```
