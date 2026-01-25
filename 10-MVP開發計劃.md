# 熊媽媽法庭 - MVP開發計劃（單人低成本版）

**項目名稱**：熊媽媽法庭（Mother Bear Court）  
**品牌定位**：大愛、包容、保護、呵護  
**開發模式**：單人開發、低成本、快速迭代  
**目標**：先做出MVP驗證核心價值，商業化後續考慮  
**核心原則**：最小可行、快速驗證、低成本、可擴展

> 📝 **本文檔已整合所有深度優化建議，包含完整的產品設計、技術實現、開發流程等詳細內容。**  
> ⚡ **快速體驗優化**：已加入快速體驗模式設計，零門檻進入，單人雙角色介面，AI自動判斷案件類型，責任分比例。詳見[快速體驗優化說明](./快速體驗優化說明.md)。  
> 🔧 **技術實現細節**：詳見[技術實現細節補充](./技術實現細節補充.md)，包含Session管理、錯誤處理、降級方案等所有技術細節。

---

## 📋 MVP核心功能（必須實現）

### 第一階段：核心流程（1-2個月）

#### 1. 用戶系統（快速體驗優化版）⭐️

**核心設計理念**：
- **零門檻進入**：生氣中的用戶需要快速獲得判決，不能讓設置流程成為障礙
- **單人操作**：不需要雙方都註冊，一個用戶可以在同一個介面操作兩個角色
- **即時體驗**：進入後立即可以開始提交案件，無需複雜設置

**快速體驗模式**（優先級最高，必須實現）：
1. **進入首頁** → 直接顯示「立即開始」按鈕（大號、醒目）
2. **選擇模式**：
   - **快速體驗模式**（推薦，默認）：無需註冊，直接使用
   - **完整模式**（可選）：註冊後使用，可保存歷史記錄
3. **單人雙角色介面**：
   - 同一個頁面，左右分屏或上下分屏
   - 左側：角色A（原告）輸入框
   - 右側：角色B（被告）輸入框
   - 雙方可以同時輸入，也可以由同一人代為輸入
   - 標註清楚「角色A」和「角色B」，避免混淆
   - 中間：母熊法官形象，提示「請雙方分別填寫陳述」
4. **提交案件** → 直接進入案件提交流程（無需選擇案件類型，AI自動判斷）
5. **獲得判決** → 立即顯示判決結果（含責任分比例）

**快速體驗模式限制**：
- 不保存案件記錄（可選擇保存，需要註冊）
- 不發送郵件通知
- 不支持和好方案生成（可選，需要註冊）
- 不支持執行追蹤（可選，需要註冊）

**引導註冊機制**：
- 判決後提示：「想要保存記錄和獲得更多功能？立即註冊」
- 一鍵註冊：只需郵箱，快速註冊
- 註冊後自動關聯當前案件

**完整模式**（可選，後續實現）：
- 註冊登錄流程（簡化版）：
  1. 郵箱輸入 → 驗證格式
  2. 發送驗證郵件 → 6位驗證碼（5分鐘有效）
  3. 輸入驗證碼 → 驗證
  4. 設置密碼 → 強度檢查（至少8位，包含字母和數字）
  5. 完成註冊 → 自動登錄
- 配對系統（可選，完整模式下使用）
- **進階功能**（雙方都註冊並配對後解鎖）⭐️：
  - **背景設定**：教育背景、文化背景、宗教背景、性格特質等
  - **關係檔案**：關係階段、底線雷點、喜好偏好、溝通模式、歷史記錄等
  - **個性化判決**：AI基於背景信息和關係檔案生成更貼切的判決
  - **精準和好方案**：基於關係檔案推薦更適合的和好方案

**技術實現**：
- 前端：React + TypeScript（或Vue）
- 後端：Node.js + Express（或Python Flask）
- 數據庫：PostgreSQL（免費版）或SQLite（開發階段）
- 認證：JWT Token

#### 2. 案件提交系統（快速體驗優化版）⭐️

**核心優化**：
- **AI自動判斷案件類型**：用戶不需要手動選擇，AI根據雙方陳述自動識別
- **單人雙角色介面**：同一個頁面，兩個輸入框，可以同時輸入或分別輸入
- **極簡流程**：直接填寫 → 提交 → 獲得判決

**案件創建流程**（極簡版）：

**步驟1：填寫雙方陳述**（單人雙角色介面）
- **介面設計**：
  - **左右分屏**或**上下分屏**：
    - 左側/上方：角色A（原告）輸入區域
    - 右側/下方：角色B（被告）輸入區域
    - 中間：母熊法官形象，提示「請雙方分別填寫陳述」
  - **輸入框設計**：
    - 標題：「角色A的陳述」/「角色B的陳述」
    - 引導文字：「發生了什麼事？你的感受是什麼？你希望對方怎麼做？」
    - 字數要求：最少50字，最多2000字
    - 實時字數統計
    - 支持Markdown格式（可選）
  - **提交按鈕**：
    - 雙方都填寫完成後，顯示「提交案件」按鈕
    - 如果只有一方填寫，顯示「等待對方填寫」或「我可以代為填寫」（快速體驗模式）

**步驟2：上傳證據**（可選，快速體驗模式可跳過）
- 格式：JPG、PNG、GIF（圖片），MP4（視頻）
- 大小：單個文件不超過5MB
- 數量：最多3張圖片或1個視頻
- 快速體驗模式：可完全跳過此步驟

