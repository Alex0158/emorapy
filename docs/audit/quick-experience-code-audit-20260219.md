# 快速體驗流程代碼審計（2026-02-19）

本文件針對「快速體驗」端到端流程做代碼層審查，範圍涵蓋：

- 前端：`QuickExperience/Create`、`QuickExperience/Result`、`sessionStore`、`request`、`polling`、相關 API 層
- 後端：`sessions/cases/judgments/evidence` 路由與 controller/service/middleware
- 測試：前後端快速體驗相關單元測試

本版為第三輪深挖更新（在前兩輪基礎上，再追加媒體授權邊界、AI 超時取消語義、日誌敏感資訊、鍵盤交互誤觸等角度）。

---

## 審計結論（摘要）

- 高風險問題集中在：**Session 綁定一致性**、**並發與競態**、**媒體授權邊界過寬**、**超時/重試語義不完整**、**前後端規則不一致**
- 快速體驗核心流程可運作，但在多案件、長時間使用、錯誤恢復與並發情境下，存在可觸發的邏輯缺陷
- 測試覆蓋對「關鍵路徑的邊界條件」不足，難以及早攔截回歸

---

## 問題清單（按風險排序）

### [CRITICAL] QX-001：顯式 `session_id` 可能被全局 Session 覆寫，造成跨案件授權錯誤

**位置**
- `frontend/src/services/request.ts`
- `frontend/src/services/api/case.ts`

**證據**
- 請求攔截器會在沒有 `X-Session-Id` header 時，把 `config.params.session_id` 直接改成全局 `sessionStorage.get()`。
- `uploadEvidence()` / `deleteEvidence()` 僅傳 `params.session_id`，未同步傳 header。

**觸發條件**
- 使用者曾建立多個快速體驗案件，且全局 Session 已切到新案件。
- 對舊案件上傳/刪除證據時，API 傳入的 `session_id` 被攔截器覆蓋。

**風險**
- 舊案件操作可能被錯誤拒絕（403 / Session 不匹配）。
- 在多案件回訪流程中造成不可預期失敗，破壞核心體驗。

**建議修復**
- 攔截器僅在「`params.session_id` 與 `X-Session-Id` 都不存在」時才注入全局 Session。
- `uploadEvidence()` / `deleteEvidence()` 傳入顯式 Session 時，同步設置 `X-Session-Id` header，避免被覆蓋。

---

### [HIGH] QX-002：`一個 Session 只對應一個 Case` 的防護有並發漏洞

**位置**
- `backend/src/services/case.service.ts`（`createQuickCase`）

**證據**
- 程式先讀 `session.case_id` 判斷是否已占用，再決定是否新建 Session；此檢查與後續建案更新之間沒有鎖。

**觸發條件**
- 同一個 Session 發生近乎同時的多次 `POST /cases/quick`。

**風險**
- 可能生成多個 quick case 綁定同一 Session。
- `by-session` 查詢只回最新案件，舊案件回訪語義混亂。

**建議修復**
- 以 `sessionId` 為鍵加分布式鎖（或 DB 原子條件更新）。
- 若產品規則確定一對一，增加資料層唯一性約束與衝突處理。

---

### [HIGH] QX-003：證據上傳狀態規則前後端不一致（`in_progress`）

**位置**
- 後端：`backend/src/controllers/evidence.controller.ts`
- 前端：`frontend/src/pages/QuickExperience/Result/index.tsx`

**證據**
- 前端把 `in_progress` 視為可上傳狀態。
- 後端僅允許 `draft` / `submitted`。

**觸發條件**
- 案件進入 `in_progress`，結果頁仍顯示可補傳證據並發送請求。

**風險**
- 使用者看到可操作 UI，但後端拒絕，造成流程中斷與誤導。

**建議修復**
- 統一規則：要麼後端加入 `in_progress`，要麼前端不再允許。
- 同步調整測試與文檔，避免再次分叉。

---

### [HIGH] QX-004：判決生成在 `NODE_ENV=test` 存在權限繞過分支

**位置**
- `backend/src/services/judgment.service.ts`

**證據**
- quick 模式下，session 不匹配時，`NODE_ENV === 'test'` 會跳過拒絕邏輯。

**觸發條件**
- 若環境配置錯誤或部署參數誤設為 `test`。

**風險**
- 權限保護依賴環境字串，存在誤配置即放寬授權的風險。

**建議修復**
- 移除執行期權限繞過；測試以 mock/stub 取代。
- 若必須保留，改為更嚴格、顯式的測試旗標並加啟動期防呆。

---

### [HIGH] QX-005：AI 限流中間件順序不合理，已登入用戶仍以 IP 限流

**位置**
- `backend/src/routes/judgment.routes.ts`
- `backend/src/middleware/rateLimiter.ts`

**證據**
- `aiLimiter` 在 `optionalAuthenticate` 之前執行。
- `aiLimiter` key 優先取 `req.user?.id`，但此時 `req.user` 尚未注入。

**觸發條件**
- `POST /judgments/generate/:id` 所有請求。

**風險**
- 限流維度偏離設計（用戶級退化成 IP 級）。
- 同 IP 多人互相影響，且難以做精準風控。

**建議修復**
- 路由改為先 `optionalAuthenticate` 再 `aiLimiter`。
- 或在 limiter 內自行解析 token（不建議重複邏輯）。

---

### [MEDIUM] QX-006：Session 過期恢復流程重複（攔截器與頁面層都刷新）

