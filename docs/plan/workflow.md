# 工作流計劃（Develop → Improve → i18n → Test → Audit → Check）

## 任務目標
- 以 Trae Skills 驅動端到端流程，提升品質與可維護性
- 當前焦點：前端 QuickExperience/Result 頁的結構化拆分與驗證

## 子任務與品質關卡
- develop：分解任務、列出風險與 Quality Gates（測試、審計、文檔）
- improve：小步拆分頁面（標題/摘要/責任分比例/判決書/證據上傳/操作/註冊提示）
- i18n（translate/add-translation/add-dict）：掃描中文文本，生成鍵值提案與標準詞庫增補
- add-unit-test：優先覆蓋工具/純函式與關鍵組件
- test-unit：運行單元測試並匯總覆蓋率
- audit：檢查 SOLID/DRY/KISS + DevSecOps，量化分數並提出修復
- check：更新文檔與修改記錄，確保同步

## 風險與回退
- 嚴禁硬編碼憑證；對安全中介（Helmet/CORS/限流）僅優化不移除
- 每步可回退（保留補丁），保持行為不變

## 輸出
- 分拆改動清單 + 驗證連結（本地預覽）
- i18n 鍵值提案與字典增補
- 測試增補與（可行時）覆蓋率摘要
- 審計報告與建議
