# 接口描述：judgment

**文檔版本**：v2.1  
**最後更新**：2026-03-05  
**代碼基準**：`backend/src/routes/judgment.routes.ts`、`backend/src/utils/validation.ts`、`frontend/src/services/api/judgment.ts`

---

## 模組定位

- 提供判決核心能力：生成、讀取、接受。
- 保留兩條候選擴展：修復回饋、臨床評分回傳。

## 接口契約（字段級）

| API | Request（核心字段） | Success（前端實際用到） | 常見錯誤碼 | 副作用/狀態轉移 | 前端入口 |
|---|---|---|---|---|---|
| `POST /api/v1/judgments/generate/:id` | `id(uuid)` + optional `X-Session-Id` | `data.judgment.id` `plaintiff_ratio/defendant_ratio` | `RATE_LIMIT_EXCEEDED` `CASE_NOT_READY` `AI_CALL_FAILED` | case 進入判決生成流 | `/case/:id/review` |
| `GET /api/v1/judgments/:id` | `id(uuid)` | `data.judgment` | `NOT_FOUND` `FORBIDDEN` | 無 | `/judgment/:id` |
| `POST /api/v1/judgments/:id/accept` | `accepted:boolean` `rating?:0..5` | `data.judgment.accepted` | `VALIDATION_ERROR` `UNAUTHORIZED` | 寫入接受/拒絕結果 | `/judgment/:id` |
| `POST /api/v1/judgments/:id/repair` | `feedback(3..2000)` | 修復後 judgment（若啟用） | `VALIDATION_ERROR` `NOT_FOUND` | 觸發修復流程 | （候選，未接線） |
| `POST /api/v1/judgments/:id/metrics` | `felt_understood/felt_blamed/willing_to_try`（0..10） | 成功旗標或 metrics 記錄 | `VALIDATION_ERROR` | 寫入品質分數 | （候選，未接線） |

## 操作級規則（深水區）

- `generate` 是判決域唯一 `aiLimiter` 接口，回歸需優先覆蓋超頻與重試。
- 前端在 quick 流程多透過 `/cases/:id/judgment` 查判決；`/judgments/:id` 主要用於正式流程詳情頁。
- `repair` / `metrics` 目前為「保留能力」，需維持接口可用但不作前台回歸主路徑。

## 回歸測試最小集

1. submitted case 觸發 generate 成功進入 judgment detail。  
2. accept 流程支持 `accepted=true/false` 兩分支。  
3. `generate` 在限流與 AI 異常時返回可識別錯誤碼。  
4. 候選接口基本健康檢查（schema + auth + 404）保持可用。  

## 錯誤碼覆蓋矩陣（API -> code -> UI 行為）

| API | error.code | HTTP | UI 行為 | 重試策略 |
|---|---|---:|---|---|
| `POST /api/v1/judgments/generate/:id` | `CASE_NOT_READY` | 422 | 提示案件尚未可判決 | 補足前置資料後重試 |
| `POST /api/v1/judgments/generate/:id` | `RATE_LIMIT_EXCEEDED` | 429 | 顯示 AI 生成過頻 | 冷卻後重試 |
| `POST /api/v1/judgments/generate/:id` | `AI_CALL_FAILED` | 503 | 顯示「可重試」並保留頁面狀態 | 人工重試 generate |
| `GET /api/v1/judgments/:id` | `NOT_FOUND` | 404 | 顯示判決不存在/已移除 | 返回來源頁 |
| `GET /api/v1/judgments/:id` | `FORBIDDEN` | 403 | 顯示無權限 | 返回列表或首頁 |
| `POST /api/v1/judgments/:id/accept` | `VALIDATION_ERROR` | 400 | 高亮 `accepted/rating` 字段 | 修正後重送 |
| `POST /api/v1/judgments/:id/accept` | `UNAUTHORIZED` | 401 | 觸發登入恢復流程 | 登入後重送 |
| `POST /api/v1/judgments/:id/repair` | `NOT_FOUND` | 404 | 提示目標判決不存在 | 不重試 |
| `POST /api/v1/judgments/:id/metrics` | `VALIDATION_ERROR` | 400 | 提示評分範圍錯誤 | 修正後重送 |

## 狀態標記

- 已使用：3
- 候選廢棄：2
