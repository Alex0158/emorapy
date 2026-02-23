# 更新日誌

## [2.0.0] - 2026-02-20（個人化判決系統 v2.0）

詳細變更記錄見後端目錄 `backend/CHANGELOG.md`。摘要：
- 新增心理畫像系統（5 表 4 ENUM、11 API、6 個 AI Prompt、6 個服務）
- 新增 SSE 流式通信、session mutex、知情同意、安全偵測、遺忘權
- 前端新增 6 個組件、2 個 Store、4 種觸發點
- processing_failed 可經 `POST /:id/retry` 重試（依賴 pipeline_step 欄位從失敗步驟恢復）。⚠️ `endSession`（`POST /:id/end`）為**非冪等**——僅接受 `in_progress` 狀態的 session，其他狀態會拋出錯誤
- abandoned 僅針對 in_progress，processing/completed 不受影響
- respond mutex 在 turn 持久化 + SSE 關閉後釋放
- SSE complete 事件含 domains_touched_so_far
- insight_type 校驗為 InsightType 枚舉值
- judgment.service.ts ai_model 改為從環境變量讀取

---

## [1.1.0] - 2026-02-20

### 安全加固
- ✅ 帳戶鎖定機制（login_failed_attempts / locked_until）
- ✅ Token 版本化（token_version），密碼重設時立即失效所有現有 session
- ✅ JWT 明確指定 HS256 算法，防止算法混淆攻擊
- ✅ JWT_SECRET 生產環境強制 ≥ 32 字元並檢查熵值
- ✅ JWT_EXPIRES_IN 從 7 天縮短至 24 小時
- ✅ Prompt Injection 防禦（fenceUserInput + SYSTEM_PROMPT 指令）
- ✅ AI 輸出消毒（sanitizeAIOutput / sanitizePlanStrings）
- ✅ 電子郵件 CRLF 注入防護（sanitizeEmail）
- ✅ 檔案刪除路徑穿越防護（path.basename + path.resolve）
- ✅ Reconciliation 資源所有權驗證
- ✅ Execution checkin 輸入消毒（notes / photos_urls）
- ✅ 案件查詢 sort_by 白名單驗證
- ✅ 新增專用限流器：verifyCodeLimiter、resetPasswordLimiter、resetConfirmLimiter、pairingJoinLimiter
- ✅ 登入失敗計數使用 Prisma atomic increment 防止 race condition
- ✅ lockService.withLock 防止案件重複建立
- ✅ 驗證碼使用 crypto.randomInt，邀請碼使用 crypto.randomBytes
- ✅ Helmet 生產環境 CSP 配置
- ✅ CORS 生產環境嚴格化
- ✅ JSON 解析錯誤處理

### 國際化（i18n）
- ✅ 後端 i18n 核心模組（BackendLocale / translateBackendMessage / translateErrorByCode）
- ✅ localeMiddleware 從 X-Locale / Accept-Language 偵測語言
- ✅ 錯誤處理中間件支援多語言錯誤訊息
- ✅ 中英文雙語錯誤碼對照（zhTWByCode / enUSByCode / directEnUSMap）
- ✅ directEnUSMap 擴展：新增驗證碼/重設密碼/配對限流、分散式鎖、Session 相關英文翻譯

### 資料庫變更
- ✅ User 模型新增 login_failed_attempts、locked_until、token_version 欄位

### 測試
- ✅ 821 個後端 Jest 測試全部通過
- ✅ 涵蓋帳戶鎖定、token 版本化、限流器、資源授權等新功能

---

## [1.0.0] - 2024-01-XX

### 新增功能

#### 核心功能
- ✅ 用戶認證系統（註冊、登錄、郵件驗證）
- ✅ Session管理（快速體驗模式）
- ✅ 配對系統（邀請碼機制）
- ✅ 案件系統（支持快速體驗和完整模式）
- ✅ AI判決生成（案件類型識別、判決書生成）
- ✅ 和好方案生成（多樣化方案推薦）
- ✅ 執行追蹤系統（確認、打卡、進度查詢）
- ✅ 文件上傳服務（證據上傳）

#### 技術特性
- ✅ JWT認證機制
- ✅ 請求驗證（Joi）
- ✅ 限流保護（多級限流策略）
- ✅ 錯誤處理（統一錯誤格式）
- ✅ 日誌系統（Winston，結構化日誌）
- ✅ 請求ID追蹤
- ✅ 響應格式化
- ✅ 定時任務（清理過期數據）

#### 安全特性
- ✅ Helmet安全頭
- ✅ CORS配置
- ✅ 密碼加密（bcrypt）
- ✅ 文件上傳安全驗證
- ✅ SQL注入防護（Prisma ORM）
- ✅ 輸入驗證和清理

#### 開發工具
- ✅ TypeScript嚴格模式
- ✅ ESLint代碼檢查
- ✅ Prettier代碼格式化
- ✅ Nodemon熱重載
- ✅ 環境變量驗證

#### 文檔
- ✅ API文檔
- ✅ 開發指南
- ✅ 部署文檔
- ✅ README

### 技術棧

- **運行時**: Node.js 20+
- **語言**: TypeScript 5.3+
- **框架**: Express.js 4.18+
- **ORM**: Prisma 5.7+
- **數據庫**: PostgreSQL (Supabase)
- **認證**: JWT
- **AI服務**: OpenAI API (GPT-3.5-turbo)
- **日誌**: Winston
- **驗證**: Joi
- **限流**: express-rate-limit

### 項目統計

- **TypeScript文件**: 51個
- **服務層**: 9個服務
- **控制器**: 8個控制器
- **路由**: 8個路由模塊
- **中間件**: 7個中間件
- **工具函數**: 多個工具模塊

### 已知問題

- 郵件服務需要配置SMTP服務器（可選）
- 文件上傳在生產環境需要集成CDN（如Cloudinary）

### 後續計劃

- [x] 單元測試和集成測試（821 個測試通過）
- [ ] 性能優化（緩存策略）
- [ ] Redis集成（Session緩存）
- [ ] WebSocket支持（實時通知）
- [ ] 更多AI模型支持
- [x] 國際化支持（zh-TW / en-US 雙語）

