# Web 表單 Label 與 Autocomplete 待辦（2026-05-10）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web / Admin 表單欄位的 programmatic label、file input、select / textarea / credential autocomplete、keyboard / screen reader 驗收
**取證代碼入口**：`frontend/src/pages/Chat/Room/components/ChatRoomEntrySection.tsx`、`frontend/src/pages/Profile/Index/index.tsx`、`frontend/src/pages/Execution/CheckIn/index.tsx`、`frontend-admin/src/pages/Admin/Login/index.tsx`、`frontend-admin/src/pages/Admin/OpsJobs/index.tsx`、`frontend-admin/src/pages/Admin/AuditLogs/index.tsx`、`frontend-admin/src/pages/Admin/Reports/index.tsx`
**最後核驗 Commit**：`3890ba8`
**最後核驗日期**：`2026-05-10`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理
**Owner**：Frontend / Accessibility / Admin UX
**優先級**：P1
**分類**：可訪問性 / 表單可用性

## 1. 問題

Web 與 Admin 目前有多個表單欄位只靠 placeholder、鄰近文字或視覺排版來表達意義，沒有穩定的 programmatic label、`aria-label`、`htmlFor` / `id` 對應，部分 credential 欄位也沒有 browser autocomplete。這會讓 screen reader、Testing Library、password manager 與鍵盤使用者的體驗不一致。

## 2. 證據

1. `frontend/src/pages/Chat/Room/components/ChatRoomEntrySection.tsx`

```tsx
<SelectTrigger className="chat-room-entry__visibility-select w-[220px]"><SelectValue /></SelectTrigger>
...
<Input
  value={inviteCodeInput}
  onChange={(e) => onInviteCodeInputChange(e.target.value)}
  placeholder={t('chat.inviteCodePlaceholder')}
  className="chat-room-entry__invite-input"
/>
```

2. `frontend/src/pages/Profile/Index/index.tsx`

```tsx
<label className="text-sm font-medium text-foreground">{t('profileIndex.nicknameLabel')}</label>
<Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t('profileIndex.nicknamePlaceholder')} maxLength={20} className="h-11 rounded-xl" />
```

同檔 email 欄位也只有可見文字，未建立 `htmlFor` / `id` 關聯。

3. `frontend/src/pages/Execution/CheckIn/index.tsx`

```tsx
<label className="text-sm font-medium text-foreground">{t('execCheckIn.notesLabel')}</label>
<textarea ... placeholder={t('execCheckIn.notesPlaceholder')} ... />
```

檔案選擇器也只有隱藏 `input[type=file]` 與按鈕觸發，沒有直接可辨識的 programmatic label。

4. `frontend-admin/src/pages/Admin/Login/index.tsx`

```tsx
<Label htmlFor="email">{t('admin.login.email')}</Label>
<Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
...
<Label htmlFor="password">{t('admin.login.password')}</Label>
<Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
```

這兩個 credential 欄位已有 label，但尚未補 browser autocomplete。

5. `frontend-admin/src/pages/Admin/OpsJobs/index.tsx`

```tsx
<p className="font-semibold">{t('admin.ops.tokenLabel')}</p>
...
<Input
  type="password"
  value={tokenInput}
  onChange={(event) => setTokenInput(event.target.value)}
  placeholder={t('admin.ops.tokenPlaceholder')}
  className="min-w-[320px] w-auto"
/>
...
<span className="text-sm">{t('admin.ops.days')}</span>
<Input ... className="w-20" />
<span className="text-sm">{t('admin.ops.maxRows')}</span>
<Input ... className="w-24" />
```

6. `frontend-admin/src/pages/Admin/AuditLogs/index.tsx`

```tsx
<Input className="w-48" placeholder={t('admin.audit.entityType')} ... />
<Input className="w-48" placeholder={t('admin.audit.action')} ... />
<Input className="w-48" type="datetime-local" placeholder={t('admin.audit.from')} ... />
<Input className="w-48" type="datetime-local" placeholder={t('admin.audit.to')} ... />
```

7. `frontend-admin/src/pages/Admin/Reports/index.tsx`

```tsx
<Input
  value={metricsInput}
  onChange={(event) => setMetricsInput(event.target.value)}
  placeholder="dau,mau,judgment_failed"
/>
```

同頁還有 `SelectTrigger` 沒有 programmatic label 的篩選器。

### 2.1 本輪新增修復樣本（2026-05-10）

1. `frontend-admin/src/pages/Admin/Reports/index.tsx`

```tsx
<label htmlFor="admin-custom-metrics">{t('admin.reports.customMetricsLabel')}</label>
<Input
  id="admin-custom-metrics"
  placeholder={t('admin.reports.metricsPlaceholder')}
  autoComplete="off"
/>
```

2. `frontend-admin/src/pages/Admin/Settings/MediaProviderSettingsCard.tsx`

```tsx
<Label htmlFor="admin-media-provider-api-key">...</Label>
<Input id="admin-media-provider-api-key" type="password" autoComplete="off" />
<Label htmlFor="admin-media-provider-base-url">...</Label>
<Input id="admin-media-provider-base-url" autoComplete="url" />
<Label htmlFor="admin-media-provider-model">...</Label>
<Input id="admin-media-provider-model" autoComplete="off" />
<Label htmlFor="admin-media-provider-prompt">...</Label>
<Textarea id="admin-media-provider-prompt" autoComplete="off" />
```

本輪對應測試：

```bash
npm run test:run --workspace frontend-admin -- src/pages/Admin/Reports/index.test.tsx src/pages/Admin/Settings/MediaProviderSettingsCard.test.tsx
```

