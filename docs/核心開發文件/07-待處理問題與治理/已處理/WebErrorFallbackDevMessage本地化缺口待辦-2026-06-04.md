# Web ErrorFallback dev message 本地化缺口待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Web ErrorBoundary fallback UI、本機開發版 crash message 顯示與 locale fallback
**取證代碼入口**：`frontend/src/components/common/ErrorFallback.tsx`、`frontend/src/components/common/ErrorFallback/index.tsx`、`frontend/src/components/common/ErrorFallback/index.test.tsx`、`frontend/src/components/common/ErrorBoundary.test.tsx`
**最後核驗 Commit**：`5c8ac1a`
**最後核驗日期**：`2026-06-05`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 問題位置與現象

全局語言排查第四十九輪確認 Web 有兩個 ErrorFallback 變體在 `import.meta.env.DEV` 下顯示 raw `error.message`：

1. `frontend/src/components/common/ErrorFallback.tsx`：`const message = isDev && error?.message ? error.message : t('errorFallback.unknown')`。
2. `frontend/src/components/common/ErrorFallback/index.tsx`：`isDev ? (error?.message || t('error.appCrash')) : t('error.appCrash')`。

本機開發版或測試環境發生 React error boundary 時，UI 會直接顯示 runtime exception message。這些 message 可能是英文診斷、固定繁中或 provider/adapter 原文，不按使用者所選語言顯示。

## 目標改動點與方案

1. ErrorFallback UI 不再因 DEV 顯示 raw `error.message`。
2. root `ErrorFallback.tsx` 使用既有 `errorFallback.unknown`。
3. folder `ErrorFallback/index.tsx` 使用既有 `error.appCrash`。
4. 保留 `ErrorBoundary.componentDidCatch()` logger 中的 error message，因該路徑是開發/診斷記錄，不是 UI 文案。

## 影響範圍與邊界

- Web：React ErrorBoundary fallback UI 與 standalone ErrorFallback tests。
- 不改：logger 診斷、Sentry placeholder、reset/reload/back-home 操作、layout。
- UX：本機開發版與 production 一樣顯示 locale catalog fallback，避免 UI 混語。

## 驗證方式

- `npm --prefix frontend test -- src/components/common/ErrorBoundary.test.tsx src/components/common/ErrorFallback/index.test.tsx src/assets/i18n/catalogParity.test.ts`
- `npm --prefix frontend run build`
- `npm run docs:check`

## Owner / Status Notes

- Owner：agent
- Status：已處理並歸檔。後續若需開發診斷詳情，應放在 logger/devtools，不放入使用者可見 fallback UI。

## 2026-06-04 本輪結果

1. `frontend/src/components/common/ErrorFallback.tsx` 已移除 DEV raw `error.message` UI 顯示，統一顯示 `errorFallback.unknown` catalog fallback。
2. `frontend/src/components/common/ErrorFallback/index.tsx` 已移除 DEV raw `error.message` UI 顯示，統一顯示 `error.appCrash` catalog fallback。
3. `frontend/src/components/common/ErrorBoundary.test.tsx` 已補實際 ErrorBoundary fallback 不顯示 `Test error` 的回歸斷言；`frontend/src/components/common/ErrorFallback/index.test.tsx` 已補不顯示 `自定義錯誤` 的回歸斷言。
4. 已驗證：`npm --prefix frontend test -- src/components/common/ErrorBoundary.test.tsx src/components/common/ErrorFallback/index.test.tsx src/assets/i18n/catalogParity.test.ts` 通過 3 files / 12 tests；`npm --prefix frontend run build` 通過；`npm run docs:check` 通過。

## 2026-06-05 歸檔復核

1. 復核現碼確認 root 與 folder 兩個 ErrorFallback UI 均不讀 `error.message` 作可見 fallback。
2. 復核 regression tests 確認 ErrorBoundary fallback 不顯示 `Test error`，ErrorFallback 不顯示 `自定義錯誤`。
3. 已驗證：`npm --prefix frontend test -- src/components/common/ErrorBoundary.test.tsx src/components/common/ErrorFallback/index.test.tsx src/assets/i18n/catalogParity.test.ts` 通過 3 files / 12 tests；`npm --prefix frontend run build` 通過。
