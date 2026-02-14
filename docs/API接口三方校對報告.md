# API 接口三方校對報告

**項目**：熊媽媽法庭（Mother Bear Court）  
**校對視角**：DevSecOps（代碼 vs 設計文檔）  
**校對日期**：2026-02-14  
**文檔版本**：v1.0

---

## 1. 校對範圍

- **對照文檔**：`docs/前端設計/08-接口一覽表.md`、`docs/後端設計/03-API設計.md`
- **對照代碼**：`backend/src/app.ts`、`backend/src/routes/*.ts`
- **目的**：確保接口規格與實現一致，標註差異並更新文檔。

---

## 2. 接口實現狀態總覽

| 模塊           | 設計文檔狀態（08 一覽表） | 後端實際狀態 | 備註     |
|----------------|---------------------------|--------------|----------|
| Session 管理   | 部分已開發                | ✅ 已實現    | quick、refresh 均有 |
| 認證           | 待開發                    | ✅ 已實現    | 6 個接口齊全 |
| 用戶           | 待開發                    | ✅ 已實現    | GET/PUT /user/profile + POST /user/avatar |
| 配對           | 待開發                    | ✅ 已實現    | 含 pairing/cancel（文檔未列） |
| 案件           | 部分已開發                | ✅ 已實現    | 含 submit、PUT、DELETE evidence |
| 判決           | 部分已開發                | ✅ 已實現    | 含 judgments/:id/accept |
| 和好方案       | 待開發                    | ✅ 已實現    | 4 個接口齊全 |
| 執行追蹤       | 待開發                    | ✅ 已實現    | 與文檔路徑/語義有差異，見下 |

---

## 3. 與設計文檔的差異

### 3.1 路由與路徑一致

- 前綴：`/api/v1`，與設計一致。
- Session：`POST /sessions/quick`、`POST /sessions/refresh` — 一致。
- Auth：`/auth/register|login|send-verification-code|verify-email|reset-password|reset-password-confirm` — 一致。
- User：`GET/PUT /user/profile`、`POST /user/avatar`（實現多出 avatar，文檔可補）。
- Pairing：`/pairing/create|join|status` — 一致；後端另有 `POST /pairing/cancel`（解除配對），文檔未列。
- Cases：`/cases/quick`、`/cases`、`/cases/by-session`、`/cases/:id`、`/cases/:id/evidence`、`/cases/:id/judgment`、`/cases/:id/submit`、`PUT /cases/:id` — 一致；另有 `DELETE /cases/:id/evidence/:evidenceId`，文檔未列。
- Judgments：`/judgments/generate/:id`、`/judgments/:id`、`/judgments/:id/accept` — 一致。
- Reconciliation：`/judgments/:id/reconciliation-plans`（POST/GET）、`/reconciliation-plans/:id`（GET）、`/reconciliation-plans/:id/select`（POST）— 一致。
- Execution：`POST /execution/confirm`、`POST /execution/checkin`、`GET /execution/dashboard` — 一致。

### 3.2 需文檔同步的差異

| 項目 | 設計文檔（08 / 03） | 後端實現 | 建議 |
|------|---------------------|----------|------|
| 執行記錄 | `GET /api/v1/execution/:planId/records` | 無此路徑；改為 `GET /api/v1/execution/status?plan_id=xxx` 返回執行狀態與記錄 | 將一覽表改為「獲取執行狀態（含記錄）」並寫明 `GET /execution/status?plan_id=` |
| 用戶頭像 | 未列 | `POST /api/v1/user/avatar` | 在 08 一覽表與 03 API 設計中補充 |
| 解除配對 | 未列 | `POST /api/v1/pairing/cancel` | 在 08 一覽表與 03 API 設計中補充 |
| 刪除證據 | 未列 | `DELETE /api/v1/cases/:id/evidence/:evidenceId` | 在 08 一覽表與 03 API 設計中補充 |
| 個人資料雙路徑 | 僅寫 `/user/profile` | 另有 `GET/PUT /api/v1/profile/me`、`/profile/relationship/:pairingId` | 在 03 中說明：對外主要使用 `/user/profile`；`/profile/me` 與 relationship 為擴展用 |

