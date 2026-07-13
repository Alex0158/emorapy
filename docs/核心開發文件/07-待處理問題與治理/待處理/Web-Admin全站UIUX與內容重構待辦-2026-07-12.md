# Web / Admin 全站 UI/UX 與內容重構待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Consumer Web 與 Admin Web 全站資訊層級、互動、內容、視覺系統、安全呈現與前端維護性重構
**取證代碼入口**：`frontend/src/router/index.tsx`、`frontend/src/pages`、`frontend/src/components`、`frontend/src/index.css`、`frontend-admin/src/router.tsx`、`frontend-admin/src/pages`、`frontend-admin/src/components`、`frontend-admin/src/index.css`、`frontend-admin/src/types/admin.ts`、`backend/src/utils/product-safety-policy.ts`、`backend/src/services/repair-eligibility.service.ts`、`backend/src/services/cost-monitoring.service.ts`
**最後核驗 Commit**：`b3f3716`
**最後核驗日期**：`2026-07-13`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：實作與代表性設計驗收已完成；真服務動態證據待補
**Owner**：Web Product / Frontend / Platform governance
**優先級**：P0 安全與敘事完整性；P1 全站 UX、內容與視覺；P1 工程可維護性

## 1. 目標與不變邊界

本待辦承接 `frontend/` 與 `frontend-admin/` 的全站重構。目標不是換一套卡片皮膚，而是讓每頁先回答「目前要做什麼」，刪除無法改變下一步的 AI／工程／宣傳資訊，並建立一套可維護、可驗證的頁面骨架與內容規則。

以下邊界不因本輪視覺重構自行改變：

1. Consumer Web 現有 route、guard、角色與頁面責任維持 `頁面清單.md` 基線。
2. 快速判斷、正式處理、先聊再判、讓系統更懂你四條產品主線不變。
3. Chat -> 梳理結果仍必須顯式觸發；Quick、協作、正式處理與 Chat 只在明確 handoff 點交接。
4. Backend `product-safety-policy`、safety routing、repair eligibility、身份、資料歸屬、API 與 DB 契約優先於前端推測或 URL query。
5. Admin Web 保持獨立 `frontend-admin/`；主站只作轉導，不把 Admin 頁面搬回 `frontend/`。
6. 保留 shadcn/ui、Radix UI、Tailwind CSS 4、Lucide、Sonner 與現有 route lazy loading；不引入第二套 component library。

## 2. 現況與問題證據

1. Consumer Web 同時存在 editorial 首頁、極簡 Quick、黑橙遊戲化協作、glass Auth 與 glass Chat，多套視覺語言缺少共同骨架。
2. 首頁重複 hero、AI 示範、四張功能卡、四步流程、manifesto 與 CTA；登入後仍渲染訪客長頁。
3. 多頁顯示 model phase、confidence、raw ID/status、固定百分比、AI insight boilerplate 或無法行動的 metadata，讓產品像 AI demo 而非關係梳理工具。
4. `FlowSimulation.tsx` + CSS 接近 2,900 行且無 production consumer；Home、Chat 仍有 1,500+ 行 active page CSS，偏離 Tailwind-only 規則。
5. 多個 route page 超過 400–600 行；Auth OTP／倒數／safe redirect、navigation config、loading/error/safety pattern 重複。
6. Admin `Settings`、`Reports`、`OpsJobs` 把多個治理任務、raw JSON、token 管理與危險操作堆在單頁；sidebar 不按權限裁剪，失效 token 亦缺安全登出／恢復。
7. 舊 `已處理/UI-UX升級遷移追蹤-2026-05-03.md` 只證明 Ant Design / LESS 遷移完成，且明確不重新設計頁面，不能作本輪完成證據。

## 3. P0 安全與敘事完整性

