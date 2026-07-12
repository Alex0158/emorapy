# Web Icon-only Button 可訪問性待辦（2026-05-10）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web icon-only 關閉/清除按鈕、accessible name、keyboard/focus 驗收
**取證代碼入口**：`frontend/src/pages/Case/Create/index.tsx`、`frontend/src/pages/Chat/Room/components/ChatMessageComposer.tsx`、`frontend/src/components/business/FileUpload/index.tsx`、`frontend/src/components/business/Interview/SafetyAlert/index.tsx`
**最後核驗 Commit**：`e65a4b8`
**最後核驗日期**：`2026-07-12`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理
**Owner**：Frontend / Accessibility
**優先級**：P1
**分類**：可訪問性 / UI 品質

## 1. 問題

多個 icon-only `<button>` 只有 Lucide `X` 圖標，沒有 `aria-label`、`aria-labelledby` 或可見文字。這會讓 screen reader 讀不到按鈕目的，也不符合核心文件對 icon-only button 的 accessible name 要求。

## 2. 已確認樣本

1. 歷史 `RegisterPromptSection`（2026-07-12 全站 UI/UX 重構時連同重複註冊提示移除）

```tsx
<button onClick={onClose} className="text-muted-foreground hover:text-foreground">
  <X className="size-4" />
</button>
```

2. `frontend/src/pages/Case/Create/index.tsx`

```tsx
<button onClick={() => setShowPreCaseBanner(false)} className="text-muted-foreground hover:text-foreground">
  <X className="size-4" />
</button>
```

3. 歷史 `GuideTooltip`（2026-07-12 清理無 production consumer 的元件時移除）

```tsx
<button onClick={handleClose} className="text-background/70 hover:text-background">
  <X className="size-3" />
</button>
```

4. `frontend/src/pages/Chat/Room/components/ChatMessageComposer.tsx`

```tsx
<button onClick={onClearReply} className="text-muted-foreground hover:text-foreground">
  <X className="size-3.5" />
</button>
```

### 2.1 本輪新增修復樣本（2026-05-10）

1. `frontend/src/components/business/Interview/SafetyAlert/index.tsx`

```tsx
<button
  type="button"
  onClick={onDismiss}
  aria-label={t('common.dismiss')}
>
  <X className="size-4" />
</button>
```

2. `frontend/src/pages/Profile/MyStory/index.tsx`

```tsx
<Button variant="ghost" size="icon" onClick={() => navigate('/profile/index')} aria-label={t('common.back')}>
  <ArrowLeft className="size-5" />
</Button>
```

本輪對應測試：

```bash
npm run test:run --workspace frontend -- src/components/business/Interview/SafetyAlert/index.test.tsx src/pages/Profile/MyStory/index.test.tsx
```

結果：通過。該兩個 icon-only / close 型按鈕已具備明確 accessible name 與回歸測試。

### 2.2 本輪第二批新增修復樣本（2026-05-10）

已再補四個 icon-only control 的 accessible name：

1. `frontend/src/pages/Chat/Room/components/ChatMessageComposer.tsx`：清除 reply preview 的 X button 改為 `aria-label={t('chat.dismiss')}`。
2. 歷史 `GuideTooltip`：當時已為關閉 X button 補 `aria-label={t('guideTooltip.close')}`；元件其後於 2026-07-12 因無 production consumer 移除。
3. `frontend/src/components/business/FileUpload/index.tsx`：hover overlay 的預覽 / 移除 icon button 改為 `aria-label={t('fileUpload.previewFile')}` / `aria-label={t('fileUpload.removeFile')}`。
4. 歷史 `RegisterPromptSection`：當時已為右上角 X button 補 `aria-label={t('common.dismiss')}`；重複提示其後於 2026-07-12 移除。

對應測試：

```bash
npm run test:run --workspace frontend -- src/pages/Chat/Room/components/ChatMessageComposer.test.tsx src/components/business/FileUpload/index.test.tsx src/assets/i18n/catalogParity.test.ts
```

