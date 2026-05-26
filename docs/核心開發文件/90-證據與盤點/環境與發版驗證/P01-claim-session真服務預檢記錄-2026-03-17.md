# P01 claim-session 真服務預檢記錄（2026-03-17）

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據文檔
**來源時間**：2026-03-17
**上下文**：環境配置、發版前後驗證與 smoke 證據
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`bd66c2d`
**最後核驗日期**：`2026-04-18`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**文檔版本**：v1.0
**最後更新**：2026-03-17
**定位**：記錄 `F01/F09` 在真服務 + 真 DB 條件下的 `claim-session` 預檢結果。
**口徑說明**：本記錄屬於「腳本化真服務預檢」，不是手動回歸結果。

---

## 1. 目標

- 驗證匿名 quick case 可被新註冊帳號成功 claim。
- 驗證 `register token` 與 `login token` 兩條 claim 路徑都可返回同一 `case_id`。
- 驗證 `verify-email -> login` 可在真服務條件下完成。
- 驗證 quick case 在 DB 中確實綁定到新註冊 user。
- 驗證 claim 後保留 session continuity，可持續讀取原 quick case。

---

## 2. 執行命令

```bash
bash ./scripts/smoke-claim-session-production-like.sh
```

---

## 3. 驗證步驟

1. `POST /api/v1/sessions/quick` 建立匿名 quick session
2. `POST /api/v1/cases/quick` 建立 quick case
3. `POST /api/v1/auth/register` 註冊新用戶並取得 register token
4. `POST /api/v1/auth/claim-session` 使用 register token claim 當前 session
5. 從 DB 讀取最新 `email_verifications` 驗證碼
6. `POST /api/v1/auth/verify-email` 完成註冊驗證
7. `POST /api/v1/auth/login` 使用已驗證帳號登入
8. 再次 `POST /api/v1/auth/claim-session` 驗證 idempotency
9. `GET /api/v1/cases/:id?session_id=...` 驗證回訪原 quick case
10. 查 DB 驗證 `user.email_verified=true` 與 `case.plaintiff_id=user.id`

---

## 4. 實際結果

- 結果：`PASS`
- 執行時間：2026-03-17
- 腳本輸出摘要：
  - `session_id=guest_1773760309193_6e5d1d6e925041e3`
  - `case_id=1612f2af-93ba-4cb4-add7-f5d127915375`
  - `user_id=8d77d092-57fe-4bc0-a3e0-ab3778cf2179`
  - `email=claim-smoke-1773760309@example.com`

---

## 5. 結論

- `claim-session` 在真服務條件下可成功完成。
- `register -> claim-session -> verify-email -> login -> claim-session` 這條鏈路可複述通過。
- quick case 在 DB 中已正確綁定到新註冊 user，且未改變 quick/session 訪問語義。
- 此預檢可作為 `P01 快速體驗閉環` 的自動化前置證據，但不替代人工手動回歸。