**步驟3：AI自動分析**（後台自動執行）
- **AI自動判斷案件類型**：
  - 基於雙方陳述內容，使用NLP模型自動識別案件類型
  - 不需要用戶手動選擇
  - 識別結果顯示在判決書中（可選，用戶可查看）
- **提交案件**：
  - 點擊「提交案件」按鈕
  - 顯示「AI正在分析中...」進度提示
  - 預計等待時間：30-60秒

**步驟4：獲得判決**（核心流程結束）
- 立即顯示判決結果
- 包含：問題分析、判決結果、**責任分比例**、具體建議
- 可選擇是否生成和好方案（可選，需要註冊）
- 可選擇是否保存記錄（可選，需要註冊）

**核心流程結束**：到這裡，用戶已經獲得判決，核心價值已實現。

**可選後續流程**（不強制，用戶可選擇）：
- 和好方案生成（可選）
- 執行追蹤（可選）
- 保存記錄（可選，需要註冊）

**技術實現**：
- 文件上傳：本地存儲（開發階段）或雲存儲（生產環境）
- 圖片處理：sharp（Node.js）或Pillow（Python）
- 郵件發送：Nodemailer（Node.js）或SendGrid（免費額度）

#### 3. 審理模式（優化版）

**只實現遠程審理模式**（MVP階段）：
- **獨立介面**：
  - 各自介面操作
  - 顯示對方當前狀態（「對方正在填寫陳述」等）
  - 進度同步顯示
- **實時同步**（簡化版）：
  - 簡單輪詢機制（每5秒查詢一次）
  - 對方完成操作時推送通知（郵件）
  - 進度條顯示雙方完成情況
- **等待優化內容**（新增）：
  - **推薦案例**：相似案例推薦、熱門案例推薦、成功案例推薦
  - **關係技巧文章**：溝通技巧、衝突解決技巧、關係維護技巧
  - **互動小遊戲**：關係測試題、性格測試、關係健康自測（MVP階段：簡單測試題）
  - **進度顯示**：當前階段顯示、預計等待時間、對方操作狀態

**技術實現**：
- 實時同步：簡單的輪詢機制（每5秒查詢一次）
- 狀態管理：服務器端狀態存儲
- 進度顯示：前端顯示當前階段

#### 4. AI判決生成（快速體驗優化版）⭐️

**AI自動判斷案件類型**（新增）：
- 使用NLP模型（BERT/GPT）分析雙方陳述
- 自動識別案件類型（生活習慣、消費決策、社交關係、價值觀、情感需求、其他）
- 識別結果用於優化判決生成，但不強制用戶查看

**Prompt模板設計**（優化版，加入責任分比例）：
```
角色設定：
你是一位溫暖、公正的母熊法官，你的使命是保護和呵護每一對情侶。
即使是在法庭，你也會用大愛、包容、保護的方式幫助他們解決衝突。

任務：
基於以下案件信息，生成一份溫暖、公正、實用的判決書。

案件信息：
- 案件類型：[AI自動識別]
- 角色A陳述：[陳述]
- 角色B陳述：[陳述]
- 證據：[證據描述]

判決書要求：
1. 問題分析（200-300字）：
   - 識別核心問題
   - 分析雙方立場
   - 理解雙方需求

2. 判決結果（100-200字）：
   - 明確判決（支持角色A/支持角色B/雙方各承擔責任）
   - **責任分比例**（必須）：
     - 以百分比形式明確雙方責任（如：角色A 60%，角色B 40%）
     - 或明確責任等級（如：角色A主要責任，角色B次要責任）
     - 說明責任分配的理由
   - 簡要說明理由
   - 強調理解和包容

3. 具體建議（300-500字）：
   - 提供3-5條具體行動建議
   - 每條建議要可執行
   - 建議要溫暖、實用

4. 關係修復建議（200-300字，可選）：
   - 如何修復關係
   - 如何重建信任
   - 如何預防類似衝突

語言風格：
- 溫暖、親和
- 專業但不冷漠
- 鼓勵而非指責
- 體現「保護和呵護」的理念

輸出格式：Markdown格式，必須包含責任分比例
```

**判決書格式標準化**（加入責任分比例）：
```markdown
# 判決書

## 📋 案件信息
- **案件類型**：[AI自動識別]
- **提交時間**：[時間]
- **判決時間**：[時間]

## 🔍 問題分析
[200-300字的問題分析]

## ⚖️ 判決結果

**責任分比例**：
- 角色A（原告）：[X]% 責任
- 角色B（被告）：[Y]% 責任
- 視覺化展示：[進度條或圓餅圖]

**判決說明**：
[100-200字的判決結果，包含責任分配理由]

## 💡 具體建議
1. [建議1]
2. [建議2]
3. [建議3]
...

## 💝 關係修復建議（可選）
[200-300字的關係修復建議]

---
*本判決由AI生成，僅供參考。如有嚴重問題，建議尋求專業幫助。*
```

**個性化機制**：
- 基於案件類型：不同類型使用不同的語言風格
- 基於衝突嚴重程度：嚴重衝突使用更溫和的語言
- 基於關係階段：新戀情 vs 長期關係使用不同建議

