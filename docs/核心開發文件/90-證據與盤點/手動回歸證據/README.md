# 手動回歸證據

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據索引
**來源時間**：2026-04-18
**上下文**：按日期/P 批次留存的手動回歸結果與摘要
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`bd66c2d`
**最後核驗日期**：`2026-04-18`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本目錄承接手動回歸批次的證據實體、README 與 summary。

本目錄只保存證據，不單獨裁決是否通過發版。

使用規則：

1. 先看 [../../測試/回歸與驗收/發版前手動回歸執行版-2026-03-17.md](../../測試/回歸與驗收/發版前手動回歸執行版-2026-03-17.md)。
2. 再用 `npm run manual-regression:init/check/check:strict/summarize/gate` 判定批次是否完整。
3. 不得因為批次目錄、`record.md` 或 `summary.md` 已存在，就推定該批次已通過。