**位置**
- `frontend/src/services/request.ts`
- `frontend/src/pages/QuickExperience/Result/index.tsx`

**證據**
- 401 Session 錯誤時，攔截器會 `clearSession + refreshSession(true)`。
- `Result` 頁 `fetchJudgment` 捕獲同類錯誤後又再刷新一次。

**觸發條件**
- Session 過期後讀取判決。

**風險**
- 重複刷新造成不必要請求與狀態抖動。
- 增加 Session 切換不一致概率。

**建議修復**
- 明確單一責任：只在攔截器或頁面層做刷新，另一方只做提示/跳轉。

---

### [MEDIUM] QX-007：`usePolling.startPolling()` 缺少「已啟動」保護，可能產生重複輪詢

**位置**
- `frontend/src/hooks/usePolling.ts`

**證據**
- `startPolling()` 只檢查 `timerRef.current`，未檢查「是否已有活躍輪詢循環」。
- 在 `poll()` 第一次執行到設定下一次 `setTimeout` 前，`timerRef` 仍可能為 `null`。

**觸發條件**
- 短時間內多次調用 `startPolling()`（頁面 effect 或手動重試）。

**風險**
- 重複請求、資源浪費、狀態競態。

**建議修復**
- 加 `isActiveRef`（或鎖）防重入，`startPolling` 若已啟動則直接返回。

---

### [MEDIUM] QX-008：證據上傳資料庫失敗時，已處理文件可能殘留（孤兒文件）

**位置**
- `backend/src/controllers/evidence.controller.ts`
- `backend/src/services/file.service.ts`

**證據**
- 文件先經 `processImage/processVideo` 寫入磁碟，再 `prisma.evidence.create`。
- 若 DB 寫入失敗，流程未回滾已落地文件。

**觸發條件**
- DB 暫時錯誤、連線中斷、交易衝突。

**風險**
- 上傳目錄累積孤兒文件，存儲膨脹，運維成本上升。

**建議修復**
- DB 寫入失敗時刪除對應 processed file。
- 加入定時「孤兒文件清理」與觀測指標。

---

### [MEDIUM] QX-009：`caseSessionMap` 無 TTL / 上限，長期使用會堆積

**位置**
- `frontend/src/utils/storage.ts`

**證據**
- map 只增不控，僅在少數 404 場景刪除單筆。

**觸發條件**
- 高頻體驗、多案件回訪、長期使用。

**風險**
- localStorage 膨脹，舊映射污染新流程判斷。

**建議修復**
- map value 增加時間戳。
- 每次讀寫做過期清理與最大筆數裁剪（例如保留最近 50 筆）。

---

### [MEDIUM] QX-010：快速體驗前端測試僅 smoke test，關鍵流程幾乎未覆蓋

**位置**
- `frontend/src/pages/QuickExperience/Create/index.test.tsx`
- `frontend/src/pages/QuickExperience/Result/index.test.tsx`

**證據**
- 目前測試僅驗證「可掛載不崩潰」。
- 未覆蓋 Session 切換、輪詢停止條件、重試、證據補傳等核心行為。

**風險**
- 高風險流程改動後容易回歸，CI 無法提前攔截。

**建議修復**
- 補上快速體驗核心交互測試（見文末「優先補測項目」）。

---

### [MEDIUM] QX-011：後端缺少 quick flow 並發與冷卻邊界測試

**位置**
- `backend/tests/unit/services/judgment.service.test.ts`
- `backend/tests/unit/services/case.service.test.ts`

**證據**
- 已有基礎 happy path，但缺少：並發生成、session 競態、重試冷卻時間等壓力場景。

**風險**
- 最容易出事故的生產場景未被單元測試覆蓋。

**建議修復**
- 增加並發與時序相關用例（見文末）。

---

### [LOW] QX-012：Result 頁證據補傳交互為「選檔即上傳」，缺少確認步驟

**位置**
- `frontend/src/pages/QuickExperience/Result/components/EvidenceUploadSection.tsx`

**證據**
- `Upload onChange` 一有檔案就直接觸發 `onUploadFiles`。

**風險**
- 誤選即上傳、難以取消，體驗可控性較差。

**建議修復**
- 改成「選檔 -> 預覽/確認 -> 上傳」兩段式流程。

---

## 首輪建議優先修復順序（Top 6，已被文末「更新後優先修復 Top 8」覆蓋）

1. QX-001（Session 參數覆寫）
2. QX-002（Session-Case 併發競態）
3. QX-003（證據狀態不一致）
4. QX-004（test 環境權限繞過分支）
5. QX-005（AI limiter middleware 順序）
6. QX-006（重複 refresh）

---

## 優先補測項目（Top 10）

1. `request`：顯式 `session_id` 不應被全局 session 覆寫  
2. `case.service`：同 Session 併發創建 quick case 的一致性  
3. `judgment.service`：`judgment_failed` 冷卻時間邏輯  
4. `judgment.service`：quick 模式 session 不匹配拒絕  
5. `evidence.controller`：`in_progress` 上傳策略（按最終規格）  
6. `Result`：Session 過期恢復流程（避免重複 refresh）  
7. `usePolling`：重複 `startPolling` 不應生成多輪詢  
8. `Result`：重試判決後輪詢恢復與停止條件  
9. `storage.caseSessionMap`：TTL/上限清理策略  
10. `uploadEvidence`：多案件回訪時使用正確 case 專屬 session

### 第二輪追加補測（針對新增問題）

