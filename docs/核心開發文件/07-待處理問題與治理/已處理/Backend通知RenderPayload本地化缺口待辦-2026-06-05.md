# Backend 通知 Render Payload 本地化缺口待辦（2026-06-05）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend notification render payload、Web 通知中心、App 通知中心、push notification 背景派送的 locale 一致性
**取證代碼入口**：`backend/src/services/notification.service.ts`、`backend/src/controllers/notification.controller.ts`、`backend/src/middleware/locale.ts`、`frontend/src/pages/Notifications/index.tsx`、`mobile/app/(app)/notifications/index.tsx`、`packages/api-client/src/m5.ts`
**最後核驗 Commit**：`fb2880d`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理
**Owner**：Backend / Web / Mobile
**關聯核心文件**：`20-App端/01-App導航與平台Adapter基線.md`、`50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`、`08-測試規範與驗收/03-App測試與證據接入基線.md`

---

## 1. 問題

`NotificationService.normalize()` 目前以固定繁中 `TEMPLATE_RENDER_DEFAULTS` 產生 `render_payload.title`、`render_payload.body`、`render_payload.cta_label` 與 push fallback 文案。Web 通知中心與 App 通知中心直接顯示 backend 回傳的 `notification.render_payload`，背景 push 派送也直接使用同一份 render 結果。

因此當使用者在 Web 或 App 選擇 `en-US` 時，通知列表與 push 仍可能顯示繁中文案，不符合「所選語言決定可見文案」的跨端語言基線。

## 2. 影響

1. Web `frontend/src/pages/Notifications/index.tsx` 的通知卡 title/body/CTA 會被 backend 固定繁中文案污染。
2. App `mobile/app/(app)/notifications/index.tsx` 的通知卡 title/body 會被 backend 固定繁中文案污染。
3. `sendPendingPushNotifications()` 是背景任務，不能依賴當前 HTTP request locale；若通知建立時沒有可重放的目標 locale，push 派送會退回固定繁中。
4. 已有 `X-Locale` / `localeMiddleware` 只能保證一般 API response message，不會自動處理通知 payload render。

## 3. 目標

1. 通知列表 API 應按請求 locale render backend-owned notification title/body/CTA。
2. 背景 push 應按通知建立時的目標 locale render title/body/fallback，不能因缺少 request context 而固定繁中。
3. 使用者或既有 payload 已顯式提供 `title` / `body` / `cta_label` 時，不應被模板覆蓋；但模板預設文案與 fallback 必須可本地化。
4. 修復需維持既有 `template_code`、`action_key`、deep link、dedup、priority 與 journey context 行為。

## 4. 邊界與注意事項

1. 本任務不改 notification schema，優先利用 existing payload JSON 記錄 `locale`，避免 migration 擴大風險。
2. 背景 push 以 `payload.locale` 作為 target locale；若不存在則回退 `zh-TW`，確保舊資料相容。
3. Web/App 前端只消費已 render 好的字串，不在各端重建通知模板，避免跨端模板分叉。
4. Admin 通知治理頁可保持管理視角，但若復用 `normalize()`，需避免破壞既有列表 shape。
5. 測試需覆蓋 `en-US` list render、create 時 payload locale 寫入、push 使用 payload locale fallback。

## 5. 驗收

```bash
npm --prefix backend test -- tests/unit/services/notification.service.test.ts tests/unit/controllers/notification.controller.test.ts --runInBand
npm --prefix backend run build -- --noEmit
npm run docs:check
```

完成後將本文件移入 `已處理/`，並在相關核心文件回寫已建立的通知 render locale 基線。

## 6. 修復摘要

1. `NotificationService` 新增 zh-TW / en-US notification template render defaults，列表 API 可按 request locale render backend-owned title/body/CTA。
2. notification create / createIfEnabled 會把 target locale 寫入 payload；直接 API 建立使用 request locale，backend 內部建立時使用收件人 `User.language`，缺省回退 `zh-TW`。
3. 背景 push dispatch 以 payload locale render title/body/fallback，不再固定繁中。
4. Web / App 仍只消費 backend 已 render 的 `render_payload`，不在前端重建 notification template。
5. `20-App端/01-App導航與平台Adapter基線.md`、`50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`、`08-測試規範與驗收/03-App測試與證據接入基線.md` 已回寫通知 render locale baseline。
