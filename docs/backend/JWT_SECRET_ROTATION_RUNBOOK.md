# JWT Secret Rotation Runbook

## 1) 目的

修復 JWT 配置污染（`JWT_SECRET` 混入多行內容）並安全輪替，避免一次性讓所有已登入用戶被迫登出。

本 runbook 以「先相容、後收斂」為原則：

1. 先上雙密鑰驗證（`JWT_SECRET` + `JWT_SECRET_PREVIOUS`）
2. 完成 staging -> production 驗證
3. 觀察一個 token 週期後關窗（移除 `JWT_SECRET_PREVIOUS`）

## 2) 適用範圍

- 服務：`mother-bear-court`（Railway）
- 環境：`staging`、`production`
- 相關程式：
  - `backend/src/config/env.ts`
  - `backend/src/utils/jwt.ts`

## 3) 安全規則（已在程式層落地）

- 生產環境必須顯式設定 `JWT_EXPIRES_IN`
- 生產環境 `JWT_SECRET` 不得包含換行
- 生產環境 `JWT_SECRET` 不得包含 `KEY=VALUE` 片段污染
- token 驗證時先試主密鑰，再試舊密鑰

## 4) 執行前檢查

先確認變數狀態（只看形狀，不輸出敏感值）：

```bash
railway variables list -s mother-bear-court -e production --json
```

至少需確認：

- `JWT_SECRET` 存在且為單行
- `JWT_EXPIRES_IN` 存在（建議 `7d`）
- 過渡期才保留 `JWT_SECRET_PREVIOUS`

## 5) 分階段輪替步驟

### A. staging（先行）

1. 設定新主密鑰與過渡舊密鑰
2. 設定 `JWT_EXPIRES_IN`
3. 部署 staging 並驗證

### B. production（同版）

1. 套用同樣變數策略
2. 以同版部署 production
3. 完成健康檢查與登入/授權抽測

建議命令（注意：`JWT_SECRET` / `JWT_SECRET_PREVIOUS` 用 `--stdin` 避免出現在 shell 歷史）：

```bash
railway variable set -s mother-bear-court -e staging --stdin JWT_SECRET
railway variable set -s mother-bear-court -e staging --stdin JWT_SECRET_PREVIOUS
railway variable set -s mother-bear-court -e staging JWT_EXPIRES_IN=7d

railway variable set -s mother-bear-court -e production --stdin JWT_SECRET
railway variable set -s mother-bear-court -e production --stdin JWT_SECRET_PREVIOUS
railway variable set -s mother-bear-court -e production JWT_EXPIRES_IN=7d
```

## 6) 驗證清單

### 健康檢查

由於 CORS 設定，外部探測建議帶允許來源：

```bash
curl -H "Origin: https://frontend-lilac-three-52.vercel.app" \
  https://mother-bear-court-production.up.railway.app/health
```

預期：`status=healthy`，且 lock backend 為 healthy。

### 過渡驗證（舊 token 可驗證）

在服務環境內，使用 `JWT_SECRET_PREVIOUS` 簽 token 並驗證應成功。  
（本次輪替已完成此步驟。）

## 7) 關窗（移除舊密鑰）

### 觸發條件

- 至少經過一個 token 週期（例如 `7d`）
- 觀察期內無舊 token 驗證失敗潮
- staging 已演練關窗且可回滾

### 操作命令

```bash
railway variable delete -s mother-bear-court -e production JWT_SECRET_PREVIOUS
```

### 關窗後立即驗證

- `/health` 正常
- 新登入可用
- 主要受保護 API（如 `/api/v1/admin/me`）可正常授權

## 8) 回滾方案

若關窗後出現大量授權失敗，立即回補：

```bash
railway variable set -s mother-bear-court -e production --stdin JWT_SECRET_PREVIOUS
```

回補後再觀察並重新安排關窗窗口。

## 9) 稽核留檔建議

每次輪替建議至少保留：

- 變更時間（started_at / remove_after）
- 執行者
- commit SHA / deployment ID
- 健康檢查與抽測結果
- 是否觸發回滾

## 10) 角色分工（建議）

- **Operator**：執行變數更新、部署、驗證與關窗
- **Reviewer**：確認風險、批准進入 production 與關窗
- **On-call**：關窗後 24 小時內監看授權異常與回滾決策
