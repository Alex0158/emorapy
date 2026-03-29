# Known Risks And History

## 1. Session Refresh 與舊案件回訪

### 背景

這是 F01 的歷史高風險點。舊問題是 session refresh 時沒有正確帶舊 session，導致舊案件映射失效。

### 當前應核對的修復機制

- `frontend/src/services/request.ts` 會從失敗請求提取舊 session，再觸發 refresh
- `frontend/src/store/sessionStore.ts` refresh 成功後會同步替換舊映射
- `frontend/src/utils/storage.ts` 提供 `caseSessionMap.replaceSession()`

### 歷史文檔

- `docs/測試/04-業務缺陷報告/已解決/Emorapy-業務缺陷報告-F01-SessionRefresh未攜帶舊Session導致舊案件回訪失效-20260307.md`

### 分析規則

除非當前代碼或測試再次出現反證，否則此項應先視為 `已修復歷史問題`，再評估是否仍有殘餘風險。

## 2. 被告陳述必填的舊認知

### 背景

曾有過時假設把「被告陳述不能為空」當成需求，但當前真實規則並非如此。

### 當前應核對的事實

- `plaintiff_statement` 必填且需達標
- `defendant_statement` 可為空字串或缺省
- 舊測試若與此衝突，應判定為測試或認知過時

### 推薦核對來源

- `backend/src/utils/validation.ts`
- `backend/src/services/case.service.ts`
- `frontend/src/pages/QuickExperience/Create/index.tsx`
- `docs/測試/02-專項測試設計/Emorapy-F01-快速體驗建案與結果測試設計與開發拆解-20260307.md`

## 3. 責任比例不真實

### 背景

這不是單一問題，必須拆層分析。

### 先拆成 4 層

1. `生成邏輯`：AI 結構化評估、文案提取、啟發式校準
2. `保存/回傳`：`plaintiff_ratio`、`defendant_ratio`、`responsibility_ratio`
3. `前端呈現`：結果頁字段回退、比例組件、文案提取
4. `用戶感知`：數值是否讓人感到不公平、說教或脫離敘事

### 關鍵提醒

- 不要直接把「用戶覺得不真實」等同於算法錯誤
- 也不要因為有數值就假設它有足夠說服力
- 要同時看比例數值與 surrounding narrative 是否一致

## 4. claim-session 語義可能不完整

### 背景

登入/註冊後的 `claim-session` 是 F01 與 F09 的銜接點，但實作語義不一定等於文檔想像中的完整「升格」。

### 排查重點

- 當前它到底做了什麼
- 失敗是否非阻斷
- case 是否真正完成身份接續
- 是否已建立足夠測試護欄

### 推薦核對來源

- `backend/src/services/auth.service.ts`
- `frontend/src/store/authStore.ts`
- `backend/tests/unit/services/auth.service.test.ts`
- `backend/tests/unit/routes/auth.routes.test.ts`

## 5. 補證據與判決狀態衝突

### 背景

F01 強調快速閉環，但補證據與判決完成之間存在天然邊界，容易出現 UI 與後端規則不一致。

### 當前應核對的事實

- 哪些狀態允許上傳
- 判決完成後是否關閉
- 上傳失敗是否會破壞主流程
- 用戶是否能理解何時能補傳、何時不能

## 6. 結論書寫規則

每次提到以上風險，都要明確標示：

- 是現存問題、已修復歷史問題，還是待運行驗證
- 影響的是 `閉環穩定性`、`結果可信度`、`轉化`、還是 `公平感`
- 是否已有測試護欄，若有，缺口在哪裡
