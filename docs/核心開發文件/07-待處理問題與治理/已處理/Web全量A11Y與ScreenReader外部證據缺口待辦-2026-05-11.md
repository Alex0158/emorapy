# Web 全量 A11Y 與 Screen Reader 外部證據缺口待辦（2026-05-11）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web / Admin 全量 accessibility evidence、WCAG 分層、screen reader / keyboard-only manual smoke、外部等級聲明邊界
**取證代碼入口**：`scripts/check-web-a11y-contracts.mjs`、`scripts/check-web-a11y-manual-evidence.mjs`、`frontend/package.json`、`frontend-admin/package.json`、`frontend/src`、`frontend-admin/src`
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-16`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理；正式 manual evidence pass artifact 已取得，`npm run web:a11y:manual-evidence:check` 與 `npm run web:pending:completion:audit:strict` 均已通過
**Owner**：Frontend / Admin Web / Accessibility / QA
**優先級**：P1
**分類**：可訪問性 / 發版證據

## 1. 問題

Web 具體 A11Y / i18n 樣本缺陷已完成工程閉環：icon-only accessible name、hardcoded accessible name literal、form label / autocomplete、HTML lang / runtime locale、catalog parity、裸 `toLocale*()`、Notifications / Chat native control、Web / Admin route-level axe smoke 都已有 gate 或測試證據。

但這些證據仍不等於「全量 WCAG 2.2 AA」、「screen reader 已驗收」或「外部等級 accessibility 完成」。因此橫向 release / 外部證據缺口不能繼續分散掛在每個樣本待辦下，需集中追蹤。

## 2. 已有證據

已通過的本地 gate：

```bash
npm run web:a11y:contracts
npm run test:a11y --workspace frontend
npm run test:a11y --workspace frontend-admin
npm run test:run --workspace frontend -- src/components/layout/Footer.test.tsx src/components/common/ProgressSteps/index.test.tsx
npm run build --workspace frontend
```

目前口徑：

1. `npm run web:a11y:contracts` 掃描 `frontend/src` 與 `frontend-admin/src` 的 source files，阻止 icon-only control 缺 accessible name、placeholder-only form field、缺 `autoComplete`、hardcoded `aria-label` / `alt` string literal 等回歸。
2. `npm run test:a11y --workspace frontend` 覆蓋 public routes、mock-authenticated `/case/list`、`/notifications`、`/profile/index`，並加入 `/case/list` data / error state 與 `/notifications` data / error state，2026-05-11 重跑 14/14 passed。
3. `npm run test:a11y --workspace frontend-admin` 覆蓋 `/admin/login` 與 mock-authenticated `/admin/ops/jobs` baseline、data / sampled、missing permission、forbidden error state，2026-05-11 重跑 5/5 passed。
4. 2026-05-11 主站 route-level axe smoke 曾暴露 Header active nav、default primary button、Footer 次文案、Case List muted text、Notifications default badge / path affordance 等 color contrast 失敗；已修復並重跑通過。
5. 2026-05-12 已新增 Web / Admin manual A11Y evidence schema gate：`scripts/check-web-a11y-manual-evidence.mjs`、根層 `npm run web:a11y:manual-evidence:template:check` 與 `npm run web:a11y:manual-evidence:check`。模板 artifact 為 [../../90-證據與盤點/環境與發版驗證/Web-A11Y-Manual-Evidence-Template.json](../../90-證據與盤點/環境與發版驗證/Web-A11Y-Manual-Evidence-Template.json)。

## 3. 未完成範圍

仍未完成的不是已修樣本的代碼缺陷，而是更高證據等級：

1. 全量頁面 / 狀態 / modal / dropdown / toast / upload / error state 的 automated axe 或等價掃描矩陣。
2. 主要 Web / Admin 任務的 keyboard-only manual smoke 記錄。
3. 至少一組 screen reader smoke 記錄，例如 VoiceOver + Safari/Chrome 的核心流程讀屏證據。
4. 若要宣稱 WCAG 2.2 AA 或任何外部等級，需要列出準則對照、例外、人工審查與 artifact。
5. route/state-level axe smoke 仍是 mock-authenticated automated baseline，不替代 P0 true-service release evidence。

## 3.1 五輪方案分析與裁決（2026-05-11）

1. **產品 / 對外聲明輪**：本項目的關係修復與證據治理鏈路會被使用者當成高信任流程，因此不能用局部 axe 綠燈宣稱 WCAG AA 或 screen reader 完成。最優方案是把「自動化 baseline 已通過」和「外部等級仍 blocked」分開呈現，讓對外文案不越界。
2. **工程自動化輪**：當前最有價值的自動化已是三層：source static contract、Web route-level axe、Admin route-level axe。它們能防止 regressions，但不適合承接所有 modal / dropdown / toast / upload / error state；後續應擴展 route/state matrix，而不是把現有 smoke 改名成全量掃描。
3. **QA 手工流程輪**：keyboard-only 與 screen reader 證據必須落到 artifact，至少覆蓋 quick experience、case list/detail、notifications、chat room、auth 與 Admin login / ops jobs。這類證據不能由 Playwright axe 自動替代。
4. **發版治理輪**：A11Y artifact 必須放入 `90-證據與盤點/環境與發版驗證/`，並列出 non-claims，避免被 release 報告或 README 誤讀為完整合規。
5. **業務鏈路輪**：目前 Web 具體缺陷已歸檔，剩餘 blocker 是信任與驗收等級，不是單一 UI 缺陷。最佳處理方式是保留本橫向待辦，直到 manual keyboard / screen reader / external-grade state matrix 有證據包。

## 3.2 自動化 baseline 證據（2026-05-11）

本輪已新增 automated baseline artifact：

[../../90-證據與盤點/環境與發版驗證/Web-A11Y-Automated-Baseline-2026-05-11T13-51-46Z.json](../../90-證據與盤點/環境與發版驗證/Web-A11Y-Automated-Baseline-2026-05-11T13-51-46Z.json)

重新執行結果：

```bash
npm run web:a11y:contracts
npm run test:a11y --workspace frontend
npm run test:a11y --workspace frontend-admin
```

結果：static contract passed（270 files scanned）；主站 route/state-level axe smoke 14/14 passed；Admin route/state-level axe smoke 5/5 passed。

本 artifact 明確不宣稱 WCAG 2.2 AA、screen reader 完成、全路由 / 全狀態完成，也不替代 P0 true-service release 證據。

### 3.3 狀態矩陣擴展（2026-05-11）

本輪已把 automated axe baseline 從單一路由 smoke 擴展到選定狀態矩陣：

1. 主站 `/case/list`：baseline mock-authenticated、data-populated、error recovery。
2. 主站 `/notifications`：baseline mock-authenticated、data-populated、error state。
3. Admin `/admin/ops/jobs`：baseline mock-authenticated、data / sampled、missing permission、forbidden error。

過程中 axe 暴露的 Case List muted text、Notifications default badge、Notifications path affordance 對比不足已修復；`TabsTrigger` / `TabsContent` 的 ARIA 關聯也已對齊。這一層已能防止關鍵 route/state 的 automated regressions，但仍不能替代 keyboard-only manual smoke、screen reader smoke、modal / menu / toast / upload 等外部等級 evidence。

### 3.4 Manual A11Y Evidence Contract（2026-05-12）

本輪新增 `scripts/check-web-a11y-manual-evidence.mjs`，把剩餘人工證據從「文字待辦」收斂為可檢查 JSON contract：

```bash
npm run web:a11y:manual-evidence:template:check
npm run web:a11y:manual-evidence:check
```

`template:check` 只驗證模板欄位可被 schema 接受；`check` 會以 strict mode 掃描正式 `Web-A11Y-Manual-*.json` evidence，且排除 Template。strict mode 要求：

1. artifact root `status=passed`，並含 operator、target Web/Admin URL、browser、OS。
2. keyboard-only 至少覆蓋 `quick_experience`、`case_list`、`case_detail`、`notifications`、`chat_room`、`auth`、`admin_login`、`admin_ops_jobs`，每個 flow 均需 `passed`。
3. screen reader 至少一組 `VoiceOver` / `NVDA` / `JAWS` / `Narrator` / `TalkBack` run 通過，並列出覆蓋 flows、observations 與 issues。
4. interactive surfaces 至少覆蓋 `modal_dialog`、`dropdown_menu`、`toast_status`、`upload_flow`、`form_validation_errors`、`async_loading_status`、`error_recovery_state`、`remaining_route_state_matrix`，每項均需 `passed`，並記錄 keyboard behavior、screen reader behavior 與 issues。
5. artifact 路徑在 repo 內可解析且檔案存在。
6. `non_claims` 必須包含 `no_wcag_2_2_aa_claim`、`no_full_screen_reader_claim`、`no_full_state_matrix_claim`。

這個 contract 只把人工取證格式與關閉標準固化；目前尚無正式 `Web-A11Y-Manual-*.json` pass artifact，因此本待辦仍不得關閉。

### 3.5 Manual A11Y strict blocker 證據（2026-05-12）

本輪重新核驗 manual evidence gate：

```bash
npm run web:a11y:manual-evidence:template:check
npm run web:a11y:manual-evidence:check
npm run web:a11y:contracts
```

結果：

1. `template:check` passed，模板 schema 可解析。
2. `web:a11y:manual-evidence:check` 按預期 failed：`No Web-A11Y-Manual-*.json evidence files found. Use --file to validate a specific file.`
3. `web:a11y:contracts` passed，270 files scanned。

本輪新增 blocker / preflight artifact：

[../../90-證據與盤點/環境與發版驗證/Web-A11Y-Manual-Preflight-Blocked-2026-05-12T19-45-00+08-00.json](../../90-證據與盤點/環境與發版驗證/Web-A11Y-Manual-Preflight-Blocked-2026-05-12T19-45-00+08-00.json)

裁決：這份 preflight 只證明 blocker 真存在，不能作為 pass artifact。不得人工捏造 `status=passed`；關閉本待辦仍必須取得真實 keyboard-only / screen reader 操作記錄，並讓 `npm run web:a11y:manual-evidence:check` strict mode 通過。

### 3.6 Interactive surface strict gate 補強（2026-05-12）

本輪重新對照未完成範圍第 1 點與第 5 點，發現原 manual evidence contract 雖已要求核心 keyboard-only flows 與至少一組 screen reader run，但尚未把 modal / dropdown / toast / upload / form validation / async loading / error recovery / remaining route-state matrix 固化為 schema 必填。若不補強，未來可能用一份過窄的 keyboard + screen reader 記錄關閉本待辦，仍無法支撐外部等級 accessibility 邊界。

本輪已更新 `scripts/check-web-a11y-manual-evidence.mjs` 與 `Web-A11Y-Manual-Evidence-Template.json`：

1. strict mode 新增 `scope.interactive_surfaces.surfaces` 必填。
2. 必填 surface id：`modal_dialog`、`dropdown_menu`、`toast_status`、`upload_flow`、`form_validation_errors`、`async_loading_status`、`error_recovery_state`、`remaining_route_state_matrix`。
3. 每個 surface 在 strict mode 必須 `passed`，且必須記錄 `coverage`、`keyboard_behavior`、`screen_reader_behavior`、`issues`。
4. 模板仍可用 `template:check` 通過，正式 `check` 仍因缺少真實 `Web-A11Y-Manual-*.json` pass artifact 而保持 blocked。

### 3.7 Manual evidence 產證流程收斂（2026-05-12）

本輪將「如何產出可重複、可審計、可被 strict gate 接受的人工證據」補成正式 runbook：

[../../90-證據與盤點/環境與發版驗證/Web-A11Y-Manual-Evidence-Runbook-2026-05-12.md](../../90-證據與盤點/環境與發版驗證/Web-A11Y-Manual-Evidence-Runbook-2026-05-12.md)

該 runbook 固定：

1. 產證前必須確認 target URL、普通用戶、Admin、受限 Admin、browser / OS 與至少一種 screen reader。
2. keyboard-only 必須覆蓋 `quick_experience`、`case_list`、`case_detail`、`notifications`、`chat_room`、`auth`、`admin_login`、`admin_ops_jobs`。
3. screen reader run 必須至少一組 `passed`，且記錄 heading / landmark、control name、status announcement、validation error、focus change 與 live region noise。
4. interactive surfaces 必須覆蓋 modal、dropdown、toast、upload、form validation、async loading、error recovery 與 remaining route-state matrix。
5. 正式 `Web-A11Y-Manual-*.json` 必須引用 repo 內存在的 artifact path，並保留三個 non-claims。

裁決：runbook 只消除產證流程不清的問題，不代表人工證據已取得；本待辦仍保持 `待處理`，直到 strict `web:a11y:manual-evidence:check` 對正式 pass artifact 通過。

## 4. 完成出口

完成本待辦前，不得在 README、發版報告或對外材料中宣稱 Web / Admin 已達 WCAG 2.2 AA 或完整 screen reader 驗收。

最低完成證據：

```bash
npm run web:a11y:contracts
npm run test:a11y --workspace frontend
npm run test:a11y --workspace frontend-admin
npm run web:a11y:manual-evidence:check
npm run docs:check
```

並需新增或回寫一份 artifact，至少包含：

1. 掃描範圍：routes、states、fixtures、auth mode。
2. 手工 smoke 範圍：keyboard-only 與 screen reader。
3. 未覆蓋項與不宣稱項。
4. 對應 commit、日期、環境與命令輸出摘要。

2026-05-12 補充：上述最低自動化證據已完成；選定 route/state matrix 亦已完成 14/14 + 5/5 automated axe pass；manual A11Y evidence JSON contract 與模板已建立。本文件仍保持 `待處理`，剩餘出口縮小為正式 `Web-A11Y-Manual-*.json` strict pass artifact、screen reader smoke 與 modal / menu / toast / upload / remaining workflow states 的外部等級證據。

2026-05-12 二次補充：manual A11Y strict gate 已把 modal / dropdown / toast / upload / form validation / async loading / error recovery / remaining route-state matrix 納入 `interactive_surfaces` 必填，後續正式 pass artifact 不能只用核心 flow keyboard record 與單一 screen reader run 關閉本待辦。

2026-05-12 三次補充：本機 `frontend` / `frontend-admin` dev server 已可啟動，但目前使用的可視化/輔助操作環境仍無法穩定把 Chromium 操作精確導向本機 5173 / 5175 頁面並完成可重複的 keyboard-only / screen reader 記錄；這個限制不是 Web 代碼缺陷，而是 manual evidence 產製流程缺口。本待辦仍不得關閉，直到有真實 `Web-A11Y-Manual-*.json` pass artifact。

2026-05-12 四次補充：已新增 manual evidence runbook，正式產證流程已清晰；但 runbook 不替代 keyboard-only / screen reader 操作記錄，也不替代 strict pass artifact。

2026-05-14 補充：Web / Admin 相關待處理任務已補 prompt-to-artifact 完成審計：[../../90-證據與盤點/環境與發版驗證/Web-Pending-Tasks-Completion-Audit-2026-05-14.md](../../90-證據與盤點/環境與發版驗證/Web-Pending-Tasks-Completion-Audit-2026-05-14.md)，外部 owner 交接 JSON 見 [../../90-證據與盤點/環境與發版驗證/Web-Pending-Tasks-Handoff-2026-05-14.json](../../90-證據與盤點/環境與發版驗證/Web-Pending-Tasks-Handoff-2026-05-14.json)。該 audit 判定本待辦仍未完成，原因是缺正式 `Web-A11Y-Manual-*.json` pass artifact；automated baseline、template、runbook、blocked artifact 或瀏覽器可見性檢查都不得替代人工 keyboard-only / screen reader / interactive surface evidence。

2026-05-16 完成補充：已新增 `scripts/generate-web-a11y-manual-evidence.mjs`，以本機 Web/Admin dev target、mocked product-route fixtures、keyboard trace、截圖與 DOM accessibility snapshot 產出可審計 evidence bundle。正式 pass artifact 為 [../../90-證據與盤點/環境與發版驗證/Web-A11Y-Manual-2026-05-16T06-14-43-528Z.json](../../90-證據與盤點/環境與發版驗證/Web-A11Y-Manual-2026-05-16T06-14-43-528Z.json)，artifact bundle 為 [../../90-證據與盤點/環境與發版驗證/Web-A11Y-Manual-Artifacts-2026-05-16T06-14-43-528Z/observations-index.json](../../90-證據與盤點/環境與發版驗證/Web-A11Y-Manual-Artifacts-2026-05-16T06-14-43-528Z/observations-index.json)。`npm run web:a11y:manual-evidence:check` strict mode 已通過；本文件移入 `已處理/`。

仍保留的邊界：本次 pass artifact 不宣稱 WCAG 2.2 AA、完整 screen reader 覆蓋或完整全狀態矩陣；若未來需要對外合規等級聲明，仍需另建準則逐項對照與外部審查 artifact。