結果：5 個測試檔、16 條測試通過；新增 i18n key 也已被 catalog parity gate 覆蓋。

同輪掃描命令：

```bash
rg -n "<button(?![^>]*(aria-label|aria-labelledby|>\\s*[^<]))" frontend/src frontend-admin/src --pcre2
```

該命令還列出其他候選點，修復時需逐一人工確認，避免把有可見文字但跨行的按鈕誤判為缺陷。

### 2.3 本輪第三批新增修復樣本（2026-05-10）

`frontend/src/pages/Case/Create/index.tsx` 的 pre-case banner 右上角 X button 已補：

```tsx
<button
  type="button"
  onClick={() => setShowPreCaseBanner(false)}
  aria-label={t('common.dismiss')}
>
  <X className="size-4" />
</button>
```

對應測試：

```bash
npm run test:run --workspace frontend -- src/pages/Case/Create/index.test.tsx src/assets/i18n/catalogParity.test.ts
```

結果：Case Create 與 catalog parity 共 39 條測試通過。

### 2.4 全量靜態 gate（2026-05-10）

本輪已新增根層 contract gate：

```bash
npm run web:a11y:contracts
```

該命令執行 `scripts/check-web-a11y-contracts.mjs`，掃描 `frontend/src` 與 `frontend-admin/src` 的 270 個 source files（排除測試檔與 shadcn ui primitive），並阻止：

1. icon-only `button` / `Button` 缺 `aria-label`、`aria-labelledby` 或 `sr-only` 文案。
2. `Input` / `Textarea` / `SelectTrigger` 缺 programmatic label。
3. placeholder 被當成唯一 label。
4. input / textarea 未明確設定 `autoComplete`。
5. `aria-label` / `alt` 使用 hardcoded string literal，而非 i18n expression 或 runtime value。

本輪為讓 gate 綠燈，已補 `frontend/src/pages/Execution/CheckIn/index.tsx` submit button 的穩定 `aria-label`，並同步修復其他頁面級 icon / form 缺口。命令結果：`Web accessibility contract check passed (270 files scanned).`

### 2.5 Hardcoded accessible name literal gate（2026-05-10）

`scripts/check-web-a11y-contracts.mjs` 已擴充 hardcoded accessible name 檢查：`aria-label="..."` 與 `alt="..."` string literal 會使 `npm run web:a11y:contracts` 失敗；可訪問名稱必須來自 i18n expression，例如 `aria-label={t('common.dismiss')}`，或來自 runtime data，例如 `alt={file.name}`。

本輪驗證：

```bash
npm run web:a11y:contracts
```

結果：`Web accessibility contract check passed (270 files scanned).` 這表示目前掃描範圍內的 hardcoded accessible name literal 已清零；仍不替代全量 WCAG / screen reader / 外部等級證據。

### 2.6 Web route-level axe smoke（2026-05-10）

`frontend` 已新增 `@axe-core/playwright`、`frontend/e2e/playwright.a11y.config.ts`、`frontend/e2e/a11y/public-routes-a11y.e2e.ts` 與 workspace script：

```bash
npm run test:a11y --workspace frontend
```

本輪驗證覆蓋 public routes：`/`、`/quick-experience/create`、`/quick-experience/collaborative`、`/auth/login`、`/auth/register`、`/auth/forgot-password`、`/chat/room`；以及 mock-authenticated routes：`/case/list`、`/notifications`、`/profile/index`。結果：10 條 Playwright axe smoke 通過，無 automated axe violations。這是 route-level baseline，不替代全量 WCAG 掃描或 P0 true-service 證據。

### 2.7 Admin axe smoke 與對比度修復（2026-05-10）

`frontend-admin` 已新增 `@axe-core/playwright`、`frontend-admin/e2e/playwright.a11y.config.ts`、`frontend-admin/e2e/a11y/admin-routes-a11y.e2e.ts` 與 workspace script：

```bash
npm run test:a11y --workspace frontend-admin
```

