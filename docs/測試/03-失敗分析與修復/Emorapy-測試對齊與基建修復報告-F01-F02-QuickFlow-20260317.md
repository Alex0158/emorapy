# Emorapy 測試對齊與基建修復報告：F01/F02 Quick Flow

日期：2026-03-17  
對應功能：`F01 快速體驗`、`F02 協作聽證`、測試基建  
對應規範：`docs/測試/00-規範與原則/Emorapy-測試設計鐵律.md`

## 1. 本輪要驗證的業務規則

1. `quick-experience.flow` 必須能在真 DB 上常態執行，不能長期依賴 skip。
2. collaborative case 在匿名同 session 模式下，提交後必須能生成並讀取判決。
3. quick case 的 `defendant_statement=''` 必須按現行服務層語義正規化為 `null`。
4. test 環境若設置 `SKIP_RATE_LIMIT=true`，限流中間件必須真實跳過。

## 2. 失敗與根因分類

### 2.1 真業務缺陷

`JudgmentService.generateJudgment()` 原本只允許 `quick` 以 `sessionId` 進入，未覆蓋 `collaborative`。

實際後果：

1. collaborative second phase 提交成功後，controller 會異步觸發判決生成。
2. 但 `generateJudgment()` 內部把這條鏈路誤判為無權限。
3. `quick-experience.flow` 因此在 `collaborative -> judgment` 段超時。

### 2.2 測試基建缺陷

1. `backend/tests/setup.ts` 在 `NODE_ENV=test` 下未主動載入 `.env`，導致 flow 測試退回假默認資料庫。
2. `rateLimiter` 的 skip 規則只覆蓋 `development`，未覆蓋 `test`，導致 flow 套件被 `429` 汙染。
3. quick judgment 為背景異步任務，測試清理若過早刪除 case，會產生 `P2003` 外鍵競態。

### 2.3 過時測試口徑

1. `emptyDefendant` 的舊樣本本身不滿足最小合法原告陳述長度。
2. flow 測試仍要求 `defendant_statement` 保持空字串，與現行 service 正規化為 `null` 的事實不一致。

以上兩項屬「過時對齊」，不是產品缺陷。

## 3. 本輪修復

### 3.1 代碼修復

- `backend/src/services/judgment.service.ts`
  - 匿名 `quick/collaborative` 皆改為以 `sessionId` 做生成與讀取權限校驗。

### 3.2 測試基建修復

- `backend/tests/setup.ts`
  - 測試環境顯式載入 `.env.test.local` / `.env.test` / `.env`
  - 設置 `SKIP_RATE_LIMIT=true`
- `backend/src/middleware/rateLimiter.ts`
  - `NODE_ENV=test` 且 `SKIP_RATE_LIMIT=true` 時跳過限流
- `backend/tests/integration/helpers/test-utils.ts`
  - 清理前等待 quick judgment 背景任務收斂，避免 FK race

### 3.3 過時測試更新

- `backend/tests/integration/fixtures/quick-experience.fixtures.ts`
  - 修正 `emptyDefendant` 樣本為合法原告陳述
- `backend/tests/integration/quick-experience.flow.test.ts`
  - 改為驗證建案成功且 `defendant_statement` 被正規化為 `null`

## 4. 補充測試

依照測試鐵律，本輪新增/更新了與規則直接對應的測試，而不是只依賴一條大 flow：

1. `backend/tests/unit/middleware/rateLimiter.test.ts`
  - 新增 `NODE_ENV=test + SKIP_RATE_LIMIT=true` 的跳過分支驗證
2. `backend/tests/unit/services/judgment.service.test.ts`
  - 新增 collaborative session 可生成判決
  - 新增 collaborative session 不匹配時拒絕讀取判決
3. `backend/tests/unit/services/case.service.test.ts`
  - 新增 quick case 空字串被告陳述正規化為 `null`

## 5. 驗證結果

已通過：

```bash
RUN_FLOW_TESTS=true npm test -- --runInBand tests/integration/quick-experience.flow.test.ts
```

結果：

- `38 passed`

## 6. 對鐵律的對照

### 6.1 第一優先是發現真業務問題

本輪沒有為了讓測試通過而弱化斷言；相反，是先把 collaborative 權限缺陷修掉，再保留業務級斷言。

### 6.2 禁止過時對齊

`defendant_statement=''` 的舊期待已被移除，改為以當前服務層事實 `null` 為準。

### 6.3 禁止長期 skip 核心流程

`quick-experience.flow` 原本的核心阻塞已補齊，現已可在真 DB 上常態執行。

## 7. 結論

本輪收斂後：

1. F01/F02 的 quick flow 證據鏈不再依賴環境借口或過時測試。
2. collaborative 判決生成/讀取規則已有代碼與測試雙重對齊。
3. 測試基建已補到能穩定承接後續回歸，不再把限流與清理競態誤報成產品缺陷。