**技術實現**（優化版）：
- AI服務：OpenAI API（GPT-3.5-turbo，成本低）
- **錯誤處理**：API調用失敗時重試（最多3次，指數退避）
- **成本控制**：
  - 每日限額：設置每日API調用上限
  - 用戶限額：免費用戶每日3次
  - Token限制：控制Prompt和Response長度
- **緩存機制**：
  - 相似案件使用緩存判決
  - 緩存時間：24小時
  - 緩存鍵：案件類型 + 關鍵詞
  - 緩存存儲：Redis（生產環境）或內存緩存（開發環境）

**判決書閱讀體驗優化**（新增）：
- **判決書摘要**：
  - 關鍵信息提取：核心問題（1句話）、判決結果（1句話）、關鍵建議（3-5條）
  - 視覺化展示：卡片式設計、重點標註、圖標輔助
- **判決書導讀**：
  - 章節導航：問題分析、判決結果、具體建議、關係修復建議
  - 重點標註：關鍵句子高亮、重要建議標記、可收藏重點內容
- **互動功能**（MVP階段簡化）：
  - 語音播放：支持語音閱讀（使用瀏覽器TTS API）
  - 分享功能：分享給朋友（匿名）、生成分享圖片
  - 收藏功能：收藏判決書、收藏重點建議

#### 5. 和好方案生成（可選功能，不強制）⭐️

**設計理念**：
- 和好方案是**可選功能**，不是核心流程的必須部分
- 用戶獲得判決後，可以選擇是否生成和好方案
- 快速體驗模式下，和好方案需要註冊後才能使用
- 核心流程：提交 → AI分析 → 判決 → **結束**（和好方案可選）

**方案模板庫**（20+模板）：
- **日常活動**（10個）：
  - 一起做飯、看電影、散步、購物、運動、閱讀、遊戲、旅行、約會、聊天
- **特殊活動**（5個）：
  - 重溫回憶、嘗試新體驗、慶祝紀念日、驚喜活動、深度對話
- **溝通練習**（5個）：
  - 「我」語句練習、傾聽練習、共情練習、衝突解決練習、情感表達練習

**執行難度評估機制**（新增）：
- **評估維度**：
  - 時間成本（1-5分）
  - 金錢成本（1-5分）
  - 情感成本（1-5分）
  - 技能要求（1-5分）
- **難度分級**：
  - 簡單（總分4-8）：1-2天可完成
  - 中等（總分9-12）：3-7天可完成
  - 困難（總分13-20）：1-4週可完成
- **智能推薦**：
  - 優先推薦簡單方案
  - 逐步推薦中等和困難方案
  - 根據執行情況調整推薦

**個性化匹配機制**（優化版）：
- **基於案件類型匹配**：
  - 生活習慣衝突 → 習慣養成活動
  - 價值觀衝突 → 理解尊重活動
  - 情感需求衝突 → 親密互動活動
- **基於關係階段匹配**：
  - 新戀情（<6個月）→ 建立親密感活動
  - 穩定關係（6個月-2年）→ 維護關係活動
  - 長期關係（>2年）→ 深化關係活動
- **基於執行能力匹配**：
  - 根據歷史執行情況
  - 根據用戶反饋
  - 動態調整難度

**方案呈現方式**（優化版）：
- **視覺化呈現**：
  - 卡片式設計，每張卡片一個建議
  - 配圖和插畫增強視覺效果
  - 母熊法官形象引導
  - 難度標識（簡單/中等/困難，帶評分）
  - 時間標識（短期/中期/長期）
- **互動式呈現**：
  - **智能推薦**：
    - 推薦算法：基於案件類型、關係階段、執行能力、歷史數據
    - 推薦展示：「最適合你」標籤、推薦理由說明、優先展示推薦方案
  - **方案對比**（MVP階段簡化）：
    - 對比維度：時間成本、難度等級、預期效果
    - 對比展示：並排對比、差異標註
  - **方案預覽**（MVP階段簡化）：
    - 預覽內容：執行步驟預覽、注意事項預覽
    - 預覽方式：彈窗預覽
  - **方案收藏**：
    - 收藏管理：收藏喜歡的方案、標記收藏原因
    - 收藏使用：快速查看收藏、執行收藏方案
  - 雙方可以選擇喜歡的方案
  - 可以自定義和調整方案
  - 可以標記完成狀態

**技術實現**（優化版）：
- 同樣使用AI生成（OpenAI API）
- 方案模板：預設方案模板庫（20+模板）
- 個性化：基於案件類型、關係階段、執行能力匹配模板
- 錯誤處理：API調用失敗時重試
- 成本控制：與判決生成共享限額

#### 6. 執行追蹤（優化版）

**執行確認**：
- 雙方確認是否接受判決
- 如有一方不接受，可申請重新審理
- 雙方都接受後，進入執行階段

**和好方案執行**：
- 選擇和好方案（智能推薦、方案對比、方案預覽）
- 確認執行計劃
- 開始執行

**執行打卡**（優化版）：
- **打卡內容**：
  - 執行時間
  - 執行內容
  - 執行感受
  - 執行照片或文字（可選）
- **打卡方式**：
  - 雙方獨立打卡
  - 自動提醒打卡（每天一次，可設置）
- **執行反饋**：
  - 收集執行反饋
  - 分析執行效果
  - 調整執行方案（如需要）