1. `signUrl` 與 `authorizeMedia` 路徑正規化一致性（`uploads/xxx` vs `xxx`）
2. 請求攔截器對顯式 `params.session_id` 的保留行為（不可被全局覆寫）
3. `request` 不應在非必要接口自動拼接 `session_id` query
4. `evidence.controller` 並發上傳時仍嚴格限制最多 3 個
5. `deleteEvidence` 的 `caseId` 與 `evidence.case_id` 一致性驗證
6. 外部 `evidence_urls` 不應產生本域簽名 token

### 第三輪追加補測（針對新增問題）

1. `authorizeMedia`：有效 `session/user` 不應直接訪問非歸屬文件
2. `/uploads`：文件名已知但非歸屬時必須 403/401（含 quick 與登入態）
3. `judgment.service`：超時後底層 AI 任務必須被取消（不可再產生成本調用）
4. `judgment.service`：超時後立即重試不應與前一輪幽靈任務重疊
5. `requestLogger`：日誌輸出不應包含原始 `sessionId`
6. `useKeyboardNavigation`：`textarea` 內 Enter 應換行，不得觸發提交
7. Create 頁：僅 `Ctrl/Cmd+Enter` 可提交（普通 Enter 無副作用）

### 第四輪追加補測（針對新增問題）

1. `app` + routes：單請求只應命中預期層級限流（避免雙重 `generalLimiter`）
2. `/:id/evidence`：已登入用戶限流 key 應優先命中 userId，而非 IP
3. `usePolling`：`stopPolling` 於 in-flight 請求期間呼叫後，不得再排下一輪 timer
4. `jobs/cleanup`：`startJobs` 與 `stopJobs` 啟停任務數量一致（含 orphan uploads）
5. `quickCaseSchema/createCaseSchema`：拒絕 `javascript:/data:/ftp:` 協議 URI
6. `ValidationUtils.validateEvidenceUrls`：僅允許 `https`（或受控白名單）URL

### 第五輪追加補測（針對新增問題）

1. Create 頁同一個 `Ctrl/Cmd+Enter` 只應觸發一次 `handleSubmit`
2. `/:id/evidence` 在無權限/無效 session 時不得先落地文件到磁碟
3. `session_id` 同時存在於 query/header 且值不一致時，服務端應有固定優先規則且一致
4. `createTempPairing` 並發下同一 session 不得創建多筆 quick pairing
5. `createQuickCase` 交易失敗時不應遺留孤兒 quick pairing
6. `getCaseById` 未授權訪問時不應先執行 URL 簽名/文件哈希等高成本操作

---

## 備註

- 本清單僅收錄「可從代碼直接驗證」的問題。
- 文檔與實作不一致（如證據上傳狀態）已按功能風險納入修復優先級。

---

## 第二輪新增問題（多角度深挖）

### [HIGH] QX-013：簽名媒體 URL 的路徑校驗規則不一致，可能導致合法 token 無法訪問

**位置**
- `backend/src/services/file.service.ts`
- `backend/src/middleware/auth.ts`
- `backend/src/app.ts`

**證據**
- `signUrl()` 將 `payload.f` 設為 URL 路徑去前導 `/` 後的值（例如 `uploads/abc.jpg`）。
- `authorizeMedia` 在 `/uploads` 掛載點內取 `req.path`（通常為 `/abc.jpg`），轉為 `requestedPath = abc.jpg`。
- 校驗條件為 `requestedPath.endsWith(payload.f)`，此時 `abc.jpg.endsWith('uploads/abc.jpg')` 為 `false`。

**觸發條件**
- 私有媒體訪問模式下，前端以 `signUrl` 產生的 URL 直接訪問 `/uploads/*`。

**風險**
- 合法簽名 URL 可能被 401 拒絕，造成快速體驗中的證據/頭像等媒體顯示失敗。

**建議修復**
- 對 `payload.f` 與 `requestedPath` 做同一規則正規化後再比較（例如都用 `path.basename`，或都使用相對於 uploads 根目錄的完整相對路徑）。
- 避免 `endsWith`，改為嚴格等值比對。

---

### [HIGH] QX-014：全局把 `session_id` 放入 query，存在授權憑證外洩面

**位置**
- `frontend/src/services/request.ts`
- `backend/src/middleware/logger.ts`

**證據**
- 請求攔截器會把 Session 同時放在 `X-Session-Id` header 與 `params.session_id`。
- 後端請求日誌記錄 `req.url`，包含 query string。

**觸發條件**
- 任意前端 API 請求（不只快速體驗核心接口）。

**風險**
- `session_id` 可能出現在伺服器日誌、反向代理日誌、APM、監控快照，增加泄露面。
- 快速體驗以 Session 作授權，洩露後可在有效期內被重放訪問。

**建議修復**
- 預設只走 `X-Session-Id` header；僅對明確需要 query 的端點才帶 `session_id`。
- 後端 logger 對敏感 query 做遮罩（或不記錄完整 query）。

---

### [HIGH] QX-015：證據數量上限檢查非原子，並發上傳可突破「最多3個」

**位置**
- `backend/src/controllers/evidence.controller.ts`

**證據**
- 先 `count` 現有數量，再逐筆 `create`，中間無交易/鎖保護。

**觸發條件**
- 同一案件並發多個上傳請求。

**風險**
- 可超過業務規則上限（>3），導致資料不一致與前端展示異常。

**建議修復**
- 以交易+鎖保證原子檢查寫入；或在資料層增設硬約束（例如以案件維度加總約束/觸發器策略）。

