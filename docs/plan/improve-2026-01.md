# PDCA 改善計劃 2026-01

## Plan（計劃）

### 1. 審查結果

| 維度 | 現狀 | 目標 |
|------|------|------|
| 命名規範 | 已存在（後端設計 01）| 維持 |
| 文件大小 | case.service 543 行、ai.service 485 行 | 可接受（單一職責清晰）|
| i18n | zh-TW 21 鍵，proposals 有擴充建議 | 補齊缺失鍵 |
| Linter | 待驗證 | 0 錯誤 |
| 單元測試 | 116 通過 | 維持 |

### 2. 改善項目

1. **i18n**：補齊 proposals 中的 error.*、pending.* 鍵
2. **提取工具**：將 `normalizeJudgment` 從 case.service 提取至 utils
3. **Linter**：執行並修復

### 3. 不分拆大文件理由

- case.service、ai.service 邏輯內聚，邊界清晰
- 強制分拆可能引入不必要的依賴與複雜度
- 優先低風險、高收益的改進

---

## Do（實施記錄）

### 已完成

1. **DRY 提取**：`normalizeJudgment` 從 case.service、judgment.service 提取至 `utils/judgment.ts`
2. **單元測試**：新增 `judgment.test.ts`，4 用例
3. **i18n**：補齊 error.*、pending.*、actions.createAnother 至 zh-TW
4. **Linter**：修復 case.service 隱式 any（c、e 參數）
5. **ActionsSection**：使用 t('actions.createAnother')

### 2026-02-01 追加

6. **命名規範**：新增 `docs/naming-conventions.md`，整合後端/前端命名約定
7. **request utils 單元測試**：新增 `utils/request.test.ts`，9 用例覆蓋 getAuthUserId、getAuthUserIdOptional、getRequestId、getSessionId
8. **i18n 擴充**：補齊 common.*、message.* 鍵至 zh-TW；Result 頁面 5 處 message 改用 t()