**執行支持機制**（新增）：
- **執行提醒**：
  - 智能提醒系統（根據執行進度調整提醒頻率）
  - 多種提醒方式（郵件、推送通知）
- **執行指導**：
  - 提供詳細執行步驟
  - 提供執行技巧
  - 提供執行注意事項
- **執行失敗處理**（新增）：
  - 執行失敗後的替代方案
  - 降低難度重新推薦
  - 提供鼓勵和支持

**後續跟進**（優化版）：
- 7天後自動詢問：問題是否真正解決、和好方案執行情況
- 30天後回訪：關係改善情況、和好方案效果
- 數據統計：為用戶提供關係健康報告（簡化版）

**技術實現**：
- 狀態管理：數據庫狀態字段
- 定時任務：Node-cron（Node.js）或APScheduler（Python）
- 郵件提醒：自動發送郵件

---

## 🛠️ 技術棧建議（低成本）

### 前端
- **框架**：React + TypeScript（或Vue 3）
- **UI庫**：Ant Design（React）或Element Plus（Vue）- 免費
- **狀態管理**：Zustand（React）或Pinia（Vue）- 輕量
- **構建工具**：Vite - 快速
- **部署**：Vercel（免費）或Netlify（免費）

### 後端
- **框架**：Node.js + Express（或Python Flask）
- **數據庫**：
  - 開發：SQLite（免費，無需配置）
  - 生產：PostgreSQL（免費版，如Supabase）
- **認證**：JWT Token
- **文件存儲**：
  - 開發：本地存儲
  - 生產：Cloudinary（免費額度）或AWS S3（免費額度）
- **郵件服務**：SendGrid（免費額度）或Nodemailer（自建SMTP）
- **部署**：Railway（免費額度）或Render（免費版）

### AI服務
- **首選**：OpenAI API（GPT-3.5-turbo，成本低）
- **備選**：本地部署開源模型（Llama 2，免費但需要GPU）
- **成本控制**：設置API調用限制，避免超支

### 開發工具
- **版本控制**：Git + GitHub（免費）
- **項目管理**：GitHub Projects（免費）
- **CI/CD**：GitHub Actions（免費）
- **監控**：Sentry（免費額度）

---

## 📅 開發時間表（單人開發）

### 第1週：項目搭建
- [ ] 搭建前端項目（React/Vue）
- [ ] 搭建後端項目（Node.js/Python）
- [ ] 配置數據庫（SQLite）
- [ ] 配置開發環境
- [ ] 部署測試環境

### 第2-3週：用戶系統
- [ ] 實現郵箱註冊（含驗證碼驗證、6位驗證碼、5分鐘有效期）
- [ ] 實現密碼登錄（含忘記密碼、密碼強度檢查）
- [ ] 實現用戶資料（基本信息、偏好設置）
- [ ] 實現配對系統（邀請碼生成、配對確認、安全機制、防暴力破解）
- [ ] 實現郵件發送（註冊驗證、配對通知）
- [ ] 實現新手引導（簡化版：歡迎頁、註冊引導、示例案例）
- [ ] 測試用戶流程

### 第4-5週：案件提交系統
- [ ] 實現案件創建（案件類型細化：6大類24子類、陳述引導：4個引導問題）
- [ ] 實現證據上傳（文件驗證、隱私保護、圖片壓縮、拖拽上傳）
- [ ] 實現雙方提交（原告提交、被告答辯，含引導問題）
- [ ] 實現郵件通知（案件創建、對方提交提醒）
- [ ] 實現情緒安撫機制（簡化版：提示、暫存草稿、12小時冷靜期）
- [ ] 實現等待優化內容（推薦案例、關係技巧文章、簡單測試題）
- [ ] 測試案件流程

### 第6-7週：審理系統
- [ ] 實現審理流程
- [ ] 實現狀態管理
- [ ] 實現進度顯示
- [ ] 實現輪詢機制
- [ ] 測試審理流程

### 第8-9週：AI判決生成
- [ ] 設計Prompt模板（完整版，包含角色設定、判決書要求、語言風格）
- [ ] 集成OpenAI API（錯誤處理、重試機制：最多3次指數退避、成本控制）
- [ ] 實現判決書生成（格式標準化、個性化機制：基於案件類型、衝突嚴重程度、關係階段）
- [ ] 實現判決書展示（摘要、導讀、互動功能：語音播放、分享、收藏）
- [ ] 實現緩存機制（相似案件緩存：24小時、案件類型+關鍵詞）
- [ ] 實現判決書摘要（關鍵信息提取、視覺化展示）
- [ ] 測試判決生成

### 第10-11週：和好方案生成
- [ ] 設計方案模板庫（20+模板：日常活動10個、特殊活動5個、溝通練習5個）
- [ ] 實現執行難度評估（4個維度：時間、金錢、情感、技能，難度分級：簡單/中等/困難）
- [ ] 實現方案生成（個性化匹配：基於案件類型、關係階段、執行能力）
- [ ] 實現方案展示（智能推薦、方案對比、方案預覽、方案收藏）
- [ ] 實現智能推薦算法（基於案件類型、關係階段、執行能力、歷史數據）
- [ ] 實現方案選擇（雙方選擇、自定義調整）
- [ ] 測試方案功能

