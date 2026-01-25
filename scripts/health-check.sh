#!/bin/bash

# 熊媽媽法庭 - 健康檢查腳本
# 用於檢查服務健康狀態

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 默認配置
API_URL="${API_URL:-http://localhost:3000}"
HEALTH_ENDPOINT="${HEALTH_ENDPOINT:-/health}"

echo "🏥 健康檢查 - 熊媽媽法庭"
echo "================================"
echo ""

# 檢查API服務
echo "📡 檢查API服務..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}${HEALTH_ENDPOINT}" || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ API服務正常運行 (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}❌ API服務異常 (HTTP $HTTP_CODE)${NC}"
    echo "   請檢查服務是否啟動: curl ${API_URL}${HEALTH_ENDPOINT}"
fi

# 檢查數據庫連接（如果後端目錄存在）
if [ -d "backend" ]; then
    echo ""
    echo "🗄️  檢查數據庫連接..."
    cd backend
    
    # 檢查Prisma Client是否生成
    if [ -d "node_modules/.prisma/client" ]; then
        echo -e "${GREEN}✅ Prisma Client已生成${NC}"
    else
        echo -e "${YELLOW}⚠️  Prisma Client未生成，運行: npm run prisma:generate${NC}"
    fi
    
    # 嘗試連接數據庫（需要.env文件）
    if [ -f ".env" ]; then
        # 這裡可以添加實際的數據庫連接檢查
        echo -e "${GREEN}✅ 環境變量文件存在${NC}"
    else
        echo -e "${YELLOW}⚠️  未找到 .env 文件${NC}"
    fi
    
    cd ..
fi

# 檢查前端構建（如果前端目錄存在）
if [ -d "frontend" ]; then
    echo ""
    echo "🎨 檢查前端構建..."
    if [ -d "frontend/dist" ]; then
        echo -e "${GREEN}✅ 前端已構建${NC}"
    else
        echo -e "${YELLOW}⚠️  前端未構建，運行: cd frontend && npm run build${NC}"
    fi
fi

# 檢查PM2進程（如果PM2已安裝）
if command -v pm2 &> /dev/null; then
    echo ""
    echo "⚙️  檢查PM2進程..."
    PM2_LIST=$(pm2 list 2>/dev/null | grep "mother-bear-court" || echo "")
    if [ -n "$PM2_LIST" ]; then
        echo -e "${GREEN}✅ PM2進程運行中${NC}"
        pm2 list | grep "mother-bear-court"
    else
        echo -e "${YELLOW}⚠️  未找到PM2進程${NC}"
    fi
fi

echo ""
echo "================================"
echo "健康檢查完成"

