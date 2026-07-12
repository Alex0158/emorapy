# 證據與盤點

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據索引
**來源時間**：2026-04-18
**上下文**：非現行 SSOT；僅作證據留存
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`e65a4b8`
**最後核驗日期**：`2026-07-12`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本目錄承接仍需保留在 `核心開發文件/` 主目錄中的附錄、證據與對賬材料。

它不是正式正文入口，而是正式正文的證據與附錄層。

即使本目錄中的某份證據與當前正文內容高度相似，也不得反向升格成正式規格；若證據裡有穩定真相，應回寫到對應正式子域。

## Emorapy 命名與歷史證據 provenance

`Emorapy` 是當前正式產品名與 App release identity。本目錄既有證據中出現的 `CJ`、`Mother Bear Court`、`mother-bear-court`、`cj-mobile`、`com.cj.motherbearcourt`、`CJ Platform` 或 `@cj/*`，只代表證據產生當時的快照、legacy infrastructure identifier 或歷史別名，不代表當前正式命名、App Store metadata、Bundle ID、Android package、EAS project、package scope 或用戶可見文案。

歷史證據原文不得為了命名收斂而機械改寫；若某份舊證據需要重新作為 release / TestFlight / App Store submission 依據，必須以當前 Emorapy identity 重新產生新證據，而不是修改舊 artifact。後續新增的 release evidence、external status / handoff、EAS artifact、TestFlight evidence、physical-device smoke、push provider delivery 與 native crash runtime evidence，必須使用 Emorapy 命名與 `com.emorapy.app` / `emorapy-mobile` 等 current identifiers。

## 固定保留入口

1. [AI流式驗證/README.md](./AI流式驗證/README.md)
2. [環境與發版驗證/README.md](./環境與發版驗證/README.md)
3. [頁面HTML快照/README.md](./頁面HTML快照/README.md)
4. [手動回歸證據/README.md](./手動回歸證據/README.md)
5. [環境與發版驗證/App-External-Evidence-Status-2026-05-29T17-17-48-569Z.json](./環境與發版驗證/App-External-Evidence-Status-2026-05-29T17-17-48-569Z.json)
6. [環境與發版驗證/App-External-Evidence-Handoff-2026-05-29T17-17-57-273Z.json](./環境與發版驗證/App-External-Evidence-Handoff-2026-05-29T17-17-57-273Z.json)
7. [設計驗收/design-qa.md](./設計驗收/design-qa.md)

## 固定保留理由

1. `AI流式驗證/`：保留 AI Stream 與 replay/snapshot/heartbeat 驗收證據。
2. `環境與發版驗證/`：保留真 DB、staging、smoke 與高風險抽檢輸出。
3. `頁面HTML快照/`：保留一批可回看的靜態頁面導出與 `manifest.json`。
4. `手動回歸證據/`：保留按日期與 `P01-P05` 分批的手動回歸實體證據。
5. `設計驗收/`：保留 Product Design source / implementation 同畫面比較、responsive 與代表性互動證據；只證明文件寫明的 scoped UI state，不替代 true-service / production sign-off。

## 使用順序

1. 先看 `核心開發文件/` 正式正文
2. 若正文需要核驗或對賬，再進本目錄對應入口
3. 若該入口仍無法回答，再進 `99-歷史降級索引/`
4. 手動回歸是否真正完成，以 `npm run manual-regression:check` / `check:strict` 為準，不以目錄是否存在為準

不要反過來做：不要先讀本目錄，再反推正式規格。

## App 證據口徑

目前 `頁面HTML快照/` 與既有手動回歸證據主要覆蓋 Web 前台與 Admin Web。它們不能被解讀為 App 版 navigation、Deep Link、SecureStore、Push、upload adapter 或 App 原生回歸已完成。

若 App 開始替換 Expo 模板、接入平台 adapter 或新增 App smoke / regression 證據，必須先回到：

1. [../20-App端/01-App導航與平台Adapter基線.md](../20-App端/01-App導航與平台Adapter基線.md)
2. [../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md](../50-跨端Mapping與Parity/01-App首輪能力與工程落點Mapping.md)
3. [../08-測試規範與驗收/03-App測試與證據接入基線.md](../08-測試規範與驗收/03-App測試與證據接入基線.md)
4. [../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md](../07-待處理問題與治理/待處理/App跨端Parity落地待辦-2026-05-05.md)

App 證據應證明對應 platform adapter、API / DB / shared package 影響已閉環；若只證明某個 screen 可以啟動，不能升格為跨端 Parity 完成。