| 缺口 | 現況 | 目標與驗證邊界 |
| --- | --- | --- |
| 梳理結果安全 route | `/judgment/:id` 目前無條件組 responsibility ratio，並把一般 repair、safety 等 intent 並列 | 只讀 normalized backend route / visibility / repair access；`safety_support` / `crisis_support` 隱藏比例、一般 repair、partner invite、co-repair，安全支持成為主行動 |
| Repair eligibility | `/reconciliation/*` 信任 URL `intent`，且預設 `invite_partner: true` | allowed intent、solo/co、invite visibility 只由 backend repair eligibility / journey / invite context 裁決；高風險不得被前端 default 放寬 |
| 正式 remote 盲寫 | 文案承諾雙方獨立填寫，但回應方提交前已看到發起方全文 | 回應方提交前不得看到發起方陳述；提交後才按正式規則互見；以雙角色 E2E 驗證 |
| Interview critical safety | critical alert 可 dismiss，且資源硬編單一地區電話 | critical 時暫停普通 composer / repair CTA、移焦到安全支持；資源由 locale / region / controlled config 提供，不能以單一地區硬編作全球 fallback |
| Quick 另一方觀點 | 「自動代寫」以固定道歉模板捏造另一方立場 | 移除該 shortcut；只有對方本人輸入或明確標示為用戶假設的內容可成為另一方觀點 |
| Quick / 協作私隱 | 「AI 將會保密」過度承諾；同設備交機未形成完整 privacy handoff | 改為可驗證的用途、保存與可見範圍；遮屏交機、鎖住上一方內容、阻止返回洩漏，並提供不安全共用裝置退出路徑 |
| Chat safety | 一般轉梳理、invite / history sharing 與訊息納入範圍容易被技術控制淹沒 | Crisis route 阻斷一般轉梳理；safety notice 持續可見；轉梳理前明確預覽將使用哪些訊息與後果 |
| Admin session / permission | 登入固定落 `/admin/ops/jobs`；失效 token 可能困在錯誤頁；sidebar 顯示所有 route | 登入落第一個可用 route 或 return URL；401 清 session；有 logout；navigation 只顯示可用項，direct URL 仍有清楚 403 |
| Admin sensitive config | masked secret 與前端 object 假設不一致，可能誤判未設定並要求重填 | Secret status 使用明確契約；只顯示「已設定／未設定／最後測試」，修改非 secret 欄位不得要求重新輸入 secret |

上述 P0 若需要修改 shared DTO、backend payload 或 audit reason contract，先更新本待辦並按 ADR / API / App parity 規則擴大治理範圍，不可用前端假欄位或 fallback 假裝閉環。

## 4. 頁面群組目標

| 群組 | Route / surface | 重構目標 |
| --- | --- | --- |
| Home / Shell | `/`、Header、Footer、BottomNav | 訪客只保留一句價值、一次可信示例、一主一次入口；登入後只顯示目前最值得處理的一件事；移除公開版本入口、emoji wordmark 與重複 landing sections |
| Quick / Collaborative | `/quick-experience/create`、`result/:id`、`collaborative` | 一次一問、漸進揭露、可驗證 privacy、低戲劇化 waiting/error；協作有真正遮屏交機；結果先顯示卡點、需要、互動循環與一個下一步 |
| Auth | `/auth/login`、`register`、`forgot-password` | 單任務 utility layout；按來源回跳；共用 OTP / password / safe redirect primitives；切換語言不得清掉未提交表單 |
| Formal / Result | `/case/list`、`create`、`:id`、`:id/review`、`/judgment/:id` | 以待你／等對方／可閱讀／進行中組織；首屏只顯示當前進度、缺什麼與下一步；移除 raw metadata、假 edit、固定進度與判決書語氣 |
| Repair / Execution | `/reconciliation/*`、`/execution/*` | 少量可比較方向；只顯示今天／這一輪下一步；量表與照片為可選反思，不作伴侶績效或愛的證據；replan 顯示新舊差異而非內部 AI phase |
| Notifications | `/notifications` | 改為需要處理／稍後／已完成的 action inbox；每項只有一個主 action，不作 social feed |
| Profile / Interview | `/profile/*`、`/interview/*` | 以系統了解多少、可補充什麼、會如何使用為主；推斷可修正且不是人格真相；移除 richness/domain/confidence 報告感；訪談可 skip/pause/end |
| Chat | `/chat/room`、`/chat/room/:roomId` | 入口先選開新／加入；房間以對話為主、AI 次要；raw room ID、strategy/type/visibility tag 與多個 header action 下沉；顯式轉梳理 |
| Consumer utility | redirects、`/admin/*`、404 | Redirect 不新增內容；缺 Admin URL 給可操作恢復；404 依登入態只保留一主一次出口 |
| Admin Shell / Login | Admin layout、`/admin/login` | 權限感知 nav、environment、identity/role、全局狀態、responsive navigation、logout；不沿用 consumer 情緒敘事 |
| Admin Ops | `/admin/ops/jobs`、`jobs`、`health` | 先顯示 failed/running/stale 與 system health；raw cron/env/performance 下沉；手動觸發顯示目標、影響、狀態與稽核結果 |
| Admin Governance | `/admin/configs`、`users`、`audit-logs` | Schema-aware config、before/after diff、可讀 user detail、受控 filter/export、pagination、reason/impact/permission/audit |
| Admin Reports / Settings | `/admin/reports`、`settings` | 以 route 內 lazy tabs 分產品／漏斗／成本／AI 運行與 admin／alerts／flags／provider；不在單頁一次 fetch／渲染所有 JSON 與治理域 |

