# App Native Accessibility 外部證據待補待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：App native accessibility、screen reader、Dynamic Type、VoiceOver / TalkBack 與 platform-level evidence 缺口
**取證代碼入口**：`mobile/app`、`mobile/src/ui/components.test.js`、`mobile/scripts/check-accessibility-contracts.mjs`、`mobile/scripts/check-user-copy-contracts.mjs`、`mobile/package.json`
**最後核驗 Commit**：`23e85ef`
**最後核驗日期**：`2026-05-31`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 現狀

App 已不再只是 Expo route skeleton。`mobile/src/ui/components.test.js` 已覆蓋 shared App UI 的 header role、LinkButton label / hint / role、ActionButton busy / disabled state、48px touch target 與 FeatureRow 合併朗讀 label；`mobile/scripts/check-accessibility-contracts.mjs` 已掃描 `mobile/app/**/*.tsx` 的 `TextInput`，要求 `accessibilityLabel` 與 `accessibilityHint`；`mobile/scripts/check-user-copy-contracts.mjs` 已對 `mobile/app`、`mobile/src/ui`、`mobile/src/features` 的可見文案與 accessibility 屬性做 raw backend / 工程詞禁用檢查。

但上述證據仍屬 RNTL / static / copy contract baseline，不能證明 App 已通過 native screen reader、Dynamic Type、VoiceOver / TalkBack、reduced motion、真機或平台級 accessibility smoke。

## 代碼依據

- `mobile/src/ui/components.test.js`：shared App UI accessibility role / label / hint / state / touch-target contract。
- `mobile/scripts/check-accessibility-contracts.mjs`：App `TextInput` accessibility label / hint static gate。
- `mobile/scripts/check-user-copy-contracts.mjs`：App 可見文案與 accessibility 文案禁用 raw backend / 工程詞 gate。
- `mobile/package.json`：App accessibility / copy checks 只屬本地 static / RNTL gate，未提供 VoiceOver / TalkBack / Dynamic Type / 真機 smoke runner。

## 文件偏差

`04-共用機制/07-可訪問性本地化與內容設計治理基線.md` 曾把 App 現狀寫成「M0 route skeleton」與「無 CJ screen accessibility runtime test」。這低估了現碼已有的 App accessibility / copy baseline；反過來，如果只寫成「App accessibility 已覆蓋」，又會高估 shared UI static gate，混淆 native platform evidence 的缺口。

## 風險

1. Web / Admin A11Y gate 可能被錯用為 App native accessibility 證據。
2. App shared UI / TextInput static gate 可能被誤讀為 VoiceOver、TalkBack 或 Dynamic Type 已驗收。
3. 新增 App screen 時若只補 accessibility props，不補 native smoke / 人工證據，release sign-off 仍缺可追溯依據。

## 目標狀態

1. 保持 `accessibility:check`、`copy:check` 與 shared UI RNTL contract 作為 App 本地工程基線。
2. 建立 App native screen reader / Dynamic Type / VoiceOver / TalkBack / reduced motion / platform smoke 的證據格式與執行入口。
3. `20-App端/`、`50-跨端Mapping與Parity/`、`08-測試規範與驗收/05-可訪問性本地化驗收基線.md` 持續區分 static baseline、native smoke 與 release-grade external evidence。

## 需要修改的文件

- `docs/核心開發文件/20-App端/01-App導航與平台Adapter基線.md`
- `docs/核心開發文件/50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md`
- `docs/核心開發文件/08-測試規範與驗收/05-可訪問性本地化驗收基線.md`
- 必要時新增 App native accessibility evidence runner 或人工證據模板

## 驗證命令

```bash
npm --prefix mobile run accessibility:check
npm --prefix mobile run copy:check
npm run docs:check
```

## Owner / Status

- Owner：App / Accessibility / Cross-platform governance
- Status：待處理
