# 前後端集成指南

## 📋 概述

本文檔說明如何啟動和運行完整的前後端系統。

## 🚀 快速開始

### 1. 後端啟動

```bash
cd backend

# 安裝依賴
npm install

# 配置環境變量
cp .env.example .env
# 編輯 .env 文件，填入必要的配置

# 生成Prisma Client
npm run prisma:generate

# 運行數據庫遷移
npm run prisma:migrate

# 啟動開發服務器
npm run dev
```

後端將運行在 `http://localhost:3001`

### 2. 前端啟動

```bash
cd frontend

# 安裝依賴
npm install

# 配置環境變量
cp .env.example .env
# 確保 VITE_API_BASE_URL=http://localhost:3001/api/v1

# 啟動開發服務器
npm run dev
```

前端將運行在 `http://localhost:5173`

## 🔗 API對接

### 基礎配置

前端通過 `VITE_API_BASE_URL` 環境變量配置後端地址。

開發環境默認配置：
- 前端：`http://localhost:5173`
- 後端：`http://localhost:3001`
- API基礎URL：`http://localhost:3001/api/v1`

### 代理配置

前端Vite配置了代理，開發環境下 `/api` 請求會自動代理到後端：

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
  },
}
```

## 📡 接口對接驗證

### 1. 健康檢查

```bash
# 檢查後端健康狀態（/health）
curl http://localhost:3001/health
```

### 2. Session創建（快速體驗模式）

```bash
# 創建Session
curl http://localhost:3001/api/v1/sessions/create
```

### 3. 案件創建（快速體驗模式）

```bash
# 創建案件
curl -X POST http://localhost:3001/api/v1/cases/quick \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: guest_xxx" \
  -d '{
    "plaintiff_statement": "測試原告陳述...",
    "defendant_statement": "測試被告陳述..."
  }'
```

## 🔐 認證流程

### 完整模式認證流程

1. **用戶註冊**
   ```typescript
   POST /api/v1/auth/register
   {
     "email": "user@example.com",
     "password": "password123",
     "nickname": "用戶暱稱"
   }
   ```

2. **用戶登錄**
   ```typescript
   POST /api/v1/auth/login
   {
     "email": "user@example.com",
     "password": "password123"
   }
   ```

3. **獲取Token**
   - 響應中包含 `token`
   - 前端存儲到 `localStorage`

4. **後續請求**
   - 在請求頭中添加：`Authorization: Bearer <token>`

### 快速體驗模式流程

1. **創建Session**
   ```typescript
   GET /api/v1/sessions/create
   ```

2. **獲取Session ID**
   - 響應中包含 `session_id`
   - 前端存儲到 `localStorage`

3. **後續請求**
   - 在請求頭中添加：`X-Session-Id: <session_id>`
   - 或在查詢參數中添加：`?session_id=<session_id>`

## 🔄 數據流程

### 快速體驗模式流程

```
1. 用戶訪問快速體驗頁面
   ↓
2. 前端自動創建Session（如果沒有）
   ↓
3. 用戶填寫案件信息
   ↓
4. 前端提交案件（POST /cases/quick）
   ↓
5. 後端創建案件並異步觸發AI判決生成
   ↓
6. 前端輪詢判決狀態（GET /judgments/:id）
   ↓
7. 判決生成完成，前端展示結果
```

### 完整模式流程

```
1. 用戶註冊/登錄
   ↓
2. 創建配對（生成邀請碼）
   ↓
3. 對方使用邀請碼加入配對
   ↓
4. 創建案件（POST /cases）
   ↓
5. 後端生成判決
   ↓
6. 雙方查看判決
   ↓
7. 生成和好方案
   ↓
8. 選擇方案並執行追蹤
```

## 🐛 常見問題

### 1. CORS錯誤

**問題**: 前端請求後端時出現CORS錯誤

**解決**:
- 檢查後端 `ALLOWED_ORIGINS` 配置
- 確保包含前端地址：`http://localhost:5173`

### 2. 401未認證錯誤

**問題**: 請求返回401錯誤

**解決**:
- 檢查Token是否正確存儲
- 檢查Token是否過期
- 確認請求頭中包含 `Authorization: Bearer <token>`

### 3. Session過期

**問題**: 快速體驗模式Session過期

**解決**:
- Session有效期24小時
- 已完成案件的Session延長到7天
- 如果過期，前端應自動創建新Session

### 4. API路徑不匹配

**問題**: 404錯誤，接口不存在

**解決**:
- 檢查API路徑是否正確
- 確認後端路由已正確註冊
- 檢查API版本號（`/api/v1`）

## 📊 接口對接檢查清單

### 認證相關
- [ ] 用戶註冊
- [ ] 用戶登錄
- [ ] Token驗證
- [ ] 郵件驗證碼發送
- [ ] 郵件驗證

### Session相關
- [ ] Session創建
- [ ] Session驗證
- [ ] Session過期處理

### 案件相關
- [ ] 快速體驗案件創建
- [ ] 完整模式案件創建
- [ ] 案件查詢
- [ ] 證據上傳

### 判決相關
- [ ] 判決生成
- [ ] 判決查詢
- [ ] 判決接受/拒絕

### 和好方案相關
- [ ] 方案生成
- [ ] 方案查詢
- [ ] 方案選擇

### 執行相關
- [ ] 執行確認
- [ ] 執行打卡
- [ ] 執行狀態查詢

## 🔍 調試技巧

### 1. 查看網絡請求

- 瀏覽器開發者工具 → Network
- 檢查請求URL、請求頭、請求體
- 檢查響應狀態碼、響應體

### 2. 查看後端日誌

```bash
# 後端日誌位置
backend/logs/combined.log
backend/logs/error.log
```

### 3. 使用Postman/Insomnia測試

- 導入API文檔
- 測試各個接口
- 驗證請求/響應格式

## 📚 相關文檔

- [後端API文檔](./backend/API.md)
- [前端開發指南](./frontend/README.md)
- [後端開發指南](./backend/DEVELOPMENT.md)