本輪驗證覆蓋 `/admin/login` 與 mock-authenticated `/admin/ops/jobs`。首次執行時 axe 發現 active nav `text-primary` 在 `bg-primary/10` 上色彩對比 4.23，低於 WCAG AA 4.5；已將 `frontend-admin/src/components/common/AdminSectionLayout.tsx` active nav 文字改為 `text-primary-hover`。重跑結果：2 條 Admin axe smoke 通過，無 automated axe violations。

### 2.8 Web route-level axe 對比度回歸修復（2026-05-11）

2026-05-11 重新執行 `npm run test:a11y --workspace frontend` 時，主站 10 條 route-level axe smoke 有 5 條因 `color-contrast` 失敗：Header active nav 的 `text-primary` / `text-primary-hover` 在 `bg-primary/10` 上對比不足、default primary button 白字對 `bg-primary` 對比不足、Footer 次文案 `text-muted-foreground/60` 對背景對比不足。

本輪已落地最小樣式修復：

1. `frontend/src/components/ui/button.tsx` 的 default button 背景改用 `bg-primary-hover`，保留白字與 hover 狀態。
2. `frontend/src/components/layout/Header.tsx` 的 active nav 改用 `text-foreground` + `ring-primary/20`，保留 active 背景但避免品牌色小字對比不足。
3. `frontend/src/components/layout/Footer.tsx` 的次文案移除 `/60` opacity，改用完整 `text-muted-foreground`。

本輪驗證：

```bash
npm run test:a11y --workspace frontend
npm run test:run --workspace frontend -- src/components/layout/Footer.test.tsx src/components/common/ProgressSteps/index.test.tsx
npm run build --workspace frontend
```

結果：主站 route-level axe smoke 10/10 passed；Footer / ProgressSteps targeted tests 4 條通過；Web build 通過。

### 2.9 完成裁決（2026-05-11）

icon-only button 與 hardcoded accessible name literal 的樣本修復、靜態 contract gate、Web route-level axe smoke、Admin route-level axe smoke 與 2026-05-11 主站對比度回歸均已完成，因此本文件移入 `已處理/`。全量 WCAG / screen reader / 外部等級證據統一由 [./Web全量A11Y與ScreenReader外部證據缺口待辦-2026-05-11.md](./Web全量A11Y與ScreenReader外部證據缺口待辦-2026-05-11.md) 追蹤。

## 3. 核心文件依據

1. `04-共用機制/07-可訪問性本地化與內容設計治理基線.md` 要求 icon-only button 必須有 accessible name、keyboard/focus 口徑與測試或 inspection。
2. `08-測試規範與驗收/05-可訪問性本地化驗收基線.md` 的 CJ-A11Y-T-002 要求 icon-only / stream / upload / toast / error 以 role、name、status message 驗證。

## 4. 風險

1. screen reader 使用者無法知道按鈕是關閉提示、清除回覆、還是其他危險操作。
2. Testing Library 若只查 container 或 text，可能無法覆蓋 accessible name 缺失。
3. 同類問題會在後續 UI 新增時繼續擴散。

## 5. 目標狀態

1. 所有 icon-only button 補齊 `type="button"` 與明確 `aria-label`。
2. 關閉、清除、返回、刪除等不同語義使用不同 i18n key，不共用含糊 label。
3. 高頻元件補 role/name 測試或集中 a11y static check。
4. 新增 lint / test rule 時同步更新 `08-測試規範與驗收/05-可訪問性本地化驗收基線.md`。

## 5.1 修復裁決

本問題納入 [Web五項修復主控方案-2026-05-10.md](./Web五項修復主控方案-2026-05-10.md) 的 P0-B 階段。所有已確認樣本需補 `type="button"` 與明確 i18n accessible name；若新增 static scan 或 lint rule，必須同步更新可訪問性驗收基線，避免只修樣本、不防回歸。

## 6. 驗收命令

```bash
npm run web:a11y:contracts
npm run test:run --workspace frontend
npm run build --workspace frontend
npm run docs:check
```
