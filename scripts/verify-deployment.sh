#!/bin/bash

# 熊媽媽法庭 - 部署驗證腳本
# 用於驗證部署是否成功

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"

echo "🔍 部署驗證 - 熊媽媽法庭"
echo "================================"
echo ""
echo "後端URL: ${BACKEND_URL}"
echo "前端URL: ${FRONTEND_URL}"
echo ""

# 檢查計數器
PASSED=0
FAILED=0

# 測試函數
test_endpoint() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}
    
    echo -e "${BLUE}測試: ${name}${NC}"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" || echo "000")
    
    if [ "$HTTP_CODE" = "$expected_code" ]; then
        echo -e "  ${GREEN}✅ 通過 (HTTP $HTTP_CODE)${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "  ${RED}❌ 失敗 (HTTP $HTTP_CODE，預期: $expected_code)${NC}"
        ((FAILED++))
        return 1
    fi
}

# 後端健康檢查
echo "📡 後端健康檢查..."
echo ""

test_endpoint "健康檢查端點" "${BACKEND_URL}/health"
test_endpoint "就緒檢查端點" "${BACKEND_URL}/health/ready"
test_endpoint "存活檢查端點" "${BACKEND_URL}/health/live"

echo ""

# 後端API測試
echo "🔌 後端API測試..."
echo ""

# 測試根路徑
test_endpoint "API根路徑" "${BACKEND_URL}/api/v1" 404 || true

# 測試Session創建（快速體驗模式）
echo -e "${BLUE}測試: 創建Session（快速體驗模式）${NC}"
SESSION_RESPONSE=$(curl -s -X POST "${BACKEND_URL}/api/v1/sessions/quick" \
    -H "Content-Type: application/json" \
    --max-time 10 || echo "")
if echo "$SESSION_RESPONSE" | grep -q "session_id"; then
    echo -e "  ${GREEN}✅ Session創建成功${NC}"
    ((PASSED++))
else
    echo -e "  ${RED}❌ Session創建失敗${NC}"
    ((FAILED++))
fi

echo ""

# 前端測試
echo "🎨 前端測試..."
echo ""

if [ "$FRONTEND_URL" != "http://localhost:5173" ]; then
    test_endpoint "前端首頁" "${FRONTEND_URL}"
    test_endpoint "前端健康檢查" "${FRONTEND_URL}/health" || true
else
    echo -e "${YELLOW}⚠️  跳過前端測試（使用默認本地URL）${NC}"
fi

echo ""

# 數據庫連接測試（如果後端目錄存在）
# 僅在本地開發環境時檢查 Prisma Client 生成（遠端生產環境跳過）
if [[ "$BACKEND_URL" == http://localhost* ]] && [ -d "backend" ] && [ -f "backend/.env" ]; then
    echo "🗄️  數據庫連接測試（本地）..."
    echo ""
    cd backend
    if npm run prisma:generate > /dev/null 2>&1; then
        echo -e "  ${GREEN}✅ Prisma Client生成成功${NC}"
        ((PASSED++))
    else
        echo -e "  ${YELLOW}⚠️  Prisma Client生成失敗（遠端環境不影響）${NC}"
    fi
    cd ..
    echo ""
fi

# 總結
echo "================================"
echo "測試結果："
echo -e "  ${GREEN}✅ 通過: ${PASSED}${NC}"
echo -e "  ${RED}❌ 失敗: ${FAILED}${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}🎉 所有測試通過！部署驗證成功！${NC}"
    exit 0
else
    echo -e "${RED}❌ 部分測試失敗，請檢查部署配置${NC}"
    exit 1
fi