## 5. 設計與組件邊界

1. Consumer 使用 `PublicLanding`、`FocusedFlow`、`AuthUtility`、`ProductWorkspace`、`ConversationWorkspace` 五種頁面骨架；Admin 使用獨立 `AdminWorkspace`。
2. 只在三個以上頁面重複時抽共用；禁止建立 props 無限擴張的萬能 Page。
3. Consumer 優先收斂 `TaskPageShell`、`NextAction`、`StateNotice`、`SafetyRoutePanel`、`AsyncProcessState`、`PrivacyScopeControl`、`PrivateHandoffScreen`。
4. Admin 優先收斂 `AdminShell`、`PermissionAwareNav`、`AdminPageHeader`、`QueryState`、`FilterBar`、`DataTablePagination`、`DetailDrawer`、`DangerActionDialog`、`SensitiveConfigStatus`。
5. Route page 只承接 SEO、page model/controller、狀態選擇與組件組裝；SSE、auth/session、chat workflow 與 backend safety 判斷不可在視覺組件中重寫。
6. Loading 不虛構百分比或 ETA；error 保留輸入並提供真實恢復；partial 不冒充成功；danger action 顯示對象、影響、不可逆程度與 audit consequence。
7. 動畫只用於狀態改變與必要 feedback；取消 every-page entrance、bounce avatar、confetti、ambient orb、glow 與 AI thinking theatre。

## 6. 視覺方向決策

Product Design 已基於 current Home、Quick 與 Collaborative 產生三個 1440 x 1024 Quick intake 方向：

1. `Quiet Ledger`：暖亞麻、ink、muted oxblood、editorial single-column。
2. `Guided Reflection`：asymmetric progress rail、mineral neutral、clay action。
3. `Calm Conversation Canvas`：quiet conversation workspace、cool ivory、deep ink、single composer。

2026-07-12 使用者授權由設計／產品負責人主導所有可由專業判斷收斂的決策。正式採用 `Guided Reflection` 作單一全站方向：以清楚步驟、暖礦物底色、深松綠文字與克制 clay action 建立低壓引導；`Quiet Ledger` 的安靜閱讀密度只作結果頁內容節奏，`Calm Conversation Canvas` 的單一 composer 只作 Chat 互動原則，兩者不形成額外視覺系統。Admin 保持獨立的 ops 密度與同源 token，不直接複製 Consumer intake 版面。

## 7. 執行順序與完成條件

1. Foundation：移除無 production consumer 的 FlowSimulation / starter assets；修 locale remount；建立 wordmark、tokens、layout、state、motion 與 typed navigation；保留 route lazy loading。
2. P0：完成本待辦第 3 節安全／敘事完整性；補 focused unit / integration / E2E。
3. Quick / Auth；Formal / Result / Chat；Repair / Execution；Profile / Interview / Notifications；Home。
4. Admin 先完成 permission-aware shell、session/logout、sensitive config contract，再依 ops → governance → reports/settings 重構。
5. 每個頁面群組需覆蓋 loading、empty、error、blocked/permission、partial、success、responsive、keyboard/focus、reduced motion 與至少一個真實主流程狀態。
6. Consumer 30 routes 與 Admin 9 routes 逐條完成 code review、route smoke、視覺 QA；動態頁不能只用靜態 screenshot 或 unit test 宣稱完成。
7. 完成後先回寫正式基線，再把本文件移到 `已處理/`；不得把已完成狀態留在 `待處理/`。

## 8. 文件同步矩陣

