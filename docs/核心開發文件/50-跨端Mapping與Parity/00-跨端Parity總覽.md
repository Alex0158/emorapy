# 跨端 Parity 總覽

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：跨端映射
**覆蓋範圍**：跨端能力到 Web / App / Backend / API / DB / 共享層的映射與缺口總覽
**取證代碼入口**：`backend/src/routes`、`backend/prisma/schema.prisma`、`frontend/src/router/index.tsx`、`frontend-admin/src/router.tsx`、`mobile/app`、`mobile/tsconfig.json`、`mobile/src/platform`、`packages/contracts/src`、`packages/api-client/src`
**最後核驗 Commit**：`1295216`
**最後核驗日期**：`2026-05-06`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 1. 定位

Parity 文件不重新定義產品功能，而是追蹤同一產品能力在不同平台的落地狀態。

狀態口徑固定如下：

| 狀態 | 定義 |
| --- | --- |
| 已落地 | 對應端已有可用代碼與可追溯 API / 頁面 / 流程 |
| 待承接 | 產品核心存在，Web 已有或 backend 已有，但 App 尚未實作 |
| 平台差異 | 產品語義一致，但平台實作不同，例如 browser route vs Deep Link |
| 待裁決 | 需要產品或工程決策，不能由單端文件自行裁定 |
| 不承接 | 明確裁決該端不提供此能力，例如 Admin Web 不進普通 App |

## 2. 能力 Parity 矩陣

| 能力組 | Backend / DB | Web | Admin Web | App | Parity 裁決 |
| --- | --- | --- | --- | --- | --- |
| 快速判斷 | 已有 quick session / case / judgment 相關接口與 schema | 已落地 | 不承接普通用戶入口 | 待承接 | App 首輪高優先級，必須復用 quick/session/case 語義 |
| 正式處理 | 已有 auth / pairing / case / judgment / reconciliation / execution 能力 | 已落地 | 可治理與查看相關資料 | 待承接 | App 應分階段承接，不改 backend 狀態機 |
| 先聊再判 | 已有 chat / message / AI orchestration / handoff 能力 | 已落地 | 可治理相關風險與成本 | 待承接 | App 可作高頻入口，但轉判決規則需保持一致 |
| 讓系統更懂你 | 已有 interview / psych profile / profile 能力 | 已落地 | 可治理與查看必要平台資料 | 待承接 | App 適合承接訪談，但 schema 不分叉 |
| 通知與提醒 | 已有 notification / content / media provider 相關能力 | 已落地 | 已有治理入口 | 待承接 | App 需新增 Push token / Deep Link 策略後再承接 |
| 平台治理 | 已有 admin / health / metrics / version / release gate 能力 | 部分入口 | 已落地 | 不承接 | App 不做 Admin Web；只回傳必要 telemetry / error context |

## 3. API 與共享層映射

| 類型 | 當前狀態 | App 開發要求 |
| --- | --- | --- |
| `packages/contracts` | Web / Admin Web 局部消費，backend 使用 declaration artifact，App 只預留 alias | App 正式功能不得手寫分叉 DTO，應逐步消費 contracts |
| `packages/api-client` | 已有 transport baseline，尚未形成完整 domain client | App 應先建立平台 adapter，再抽 domain API client |
| `backend/src/routes` | 是 API 事實來源 | App 不得建立繞過 backend 的業務資料通道 |
| `backend/prisma/schema.prisma` | 是 DB schema 事實來源 | App 新需求若要新增持久化欄位，必須先成為 schema / migration 待辦 |
| `frontend/src/router/index.tsx` | 是 Web 用戶端路由事實來源 | App route 只作對照，不直接複製 browser guard |
| `frontend-admin/src/router.tsx` | 是 Admin Web 路由事實來源 | App 普通版不承接 Admin Web |
| `mobile/app` | 已有 Expo Router 模板 tabs / modal | 只能作 App navigation 起點；模板 `Tab One` / `Tab Two` / `Modal` 未替換前，不得視為 CJ App screen 已落地 |
| `mobile/src/platform` | 已有 storage / notifications / upload 的 types-only 邊界 | 只能作 App runtime adapter 的起點；未實作前不得視為 SecureStore / Push / upload 能力已落地 |

## 4. 必須主動記錄的差異

以下情況一律要新增待處理任務，並在本文件或後續子文件中回鏈：

1. App 需要新增或修改 DB schema。
2. App 需要新增 API 或修改既有 response shape。
3. App 對 auth/session/token refresh 的策略與 Web 不同。
4. App 對 Push、Deep Link、media、permission 的需求會影響 backend。
5. Web 凍結基線與跨端產品核心發生衝突。
6. 共享 contracts / api-client / domain logic 的消費狀態與文件描述不一致。
7. 某端已實作、另一端未實作，但產品目標要求一致。

## 5. 當前 App 缺口清單

| 缺口 | 分類 | 後續處理 |
| --- | --- | --- |
| App 尚未正式消費 `@cj/contracts` / `@cj/api-client` | 共享層 Parity | 建立 App API adapter 與 contracts 消費任務 |
| `mobile/app` 仍是 Expo 模板 tabs / modal，App 尚未承接 CJ 主產品路由 | 功能 Parity | 先裁決 App 首輪能力矩陣，再替換模板 navigation / screen |
| `mobile/src/platform/storage` 只有 types-only 邊界，SecureStore token / session restore 未實作 | 平台差異 | 建立 App auth/session runtime adapter 與 refresh 設計任務 |
| `mobile/src/platform/notifications` 只有 types-only 邊界，Push token / notification sync 未實作 | 平台差異 + backend 影響 | 建立 notification / push schema/API 評估任務 |
| `mobile/src/platform/upload` 只有 types-only 邊界，ImagePicker / upload provider adapter 未實作 | 平台差異 + backend 影響 | 建立 evidence / profile media upload adapter 與授權評估任務 |
| Deep Link 授權失敗回退未定義 | 平台差異 | 建立 route / auth failure UX 任務 |
| App 測試與 smoke gate 未落地 | 工程治理 | 已建立 App 測試與證據接入基線；仍需落地 App smoke / regression / CI 任務 |

## 6. 關聯正文

1. App 首輪 screen 分組到 Web / Backend / API / DB / shared packages 的細映射，見 [01-App首輪能力與工程落點Mapping.md](./01-App首輪能力與工程落點Mapping.md)。
2. App navigation 與 platform adapter 落點規則，見 [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md)。
3. App 測試、回歸、CI 與證據接入規則，見 [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md)。
4. App 尚未落地的治理任務，見 [../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md](../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md)。
