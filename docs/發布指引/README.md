# 發布指引

本資料夾集中存放**部署與發布**相關文檔，便於查找與維護。**無重複**：平台操作在此，後端細則與可選 Gate 在 `docs/backend/`。

---

## 本目錄文件一覽

| 文件 | 說明 |
|------|------|
| [發佈流程指引.md](./發佈流程指引.md) | **總覽**：發佈前檢查、建議順序、部署後驗證、回滾、發佈清單；並說明與其他文檔的關係 |
| [Vercel-發布指引.md](./Vercel-發布指引.md) | 前端：客戶端與管理端在 Vercel 的手動／自動發布步驟 |
| [Railway-發布指引.md](./Railway-發布指引.md) | 後端：在 Railway 的手動發布（`railway up`）與 Git 接法；環境變數完整清單見 backend/DEPLOYMENT |

---

## 快速對照（只做發布時）

- **前端客戶端**：repo 根目錄執行 `vercel --prod` → 見 [Vercel-發布指引](./Vercel-發布指引.md)
- **前端管理端**：`frontend-admin/` 執行 `vercel --prod` → 見 [Vercel-發布指引](./Vercel-發布指引.md)
- **後端**：repo 根目錄執行 `railway up` → 見 [Railway-發布指引](./Railway-發布指引.md)

---

## 相關文檔（不重複、不衝突）

| 文檔 | 用途 |
|------|------|
| [docs/backend/DEPLOYMENT.md](../backend/DEPLOYMENT.md) | 後端環境變數完整清單、遷移、監控、Docker/PM2 等細則；**權威來源**，Railway 指引只引用不重列。 |
| [docs/backend/STAGING_TO_PRODUCTION_FLOW.md](../backend/STAGING_TO_PRODUCTION_FLOW.md) | 可選的嚴格 Staging→Production gate（有 staging 時使用）；無 staging 時僅依本目錄發佈流程即可。 |