- 必更：`10-Web端/00-Web端凍結基線總覽.md`、`04-共用機制/01-樣式Token與共享視覺規範.md`、`04-共用機制/07-可訪問性本地化與內容設計治理基線.md`、`08-測試規範與驗收/05-可訪問性本地化驗收基線.md`。
- 頁面責任、主 action、成功／失敗分支或 guard 改變時：`頁面清單.md`。
- Consumer handoff 改變時：`02-用戶端核心流程/00-用戶端核心流程總覽.md` 與必要的 `業務流程整合.md`。
- Admin 分組／治理工作流改變時：`03-管理端與平台治理/00-管理端與平台治理總覽.md`。
- API / DTO / backend safety payload / audit contract 改變時：接口主冊、對應 `06-接口描述/`、Mapping、RTM；涉及 App parity 時同步 `50-跨端Mapping與Parity/`。
- 不因純 layout 更換機械改寫 `00-跨端產品核心/`、功能特性或 API mapping。
- 核心營銷文件中仍使用「AI 調解／裁決平台、AI 判決書」的定位材料必須更新或明確降級，不能繼續作首頁內容來源。

## 9. 2026-07-12 執行快照

已完成：

1. Consumer Web 30 routes 與 Admin Web 9 routes 依 Guided Reflection 重構資訊層級、內容、tokens、shell 與主要互動；刪除 starter asset、未使用的 Home simulation/demo、AI phase timeline、emoji/假 persona、慶祝 overlay、硬編陰影與重複 registration prompt。
2. Quick 移除另一方自動代寫，補私密雙人交接與可清除草稿；正式 remote read path 補 blind response projection；judgment / reconciliation 以 active safety route 覆蓋 stored route，禁止舊 plan/detail/commit/resume 繞過 safety intent。
3. Admin 已有 permission-aware navigation、session recovery/logout、first permitted route、responsive drawer、可鍵盤操作的 config selector、受控危險操作與較小 route/controller files。
4. Consumer 全量單元／組件測試 `172 files / 1994 tests`、Admin `16 files / 49 tests`、Backend unit `161 suites / 2098 tests` 全數通過；Consumer / Admin / Backend builds、三端 lint、product-line、admin-boundary、a11y、AI positioning、docs truth 與 `git diff --check` 通過。
5. Product Design 同 viewport source/implementation combined QA、Consumer desktop/mobile、Admin desktop/mobile 與主互動 evidence 已寫入 `90-證據與盤點/設計驗收/design-qa.md`，該 scoped design QA 為 passed。
6. Ship coverage matrix 為 `28 / 30（93%）`：24 / 24 code paths 與 4 / 6 user flows 已有自動化證據；剩餘兩組 credential-backed true-service E2E 由正式 release gate 與本待辦的動態證據邊界承接。

仍需保持本文件在 `待處理/`：

1. Quick Result 真 backend 完成態、Collaborative Role A → Role B 正式送出、Formal remote 雙身份 blind-before-submit、safety/crisis runtime policy 與 Admin destructive mutations 尚未在本輪以 credential-backed / DB-backed true-service E2E 重跑。
2. 本輪 Admin 已登入工作台瀏覽器驗收使用 synthetic local API fixture，只能證明 UI state、permission navigation 與 responsive，不構成 staging / production service 證據。
3. Admin costs API 已返回 `openai.ledger.status`、request/token/cost 與 product-flow breakdown，但 `frontend-admin/src/types/admin.ts` 尚未承接 ledger contract，`CostsPanel` 亦只顯示 generic OpenAI status/summary token；此 P2 不阻擋 ledger P1 release，但在 Admin UI 可診斷實際 request attribution 前不得宣稱成本治理頁完整。
4. 上述動態證據與 Admin ledger breakdown 補齊並回寫後，才可把本文件移入 `已處理/`；不得以 unit test、static gate、fixture 或 screenshot 代替真服務結論。

## 10. 驗證命令

```bash
npm run docs:check
npm run web:product-lines:check
npm run web:admin-boundary:check
npm run web:a11y:contracts
npm run ai:positioning:check
npm run test --workspace frontend
npm run lint --workspace frontend
npm run build --workspace frontend
npm run test --workspace frontend-admin
npm run lint --workspace frontend-admin
npm run build --workspace frontend-admin
```

另需執行 Consumer / Admin route-level axe、關鍵 E2E、瀏覽器 desktop/mobile 視覺驗證與 P0 safety matrix；若 dev DB、auth fixture 或 backend policy payload 不可用，該動態頁保持未驗證，不得用 fallback 畫面代替完成證據。