### 第12週：執行追蹤
- [ ] 實現執行確認（雙方確認、重新審理申請）
- [ ] 實現執行打卡（打卡內容、打卡方式、執行反饋）
- [ ] 實現執行支持機制（執行提醒、執行指導、執行失敗處理）
- [ ] 實現定時回訪（7天、30天自動詢問）
- [ ] 測試執行流程

### 第13-14週：優化和測試
- [ ] UI/UX優化：
  - 新手引導完善
  - 等待體驗優化（推薦內容、進度顯示）
  - 判決書閱讀體驗優化（摘要、導讀、互動功能）
  - 和好方案選擇體驗優化（智能推薦、方案預覽）
  - 微交互設計（按鈕反饋、加載狀態、動畫效果）
- [ ] 性能優化：
  - 數據庫索引優化
  - API緩存機制
  - 圖片優化和壓縮
  - 前端代碼分割和懶加載
- [ ] 錯誤處理：
  - 統一錯誤處理規範
  - 友好錯誤提示
  - 錯誤日誌記錄
- [ ] 安全性檢查：
  - 密碼加密（bcrypt）
  - JWT安全（過期時間、刷新機制）
  - 輸入驗證（XSS防護、SQL注入防護）
  - 文件上傳安全（類型驗證、大小限制）
  - 敏感信息保護（自動檢測、手動遮擋）
- [ ] 代碼質量：
  - ESLint配置和檢查
  - Prettier格式化
  - 單元測試（核心邏輯80%+覆蓋率）
  - 代碼審查
- [ ] 全面測試：
  - 功能測試（所有P0功能）
  - 集成測試（API端到端測試）
  - 用戶測試（邀請5-10個測試用戶）

### 第15-16週：部署和上線
- [ ] 生產環境部署
- [ ] 域名配置
- [ ] SSL證書配置
- [ ] 監控配置
- [ ] 上線準備

---

## 💰 成本估算（MVP階段）

### 月度成本（最低配置）

**開發階段（前3個月）**：
- 域名：$10/年（一次性）
- 開發工具：$0（全部免費）
- **總計**：約$1/月

**生產環境（上線後）**：
- 前端部署（Vercel/Netlify）：$0（免費版）
- 後端部署（Railway/Render）：$0-5/月（免費版或最低配置）
- 數據庫（Supabase免費版）：$0
- 文件存儲（Cloudinary免費額度）：$0
- 郵件服務（SendGrid免費額度）：$0
- AI服務（OpenAI API）：$10-50/月（根據使用量）
- 域名：$1/月
- **總計**：約$11-56/月

**預算建議**：
- 開發階段：$0-10/月
- MVP上線：$20-60/月
- 預留緩衝：$100/月

---

## 🎯 MVP功能優先級

### P0（必須實現，快速體驗核心流程）⭐️
1. ✅ **快速體驗模式**（無需註冊，單人雙角色介面）
2. ✅ **案件提交**（單人雙角色介面，AI自動判斷案件類型）
3. ✅ **AI判決生成**（含責任分比例、完整Prompt、錯誤處理）
4. ✅ **判決結果展示**（問題分析、判決結果、責任分比例、具體建議）

### P1（重要但可簡化）
1. ⚠️ **用戶註冊登錄**（完整模式，可選）
2. ⚠️ **和好方案生成**（可選功能，不強制）
3. ⚠️ **執行追蹤**（可選功能，不強制）
4. ⚠️ **證據上傳**（可選，快速體驗模式可跳過）

### P2（進階功能，雙方都註冊並配對後解鎖）
1. ⏸️ **背景設定系統**（用戶背景表、關係檔案表）
2. ⏸️ **個性化判決**（基於背景信息和關係檔案的AI判決）
3. ⏸️ **精準和好方案**（基於關係檔案的個性化推薦）
4. ⏸️ **關係健康監測**（基於關係檔案的關係健康分析）

### P1（重要但可簡化）
1. ⚠️ 新手引導（簡化版：歡迎頁、註冊引導、示例案例）
2. ⚠️ 等待優化內容（簡化版：推薦案例、關係技巧文章、簡單測試題）
3. ⚠️ 判決書閱讀優化（簡化版：摘要、導讀、收藏功能）
4. ⚠️ 和好方案選擇優化（簡化版：智能推薦、方案預覽）
5. ⚠️ 情緒安撫機制（簡化版：提示、暫存草稿、12小時冷靜期）
6. ⚠️ 郵件通知（基本通知即可）

### P2（後續優化）
1. ⏸️ 協同審理模式（先只做遠程）
2. ⏸️ 案例庫（後續添加）
3. ⏸️ 社區功能（後續添加）
4. ⏸️ 關係健康監測（後續添加）
5. ⏸️ 案件嚴重程度分級（後續添加）
6. ⏸️ 情緒檢測和調節（後續添加）
7. ⏸️ 無障礙設計（後續添加）

---

## 🚀 快速啟動指南

### 1. 技術選型決策

**推薦方案（最簡單）**：
- 前端：React + Vite + Ant Design
- 後端：Node.js + Express
- 數據庫：SQLite（開發）→ Supabase（生產）
- AI：OpenAI API

**替代方案（如果熟悉Python）**：
- 前端：React + Vite + Ant Design
- 後端：Python + Flask
- 數據庫：SQLite（開發）→ Supabase（生產）
- AI：OpenAI API

### 2. 項目結構