---

### [MEDIUM] QX-016：刪除證據接口未校驗 path 中的 `caseId` 與 evidence 關聯

**位置**
- `backend/src/controllers/evidence.controller.ts`

**證據**
- `deleteEvidence` 僅使用 `evidenceId` 查資料，不驗證 `req.params.id`。

**觸發條件**
- 請求路徑中的 `caseId` 與 `evidenceId` 實際不一致。

**風險**
- API 語義與審計軌跡混亂；前端若路由拼接錯誤不易察覺。
- 在多案件場景下可能引發錯誤刪除行為判讀困難。

**建議修復**
- 額外校驗 `evidence.case_id === req.params.id`，否則回 404/403。

---

### [MEDIUM] QX-017：上傳限流 key 對 query 內 session 無感，快體驗限流精度不足

**位置**
- `backend/src/middleware/rateLimiter.ts`
- `frontend/src/services/api/case.ts`

**證據**
- `uploadLimiter` 只讀 `req.headers['x-session-id']`，不讀 `req.query.session_id`。
- 前端 `uploadEvidence()` 顯式 Session 主要放在 `params.session_id`。

**觸發條件**
- 快速體驗請求僅帶 query session，未帶 header。

**風險**
- 限流退化到 IP 維度，精度不足且易互相干擾。

**建議修復**
- 限流 key 同時讀 header 與 query 的 session。
- 前端顯式 session 請求統一同時傳 header。

---

### [MEDIUM] QX-018：Session 相關 400 錯誤在前端攔截器未專門處理，易出現錯誤提示語義偏差

**位置**
- `backend/src/utils/errors.ts`
- `frontend/src/services/request.ts`

**證據**
- `SESSION_ID_REQUIRED` / `INVALID_SESSION_ID` 是 400。
- 前端攔截器只對 401 做 Session 過期流程，400 走通用錯誤分支。

**觸發條件**
- 缺失/格式錯誤 session 的快速體驗請求。

**風險**
- 使用者得到「伺服器錯誤」類泛化提示，不利於自助恢復。

**建議修復**
- 對 400 + `SESSION_ID_REQUIRED` / `INVALID_SESSION_ID` 做專門分支處理與提示。

---

### [HIGH] QX-019：外部 `evidence_urls` 也會被簽名，可能把簽名 token 暴露給第三方域名

**位置**
- `backend/src/services/case.service.ts`
- `backend/src/services/file.service.ts`

**證據**
- quick case 可接收並保存任意 URI 的 `evidence_urls`。
- 回傳案件時會對所有 `e.file_url` 執行 `signUrl()`，未限制 host。

**觸發條件**
- 客戶端（或惡意調用方）提交外部域名 evidence URL。

**風險**
- 簽名 token 出現在第三方 URL query，外部服務可收集該 token。
- 增加 token 重放與憑證暴露面（即使成功利用有條件限制，仍屬不必要暴露）。

**建議修復**
- 只對本域 `/uploads` 來源做簽名。
- 外部 URL 要麼拒收，要麼原樣返回且標記為 external，不走本地簽名流程。

---

### [MEDIUM] QX-020：`/sessions/refresh` 實際是「新建 Session」，不是「續期既有 Session」

**位置**
- `backend/src/routes/session.routes.ts`
- `backend/src/controllers/session.controller.ts`

**證據**
- `/sessions/refresh` 與 `/sessions/quick` 共用同一 `createSession` controller。

**觸發條件**
- 任意 refresh 調用。

**風險**
- 「refresh」語義與實作不一致，容易讓前端或運維誤判。
- 舊 Session 仍可用至過期，不是嚴格輪換。

**建議修復**
- 若要真 refresh：需帶舊 Session，服務端校驗後原子旋轉（失效舊、簽發新）。
- 若維持現狀，請明確改名為 `createOrRotateSession` 並更新文檔語義。

---

## 第三輪新增問題（進一步深挖）

### [CRITICAL] QX-021：`/uploads` 授權僅驗證「有任一有效身份」，未校驗文件歸屬

**位置**
- `backend/src/middleware/auth.ts`
- `backend/src/app.ts`

**證據**
- `authorizeMedia` 對已登入使用者（`req.user?.id`）直接放行。
- quick session 分支只驗證「session 存在且未過期」，也直接放行。
- 兩者都未把請求文件與「當前 user/session 對應案件證據」做關聯校驗。
- `/uploads` 掛載只套 `downloadLimiter + authorizeMedia + express.static`，沒有資源層授權檢查。

**觸發條件**
- 攻擊者持有任一有效登入態或任一有效 quick session，且取得目標文件名/URL（例如來自日誌、錯誤分享、外部泄露）。

**風險**
- 可橫向讀取非本人證據文件（機密資料外洩）。
- 與快速體驗「以 session 隔離案件」的安全假設不一致。

**建議修復**
- 在 `authorizeMedia` 增加文件歸屬檢查：文件必須屬於當前 user 可訪問案件，或屬於當前 session 對應 quick 案件。
- 更嚴格方案：移除「僅憑 session / user 直接讀 `/uploads`」路徑，統一改為短時效簽名 URL + 歸屬驗證。

---

### [HIGH] QX-022：`Promise.race` 超時未取消底層 AI 任務，會產生幽靈調用與重試重疊

**位置**
- `backend/src/services/judgment.service.ts`
- `backend/src/services/ai.service.ts`

