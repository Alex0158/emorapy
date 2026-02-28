# Ops 告警 Runbook

## 1) 告警範圍

本 runbook 補齊以下 P1 告警：

- `health.lock` 進入 degraded/unhealthy
- API `5xx` 異常比例過高
- API `409(CONFLICT)` 異常比例過高

## 2) 指標來源

- `GET /health`：讀取 `checks.lock.status`
- Redis minute buckets（由後端中介層寫入）：
  - key: `ops:metrics:http:minute:YYYYMMDDHHmm`
  - fields: `total`, `status5xx`, `status409`

## 3) 告警檢查腳本

於 `backend/` 執行：

```bash
API_BASE_URL=https://<your-backend-domain> \
REDIS_URL=redis://... \
ALERT_LOOKBACK_MINUTES=15 \
ALERT_MAX_5XX_RATIO=0.05 \
ALERT_MAX_CONFLICT_RATIO=0.20 \
npm run ops:alerts:check
```

預設行為：

- 輸出 JSON 報告到 `./tmp/bench-reports/ops-alert-check.json`
- `exit 0`：無 alert
- `exit 2`：有 alert（可用於 CI / scheduler fail）
- `exit 1`：腳本本身執行錯誤

Slack 通知（可選）：

```bash
ALERT_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/... \
ALERT_SLACK_DEDUP_WINDOW_SECONDS=600 \
npm run ops:alerts:check
```

- 有 `alert` 時會推送 Slack
- 同一組告警名稱會在 dedup 視窗內抑制重複通知（預設 10 分鐘）

## 4) Railway 觸發建議

可用以下任一方式：

- Railway scheduler / cron job 定時執行此腳本
- 外部監控（GitHub Actions / cron service）定時跑腳本並發通知

建議頻率：每 5 分鐘。

補充：後端內建排程 `ops_alerts_check` 也會每 5 分鐘執行同樣檢查（需啟用 scheduled jobs）。

## 5) 建議門檻（可調）

- `ALERT_MAX_5XX_RATIO=0.05`（15 分鐘窗口）
- `ALERT_MAX_CONFLICT_RATIO=0.20`（15 分鐘窗口）
- `ALERT_MIN_SAMPLES=30`（樣本不足只警示，不觸發 hard alert）
- `ALERT_SLACK_DEDUP_WINDOW_SECONDS=600`（避免短時風暴洗版）

## 6) 告警處置

### `health.lock` degraded

1. 立即確認 `REDIS_URL` 是否可連線  
2. 檢查後端 log 是否退回 simple-lock  
3. 修復 Redis 連線後重跑檢查

### `5xx ratio` 超標

1. 看同時間段 error log top 3 錯誤  
2. 檢查 DB/Redis 可用性與超時  
3. 必要時先降流量或暫停高風險工作

### `409 ratio` 超標

1. 判斷是否新功能鎖衝突回歸  
2. 交叉檢查 invite/judgment 併發場景  
3. 若為預期熱點，調整重試策略與前端提示