```
mother-bear-court/
├── frontend/          # 前端項目
│   ├── src/
│   │   ├── pages/     # 頁面
│   │   ├── components/# 組件
│   │   ├── api/       # API調用
│   │   └── utils/     # 工具函數
│   └── package.json
├── backend/           # 後端項目
│   ├── src/
│   │   ├── routes/    # 路由
│   │   ├── models/    # 數據模型
│   │   ├── services/  # 業務邏輯
│   │   └── utils/     # 工具函數
│   └── package.json
└── README.md
```

### 3. 數據庫設計（完整版）

**用戶表（users）**：
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(50),
  avatar_url VARCHAR(500),
  gender VARCHAR(10),
  age INTEGER,
  relationship_status VARCHAR(20) NOT NULL,
  language VARCHAR(10) DEFAULT 'zh',
  timezone VARCHAR(50),
  notification_enabled BOOLEAN DEFAULT true,
  privacy_level VARCHAR(20) DEFAULT 'private',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
```

**用戶背景表（user_profiles）**（進階功能，可選）：
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 教育背景
  education_level VARCHAR(50), -- 高中/大專/本科/碩士/博士/其他
  major_field VARCHAR(100),
  university VARCHAR(200),
  -- 文化背景
  ethnicity VARCHAR(100),
  cultural_identity TEXT[], -- 多選：東方文化/西方文化等
  upbringing_environment VARCHAR(50), -- 城市/鄉村/小鎮
  -- 宗教背景
  religion VARCHAR(50), -- 無/基督教/伊斯蘭教/佛教等
  religious_practice_level VARCHAR(50), -- 不實踐/偶爾/經常/嚴格
  -- 家庭背景
  family_structure VARCHAR(50), -- 獨生子女/有兄弟姐妹/單親/重組
  parents_relationship VARCHAR(50), -- 和諧/一般/緊張/離異
  family_economic_status VARCHAR(50),
  -- 性格特質
  mbti_type VARCHAR(10),
  big_five_personality JSONB, -- {openness, conscientiousness, extraversion, agreeableness, neuroticism}
  communication_style VARCHAR(50), -- 直接/間接/理性/感性
  -- 其他
  occupation VARCHAR(100),
  interests TEXT[], -- 多選
  core_values TEXT[], -- 多選：家庭/事業/自由/穩定等
  -- 隱私設置
  profile_visibility VARCHAR(20) DEFAULT 'private', -- private/partner_only/public
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
```

**關係檔案表（relationship_profiles）**（進階功能，可選）：
```sql
CREATE TABLE relationship_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pairing_id UUID NOT NULL REFERENCES pairings(id) ON DELETE CASCADE,
  -- 關係基本信息
  relationship_duration_days INTEGER, -- 在一起多少天
  relationship_stage VARCHAR(50), -- 新戀情/穩定關係/長期關係/已婚
  milestones JSONB, -- [{type: "first_date", date: "2024-01-01"}, ...]
  -- 地理位置
  user1_location VARCHAR(200),
  user2_location VARCHAR(200),
  is_long_distance BOOLEAN DEFAULT false,
  distance_km INTEGER,
  meeting_frequency VARCHAR(50), -- 每天/每週/每月/很少
  -- 底線和雷點
  user1_bottom_lines TEXT[], -- 角色A的底線
  user2_bottom_lines TEXT[], -- 角色B的底線
  common_bottom_lines TEXT[], -- 共同底線
  historical_red_flags JSONB, -- 從歷史案件中提取的雷點
  -- 喜好和偏好
  user1_preferences JSONB, -- {activities: [], foods: [], movies: [], music: []}
  user2_preferences JSONB,
  common_preferences JSONB,
  dislikes JSONB,
  -- 溝通模式
  communication_frequency VARCHAR(50), -- 每天/每週幾次/偶爾
  preferred_communication_methods TEXT[], -- 文字/語音/視頻/面對面
  conflict_communication_style VARCHAR(50), -- 冷戰/爭吵/理性討論/尋求第三方
  -- 關係優勢和挑戰
  relationship_strengths TEXT[], -- 雙方認為的優勢
  relationship_challenges TEXT[], -- 雙方認為的挑戰
  -- 歷史記錄（自動生成）
  historical_case_types JSONB, -- 過往案件類型分布
  historical_responsibility_trends JSONB, -- 責任分比例趨勢
  reconciliation_plan_execution_rate DECIMAL(5,2), -- 和好方案執行率
  relationship_improvement_trend VARCHAR(50), -- 改善/穩定/惡化
  -- 元數據
  completion_percentage INTEGER DEFAULT 0, -- 檔案完成度
  last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_relationship_profiles_pairing_id ON relationship_profiles(pairing_id);
CREATE INDEX idx_relationship_profiles_stage ON relationship_profiles(relationship_stage);
```

**配對表（pairings）**：
```sql
CREATE TABLE pairings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES users(id),
  user2_id UUID REFERENCES users(id),
  invite_code VARCHAR(6) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, active, cancelled
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX idx_pairings_invite_code ON pairings(invite_code);
CREATE INDEX idx_pairings_user1_id ON pairings(user1_id);
CREATE INDEX idx_pairings_user2_id ON pairings(user2_id);
CREATE INDEX idx_pairings_status ON pairings(status);
```