**證據**
- 判決生成使用 `Promise.race([aiService.generateJudgment(...), timeoutPromise])` 做 60s 超時。
- 超時後只拋錯並把案件設為 `judgment_failed`，但未向 `aiService.generateJudgment` 傳遞可取消信號。
- `aiService.generateJudgment` 內部仍可能持續進行 OpenAI 重試/摘要生成，形成後台幽靈請求。

**觸發條件**
- AI 響應慢、網路抖動、重試退避時，超過 `AI_TIMEOUT.JUDGMENT_GENERATION`。

**風險**
- 前台已判定失敗，但背景仍消耗 AI 配額與成本。
- 使用者立即點「重試」時，可能與幽靈任務時間重疊，放大重複調用與狀態競態。

**建議修復**
- 改為可取消超時：在 judgment service 建立 `AbortController`，把 `signal` 傳到 AI 層；超時時主動 abort 底層調用。
- 明確區分「業務超時」與「任務已終止」事件，避免超時後殘留請求。

---

### [MEDIUM] QX-023：後端請求日誌直接記錄 `sessionId`，即使移除 query 仍有憑證泄露面

**位置**
- `backend/src/middleware/logger.ts`

**證據**
- `requestLogger` 在 development 記錄 `logData.sessionId = getSessionId(req)`。
- production 也在錯誤請求/慢請求場景記錄 `sessionId` 欄位。
- 代表即使前端後續不再把 `session_id` 放 query，日誌層仍會保留原始 session 憑證。

**觸發條件**
- 任意帶 session 的請求（尤其 4xx/5xx 或慢請求）。

**風險**
- 日誌系統、排障快照、告警聚合平台若權限邊界不足，會形成 session 重放風險。

**建議修復**
- 不記錄原值 `sessionId`；改記錄不可逆短摘要（如 hash 前 8 位）作追蹤。
- 將 session 視為敏感憑證，納入日誌遮罩規則。

---

### [MEDIUM] QX-024：Create 頁全局 Enter 快捷提交，與文字輸入行為衝突

**位置**
- `frontend/src/hooks/useAccessibility.ts`
- `frontend/src/pages/QuickExperience/Create/index.tsx`

**證據**
- `useKeyboardNavigation` 直接監聽 `window.keydown`，`Enter` 一律觸發 `onEnter`，未排除 `textarea/input/contenteditable`。
- Create 頁在 `canSubmit=true` 時把 `onEnter` 綁定到 `handleSubmit`。

**觸發條件**
- 使用者在陳述輸入框按 Enter 換行（尤其已達最小字數、`canSubmit=true`）。

**風險**
- 易誤觸提交，導致案件提前送出（內容品質下降、補救成本增加）。
- 與已提供的 `Ctrl+Enter` 提交語義衝突。

**建議修復**
- `Enter` 僅在非輸入控件焦點時觸發提交，或限定為 `Ctrl/Cmd+Enter`。
- 保留文字編輯區原生 Enter 換行行為。

---

## 第四輪新增問題（再深挖）

### [HIGH] QX-025：全局與路由層 `generalLimiter` 疊加，導致限流語義失真與過度節流

**位置**
- `backend/src/app.ts`
- `backend/src/routes/case.routes.ts`
- `backend/src/routes/judgment.routes.ts`
- `backend/src/routes/session.routes.ts`

**證據**
- `app.ts` 已全局 `app.use(generalLimiter)`。
- 多數路由又再次套用 `generalLimiter`（如 cases/judgments/sessions 等）。
- 同一請求會被兩層 limiter 計數，實際可用配額低於配置值，且 429 行為更難預期。

**觸發條件**
- 快速體驗流程中高頻請求（建案、查案、取判決、refresh session）。

**風險**
- 正常使用者更容易被誤限流（尤其弱網路重試或輪詢時）。
- 配置與實際吞吐不一致，排障與容量規劃困難。

**建議修復**
- 保留單一責任層：要麼只保留全局 `generalLimiter`，要麼路由分級限流並移除全局通用限流。
- 若需雙層，應明確區分用途（例如全局高上限 + 路由低上限）並在文檔標註。

---

### [MEDIUM] QX-026：上傳限流在認證前執行，已登入用戶仍退化為 IP 維度

**位置**
- `backend/src/routes/case.routes.ts`
- `backend/src/middleware/rateLimiter.ts`

**證據**
- `/:id/evidence` 路由中 `uploadLimiter` 先於 `optionalAuthenticate`。
- `uploadLimiter` key 優先取 `req.user?.id`，但此時 `req.user` 尚未注入，常退化為 `sessionId/IP`。

**觸發條件**
- 完整模式（已登入）上傳證據請求。

**風險**
- 同 IP 用戶互相影響，限流精度與公平性下降。
- 風控與審計失真，難以基於 user 維度追蹤濫用。

**建議修復**
- 調整中間件順序：先 `optionalAuthenticate` 再 `uploadLimiter`。
- 或在 limiter 內解析 token（不建議，會重複認證邏輯）。

---

### [MEDIUM] QX-027：`usePolling.stopPolling()` 無法中止「進行中的 poll」，可能在停止後復活輪詢

**位置**
- `frontend/src/hooks/usePolling.ts`

**證據**
- `stopPolling()` 只清理 `timerRef`，未標記「輪詢已停用」。
- 若 `poll()` 正在 `await fnRef.current()`，即使外部已調 `stopPolling()`，返回後仍會繼續安排下一次 `setTimeout`。

