#!/bin/bash

# Emorapy - 部署腳本
# 用於自動化部署後端服務

set -e  # 遇到錯誤立即退出

echo "🚀 開始部署 Emorapy 後端服務..."

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 檢查Node.js版本
echo "📋 檢查環境..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js版本需要18或更高，當前版本: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js版本: $(node -v)${NC}"

# 檢查環境變量文件
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠️  未找到 .env 文件，請先創建並配置環境變量${NC}"
    if [ -f "backend/.env.example" ]; then
        echo "📝 從 .env.example 創建 .env 文件..."
        cp backend/.env.example backend/.env
        echo -e "${YELLOW}⚠️  請編輯 backend/.env 文件並填入實際配置${NC}"
        exit 1
    else
        echo -e "${RED}❌ 未找到 .env.example 文件${NC}"
        exit 1
    fi
fi

# 進入後端目錄
cd backend

# 安裝依賴
echo "📦 安裝依賴..."
npm ci --production=false

# 生成Prisma Client
echo "🔧 生成Prisma Client..."
npm run prisma:generate

# 運行數據庫遷移
echo "🗄️  運行數據庫遷移..."
npm run prisma:migrate

# 構建項目
echo "🏗️  構建項目..."
npm run build

# 檢查構建是否成功
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ 構建失敗，dist目錄不存在${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 構建成功${NC}"

# 返回根目錄
cd ..

# 運行環境變量驗證
echo ""
echo "🔍 驗證環境變量..."
if [ -f "../scripts/validate-env.sh" ]; then
    cd ..
    chmod +x scripts/validate-env.sh
    ./scripts/validate-env.sh || echo -e "${YELLOW}⚠️  環境變量驗證失敗，請檢查配置${NC}"
    cd backend
fi

echo -e "${GREEN}🎉 部署準備完成！${NC}"
echo ""
echo "下一步："
echo "1. 檢查環境變量配置（backend/.env）"
echo "2. 運行 'npm start' 啟動服務（在backend目錄）"
echo "3. 或使用 PM2: pm2 start dist/index.js --name emorapy-backend"
echo "4. 運行部署驗證: ./scripts/verify-deployment.sh"
