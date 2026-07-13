# Web HTML Lang 與 I18n Gate 待辦（2026-05-10）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web / Admin HTML language、default locale、i18n fallback、locale formatting gate
**取證代碼入口**：`frontend/index.html`、`frontend-admin/index.html`、`frontend/src/utils/i18n.ts`、`frontend/src/assets/i18n`、`frontend-admin/src/utils/i18n.ts`、`frontend-admin/src/assets/i18n`
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-10`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理
**Owner**：Frontend / Accessibility / Localization
**優先級**：P1
**分類**：可訪問性 / 本地化

## 1. 問題

正式規格已把 `CJ-A11Y-GAP-001` 列為缺口：Web / Admin / mobile web 根 HTML 固定 `lang="en"`，但 default locale 是 `zh-TW`。目前活躍問題總覽沒有對應待辦文件，因此這個正式缺口缺少可追蹤 owner、驗收命令與完成條件。

## 2. 證據

`frontend/index.html`：

```html
<html lang="en">
```

`frontend-admin/index.html`：

```html
<html lang="en">
```

`frontend/src/utils/i18n.ts`：

```ts
const DEFAULT_LOCALE: Locale = 'zh-TW';
```

同檔也允許 `en-US` catalog lazy load；缺 key 時會 fallback 到 `zh-TW` 或 humanized key。核心驗收文件已明確 `i18n key completeness / fallback 檢查` 待建立。

### 2.1 第二輪新增取證樣本

1. `frontend/src/pages/Chat/Room/components/ChatMessageItem.tsx` 與 `frontend/src/pages/Execution/CheckIn/index.tsx` 都直接使用 `new Date(...).toLocaleString()`，沒有走統一 locale helper。
2. `frontend/src/components/business/Interview/SafetyAlert/index.tsx` 使用 `aria-label="Dismiss"`，`frontend/src/pages/Judgment/Detail/index.tsx` 使用 `aria-label={`${star} star`}`，都屬於 hardcoded 英文 accessible name。
3. `frontend-admin/src/pages/Admin/Reports/index.tsx` 的自定義報表輸入仍以 hardcoded placeholder `dau,mau,judgment_failed` 呈現，沒有明確的 programmatic label。

## 3. 核心文件依據

1. `04-共用機制/07-可訪問性本地化與內容設計治理基線.md`：`CJ-A11Y-GAP-001` 現狀為待修正。
2. `08-測試規範與驗收/05-可訪問性本地化驗收基線.md`：`CJ-A11Y-T-003`、`CJ-L10N-T-001`、`CJ-L10N-T-002` 均為待建立或待修正。
3. 同驗收文件明確不得在沒有 i18n key completeness / fallback 檢查前宣稱雙語完整。

## 4. 風險

1. 螢幕閱讀器、搜尋引擎、翻譯工具與語音朗讀可能按英文處理繁中頁面。
2. `toLocaleString()` 等日期格式若不接 `getLocale()`，會受瀏覽器環境影響，不符合統一 locale policy。
3. 英文 catalog lazy load 與 humanized fallback 可能讓缺 key 在 UI 中以看似可讀但未審核的文案出現。

## 5. 目標狀態

1. Web / Admin 根 HTML 的 `lang` 與 default locale 一致，或在 runtime locale 變更時同步更新 `document.documentElement.lang`。
2. 建立 i18n key completeness / fallback gate，至少覆蓋 zh-TW / en-US catalog。
3. 日期、時間、數字、百分比等格式統一使用 locale-aware helper。
4. 補充必要測試，確保 locale switch 後 `html[lang]`、catalog、可見文案與格式化策略一致。

## 5.1 修復裁決

本問題納入 [Web五項修復主控方案-2026-05-10.md](./Web五項修復主控方案-2026-05-10.md) 的 P0-C 階段。修復必須同時處理靜態 `html lang`、runtime locale switch、catalog completeness / fallback gate 與 locale-aware formatting；不得只把 `index.html` 改成 `zh-TW` 後宣稱完成。

## 5.2 本輪修復證據（2026-05-10）

已落地修復：

1. `frontend/index.html` 與 `frontend-admin/index.html` 的根 HTML 改為 `lang="zh-TW"`，對齊 default locale。
2. `frontend/src/utils/i18n.ts` 與 `frontend-admin/src/utils/i18n.ts` 新增 `document.documentElement.lang` runtime sync；初始化與 `setLocale()` 命中相同 locale 時也會同步。
3. `frontend/src/pages/Notifications/index.tsx` 與 `frontend/src/pages/Chat/Room/components/ChatMessageItem.tsx` 的日期時間格式改為 `toLocaleString(getLocale())`。

本輪驗證：

```bash
rg -n "<html lang=\"en\"|<html lang=\"zh-TW\"" frontend/index.html frontend-admin/index.html
rg -n "role=\"button\"|tabIndex=\\{0\\}.*onKeyDown|toLocaleString\\(\\)" frontend/src/pages/Notifications/index.tsx frontend/src/pages/Chat/Room/components/ChatMessageItem.tsx
npm run build --workspace frontend
npm run build --workspace frontend-admin
```

結果：HTML lang 只剩 `zh-TW`；兩個本輪修改頁面沒有裸 `toLocaleString()`；Web / Admin build 均通過。

### 5.3 Catalog gate 補強（2026-05-10）

已新增 catalog parity gate：

1. `frontend/src/assets/i18n/catalogParity.test.ts` 覆蓋主站 zh-TW / en-US key set parity、非空文案與 placeholder parity。
2. `frontend-admin/src/assets/i18n/catalogParity.test.ts` 覆蓋 Admin zh-TW / en-US key set parity、非空文案與 placeholder parity。

本輪驗證：

```bash
npm run test:run --workspace frontend -- src/assets/i18n/catalogParity.test.ts
npm run test:run --workspace frontend-admin -- src/assets/i18n/catalogParity.test.ts
```

結果：主站與 Admin catalog parity 測試均通過。

### 5.4 Formatting scan 補強（2026-05-10）

已收斂本輪發現的裸 locale formatting：

1. `frontend/src/pages/Chat/Room/components/ChatMessageList.tsx` 的 day divider 改用 `getLocale()`。
2. `frontend/src/pages/Chat/Room/utils/chatMessageHelpers.ts` 的 day compare 改為接收 locale。
3. `frontend/src/pages/Chat/Room/components/ChatMessageItem.tsx` 的 message time 改用 `getLocale()`。
4. `frontend/src/pages/Execution/CheckIn/index.tsx` 的 check-in history time 改用 `getLocale()`。

本輪驗證：

```bash
rg -n "toLocaleString\\(\\)|toLocaleDateString\\(\\)|toLocaleTimeString\\(\\)" frontend/src frontend-admin/src -g '*.ts' -g '*.tsx'
npm run test:run --workspace frontend -- src/pages/Chat/Room/index.test.tsx src/pages/Execution/CheckIn/index.test.tsx src/pages/Chat/Room/components/ChatMessageItem.test.tsx src/pages/Notifications/index.test.tsx src/assets/i18n/catalogParity.test.ts
npm run build --workspace frontend
```

結果：裸 `toLocale*()` 掃描無輸出；相關 Web 測試 123 條通過；Web build 通過。

### 5.5 Fallback fail policy 補強（2026-05-10）

已在 `frontend/src/utils/i18n.ts` 與 `frontend-admin/src/utils/i18n.ts` 建立缺 key fail policy：非 production 直接 throw `Missing i18n key: <key>`；production 回傳 `[missing-i18n:<key>]`，不再回傳原 key 或 humanized key。`frontend/src/pages/Chat/Room/chatRoomUtils.ts` 的動態 message type / visibility scope label 已改為明確 allowlist，未知後端枚舉直接顯示原始值，不再透過缺 i18n key 中斷整頁。

本輪同時補齊被 fail policy 抓出的 Chat catalog 缺口：`chat.status.active`、`chat.messageType.ai_text`、`chat.inviteCodeInputLabel`。`ChatRoomEntrySection` 的 invite code input 已補 programmatic label 與 `autoComplete="off"`。

本輪驗證：

```bash
npm run test:run --workspace frontend -- src/pages/Notifications/index.test.tsx src/pages/Chat/Room/index.test.tsx src/assets/i18n/catalogParity.test.ts src/utils/i18n.test.ts
npm run test:run --workspace frontend-admin -- src/utils/i18n.test.ts src/assets/i18n/catalogParity.test.ts
```

結果：主站 135 條測試通過；Admin i18n / catalog gate 7 條測試通過。

2026-05-11 補充裁決：HTML lang、runtime locale、catalog parity、locale formatting scan、fallback fail policy、hardcoded accessible name gate 與 route-level axe smoke 均已完成，因此本文件移入 `已處理/`。全量 WCAG / screen reader / 外部等級證據統一由 [./Web全量A11Y與ScreenReader外部證據缺口待辦-2026-05-11.md](./Web全量A11Y與ScreenReader外部證據缺口待辦-2026-05-11.md) 追蹤；P0 true-service / Admin credential-backed 本機證據已由 [WebP0流程E2E真服務證據缺口待辦-2026-05-10.md](./WebP0流程E2E真服務證據缺口待辦-2026-05-10.md) 收口。

## 6. 驗收命令

```bash
rg -n "<html lang=|DEFAULT_LOCALE|humanizeKey|toLocaleString\\(|toLocaleDateString\\(" frontend frontend-admin
rg -n "toLocaleString\\(\\)|toLocaleDateString\\(\\)|toLocaleTimeString\\(\\)" frontend/src frontend-admin/src -g '*.ts' -g '*.tsx'
npm run test:run --workspace frontend
npm run test:run --workspace frontend -- src/assets/i18n/catalogParity.test.ts
npm run test:run --workspace frontend-admin -- src/assets/i18n/catalogParity.test.ts
npm run test:a11y --workspace frontend
npm run test:a11y --workspace frontend-admin
npm run build --workspace frontend
npm run build --workspace frontend-admin
npm run docs:check
```
