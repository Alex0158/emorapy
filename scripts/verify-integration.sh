#!/bin/bash

# 前後端集成驗證腳本

echo "🔍 開始驗證前後端集成..."

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 檢查後端是否運行
echo "📡 檢查後端服務..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo -e "${GREEN}✅ 後端服務運行正常${NC}"
else
    echo -e "${RED}❌ 後端服務未運行，請先啟動後端（npm run dev）${NC}"
    exit 1
fi

# 檢查前端是否運行
echo "🌐 檢查前端服務..."
if curl -s http://localhost:5173 > /dev/null; then
    echo -e "${GREEN}✅ 前端服務運行正常${NC}"
else
    echo -e "${YELLOW}⚠️  前端服務未運行（可選）${NC}"
fi

# 測試API端點
echo "🧪 測試API端點..."

# 1. 健康檢查
echo -n "  健康檢查: "
HEALTH_BODY=$(curl -s http://localhost:3001/health)
if echo "$HEALTH_BODY" | grep -Eq "\"status\":\"(healthy|degraded)\""; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
    echo "    響應: $HEALTH_BODY"
fi

# 2. Session創建
echo -n "  Session創建: "
SESSION_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/sessions/quick)
if echo "$SESSION_RESPONSE" | grep -q "session_id"; then
    echo -e "${GREEN}✅${NC}"
    SESSION_ID=$(echo "$SESSION_RESPONSE" | grep -o '"session_id":"[^"]*' | cut -d'"' -f4)
    echo "    Session ID: $SESSION_ID"
else
    echo -e "${RED}❌${NC}"
fi

echo ""
echo -e "${GREEN}✨ 驗證完成！${NC}"
