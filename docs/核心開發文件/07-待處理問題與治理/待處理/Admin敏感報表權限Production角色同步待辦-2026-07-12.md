# Admin 敏感報表權限 Production 角色同步待辦

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：問題治理
**覆蓋範圍**：Production `AdminRole.permissions` 與代碼預設敏感報表權限的資料同步
**取證代碼入口**：`backend/src/utils/admin-permissions.ts`、`backend/src/controllers/admin.controller.ts`、`backend/src/services/ai-stream.service.ts`、`backend/prisma/seed.ts`
**最後核驗 Commit**：`e65a4b8`
**最後核驗日期**：`2026-07-12`
<!-- CORE_DOC_AUDIT_METADATA:END -->

**狀態**：待處理（當前為安全降級，不阻斷發布）
**Owner**：Platform governance / Admin Backend
**優先級**：P1 Production 資料與權限奇偶

## 現狀

1. 代碼新增獨立權限 `reports:sensitive:read`。`ops` 的代碼預設會包含此權限；`marketing` 與 `support` 預設不包含。
2. `super_admin` 可透過 `admin:all` 通過相同授權邏輯。
3. 無 `admin:all` 或 `reports:sensitive:read` 時，AI Stream detail 由 backend 回傳 `sensitiveContentIncluded: false`，並將 session 原文、metadata 及 event 敏感內容固定移除。因此 `marketing` / `support` 應維持 redacted。
4. Production 現有 `ops` 角色的 permissions 為持久化資料，可能建立於新權限之前；本輪尚未取得該列已包含 `reports:sensitive:read` 的 Production 證據。

## 不可使用完整 Seed 同步

不得以 `prisma:seed` 作為此次 Production 權限同步方式：

1. `backend/prisma/seed.ts` 同時包含測試帳戶與內容資料寫入，不是單一權限變更工具。
2. 現有 `adminRole.upsert` 對已存在角色使用 `update: {}`，即使執行也不會把新權限同步到現有 `ops` 角色。

## 目標 Release 動作

1. 新增一個 targeted、audited 的 role-permission sync 工具，先以 read-only / dry-run 列出當前 `ops` 權限與準備追加的差異。
2. 在 Production 只對 `ops` 追加 `reports:sensitive:read`；不刪除或重排現有權限，不修改 `super_admin`、`marketing`、`support` 或任何帳戶關聯。
3. 記錄 actor、target role、before / after、新增權限、commit SHA 與時間；失敗時不得留下 partial update。
4. 同步後重新讀取 Production 角色資料並執行下列真服務驗證，再將本文件移至 `已處理/`。

## 驗證與完成條件

Targeted sync 工具完成後，必須提供明確的 read / dry-run / apply 命令，並驗證：

1. `ops` 實際請求 AI Stream detail 時 `sensitiveContentIncluded === true`。
2. `marketing` 實際請求時 `sensitiveContentIncluded === false`，原文與 metadata 保持 `null`。
3. `support` 也維持相同 redacted 邊界。
4. `ops` 敏感 detail read 產生 `ai_stream/view_sensitive_content` audit log，actor、entity 與時間可追溯。
5. 執行並保存非敏感證據：

```bash
npm run docs:check
npm run ops:release:gate:evidence
```

`ops:release:gate:evidence` 不可代替上述三角色 API 與 audit log 真服務斷言。

## 當前風險邊界

同步前，Production 現有 `ops` 若尚未取得新權限，會看到 redacted detail，不會因資料漂移而越權取得敏感原文。這是 fail-closed 安全降級，影響是 `ops` 暫時無法進行需要原文的調查，而非敏感資料暴露。
