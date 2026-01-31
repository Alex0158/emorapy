---
name: "release-health-check"
description: "執行本地/環境發布健康檢查；當需要快速驗證 API、前端與資料庫連通性時觸發。"
---

# Release Health Check

## 目的
一鍵檢查服務是否就緒（後端、前端、DB、環境變數），在部署完成、回歸測試前或疑似服務異常時使用。

## 前置約定
- 開發環境端口：後端 3001、前端 5173、DB 容器 mbc-dev-db、VITE_API_BASE_URL 指向 http://localhost:3001/api/v1。

## 檢查步驟
1. 後端 API 健康：
   - 嘗試請求健康端點或根路徑，觀察 HTTP 狀態與延遲。
2. 前端預覽：
   - 請求首頁或以 HEAD 取得回應行，確認伺服器啟動與狀態。
3. DB 連線：
   - 檢查容器是否存在與端口映射，必要時進一步執行只讀查詢。
4. 環境變數：
   - 比對 VITE_API_BASE_URL 是否符合約定。

## 成功準則
- API 返回 200 或健康 JSON；前端返回 2xx/3xx；DB 容器存在且可查詢；環境變數符合。

## 失敗與修復
- API 超時/拒絕：確認服務進程與端口 3001；檢查健康端點路徑與代理。
- 前端無回應：啟動開發伺服器或排查端口佔用。
- DB 容器不存在：啟動對應 compose 服務並核對端口映射。
- 環境變數不符：修正 .env 或啟動腳本注入並重新載入。

## 執行範例（本地開發）
```bash
set -e
API_BASE="http://localhost:3001/api/v1"
FRONTEND="http://localhost:5173"
DB_CONTAINER="mbc-dev-db"

echo "[API] Checking: $API_BASE/health"
curl -s -S -m 5 -o /dev/null -w "%{http_code}\n" "$API_BASE/health"

echo "[Frontend] Checking: $FRONTEND"
curl -s -S -m 5 -I "$FRONTEND" | head -n 1

echo "[DB] Checking container: $DB_CONTAINER"
docker ps --format '{{.Names}} {{.Ports}}' | grep -q "$DB_CONTAINER" && echo "DB container running" || echo "DB container not running"

echo "[Env] Checking VITE_API_BASE_URL"
test "$VITE_API_BASE_URL" = "$API_BASE" && echo "Env OK" || echo "Env mismatch: $VITE_API_BASE_URL"
```
