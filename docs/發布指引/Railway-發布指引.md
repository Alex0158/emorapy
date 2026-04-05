# Railway 發布指引（後端）

**文檔版本**：v1.1  
**最後更新**：2026-04-05  
**適用**：後端（backend）單一服務，同時服務客戶端與管理端 API。

---

## 1. 架構概覽

- **一個後端**：`backend/`，單一 Express 應用，部署在 Railway 的**一個服務**上。
- **Vercel 前端**：客戶端與管理端兩個專案都透過 `VITE_API_BASE_URL` 指向此後端的 Production 網址。
- **Railway 專案／服務**（依目前連結為準）：
  - **專案**：ingenious-commitment
  - **服務名稱**：mother-bear-court

---

## 2. 前置需求

- 已安裝 [Railway CLI](https://docs.railway.com/develop/cli)：`npm i -g @railway/cli` 或 `brew install railway`
- 本機已登入：`railway login`
- 本機已連結到正確專案與服務：在 **repo 根目錄** 執行 `railway link`，選擇對應的 Project 與 Service（若尚未連結）
- 程式已更新到要發布的版本（如已 `git pull`）

---

## 3. 手動發布（CLI）

> 若目標是 `staging`，且倉庫已配置 GitHub Actions secrets，現在更推薦直接使用 `Staging Deploy and Smoke` workflow。它會先部署 staging，再自動跑 smoke，避免漏掉後續驗證。手動 `railway up` 保留給本機緊急部署或需要 CLI 直控的場景。

### 3.1 從 repo 根目錄部署

建置與啟動指令由**根目錄**的 `railway.json` 定義（`cd backend && ...`），因此必須在 **mother-bear-court 根目錄** 執行：

```bash
cd /path/to/mother-bear-court
railway up
```

- `railway up` 會將目前目錄內容上傳並觸發 Railway 的建置與部署。
- 完成後終端會輸出 **Build Logs** 連結，可到 Railway Dashboard 查看建置與運行日誌。

### 3.2 常用指令

| 指令 | 說明 |
|------|------|
| `railway status` | 顯示目前連結的 Project、Environment、Service |
| `railway up` | 上傳並觸發部署（使用目前連結的服務） |
| `railway logs` | 串流查看服務日誌（可加 `--limit N`） |
| `railway variables` | 列出該服務的環境變數（名稱，不顯示值） |
| `railway link` | 重新選擇 Project / Service 連結 |

### 3.3 staging 推薦操作

對 `staging`：

1. 優先進 GitHub Actions 執行 `Staging Deploy and Smoke`
2. 若只需重跑驗證、不需重新部署，再執行 `Staging Smoke Gate`
3. 若 `Staging Deploy and Smoke` 卡在 `railway link` / token 授權，先修正 GitHub secret `RAILWAY_API_TOKEN`
4. 在 CI token 尚未修正前，才使用本機已登入 Railway CLI 直接 `railway up` 作為臨時 fallback

### 3.4 確認部署結果

- 在終端輸出的 **Build Logs** 連結中確認建置為 Success。
- 在 Railway Dashboard → 該 Service → **Deployments** 查看最新部署狀態。
- 部署成功後，後端服務會重啟，客戶端與管理端即可使用最新 API。

---

## 4. Railway 專案／服務設定

### 4.1 建置與啟動（根目錄 railway.json）

目前由 **repo 根目錄** 的 `railway.json` 定義：

- **Build**：`cd backend && npm ci && npm run build:prod`
- **Start**：`cd backend && npm start`
- **Restart**：ON_FAILURE，最多重試 10 次

因此 Railway 的 **Root Directory** 應為 repo 根目錄（或保持預設），不要設成 `backend`，否則 `cd backend` 會失敗。

### 4.2 環境變數

在 Railway Dashboard → 該 Service → **Variables** 設定。**必要項**至少包含：

- `DATABASE_URL`、`JWT_SECRET`、`ADMIN_JWT_SECRET`、`OPENAI_API_KEY`
- `FRONTEND_URL`、`ALLOWED_ORIGINS`（須含客戶端與管理端網域）

**完整清單、可選變數、遷移與監控**請以 [docs/backend/DEPLOYMENT.md](../backend/DEPLOYMENT.md) 為準，避免與本指引重複或不同步。  
若需啟用註冊／忘記密碼等郵件，可依 [Resend-郵件配置.md](./Resend-郵件配置.md) 設定 Resend 並在 Variables 中加入 `SMTP_*` 與 `EMAIL_FROM`。

### 4.3 backend/railway.toml

`backend/railway.toml` 為**後端子目錄**的參考設定（buildCommand 為 `npm ci && npm run build`、start 為 `npm start`）。若未來改為以 **backend** 為 Railway 的 Root Directory，則會以該 toml 為準；目前以**根目錄**部署時，以**根目錄 railway.json** 為準。

---

## 5. 接 Git 自動部署（可選）

若希望 **git push 後自動部署**：

1. 在 Railway Dashboard 進入該專案與 Service。
2. 在 **Settings** 中連接 **GitHub** 倉庫（如 `mother-bear-court`）。
3. 設定 **Root Directory** 為 repo 根目錄（空白或 `/`），以配合根目錄的 `railway.json`。
4. 設定要觸發部署的**分支**（如 `main`）。

之後推送到該分支會自動觸發 Railway 建置與部署。

---

## 6. 與發佈流程的關係

- 整體發佈順序見 [發佈流程指引.md](./發佈流程指引.md)（發佈前檢查 → 前端 Vercel → 後端 Railway → 驗證）。
- 前端發布步驟見 [Vercel-發布指引.md](./Vercel-發布指引.md)。
- 後端發布完成後，請依發佈流程指引執行 **部署後驗證**（如 `verify-deployment.sh`、手動抽測）。

---

## 7. 常見狀況

- **建置失敗**：在 Build Logs 中查看錯誤；常見為依賴、Node 版本或缺少環境變數。根目錄部署時請確認 `railway.json` 的 `cd backend` 路徑正確。
- **本機未連結或連結錯誤**：在 repo 根目錄執行 `railway link`，選擇正確的 Project 與 Service。
- **要確認目前連結**：執行 `railway status`。
- **GitHub Actions deploy 卡在 `railway link`**：優先檢查 `RAILWAY_API_TOKEN` secret 是否為真正可供 CI 使用的 Railway token；本機 CLI 的登入狀態或被 redacted 的 config 值不能直接當成 CI secret 使用。
