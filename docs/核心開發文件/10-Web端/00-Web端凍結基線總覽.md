# Web 端凍結基線總覽

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：正式規格
**覆蓋範圍**：Web / Admin Web 已實作能力、凍結基線、平台差異與對 App 的參照邊界
**取證代碼入口**：`frontend/src/router/index.tsx`、`frontend/src/pages`、`frontend-admin/src/router.tsx`、`frontend-admin/src/pages`、`backend/src/routes`、`scripts/start-dev.sh`
**最後核驗 Commit**：`adda512`
**最後核驗日期**：`2026-05-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 凍結口徑

Web 端基線以當前 repo 的 `frontend/`、`frontend-admin/`、`backend/`、`packages/*` 實作為準。當前核驗 commit 為 `adda512`，核驗日期為 `2026-05-05`。

本基線用作 App 開發對照：

1. 已在 Web 存在的產品能力，App 應判定為「需要評估是否承接」。
2. Web 已有但不適合 App 原樣搬遷的能力，應記為平台差異。
3. Web 沒有閉環但跨端產品核心要求存在的能力，應記為代碼待處理任務。
4. Web 平台專屬實作不得反向污染跨端核心。

## 2. Web 應用邊界

| 應用 | 目錄 | 定位 |
| --- | --- | --- |
| 主 Web | `frontend/` | 使用者端主入口，承接快速體驗、正式案件、聊天室、心理訪談、修復旅程、通知與個人資料 |
| Admin Web | `frontend-admin/` | 管理與平台治理入口，承接 dashboard、reports、AI monitoring、user management、content / notification governance |
| Backend | `backend/` | API、DB schema、授權、狀態機、AI ledger、通知、健康檢查與發布治理 |
| 共享層 | `packages/contracts`、`packages/api-client` | Web / Admin Web 已開始局部消費，App 目前只預留 alias |

## 3. 已落地主能力

| 能力組 | Web 基線 |
| --- | --- |
| 快速判斷 | 支持 quick experience、匿名 session、session-bound case、claim / refresh 等主鏈路 |
| 正式處理 | 支持登入、配對、正式案件、判決、修復旅程與 execution 相關流程 |
| 先聊再判 | 支持 chat room、message、AI orchestration 與轉入判斷材料的後端能力 |
| 讓系統更懂你 | 支持 interview、psych profile、profile 相關接口與頁面流 |
| 通知與內容 | 支持 notification、content、media provider 相關接口與前台入口 |
| 平台治理 | 支持 Admin Web、health / metrics / version、AI cost、recovery task、release gate 相關治理 |

細節仍以根層旗艦文件、`01-08` 正式子域與 `06-接口描述/` 為準。本文件只固定 Web 作為 App 開發的參照基線。

## 4. Web 專屬平台實作

Web 端可保留以下平台專屬實作：

1. React Router / browser route guard。
2. Browser local/session storage adapter。
3. Web Header、BottomNav、桌面/手機瀏覽器 responsive layout。
4. Vite / Vercel build pipeline。
5. Admin Web 獨立 Vite/Vercel 入口。

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
4. 跨端差異：`50-跨端Mapping與Parity/`。

若 App 因原生權限、推播、Deep Link、SecureStore 或離線/恢復流程需要新增平台行為，應先在 App 端文件描述，再在 Parity 文件裁決是否屬於產品核心差異。