**觸發條件**
- 停止輪詢時剛好有一次請求在飛行中（頁面切換、拿到結果、錯誤分支停止）。

**風險**
- 停止後仍持續請求，造成隱性流量與狀態抖動。
- 增加結果頁「偶發重啟輪詢」與難排查的時序問題。

**建議修復**
- 增加 `isActiveRef`，在 `poll` 進入、`await` 後、`setTimeout` 前都檢查活躍狀態。
- `stopPolling()` 除清 timer 外同步設置 `isActiveRef=false`。

---

### [LOW] QX-028：`stopJobs()` 未停止 `cleanupOrphanUploads`，啟停對稱性缺失

**位置**
- `backend/src/jobs/cleanup.job.ts`

**證據**
- `startJobs()` 啟動了 5 個任務（含 `cleanupOrphanUploads`）。
- `stopJobs()` 僅停止 4 個任務，漏掉 `cleanupOrphanUploads.stop()`。

**觸發條件**
- 服務優雅關閉、測試啟停、熱重載場景。

**風險**
- 任務生命週期管理不一致，可能導致測試不穩定或資源清理時序異常。

**建議修復**
- 在 `stopJobs()` 補上 `cleanupOrphanUploads.stop()`，保持與 `startJobs()` 對稱。

---

### [HIGH] QX-029：`evidence_urls` 僅做 URI 格式校驗，未限制 scheme，允許非 http(s) 協議

**位置**
- `backend/src/utils/validation.ts`
- `backend/src/services/case.service.ts`

**證據**
- `quickCaseSchema/createCaseSchema` 使用 `Joi.string().uri()`，未限制協議白名單。
- `ValidationUtils.validateEvidenceUrls` 使用 `new URL(url)`，同樣未限制 `http/https`。
- 允許 `ftp:`, `data:`, `javascript:` 類 URI 進入資料層。

**觸發條件**
- API 客戶端直接調用 `POST /cases/quick` 或 `POST /cases` 提交惡意/非常規 URI。

**風險**
- 不安全 URI 可被持久化並在後續流程被錯誤使用（預覽、跳轉、簽名拼接）。
- 擴大憑證暴露與前端安全風險面（與 QX-019 疊加）。

**建議修復**
- 嚴格限制為 `https`（必要時允許 `http` 於開發環境）。
- 若業務只接受本地上傳，則禁止客戶端直接提交任意 `evidence_urls`。

---

## 第五輪新增問題（極限深挖）

### [HIGH] QX-030：Create 頁 `Ctrl/Cmd+Enter` 可能被雙重鍵盤監聽重複提交

**位置**
- `frontend/src/pages/QuickExperience/Create/index.tsx`
- `frontend/src/hooks/useAccessibility.ts`
- `frontend/src/components/common/KeyboardShortcuts/index.tsx`

**證據**
- Create 頁同時掛載 `useKeyboardNavigation(onEnter=>handleSubmit)` 與 `KeyboardShortcuts`（含 `ctrl+enter=>handleSubmit`）。
- `useKeyboardNavigation` 對任何 `Enter`（包含 `Ctrl/Cmd+Enter`）都會觸發 `onEnter`。
- 同一次按鍵事件可命中兩個 listener，導致 `handleSubmit` 重入。

**觸發條件**
- 在 Create 頁按 `Ctrl/Cmd+Enter` 提交。

**風險**
- 可能發出重複建案請求，造成重複 case/session、用量放大與流程混亂。

**建議修復**
- 統一快捷鍵入口，只保留一個提交 listener。
- `handleSubmit` 加前置防重入（例如 `isSubmittingRef`）。

---

### [HIGH] QX-031：證據上傳在授權判斷前就寫入磁碟，可被濫用進行存儲消耗攻擊

**位置**
- `backend/src/controllers/evidence.controller.ts`
- `backend/src/services/file.service.ts`
- `backend/src/routes/case.routes.ts`

**證據**
- `uploadEvidence` middleware 先執行 `upload.array('files', 3)`（multer disk storage 直接落地）。
- 權限檢查（session/user/case）在後續 handler 才執行。
- 未授權請求在被拒之前已寫入文件，且失敗分支未即時清理。

**觸發條件**
- 攻擊者反覆對 `POST /cases/:id/evidence` 發送無效 session/無權限上傳請求。

**風險**
- 可持續產生孤兒文件，快速推高磁碟占用（清理任務是延時批處理，非即時）。
- 對快速體驗入口形成低成本資源消耗面。

**建議修復**
- 把授權前置到文件落地之前（先驗證再接收文件），或改用 memory storage + 驗證通過後再寫盤。
- 對授權失敗分支增加即時清理。

---

### [MEDIUM] QX-032：`session_id` 來源優先級不一致（有的 header 優先、有的 query 優先）

**位置**
- `backend/src/controllers/case.controller.ts`
- `backend/src/controllers/judgment.controller.ts`
- `backend/src/controllers/evidence.controller.ts`
- `backend/src/middleware/auth.ts`

**證據**
- `createQuickCase` 使用 `header -> query`。
- 多數其它接口與 `validateSession/authorizeMedia` 使用 `query -> header`。
- 同一憑證在不同端點可能被不同來源覆蓋，語義不一致。

**觸發條件**
- 請求同時攜帶 `X-Session-Id` 與 `session_id`，且兩者不一致。

**風險**
- 出現授權結果漂移（同一客戶端對不同端點表現不一致）。
- 排障與審計難度提高，容易形成「偶發 403/401」問題。