結果：通過。Admin Reports 的 custom metrics input 與 Admin Media Provider settings 的 API key/base URL/model/prompt 欄位都已具備 programmatic label，且 credential / URL 欄位補齊 autocomplete。

### 2.2 第二批修復樣本（2026-05-10）

1. `frontend/src/pages/Chat/Room/components/ChatRoomEntrySection.tsx` 的 invite code input 已補 `Label htmlFor="chat-invite-code"`、`id="chat-invite-code"` 與 `autoComplete="off"`，並由 `frontend/src/pages/Chat/Room/index.test.tsx` 的 route-level keyboard smoke 驗證可用 `getByLabelText('邀請碼')` 定位。
2. `frontend-admin/src/pages/Admin/Login/index.tsx` 的 email / password 已補 `autoComplete="email"` 與 `autoComplete="current-password"`，並新增 `frontend-admin/src/pages/Admin/Login/index.test.tsx`。
3. `frontend-admin/src/pages/Admin/OpsJobs/index.tsx` 的 admin token、days、max rows 已補 `Label htmlFor` / `id` 與 `autoComplete="off"`，並新增 `frontend-admin/src/pages/Admin/OpsJobs/index.test.tsx`。
4. `frontend-admin/src/pages/Admin/AuditLogs/index.tsx` 的 entity type、action、from、to filters 已補 `Label htmlFor` / `id` 與 `autoComplete="off"`，並新增 `frontend-admin/src/pages/Admin/AuditLogs/index.test.tsx`。

本輪對應測試：

```bash
npm run test:run --workspace frontend -- src/pages/Notifications/index.test.tsx src/pages/Chat/Room/index.test.tsx src/assets/i18n/catalogParity.test.ts src/utils/i18n.test.ts
npm run test:run --workspace frontend-admin -- src/pages/Admin/Login/index.test.tsx src/pages/Admin/OpsJobs/index.test.tsx src/pages/Admin/AuditLogs/index.test.tsx src/pages/Admin/Reports/index.test.tsx src/pages/Admin/Settings/MediaProviderSettingsCard.test.tsx src/assets/i18n/catalogParity.test.ts src/utils/i18n.test.ts
```

結果：主站 135 條測試通過；Admin 表單 / i18n / catalog gate 12 條測試通過。

### 2.3 全量靜態 gate（2026-05-10）

本輪新增 `scripts/check-web-a11y-contracts.mjs` 與根層命令：

```bash
npm run web:a11y:contracts
```

該 gate 掃描 `frontend/src` 與 `frontend-admin/src` 的 270 個 source files，並把以下情況視為失敗：

1. `Input` / `Textarea` / `SelectTrigger` 沒有 `aria-label`、`aria-labelledby`、`Label htmlFor` / `id` 對應或 wrapping label。
2. 表單欄位只靠 placeholder 表達語義。
3. input / textarea 未明確設定 `autoComplete`。
4. icon-only button 沒有 accessible name。

為使 gate 清零，本輪已同步補齊 Auth forgot/register、Case Create/List、Chat entry/composer、Execution CheckIn、Profile Index/Pairing/Settings、QuickExperience Collaborative、Reconciliation preferences，以及 Admin Configs/Reports/Settings/Users/Media Provider/JsonConfigCard 的 programmatic label、`aria-label` 與 `autoComplete`。命令結果：`Web accessibility contract check passed (270 files scanned).`

## 3. 核心文件依據

1. `04-共用機制/07-可訪問性本地化與內容設計治理基線.md`：`CJ-A11Y-002` 要求可理解 name / status，表單欄位與 credential input 不能只靠視覺排版。
2. `08-測試規範與驗收/05-可訪問性本地化驗收基線.md`：Unit / Component 驗收必須能用 `getByRole` / `getByLabelText` 檢驗 form field。
3. `08-測試規範與驗收/05-可訪問性本地化驗收基線.md` 也要求 i18n / locale 的驗收不能只看畫面，表單文案與 credential flows 必須可追溯。

## 4. 風險

1. screen reader 無法可靠辨識欄位用途。
2. password manager 與 browser autofill 不能穩定工作，Admin credential flow 會劣化。
3. 測試容易退化成靠 placeholder / DOM 結構猜欄位，之後改版會碎。

## 5. 目標狀態

1. 所有 `Input`、`Textarea`、`SelectTrigger`、`file input` 都要有 programmatic label 或明確 `aria-label` / `aria-labelledby`。
2. 所有 credential input 都要設定正確 autocomplete。
3. 需要隱藏原生 input 的檔案上傳元件，必須保留可追溯的可訪問名稱與測試。
4. 表單相關測試以 `getByLabelText` / `getByRole` 為主，不接受只用 placeholder 定位。

## 6. 驗收命令

```bash
npm run web:a11y:contracts
npm run test:a11y --workspace frontend
npm run test:a11y --workspace frontend-admin
npm run test:run --workspace frontend
npm run build --workspace frontend
npm run build --workspace frontend-admin
npm run docs:check
```

## 7. 完成裁決（2026-05-11）

Web / Admin form label、`autoComplete`、placeholder-only field、file input / select / textarea 靜態 gate 已由 `npm run web:a11y:contracts` 承接並通過；Web / Admin route-level axe smoke 也已建立並通過。因此本文件移入 `已處理/`。

全量 WCAG / screen reader / 外部等級證據統一由 [./Web全量A11Y與ScreenReader外部證據缺口待辦-2026-05-11.md](./Web全量A11Y與ScreenReader外部證據缺口待辦-2026-05-11.md) 追蹤。