### 3.3 安全與中間件（與 05-中間件和安全 對齊）

- 認證：需登錄接口使用 `authenticate`，與設計一致。
- 快速體驗：`optionalAuthenticate`、`validateSession`（query `session_id` 或 header `X-Session-Id`），與 03 說明一致。
- CORS：`allowedHeaders` 含 `X-Session-Id`，與設計一致。
- 上傳與下載：`/uploads` 使用 `authorizeMedia`，僅允許 GET/HEAD，與安全設計一致。

---

## 4. 前端路由與設計文檔差異（02-路由與頁面結構）

| 項目 | 設計（02） | 前端代碼（router） | 建議 |
|------|------------|---------------------|------|
| 判決結果頁 | `/judgment/:id/result`，組件 `Judgment/Result` | 僅有 `judgment/:id`（Judgment/Detail），無獨立 Result 路由 | 文檔改為「判決結果在 Detail 頁內呈現」，或保留 Result 為 Detail 之別名說明 |
| 500 錯誤頁 | `/500`，組件 `pages/Error` | 無 `/500` 路由，僅 `*` → NotFound | 文檔註明「目前未單獨實現 /500，錯誤由 NotFound 或 ErrorBoundary 處理」 |
| 個人中心路徑 | `/profile/index` | `profile/index`（相對根布局） | 一致 |

---

## 5. 已同步至文檔的修改建議匯總

1. **08-接口一覽表**  
   - 將 Session、認證、用戶、配對、案件、判決、和好方案、執行追蹤的「已實現」接口標為 ✅ 已開發。  
   - 補充：`POST /user/avatar`、`POST /pairing/cancel`、`DELETE /cases/:id/evidence/:evidenceId`。  
   - 將「獲取執行記錄」改為「獲取執行狀態（含記錄）」並對應 `GET /execution/status?plan_id=`。

2. **03-API設計**  
   - 補充：`POST /user/avatar`、`POST /pairing/cancel`、`DELETE /cases/:id/evidence/:evidenceId`。  
   - 執行相關：將 `GET /execution/:planId/records` 改為 `GET /execution/status?plan_id=xxx` 並說明返回含 records。  
   - 可選：簡要說明 `/profile/me`、`/profile/relationship/:pairingId` 與 `/user/profile` 的區分。

3. **02-路由與頁面結構**  
   - 判決：說明「判決結果」由 `Judgment/Detail` 承載，無單獨 `/judgment/:id/result` 路由。  
   - 500：說明當前無獨立 `/500` 頁面，由通用錯誤處理覆蓋。

---

## 6. 版本與後續

- **文檔版本**：設計文檔建議在本次修改後將「最後更新」統一為 2026-02，並在 00-項目總覽 或各文檔末尾增加「變更記錄」條目。
- **後續建議**：  
  - 新接口或變更時先更新 03 與 08，再改代碼。  
  - 自動化：可考慮用 OpenAPI/Swagger 從代碼生成接口清單，與 08 做差異檢查。

### 後續維護檢查清單（接口/路由變更時）

1. 後端新增或修改路由 → 更新 `docs/後端設計/03-API設計.md`、`docs/前端設計/08-接口一覽表.md`、必要時 `docs/功能特性清單.md` 的 API 速查表。
2. 前端新增或修改頁面/路由 → 更新 `docs/前端設計/02-路由與頁面結構設計.md`、08 一覽表之「應用頁面」。
3. 完成變更後可在本報告或 `docs/00-項目總覽.md` 變更記錄中補一筆，便於追蹤。

---

**Confidence**：**high**（已逐條對照後端路由與設計文檔，差異已列出並給出更新建議。）