**案件表（cases）**：
```sql
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pairing_id UUID NOT NULL REFERENCES pairings(id),
  title VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL,
  sub_type VARCHAR(50),
  plaintiff_id UUID NOT NULL REFERENCES users(id),
  defendant_id UUID NOT NULL REFERENCES users(id),
  plaintiff_statement TEXT NOT NULL,
  defendant_statement TEXT,
  status VARCHAR(20) DEFAULT 'draft', -- draft, submitted, in_progress, completed, cancelled
  mode VARCHAR(20) DEFAULT 'remote', -- remote, collaborative
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_cases_pairing_id ON cases(pairing_id);
CREATE INDEX idx_cases_plaintiff_id ON cases(plaintiff_id);
CREATE INDEX idx_cases_defendant_id ON cases(defendant_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_type ON cases(type);
CREATE INDEX idx_cases_created_at ON cases(created_at);
```

**證據表（evidences）**：
```sql
CREATE TABLE evidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  file_url VARCHAR(500) NOT NULL,
  file_type VARCHAR(20) NOT NULL, -- image, video
  file_size INTEGER,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_evidences_case_id ON evidences(case_id);
CREATE INDEX idx_evidences_user_id ON evidences(user_id);
```

**判決表（judgments）**：
```sql
CREATE TABLE judgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  judgment_content TEXT NOT NULL,
  summary TEXT,
  ai_model VARCHAR(50) NOT NULL,
  prompt_version VARCHAR(20),
  user1_acceptance BOOLEAN,
  user2_acceptance BOOLEAN,
  user1_rating INTEGER, -- 1-5
  user2_rating INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_judgments_case_id ON judgments(case_id);
CREATE INDEX idx_judgments_created_at ON judgments(created_at);
```

**和好方案表（reconciliation_plans）**：
```sql
CREATE TABLE reconciliation_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judgment_id UUID NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
  plan_content TEXT NOT NULL,
  plan_type VARCHAR(50) NOT NULL, -- activity, communication, intimacy
  difficulty_level VARCHAR(20) NOT NULL, -- easy, medium, hard
  estimated_duration INTEGER, -- days
  user1_selected BOOLEAN DEFAULT false,
  user2_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reconciliation_plans_judgment_id ON reconciliation_plans(judgment_id);
CREATE INDEX idx_reconciliation_plans_difficulty ON reconciliation_plans(difficulty_level);
```

**執行記錄表（execution_records）**：
```sql
CREATE TABLE execution_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_plan_id UUID NOT NULL REFERENCES reconciliation_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL, -- confirm, checkin, complete
  status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, skipped
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_execution_records_plan_id ON execution_records(reconciliation_plan_id);
CREATE INDEX idx_execution_records_user_id ON execution_records(user_id);
CREATE INDEX idx_execution_records_status ON execution_records(status);
```

**郵件驗證表（email_verifications）**：
```sql
CREATE TABLE email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  type VARCHAR(20) NOT NULL, -- register, reset_password
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_verifications_email ON email_verifications(email);
CREATE INDEX idx_email_verifications_code ON email_verifications(code);
CREATE INDEX idx_email_verifications_expires_at ON email_verifications(expires_at);
```

### 4. API設計（RESTful完整版）

**認證相關**：
```
POST /api/v1/auth/register
  Request: { email, password, nickname }
  Response: { user, token }

POST /api/v1/auth/login
  Request: { email, password }
  Response: { user, token }

POST /api/v1/auth/verify-email
  Request: { email, code }
  Response: { success }

POST /api/v1/auth/reset-password
  Request: { email }
  Response: { success }

POST /api/v1/auth/reset-password-confirm
  Request: { email, code, new_password }
  Response: { success }
```

**用戶相關**：
```
GET /api/v1/user/profile
  Headers: { Authorization: Bearer <token> }
  Response: { user }

PUT /api/v1/user/profile
  Headers: { Authorization: Bearer <token> }
  Request: { nickname, avatar_url, ... }
  Response: { user }
```

**配對相關**：
```
POST /api/v1/pairing/create
  Headers: { Authorization: Bearer <token> }
  Response: { pairing: { id, invite_code } }

POST /api/v1/pairing/join
  Headers: { Authorization: Bearer <token> }
  Request: { invite_code }
  Response: { pairing }

GET /api/v1/pairing/status
  Headers: { Authorization: Bearer <token> }
  Response: { pairing }
```

**案件相關**：
```
POST /api/v1/cases
  Headers: { Authorization: Bearer <token> }
  Request: { pairing_id, title, type, sub_type, statement, evidence_urls }
  Response: { case }

GET /api/v1/cases/:id
  Headers: { Authorization: Bearer <token> }
  Response: { case }

PUT /api/v1/cases/:id/statement
  Headers: { Authorization: Bearer <token> }
  Request: { statement }
  Response: { case }

POST /api/v1/cases/:id/evidence
  Headers: { Authorization: Bearer <token> }
  Request: { file }
  Response: { evidence }
```

**判決相關**：
```
POST /api/v1/cases/:id/judgment
  Headers: { Authorization: Bearer <token> }
  Response: { judgment }

GET /api/v1/cases/:id/judgment
  Headers: { Authorization: Bearer <token> }
  Response: { judgment }

POST /api/v1/judgments/:id/accept
  Headers: { Authorization: Bearer <token> }
  Request: { accepted, rating }
  Response: { success }
```