**建議修復**
- 全服務統一單一來源與優先級（建議 `X-Session-Id` 優先）。
- 若兩者同時存在且不一致，直接拒絕並返回明確錯誤碼。

---

### [MEDIUM] QX-033：`createTempPairing` 存在檢查-創建競態，且建案失敗會遺留臨時配對

**位置**
- `backend/src/services/pairing.service.ts`
- `backend/src/services/case.service.ts`
- `backend/prisma/schema.prisma`

**證據**
- `createTempPairing` 先 `findFirst(session_id)` 再 `create`，無鎖且資料層無 `session_id` 唯一約束。
- `caseService.createQuickCase` 先創建 temp pairing，再進入 case 交易；若交易失敗，已建 pairing 不回滾。

**觸發條件**
- 同 session 並發建案，或建案交易中途失敗。

**風險**
- 可能為同一 session 產生多筆 quick pairing，增加資料噪音與後續語義混亂。
- 遺留孤兒 temp pairing，需等長週期清理任務回收。

**建議修復**
- 對 quick pairing 增加 session 維度唯一約束/原子 upsert。
- 把 temp pairing 創建納入與 case 同一交易，或失敗時補償刪除。

---

### [MEDIUM] QX-034：`getCaseById` 在授權前先做媒體 URL 簽名，放大未授權請求成本

**位置**
- `backend/src/services/case.service.ts`
- `backend/src/services/file.service.ts`

**證據**
- `getCaseById` 取得 case 後先對 `evidences`/`avatar_url` 全量 `signUrl()`，之後才檢查 quick session 或 user 權限。
- `signUrl()` 可能進行 `stat/readFile/hash`（同步 I/O + 計算）。

**觸發條件**
- 對存在的 case 發送未授權請求（尤其 evidence 較多時）。

**風險**
- 未授權流量也可消耗簽名與文件 I/O 資源，形成放大攻擊面。
- 帶來可觀測的時間差，增加資源存在性側信道風險。

**建議修復**
- 先做權限校驗，再做 URL 簽名與衍生處理。
- 對簽名流程加入快取與成本上限保護。

---

## 更新後統計

- 總問題數：34
- CRITICAL：2
- HIGH：13
- MEDIUM：17
- LOW：2

## 更新後優先修復 Top 8

1. QX-021（`/uploads` 授權未做文件歸屬校驗）
2. QX-031（授權前落地文件可被濫用）
3. QX-001（顯式 session 被覆寫）
4. QX-013（簽名 URL 路徑校驗不一致）
5. QX-022（AI 超時未取消底層任務）
6. QX-014（query 攜帶 session 導致憑證外洩面）
7. QX-029（`evidence_urls` 協議白名單缺失）
8. QX-030（`Ctrl/Cmd+Enter` 可能重複提交）

---

## 修復落地狀態（已完成）

本輪已依據審計清單完成代碼修復與回歸驗證，狀態如下：

- 已修復：`QX-001 ~ QX-034`（34/34）
- 重點完成面向：
  - Session 一致性與恢復語義：`QX-001/QX-006/QX-009/QX-014/QX-018/QX-020/QX-032`
  - 並發與狀態機穩定性：`QX-002/QX-003/QX-005/QX-007/QX-008/QX-015/QX-016/QX-025/QX-026/QX-027/QX-028/QX-033/QX-034`
  - 安全邊界與敏感資訊：`QX-013/QX-019/QX-021/QX-022/QX-023/QX-029/QX-031`
  - 交互與誤觸風險：`QX-012/QX-024/QX-030`
  - 測試補強：`QX-010/QX-011`

### 主要修復檔案（節選）

- 後端
  - `backend/src/middleware/auth.ts`（媒體授權加文件歸屬校驗、token 路徑一致、session 來源衝突拒絕）
  - `backend/src/controllers/evidence.controller.ts`（授權前置、並發上傳鎖、失敗即時清理、刪除 case/evidence 一致性）
  - `backend/src/services/case.service.ts`（quick 建案加 session 鎖、pairing 補償刪除、授權後再簽名）
  - `backend/src/services/pairing.service.ts`（quick pairing 建立加鎖，消除 check-then-create 競態）
  - `backend/src/services/judgment.service.ts` + `backend/src/services/ai.service.ts`（超時中止下傳，避免幽靈 AI 請求）
  - `backend/src/services/file.service.ts`（僅本域 uploads 簽名、第三方 URL 不附 token）
  - `backend/src/services/session.service.ts` + `backend/src/controllers/session.controller.ts` + `backend/src/routes/session.routes.ts`（refresh 旋轉語義）
  - `backend/src/middleware/logger.ts` + `backend/src/middleware/errorHandler.ts`（session 脫敏記錄）
  - `backend/src/middleware/rateLimiter.ts` + `backend/src/app.ts` + routes（限流順序與重疊修復）
  - `backend/src/utils/validation.ts`（`evidence_urls` 限 HTTPS）
  - `backend/src/jobs/cleanup.job.ts`（補齊 `cleanupOrphanUploads.stop()`）
- 前端
  - `frontend/src/services/request.ts`（移除全局 query 注入、補 400 session 錯誤處理）
  - `frontend/src/services/api/case.ts` + `frontend/src/services/api/judgment.ts`（顯式 session 改走 `X-Session-Id`）
  - `frontend/src/hooks/usePolling.ts`（active guard + stop 不可復活）
  - `frontend/src/hooks/useAccessibility.ts` + `frontend/src/pages/QuickExperience/Create/index.tsx`（避免輸入框 Enter 誤觸與重複提交）
  - `frontend/src/pages/QuickExperience/Result/components/EvidenceUploadSection.tsx`（改為先選檔再確認上傳）
  - `frontend/src/utils/storage.ts`（`caseSessionMap` TTL + 上限裁剪）

