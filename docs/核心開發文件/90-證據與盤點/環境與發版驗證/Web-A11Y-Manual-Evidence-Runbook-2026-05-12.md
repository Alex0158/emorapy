# Web / Admin Manual A11Y Evidence Runbook（2026-05-12）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據產製 Runbook
**來源時間**：2026-05-12
**上下文**：Web / Admin keyboard-only、screen reader 與 interactive surface 人工可訪問性證據產製流程
**SSOT 屬性**：非現行 SSOT（僅作證據產製流程與發版前驗收操作指引）
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-12`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本 runbook 用於產出可被 `npm run web:a11y:manual-evidence:check` strict mode 接受的正式 `Web-A11Y-Manual-*.json` evidence。它不是 pass artifact；只有完成人工 keyboard-only、screen reader 與 interactive surface 檢查，並讓 strict gate 通過後，才能關閉 `Web全量A11Y與ScreenReader外部證據缺口待辦-2026-05-11.md`。

## 1. 前置條件

1. 選定 target：local、staging、release 或 production；artifact 內必須記錄 `environment.web_url`、`environment.admin_url`、browser、OS。
2. 準備可登入帳號：
   - 普通 Web 使用者：能進入 case list/detail、notifications、chat room。
   - Admin 使用者：能登入 Admin 並進入 `/admin/ops/jobs`。
   - 受限 Admin 使用者：若要覆蓋 forbidden / missing permission state，需提供可觸發權限不足的帳號。
3. 開啟至少一種 screen reader：
   - macOS：VoiceOver + Safari 或 Chrome。
   - Windows：NVDA / JAWS / Narrator + Chrome 或 Edge。
   - Android：TalkBack + Chrome。
4. 建立人工證據資料夾，例如：

```text
docs/核心開發文件/90-證據與盤點/環境與發版驗證/Web-A11Y-Manual-Artifacts-YYYY-MM-DD/
```

資料夾內應放置錄屏、截圖、操作筆記、screen reader 觀察記錄或 QA 匯出檔。正式 JSON 的 `artifacts[].path` 必須指向 repo 內存在的檔案或資料夾。

## 2. 必跑命令

產證前先確認自動化基線仍綠燈：

```bash
npm run web:a11y:contracts
npm run test:a11y --workspace frontend
npm run test:a11y --workspace frontend-admin
npm run web:a11y:manual-evidence:template:check
```

完成人工記錄並填好正式 JSON 後，必跑：

```bash
npm run web:a11y:manual-evidence:check
npm run docs:check
```

`web:a11y:manual-evidence:check` 必須通過；模板檢查通過不代表正式 evidence 通過。

## 3. Keyboard-Only Flow Matrix

每個 flow 都必須記錄 Tab / Shift+Tab / Enter / Space / Esc、focus order、不可達控制、focus trap、focus return 與 issues。正式 JSON 中每一項 `status` 必須是 `passed` 才能 strict pass。

| flow id | 最小覆蓋 |
| --- | --- |
| `quick_experience` | `/quick-experience/create` 輸入、Next / submit、loading、結果或錯誤、返回 / close |
| `case_list` | `/case/list` empty / data / error、filter、open case、pagination 或 retry |
| `case_detail` | case detail / judgment detail、tabs / sections、CTA、back、status message |
| `notifications` | `/notifications` data / empty / error、open primary action、snooze、dismiss、read/unread |
| `chat_room` | `/chat/room` composer、send、reply preview、request analysis、stream status、retry/error |
| `auth` | login / register / forgot password、field labels、validation errors、submit、link navigation |
| `admin_login` | Admin login fields、validation、submit、loading、failure state |
| `admin_ops_jobs` | `/admin/ops/jobs` filters、table/list、sampled state、missing permission、forbidden state |

## 4. Screen Reader Run

至少一組 screen reader run 必須通過，且正式 JSON 的 `scope.screen_reader.runs[]` 需填入：

1. `tool`：`VoiceOver`、`NVDA`、`JAWS`、`Narrator` 或 `TalkBack`。
2. `browser`、`os`、`status=passed`。
3. 覆蓋 flows；至少應包含 quick experience、case list、notifications、chat room、auth、admin login、admin ops jobs。
4. observations：heading / landmark、control name、status announcement、validation error、focus change、live region noise。
5. issues：若有 issue，必須先修復或明確阻塞；strict pass artifact 不接受 `blocked` 或 `failed` run。

macOS VoiceOver 建議記錄：

```text
VoiceOver on/off: Command + F5
Next item: VO + Right
Previous item: VO + Left
Activate: VO + Space
Headings rotor: VO + U
```

## 5. Interactive Surface Matrix

正式 JSON 必須填滿 `scope.interactive_surfaces.surfaces[]`，每項 `status=passed`，並記錄 coverage、keyboard behavior、screen reader behavior、issues。

| surface id | 最小覆蓋 |
| --- | --- |
| `modal_dialog` | open、initial focus、focus trap、close、Esc、focus return |
| `dropdown_menu` | trigger、arrow navigation、selection、Esc close、focus return |
| `toast_status` | success / warning / error / async status，確認 live region 或 status announcement |
| `upload_flow` | file picker trigger、validation、progress、preview/remove、success feedback |
| `form_validation_errors` | auth、quick input、chat composer、case creation、Admin forms 的 error association |
| `async_loading_status` | AI generation、chat analysis、judgment loading、Admin jobs loading、disabled controls |
| `error_recovery_state` | API error、permission denied、expired session、upload failure、retry/back/home |
| `remaining_route_state_matrix` | 自動化 axe 未覆蓋的 empty / data / forbidden / loading / destructive confirmation samples |

## 6. 產出 JSON

1. 複製模板：

```bash
cp docs/核心開發文件/90-證據與盤點/環境與發版驗證/Web-A11Y-Manual-Evidence-Template.json docs/核心開發文件/90-證據與盤點/環境與發版驗證/Web-A11Y-Manual-YYYY-MM-DD.json
```

2. 將 root `status` 改為 `passed`，填入真實 operator、target URL、browser、OS。
3. 將所有 keyboard flows、screen reader runs、interactive surfaces 改為真實觀察結果。
4. `artifacts[]` 至少放一個 repo 內存在的證據路徑。
5. `non_claims` 必須保留：
   - `no_wcag_2_2_aa_claim`
   - `no_full_screen_reader_claim`
   - `no_full_state_matrix_claim`

## 7. 不得宣稱

1. 沒有正式 `Web-A11Y-Manual-*.json` strict pass artifact，不得關閉 Web A11Y 待辦。
2. 不得用 Playwright axe、模板 JSON、preflight blocker 或口頭觀察替代 screen reader pass evidence。
3. 不得因一組 screen reader run 通過就宣稱完整 screen reader 覆蓋。
4. 不得宣稱 WCAG 2.2 AA，除非另有完整準則對照、例外列表、人工審查與外部等級 artifact。
