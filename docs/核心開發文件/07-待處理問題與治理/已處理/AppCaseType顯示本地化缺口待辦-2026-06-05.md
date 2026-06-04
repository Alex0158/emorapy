# App Case Type 顯示本地化缺口待辦（2026-06-05）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App Quick result case type meta、App Case title fallback、backend stored case type 與 App locale 顯示
**取證代碼入口**：`mobile/app/(public)/quick/result.tsx`、`mobile/app/(app)/case/index.tsx`、`mobile/src/i18n/catalogs/zh-TW.ts`、`mobile/src/i18n/catalogs/en-US.ts`、`frontend/src/utils/caseType.ts`
**最後核驗 Commit**：`4796829`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：已處理
**Owner**：Mobile / Shared
**關聯核心文件**：`20-App端/01-App導航與平台Adapter基線.md`、`50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`

---

## 1. 問題

Backend / shared contract 的 `Case.type` 目前仍是繁中資料值，例如 `生活習慣衝突`、`其他衝突`。Web 已透過 `frontend/src/utils/caseType.ts` 將這些資料值映射到 i18n key，再由 catalog 顯示當前語言。

App 仍有兩個直接顯示資料值的位置：

1. `mobile/app/(public)/quick/result.tsx` 的 quick result meta 使用 `caseItem.type || t('quick.result.meta.unclassified')`。
2. `mobile/app/(app)/case/index.tsx` 的 `labelCaseTitle()` 在沒有 `title` 時 fallback 到 `item.type`。

因此英文 App 使用者可能看到繁中 case type。

## 2. 影響

1. Quick result 的類型欄位不跟隨 App selected locale。
2. Case screen 在 backend title 缺失時會用繁中 case type 作 fallback。
3. Web / App 對同一 `Case.type` 的顯示策略不一致。

## 3. 目標

1. App 建立或復用一個 case type -> i18n key 的映射 helper。
2. `quick/result` 與 `case/index` 顯示 case type 時必須透過 App catalog。
3. 未識別類型使用既有 locale fallback：Quick result 用 `quick.result.meta.unclassified`，Case title fallback 用 `case.titleFallback`。
4. 不改 backend / shared contract 的 `Case.type` 資料值；本輪只修端側顯示。

## 4. 邊界與注意事項

1. 不新增 DB migration；既有資料值保持不變。
2. 不把 Web utility 直接 import 到 App；App 應在 mobile 側建立小型 helper 或抽到 shared 待辦後再復用。
3. 類型映射必須有 zh-TW / en-US catalog key，避免 unknown type 被 humanized。

## 5. 驗收

```bash
npm --prefix mobile test -- src/features/m4/caseTypeLabels.test.js --runInBand
npm --prefix mobile run copy:check
npm --prefix mobile run typecheck
npm run docs:check
```

## 6. 修復紀錄

2026-06-05 已修復：

1. 新增 `mobile/src/features/m4/caseTypeLabels.ts`，將 backend `Case.type` 繁中資料值映射到 App i18n catalog。
2. `mobile/app/(public)/quick/result.tsx` 的類型 meta 改用 `getCaseTypeLabel()`，英文 locale 不再直接顯示繁中 `caseItem.type`。
3. `mobile/app/(app)/case/index.tsx` 的 title fallback 改用本地化 case type label，未知類型仍回 `case.titleFallback`。
4. `mobile/src/i18n/catalogs/zh-TW.ts` / `en-US.ts` 補齊 case type labels，並新增 focused helper test。

本輪已通過：

```bash
npm --prefix mobile test -- src/features/m4/caseTypeLabels.test.js --runInBand
npm --prefix mobile run copy:check
npm --prefix mobile run typecheck
```
