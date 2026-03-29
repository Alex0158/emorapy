# Vercel 發布指引

**文檔版本**：v1.0  
**最後更新**：2026-03-07  
**適用**：前端客戶端（Emorapy）與管理端（frontend-admin）的 Vercel 部署。

---

## 1. 架構概覽

本專案在 Vercel 上為**兩個獨立專案**，分別對應兩個前端應用：

| 端 | Vercel 專案名稱 | 程式目錄 | Production 網址（範例） |
|----|-----------------|----------|---------------------------|
| **客戶端**（Emorapy 用戶端） | `mother-bear-court` | `frontend/` | `https://mother-bear-court.vercel.app` |
| **管理端**（運維／管理後台） | `frontend-admin` | `frontend-admin/` | `https://frontend-admin-sigma-virid.vercel.app` |

- 客戶端與管理端**分開發布**，各自有獨立的部署紀錄與 Production 網址。
- 根目錄的 `vercel.json` 為早期設定，實際部署以「從哪個目錄執行 CLI」或 Vercel 專案設定的 **Root Directory** 為準。

---

## 2. 前置需求

- 已安裝 [Vercel CLI](https://vercel.com/docs/cli)：`npm i -g vercel`
- 本機已登入 Vercel：執行 `vercel login`（若尚未登入）
- 程式已更新到要發布的版本（例如已 `git pull` 或本地改動已 commit）

---

## 3. 手動發布（CLI）

### 3.1 發布客戶端（Emorapy）

從 **repo 根目錄** 部署，會對應到 Vercel 專案 `mother-bear-court`（專案若已設 Root Directory 為 `frontend`，則會建置客戶端）：

```bash
cd /path/to/mother-bear-court
vercel --prod
```

- 預覽部署（不更新 Production）：改為 `vercel`（不加 `--prod`）。
- 若專案尚未連結，CLI 會提示選擇或建立 Vercel 專案，請選擇 **mother-bear-court**，並確認 Root Directory 為 **frontend**。

### 3.2 發布管理端（frontend-admin）

從 **frontend-admin 目錄** 部署，會對應到 Vercel 專案 `frontend-admin`：

```bash
cd /path/to/mother-bear-court/frontend-admin
vercel --prod
```

- 預覽：`vercel`（不加 `--prod`）。
- 若尚未連結，選擇 **frontend-admin** 專案。

### 3.3 常用指令

| 指令 | 說明 |
|------|------|
| `vercel` | 預覽部署（產生預覽 URL，不影響 Production） |
| `vercel --prod` | 正式部署並更新 Production 網址 |
| `vercel ls` | 列出該專案近期部署（需在已 link 的目錄下執行） |
| `vercel inspect <deployment-url>` | 查看某次部署詳情 |
| `vercel logs <deployment-url>` | 查看該次部署的日誌 |

---

## 4. Vercel 專案設定建議

在 Vercel Dashboard 中，建議每個專案設定如下：

### 4.1 客戶端（mother-bear-court）

- **Root Directory**：`frontend`
- **Framework Preset**：Vite
- **Build Command**：依 `frontend/vercel.json` 或預設即可（如 `npm run build`）
- **Output Directory**：`dist`
- **Install Command**：`npm install` 或 `npm install --include=dev`

### 4.2 管理端（frontend-admin）

- **Root Directory**：`frontend-admin`
- **Framework Preset**：Vite
- **Build Command**：依 `frontend-admin/vercel.json`（如 `npm run build`）
- **Output Directory**：`dist`
- **Install Command**：`npm install` 或 `npm install --include=dev`

### 4.3 環境變數

- 客戶端：在 Vercel 專案 **Settings → Environment Variables** 設定（例如 `VITE_API_BASE_URL`、`VITE_ADMIN_LOGIN_URL` 等）。
- 管理端：同上，設定管理端所需變數（如 `VITE_API_BASE_URL`）。若需 Header 版本面板顯示客戶端版本，另設 `VITE_FRONTEND_BASE_URL`（客戶端 Production 網址，如 `https://mother-bear-court.vercel.app`）。
- **Railway 後端**：請確認 `ALLOWED_ORIGINS` 已包含客戶端 Production 網址（如 `https://mother-bear-court.vercel.app`），否則會出現 CORS 403／「網絡連接失敗」。

---

## 5. 接 Git 自動部署（可選）

若希望 **git push 後自動發布**：

1. 在 Vercel Dashboard 進入對應專案（mother-bear-court 或 frontend-admin）。
2. 點 **Connect Git Repository**，選擇 GitHub 上的 `mother-bear-court` 倉庫。
3. 設定 **Root Directory**：
   - 客戶端專案：`frontend`
   - 管理端專案：`frontend-admin`
4. 儲存後，推送到所選分支（如 `main`）會觸發該專案的自動建置與部署。

注意：同一倉庫可同時連接兩個 Vercel 專案，只要 Root Directory 不同即可。

---

## 6. 與 repo 設定的對應關係

| 檔案 | 用途說明 |
|------|----------|
| `vercel.json`（根目錄） | 早期單一專案用，建置 frontend-admin；目前若從根目錄 deploy 且專案設為 frontend，則以專案設定為準。 |
| `frontend/vercel.json` | 客戶端 SPA：rewrites 指向 `/index.html`、靜態資源 Cache-Control。 |
| `frontend-admin/vercel.json` | 管理端 SPA：同上。 |
| `package.json`（根目錄） | `vercel-build` 僅建 frontend-admin；客戶端建置由 `frontend/` 內建置腳本負責。 |

---

## 7. 發布後檢查

- **客戶端**：開啟 `https://mother-bear-court.vercel.app`，確認首頁、登入、主要流程正常。
- **管理端**：開啟管理端 Production 網址，確認登入與權限正常。
- 若有設定部署驗證腳本，可一併執行（見 [發佈流程指引.md](./發佈流程指引.md)）。

---

## 8. 常見狀況

- **部署狀態為 Error**：在 Vercel Dashboard 點進該次部署 → **Building** 或 **Logs** 查看錯誤訊息；常見為依賴、Node 版本或環境變數未設。
- **本機 CLI 與 Dashboard 專案不一致**：在對應目錄執行 `vercel link` 重新選擇專案與 scope。
- **要同時更新兩端**：需分別在「根目錄（或 frontend）」與「frontend-admin」各執行一次 `vercel --prod`（或透過 Git 連接兩專案後 push 一次即可觸發兩邊建置）。
