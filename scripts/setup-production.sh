#!/bin/bash

# 熊媽媽法庭 - 生產環境設置腳本
# 用於初始化生產環境配置

set -e

echo "🔧 設置生產環境..."

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 檢查是否在生產環境
if [ "$NODE_ENV" != "production" ]; then
    echo -e "${YELLOW}⚠️  當前環境不是生產環境，設置 NODE_ENV=production${NC}"
    export NODE_ENV=production
fi

# 後端環境變量設置
echo "📝 設置後端環境變量..."
if [ ! -f "backend/.env" ]; then
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env
        echo -e "${YELLOW}⚠️  已創建 backend/.env，請編輯並填入生產環境配置${NC}"
    else
        echo -e "${RED}❌ 未找到 backend/.env.example${NC}"
        exit 1
    fi
fi

# 前端環境變量設置
echo "📝 設置前端環境變量..."
if [ ! -f "frontend/.env" ]; then
    if [ -f "frontend/.env.example" ]; then
        cp frontend/.env.example frontend/.env
        echo -e "${YELLOW}⚠️  已創建 frontend/.env，請編輯並填入生產環境配置${NC}"
    else
        echo -e "${YELLOW}⚠️  未找到 frontend/.env.example（可選）${NC}"
    fi
fi

# 創建必要的目錄
echo "📁 創建必要的目錄..."
mkdir -p backend/uploads
mkdir -p backend/logs
mkdir -p frontend/dist

# 設置權限
echo "🔐 設置文件權限..."
chmod 755 backend/uploads
chmod 755 backend/logs

# 檢查PM2是否安裝
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2未安裝，建議安裝以管理進程${NC}"
    echo "   安裝命令: npm install -g pm2"
else
    echo -e "${GREEN}✅ PM2已安裝${NC}"
fi

echo -e "${GREEN}✅ 生產環境設置完成！${NC}"
echo ""
echo "請確保以下配置已正確設置："
echo "1. 數據庫連接（DATABASE_URL）"
echo "2. JWT密鑰（JWT_SECRET）- 使用強隨機字符串"
echo "3. OpenAI API密鑰（OPENAI_API_KEY）"
echo "4. 前端URL（FRONTEND_URL）"
echo "5. CORS配置（ALLOWED_ORIGINS）"