### 回歸驗證

- 已通過：
  - `backend: npm run build`
  - `frontend: npm run build`
  - `backend: npm test -- --runInBand tests/unit/controllers/case.controller.test.ts tests/unit/controllers/judgment.controller.test.ts tests/unit/middleware/auth.test.ts tests/unit/controllers/session.controller.test.ts tests/unit/routes/session.routes.test.ts tests/unit/services/session.service.test.ts`
  - `frontend: npm run test -- src/services/api/case.test.ts`
  - `frontend: npm run test -- src/hooks/usePolling.test.ts src/hooks/useAccessibility.test.tsx src/services/api/judgment.test.ts src/services/api/case.test.ts`

---

## 測試梳理與覆蓋率衝刺（快速體驗，追加）

本輪針對「快速體驗」流程進行了二次測試梳理，重點是把過時/薄弱測試升級為流程導向測試，並補齊高風險分支（session、授權、重試、上傳、輪詢、恢復）：

- 前端新增/強化：
  - `frontend/src/pages/QuickExperience/Create/index.test.tsx`
  - `frontend/src/pages/QuickExperience/Result/index.test.tsx`
  - `frontend/src/services/request.test.ts`
  - `frontend/src/hooks/useAccessibility.test.tsx`
  - `frontend/src/hooks/useSession.test.ts`
  - `frontend/src/store/caseStore.test.ts`
  - `frontend/src/utils/storage.test.ts`
- 前端對應最小可測性重構：
  - `frontend/src/pages/QuickExperience/Result/index.tsx`（錯誤顯示條件與 fallback 文案路徑、移除不可達防禦分支）
  - `frontend/src/services/request.ts`（移除不可達 try/catch）
  - `frontend/src/hooks/useAccessibility.ts`（移除不可達 enabled 判斷）
  - `frontend/src/hooks/useSession.ts`（finally 改為顯式 success/fail 收斂）

### 本輪驗證結果（追加）

- 前端 quick-flow 測試（11 檔）：
  - `11 files / 194 tests` 全部通過
- 後端 quick-flow 測試（13 suites）：
  - `319 tests` 全部通過

### 後端二次補測（追加）

本輪再補上後端「快速體驗關鍵分支」測試，新增/擴充：

- `backend/tests/unit/utils/validation.test.ts`
- `backend/tests/unit/utils/validation-schemas.test.ts`
- `backend/tests/unit/utils/request.test.ts`
- `backend/tests/unit/controllers/session.controller.test.ts`
- `backend/tests/unit/middleware/auth.test.ts`
- `backend/tests/unit/middleware/rateLimiter.test.ts`
- `backend/tests/unit/controllers/evidence.controller.test.ts`
- `backend/tests/unit/services/judgment.service.test.ts`
- `backend/tests/unit/services/case.service.test.ts`
- `backend/tests/unit/services/pairing.service.test.ts`
- `backend/tests/unit/services/session.service.test.ts`

對應補強重點：
- Session 來源衝突（header/query 不一致）拒絕路徑
- 簽名媒體 token 的 `size/mtime/contentHash` 防重放校驗失敗路徑
- `ValidationUtils` 全方法與 quick-case 相關 Joi schema 驗證
- `getSessionIdFromSources` 的 header array / query-only / 衝突判斷
- `rateLimiter` 在 development/production、user/session/ip/anonymous key、skip 開關路徑
- `evidence.controller` handler 內衝突分支與 filename 解析邊界
- `judgment.service` 非 Error 錯誤正規化與補償路徑（`cache get` 缺值、非 P2002 事務錯誤）
- `pairing.service` 10 次邀請碼碰撞極端路徑
- `session.service` `cleanupExpiredSessions` 默認參數與批次路徑
- `case.service` 短標題 fallback 路徑

### 本輪 scoped 覆蓋率（快速體驗核心檔）

測試命令（節選）：
- `frontend: npx vitest run ... --coverage.include=<quick-flow files>`

覆蓋率結果：
- **Statements: 100%**
- **Lines: 100%**
- **Branches: 100%**

覆蓋檔案包含（快速體驗核心）：
- `pages/QuickExperience/Create/index.tsx`
- `pages/QuickExperience/Result/index.tsx`
- `services/request.ts`
- `services/api/case.ts`
- `services/api/session.ts`
- `store/sessionStore.ts`
- `store/caseStore.ts`
- `hooks/useSession.ts`
- `hooks/usePolling.ts`
- `hooks/useAccessibility.ts`
- `utils/storage.ts`

後端 scoped（quick-flow 相關核心檔）最新結果：
- **Statements: 100%**
- **Lines: 100%**
- **Branches: 100%**

說明：
- 針對先前未覆蓋的防禦性/環境性分支（`rateLimiter`、`authorizeMedia`、`evidence delete filename`、`judgment` 補償與錯誤型別邊界）已完成定向補測並覆蓋。
- 補測過程中暴露 `judgment.service` 在 `error === undefined` 時的日誌處理缺陷；已修復為統一錯誤正規化後再記錄，避免 `TypeError` 導致錯誤路徑提前中斷。
