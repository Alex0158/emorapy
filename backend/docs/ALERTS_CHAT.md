# Chat 指標與告警示例（Prometheus）

已暴露的指標（/metrics）：
- `chat_messages_total`：訊息數
- `chat_rate_limit_hits_total`：房級限流命中
- `chat_ai_trigger_total{strategy}`：AI 觸發（support/mediation）
- `chat_safety_hits_total`：安全/危機命中
- `chat_judgment_total{result}`：判決成功/失敗

示例告警規則（PromQL）：

```yaml
- alert: ChatSafetySpike
  expr: increase(chat_safety_hits_total[5m]) > 5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Chat 安全命中異常上升"
    description: "5 分鐘內安全命中 {{ $value }} 次"

- alert: ChatJudgmentFailureRateHigh
  expr: rate(chat_judgment_total{result="failed"}[10m]) / rate(chat_judgment_total[10m]) > 0.03
  for: 10m
  labels:
    severity: critical
  annotations:
    summary: "聊天室判決失敗率過高"
    description: "10 分鐘內失敗率超過 3%"

- alert: ChatRateLimitFlood
  expr: increase(chat_rate_limit_hits_total[5m]) > 20
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "聊天室限流觸發頻繁"
    description: "5 分鐘內限流命中 {{ $value }} 次，可能出現刷屏或濫用"
```

部署提示：
- 確保 /metrics 端點在內網暴露並被 Prometheus 抓取。
- 若需分房間粒度，可在後續指標加入 roomId 標籤（當前為總計）。 

規則檔案：
- `backend/ops/prometheus/chat-alerts.rules.yml` 可直接納入 Prometheus rule_files 或對應的告警管理系統。
