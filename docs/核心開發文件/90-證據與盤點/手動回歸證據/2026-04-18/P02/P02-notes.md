# P02 補充證據筆記

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據文檔
**來源時間**：2026-04-18
**上下文**：按日期/P 批次留存的手動回歸結果與摘要
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`bd66c2d`
**最後核驗日期**：`2026-04-18`
<!-- CORE_DOC_AUDIT_METADATA:END -->

- 日期：2026-04-18
- 判定：PASS（已修復重驗）
- 定位：補充 `record.md` 無法承載的 API / DB / 代碼級證據

## 初始失敗取證（保留）

- 初始失敗案例：`a1c68225-c379-4b31-a4ad-1f282cfbb953`
- 當時症狀：
  - `GET /api/v1/cases/:id`：雙方均 `403`
  - `GET /api/v1/cases/:id/judgment`：雙方均 `403`
- 但該案件落庫資料正確：
  - `mode = collaborative`
  - `session_id = null`
  - `plaintiff_id / defendant_id` 已正確對應配對雙方
- 初始裁決為 FAIL（原因：full-mode collaborative 權限模型與 session-only 判斷衝突）

## 代碼根因與修復

- 原缺陷位置：
  - `backend/src/services/case.service.ts` 的 `getCaseById()`
  - `backend/src/services/judgment.service.ts` 的 `getJudgmentByCaseId()`
- 原行為：把 `CASE_MODE.COLLABORATIVE` 一律視為 session-only。
- 修復行為：新增 `isSessionBoundCase` 規則，僅在以下情況走 session 校驗：
  - `mode = quick`
  - `mode = collaborative` 且 `session_id` 有值
- 對於 `collaborative + session_id = null` 的 full-mode 正式案件，改為走當事人 `userId` 授權（plaintiff/defendant）。

### 對應單元測試

- `backend/tests/unit/services/case.service.test.ts`
  - `collaborative full-mode（無 session_id）應允許以當事人 userId 讀取案件`
- `backend/tests/unit/services/judgment.service.test.ts`
  - `collaborative full-mode（無 session_id）應允許當事人以 userId 讀取判決`
  - `collaborative full-mode（無 session_id）非當事人應 FORBIDDEN`

## 修復後重驗（API）

### 第 1 輪：舊失敗案例重驗

- 目標案件：`a1c68225-c379-4b31-a4ad-1f282cfbb953`
- 登錄帳號：`boyfriend@test.com`、`girlfriend@test.com`
- 結果：
  - 雙方 `GET /api/v1/cases/:id` 均為 `200`
  - 雙方 `GET /api/v1/cases/:id/judgment` 均為 `202`（`JUDGMENT_PENDING`）
- 判定：已解除 `403` 權限阻斷，授權模型符合預期。

### 第 2 輪：新建同類案件重驗

- 新建請求：
  - `POST /api/v1/cases`
  - `mode=collaborative`
  - `pairing_id=0ae859d7-4ce1-4307-879b-fde8e6712e6e`
- 新建結果：
  - HTTP `201`
  - case id：`1a0efa9f-cf7e-4a98-ae92-427563886ec5`
  - `mode=collaborative`
  - `session_id=null`
  - `plaintiff_id/defendant_id` 正確落到配對雙方
- 讀取結果：
  - 雙方 `GET /api/v1/cases/:id` 均為 `200`
  - 雙方 `GET /api/v1/cases/:id/judgment` 均為 `202`（`JUDGMENT_PENDING`）
  - 未認證讀取 `GET /api/v1/cases/:id`、`GET /api/v1/cases/:id/judgment` 均為 `401`
- 判定：授權邊界正確（當事人可讀、匿名不可讀）。

## 裁決

- `P02 = PASS`
- 舊 FAIL 證據已保留，作為本次修復前後對照依據。