**和好方案相關**：
```
POST /api/v1/judgments/:id/reconciliation-plans
  Headers: { Authorization: Bearer <token> }
  Response: { plans: [...] }

GET /api/v1/judgments/:id/reconciliation-plans
  Headers: { Authorization: Bearer <token> }
  Response: { plans: [...] }

POST /api/v1/reconciliation-plans/:id/select
  Headers: { Authorization: Bearer <token> }
  Response: { success }
```

**執行相關**：
```
POST /api/v1/execution/confirm
  Headers: { Authorization: Bearer <token> }
  Request: { plan_id }
  Response: { success }

POST /api/v1/execution/checkin
  Headers: { Authorization: Bearer <token> }
  Request: { plan_id, notes }
  Response: { success }

GET /api/v1/execution/status
  Headers: { Authorization: Bearer <token> }
  Response: { status }
```

**錯誤處理規範**：
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

**錯誤碼定義**：
- `400 Bad Request`：請求參數錯誤
- `401 Unauthorized`：未認證
- `403 Forbidden`：無權限
- `404 Not Found`：資源不存在
- `409 Conflict`：資源衝突
- `422 Unprocessable Entity`：業務邏輯錯誤
- `500 Internal Server Error`：服務器錯誤

---

## 📝 開發注意事項

### 1. 代碼質量
- **保持簡單**：不要過度設計
- **快速迭代**：先實現功能，再優化
- **代碼註釋**：關鍵邏輯要有註釋
- **錯誤處理**：基本的錯誤處理即可

### 2. 安全性（基本）
- **密碼加密**：使用bcrypt
- **JWT Token**：設置過期時間
- **輸入驗證**：基本的輸入驗證
- **SQL注入防護**：使用ORM或參數化查詢

### 3. 性能（基本）
- **數據庫索引**：關鍵字段加索引
- **圖片優化**：上傳時壓縮圖片
- **API緩存**：簡單的緩存機制
- **分頁**：列表數據分頁

### 4. 用戶體驗（基本）
- **加載提示**：操作時顯示加載狀態
- **錯誤提示**：友好的錯誤提示
- **響應式設計**：適配手機和電腦
- **基本動畫**：簡單的過渡動畫

---

## 🎯 MVP驗證指標（優化版）

### 核心指標
- **用戶指標**：
  - 用戶註冊數：目標100人
  - 配對成功率：目標80%
  - 次日留存率：目標40%
  - 7日留存率：目標25%
- **功能指標**：
  - 案件提交量：每日、每週、每月
  - 案件完成率：目標60%（提交到完成）
  - 判決滿意度：目標70%（1-5星評分）
  - 和好方案生成率：目標80%（判決後生成）
  - 和好方案執行率：目標50%（執行和好方案）
  - 和好方案成功率：目標60%（執行後關係改善）
- **質量指標**：
  - 判決準確性：目標70%（用戶認可判決）
  - 問題解決率：目標60%（問題真正解決）
  - 關係改善率：目標50%（關係改善）
  - 衝突復發率：目標<30%（類似衝突復發）

### 用戶反饋機制（優化版）
- **反饋渠道**：
  - 產品內反饋入口（右下角浮動按鈕）
  - 反饋表單（簡單3個問題：功能使用情況、問題、建議）
  - 郵件反饋：support@motherbearcourt.com
- **反饋處理流程**：
  1. 收集反饋 → 2. 分類標記（Bug報告/功能建議/使用問題/其他）→ 3. 優先級排序 → 4. 處理 → 5. 回覆用戶
- **處理方式**：
  - 24小時內響應
  - 48小時內給出解決方案
  - 優先修復關鍵問題（P0功能相關）
  - 跟蹤處理結果

---

## 📚 學習資源

### 技術學習
- **React**：官方文檔、React官方教程
- **Node.js**：Node.js官方文檔
- **數據庫**：SQL基礎、PostgreSQL文檔
- **AI API**：OpenAI API文檔

### 設計參考
- **UI設計**：Ant Design組件庫
- **用戶體驗**：參考類似產品
- **品牌設計**：母熊形象設計參考

---

## 🔄 迭代計劃

### MVP v1.0（3個月）
- 核心功能實現
- 基本UI/UX
- 上線測試

### MVP v1.1（4-5個月）
- 根據用戶反饋優化
- 修復關鍵問題
- 增加簡單功能

### MVP v2.0（6-9個月）
- 協同審理模式
- 案例庫功能
- 關係健康監測

---

## 💡 開發建議

### 1. 保持專注
- **只做核心功能**：不要被其他功能分散注意力
- **快速驗證**：先做出來，再優化
- **用戶反饋優先**：根據用戶反饋調整方向

### 2. 技術選型
- **選擇熟悉的技術**：不要為了用新技術而用
- **選擇簡單的技術**：能簡單實現就不要複雜
- **選擇有文檔的技術**：遇到問題能快速解決

### 3. 時間管理
- **設定里程碑**：每週設定小目標
- **記錄時間**：記錄實際開發時間，調整計劃
- **留出緩衝**：計劃時間留出20%緩衝

### 4. 尋求幫助
- **技術社區**：Stack Overflow、GitHub Issues
- **文檔和教程**：官方文檔、在線教程
- **AI助手**：ChatGPT、Claude等AI工具

---

**文檔版本**：v1.0  
**創建日期**：2024年  
**最後更新**：2024年  
**適用對象**：單人開發者、低成本初創

