# 成本監控看板（P2）

## 1) 看板目標

用同一個週視角追蹤三類成本：

- Redis：記憶體與連線使用
- Railway：流量 egress 與服務資源
- OpenAI：模型 token 與估算費用

## 2) 指標清單

### Redis

- used memory
- connected clients
- key count（可選）
- eviction/rejected connections（可選）

### Railway

- egress（GB）
- service RAM/CPU 使用趨勢
- 每服務月度成本

### OpenAI

- prompt/completion token（按日）
- 各模型費用估算
- 單請求平均成本（可選）

## 3) 採集方式（已落地）

- 後端 API：`GET /api/v1/admin/reports/costs`
- Redis：用 `REDIS_URL` 讀取 `INFO memory/clients` + `dbsize`
- Railway：`RAILWAY_API_TOKEN + RAILWAY_PROJECT_ID` 呼叫 Railway API 取 egress
- OpenAI：`OPENAI_BILLING_API_KEY`（若未設，退回 `OPENAI_API_KEY`）呼叫 usage/cost API 取實際成本與 tokens
- 容錯策略：任一來源失敗時回 `partial=true` + `reasons[]`

## 4) 建議資料表/報告節奏

- 日聚合（daily snapshot）
- 週報（7d rolling）
- 月報（billing cycle）

## 5) 告警建議

- Redis 記憶體連續 30 分鐘 > 80%
- Railway egress 超過月預算 70% / 90%
- OpenAI 日成本超過日預算 120%

## 6) 前端呈現

- 管理端 `Reports` 已新增成本區塊：
  - 24h / 7d OpenAI 成本
  - 24h Railway egress
  - Redis memory / key 使用
  - daily trend 原始資料（egress / cost）與來源狀態
