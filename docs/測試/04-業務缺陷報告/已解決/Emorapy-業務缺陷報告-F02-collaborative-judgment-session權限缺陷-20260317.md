# Emorapy 業務缺陷報告：F02 collaborative judgment session 權限缺陷

日期：2026-03-17  
狀態：`已修復`  
對應功能：`F02 協作聽證`  
對應測試：`backend/tests/integration/quick-experience.flow.test.ts`

## 1. 問題摘要

匿名 collaborative case 在角色 B 提交完成後，後端會異步觸發判決生成。  
但 `JudgmentService.generateJudgment()` 原本只允許 `quick` 模式使用 `sessionId` 權限，未包含 `collaborative`。

結果是：

1. 角色 B 提交成功
2. controller 已觸發生成判決
3. judgment service 卻回 `FORBIDDEN`
4. 最終 collaborative flow 在輪詢判決時超時

## 2. 觸發條件

1. 建立匿名 collaborative case
2. 使用同一個 `sessionId` 完成角色 A 建案與角色 B 提交
3. 等待異步判決生成

## 3. 預期行為

- collaborative case 與 quick case 一樣，作為匿名同 session 模式，應允許以匹配的 `sessionId` 生成與讀取判決。

## 4. 實際行為

- `generateJudgment()` 僅在 `case_.mode === quick` 時接受 `sessionId`
- `collaborative` 被錯誤落入完整模式分支
- 異步生成直接被拒絕

## 5. 根因

根因位於：

- [judgment.service.ts](/Users/alex/Desktop/CJ/mother-bear-court/backend/src/services/judgment.service.ts)

具體問題：

1. 生成判決權限判斷未把 `CASE_MODE.COLLABORATIVE` 納入匿名 session 規則
2. 讀取判決的口徑雖已支持 `quick/collaborative`，但生成側未對齊，造成前後不一致

## 6. 修復方案

已修復：

1. 將 `generateJudgment()` 的匿名 session 權限由 `quick` 擴展為 `quick/collaborative`
2. 補充單元測試驗證 collaborative session 可生成判決
3. 補充整合測試驗證 `角色A建立 -> 角色B提交 -> 判決可讀取`

## 7. 驗證證據

已通過：

```bash
RUN_FLOW_TESTS=true npm test -- --runInBand tests/integration/quick-experience.flow.test.ts
```

結果：

- `38 passed`

補充通過：

```bash
npm test -- --runInBand tests/unit/services/judgment.service.test.ts
```

## 8. 結論

本問題屬於真實業務權限缺陷，不是測試設計問題。  
現已修復並補齊對應單元與整合證據，故移入 `已解決/`。
