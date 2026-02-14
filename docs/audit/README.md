# 審計文件索引（七大原則 / DevSecOps）

本目錄為全區代碼審計產出與後續設計說明。審計範圍：backend/src、frontend/src（生產代碼，不含測試）。

---

## 主要報告

| 文件 | 說明 |
|------|------|
| [audit-20260208-triple-round.md](audit-20260208-triple-round.md) | **最新審計**（2026-02-08）：三輪 audit/improve/add-unit-test/check，綜合合規率 ≈ 92%。 |
| [per-file-audit-20260206.md](per-file-audit-20260206.md) | 逐檔案審計（2026-02-06）：按模組逐檔審計，含 Linter、SOLID、DRY、KISS、Secure、Lean。 |
| [seven-principles-devsecops-20260201.md](seven-principles-devsecops-20260201.md) | 七大原則與 DevSecOps 方法說明、維度定義與評分方式。 |

---

## 執行清單與參考

| 文件 | 說明 |
|------|------|
| [audit-checklist.md](audit-checklist.md) | **審計執行清單**：下次執行全區審計時可依此掃描並產出報告。 |

---

## 後續設計（可選）

| 文件 | 說明 |
|------|------|
| [split-large-services-design-20260206.md](split-large-services-design-20260206.md) | 大檔拆分設計：case.service / ai.service 現狀、觸發條件、可選拆分方案。 |
| [di-design-20260206.md](di-design-20260206.md) | 依賴注入設計：現狀、介面與建構子注入方案。 |
| [quick-experience-deep-dive-20260206.md](quick-experience-deep-dive-20260206.md) | 快速體驗深度審計：代碼梳理、缺口與風險。 |

---

## 繼續

- **例行審計**：依 [audit-checklist.md](audit-checklist.md) 執行 Linter / SOLID / DRY / KISS / Secure / Lean 掃描。
- **當前狀態**：後端 749 測試通過、Linter 0 錯誤；rateLimiter DRY 已完成。
- **歷史引用**：部分報告內提及 [global-audit-20260201](global-audit-20260201.md) 為早期全區審計代稱；若該檔不存在可忽略，結論已收斂於 per-file-audit 與 seven-principles 等報告。
