# 聊天室測試案例

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：測試索引
**覆蓋範圍**：測試目錄入口與使用規則
**取證代碼入口**：`backend/tests`、`frontend/src/**/*.test.tsx`、`frontend/e2e/**/*.ts`、`e2e/**/*.ts`、`scripts`
**最後核驗 Commit**：`4d14e4f`
**最後核驗日期**：`2026-04-19`
<!-- CORE_DOC_AUDIT_METADATA:END -->

本資料夾包含聊天室 AI 回應的測試案例，與快速體驗（判決流程）案例分開，因聊天室為即時情感支持、非判決。

## 案例總覽

| 檔案 | 情境 | 測試目的 |
|------|------|----------|
| 情感陪伴-過度同理防護.md | 用戶尋求對爭議行為的認同 | 驗證 validation-seeking 偵測與價值澄清 prompt 生效 |

## 相關

- 歷史設計審查稿已移入根級 `歸檔/`
- 單元測試：`backend/tests/unit/services/chat-ai-orchestrator.service.test.ts`
