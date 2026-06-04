# Backend P2002 Dev Unique Constraint Fallback 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Backend `errorHandler` Prisma P2002 development fallback、`translateBackendMessage()` dynamic unique-constraint pattern、本機開發版 API error 顯示語言
**取證代碼入口**：`backend/src/middleware/errorHandler.ts`、`backend/src/i18n/index.ts`、`backend/tests/unit/middleware/errorHandler.test.ts`、`backend/tests/unit/utils/backend-i18n.test.ts`
**最後核驗 Commit**：`e0cc480`
**最後核驗日期**：`2026-06-04`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

`backend/src/middleware/errorHandler.ts` 在 Prisma `P2002` 且非 production、非 email duplicate 或缺少 `meta.target` 時，會回傳：

```ts
translateBackendMessage(locale, `唯一約束違規: ${target?.join(', ') || '未知字段'}`)
```

`backend/src/i18n/index.ts` 目前只將前綴 `唯一約束違規:` 翻為 `Unique constraint violation:`，但不處理 fallback suffix `未知字段`。因此英文語系下：

```txt
唯一約束違規: 未知字段 -> Unique constraint violation: 未知字段
```

本機開發版或 development 環境若觸發這條 API error，Web / Admin / App 或開發者調試 UI 會看到混中英訊息，未完整按所選語言顯示。

## 影響範圍

- Backend：直接受影響。`translateBackendMessage()` dynamic unique constraint pattern 只翻前綴。
- Web / Admin / App：間接受影響。development API response 可被 request error UI 或開發工具顯示。
- Shared：間接受影響。shared API client 會保留 backend response message 作 error payload。

## 目前語言處理缺口

1. `translateBackendMessage('en-US', '唯一約束違規: 未知字段')` 仍包含繁中。
2. `backend/tests/unit/middleware/errorHandler.test.ts` 目前只在 zh-TW default locale 驗證 `P2002 無 meta.target`，沒有 en-US regression。
3. 這條分支屬本機開發版 / development diagnostics，但仍是 backend-owned literal，不應在英文語系混用繁中。

## 目標行為

1. `en-US` 下 `唯一約束違規: 未知字段` 應輸出完整英文，例如 `Unique constraint violation: unknown field`。
2. `en-US` 下具體英文欄位名稱仍保留，例如 `email`、`case_id` 不本地化。
3. `zh-TW` 下現有中文 development diagnostic 保持不變。
4. 不改 production P2002 行為：production 仍回 `資源已存在` / `Resource already exists`。

## 修復前分析

- 目標改動點：`backend/src/i18n/index.ts` 的 `message.startsWith('唯一約束違規:')` 分支，補 suffix normalization；`backend-i18n.test.ts` 與 `errorHandler.test.ts` 補 regression。
- 替代方案 A：把 errorHandler 的 fallback literal 改成英文 key。會破壞 zh-TW 原文優先的 backend message model，不採用。
- 替代方案 B：直接把 `未知字段` 加到 `directEnUSMap`。無法處理 `唯一約束違規:` dynamic suffix 組合，不如在 dynamic pattern 內處理。
- 本輪方案：在 unique constraint dynamic translator 中只針對已知 suffix `未知字段` 翻成 `unknown field`，其他 target name 原樣保留。
- fallback 邏輯：zh-TW unchanged；en-US prefix translated；known CJK diagnostic suffix translated；field names unchanged。
- UI/UX：本機開發版英文語系下不再出現混中英錯誤；不改 status/code。
- 風險：低。pattern 僅限 `唯一約束違規:` 分支，且只處理固定 suffix。
- 回滾點：回滾 `backend/src/i18n/index.ts` 與兩個 backend unit test 即可。

## 驗證方式

1. `npm --prefix backend test -- tests/unit/middleware/errorHandler.test.ts tests/unit/utils/backend-i18n.test.ts --runInBand`
2. `npm --prefix backend run build -- --pretty false`
3. 靜態檢查 `translateBackendMessage('en-US', '唯一約束違規: 未知字段')` 不含 CJK。
4. `npm run docs:check`

## Owner / Status Notes

- Owner：agent
- Status：待處理
- 注意：本任務只處理 backend 自己組裝的 P2002 development diagnostic；第三方 DB raw error message 不納入本輪翻譯。
