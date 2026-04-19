# P03 補充說明

<!-- CORE_DOC_AUDIT_METADATA:START -->
**文檔類型**：證據文檔
**來源時間**：2026-04-18
**上下文**：按日期/P 批次留存的手動回歸結果與摘要
**SSOT 屬性**：非現行 SSOT（僅作證據/歷史/治理參考）
**最後核驗 Commit**：`bd66c2d`
**最後核驗日期**：`2026-04-18`
<!-- CORE_DOC_AUDIT_METADATA:END -->

## 初始失敗取證

### 舊失敗 session

- 測試帳號：`boyfriend@test.com`
- 初始失敗 session：`34550cef-ec86-447d-863c-b66dee942517`

### 初始阻斷點

1. `POST /api/v1/interview/:id/respond` 已返回 `202 Accepted`。
2. 後端已成功生成下一輪 AI 問句並落庫。
3. 前端頁面長時間停在 `我正在整理你的分享......`，輸入框持續 disabled，只剩 `停止` 按鈕。

### 舊失敗裁決

- 舊版 `P03` 失敗點不在 consent、result 頁或返回個人頁出口。
- 真正阻斷點是「訪談聊天主循環」：
  - SSE 終態沒有可靠收斂到 UI；
  - 前端沒有用 canonical session 正確自愈；
  - 使用者在首輪回答後就可能被永久鎖死在 streaming 佔位。

## 根因

### 根因 1：漏掉 `stream.persisted` 時沒有可靠的 canonical 自愈

- 訪談頁原本只依賴 SSE 活事件把 streaming 狀態收斂回正常聊天狀態。
- 如果前端漏掉 `stream.persisted`，頁面會一直保留 optimistic streaming shell。

### 根因 2：fallback 視窗過短

- 第一輪補救只做了 bounded polling，但上限是 `6 * 2.5s = 15s`。
- 真機觀察到實際 AI 回合在高延遲下常落在 `15s+` 才真正持久化下一輪 turn。
- 結果是最後一次輪詢常常發生在下一輪 AI turn 落庫之前，頁面隨後永久卡住。

## 修復內容

### 修復 1：`ready snapshot = persisted` 時立即回拉 canonical session

- 代碼：`frontend/src/pages/Interview/Chat/index.tsx`
- 作用：reconnect 後即使只拿到最新 persisted snapshot，也會：
  - `applyShouldEnd(...)`
  - `finishStreaming()`
  - `syncSessionSilently(sessionId)`

### 修復 2：canonical session 前進時，store 主動結束 optimistic streaming

- 代碼：`frontend/src/store/interviewStore.ts`
- 作用：`syncSessionSilently(sessionId)` 在 `isStreaming=true` 期間，如果發現 canonical session：
  - 已離開 `in_progress`，或
  - `turns.length` 比本地更長，
  會主動清掉：
  - `isStreaming`
  - `streamingText`
  - `streamingStatus`
  - `abortController`

### 修復 3：streaming 期間加入長視窗 canonical fallback polling

- 代碼：`frontend/src/pages/Interview/Chat/index.tsx`
- 作用：
  - streaming 期間每 `2.5s` 靜默同步一次 canonical session；
  - 補救窗口提升到 `24` 次，也就是約 `60s`；
  - 足以覆蓋真機觀察到的 `15-20s` AI 生成延遲。

### 回歸測試

- `frontend/src/pages/Interview/Chat/index.test.tsx`
  - `reconnect 後 ready snapshot 若已是 persisted，應結束 streaming 並同步 canonical session（P03 回歸）`
  - `streaming 中若 SSE 漏掉 persisted，應定期同步 canonical session 自愈（P03 回歸）`
- `frontend/src/store/interviewStore.test.ts`
  - `canonical session 已前進到下一輪 AI 時應結束 optimistic streaming（P03 回歸）`

## 修復後重驗

### 重驗 session

- 測試帳號：`boyfriend@test.com`
- 重驗 session：`bc333002-cdf5-40eb-8f4f-1840eed0993f`

### 重驗過程

1. 登入後進入 `/profile/my-story`，點擊 `繼續聊聊` 進入既有進行中 session。
2. 首次修復驗證：
   - 先前已卡死的回合在 reload 後可正確拉回 canonical turn，頁面顯示第 3 輪 AI 問句。
3. 同頁連續互動重驗：
   - 在已恢復的同一個聊天頁中點擊 quick tag `👍 我同意`。
   - 前端短暫進入 `我正在整理你的分享......`。
   - 約 `22s` 後，頁面自動顯示下一輪 AI 問句：
     - `那很好！如果你願意，我們可以聊聊你最近的一些開心經歷。比如說，有沒有什麼特別的事情讓你感到愉快，或者最近有沒有讓你印象深刻的散步經歷呢？這些都可以幫助我們轉換一下心情。`
   - 同時：
     - 標題中的回合數由 `已進行 3 輪對話` 前進到 `已進行 4 輪對話`
     - 輸入框恢復可用
     - `停止` 按鈕消失，回到正常聊天輸入狀態

### 後端與網路旁證

- 瀏覽器 network：
  - `POST /api/v1/interview/bc333002-cdf5-40eb-8f4f-1840eed0993f/respond => 202`
  - streaming 期間持續有 `GET /api/v1/interview/bc333002-cdf5-40eb-8f4f-1840eed0993f => 200`
- DB/API 交叉驗證：
  - 第 4 輪回覆已成功落庫，並能被 canonical `GET /interview/:id` 讀到。
  - 前端最終也成功把它回寫成可見聊天訊息，而不是永久停在 loading placeholder。

### 修復後證據

- 通過截圖：`p03-stream-recovery-fixed-2026-04-18.png`
- 輸出副本：`output/playwright/p03-stream-recovery-fixed-2026-04-18.png`

## 對 P03 的最終裁決

- `P03` 現在應視為 `PASS`。
- 舊失敗證據保留，用於追溯本輪修復前的真實阻斷點。
- 目前閉環結論是：
  - 訪談頁在真實 AI latency 下，已能依靠 canonical fallback 正常跨過 streaming 終態；
  - 使用者可持續完成多輪對話，不再在 quick-tag 回答後被永久鎖死。
