#!/bin/bash

# 關鍵路徑自動化測試腳本
# 用於快速驗證核心功能是否正常

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 配置
API_URL="${API_URL:-http://localhost:3001/api/v1}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
# 從 API_URL 推導後端基底 URL（去掉 /api/v1）
BASE_URL="${API_URL%/api/v1}"

echo "🧪 開始關鍵路徑測試..."
echo "API URL: $API_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""

# 測試計數器
PASSED=0
FAILED=0

# 測試函數
test_endpoint() {
  local name=$1
  local method=$2
  local url=$3
  local data=$4
  local expected_status=${5:-200}

  echo -n "測試: $name ... "

  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$url" || echo -e "\n000")
  elif [ "$method" = "POST" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$url" || echo -e "\n000")
  fi

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "$expected_status" ]; then
    echo -e "${GREEN}✅ 通過${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}❌ 失敗 (HTTP $http_code)${NC}"
    echo "  響應: $body"
    ((FAILED++))
    return 1
  fi
}

# 1. 健康檢查
echo "📋 1. 健康檢查測試"
test_endpoint "健康檢查" "GET" "$BASE_URL/health" "" 200
echo ""

# 2. Session創建（快速體驗）
echo "📋 2. Session創建測試"
SESSION_RESPONSE=$(curl -s -X POST "$API_URL/sessions/quick" -H "Content-Type: application/json")
SESSION_ID=$(echo $SESSION_RESPONSE | grep -o '"session_id":"[^"]*' | cut -d'"' -f4)

if [ -n "$SESSION_ID" ]; then
  echo -e "${GREEN}✅ Session創建成功: $SESSION_ID${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ Session創建失敗${NC}"
  ((FAILED++))
fi
echo ""

# 3. 快速體驗案件創建
echo "📋 3. 快速體驗案件創建測試"
CASE_DATA='{
  "plaintiff_statement": "This is a long test case statement used for validation. We would like to verify the end-to-end flow, including creating a quick case, invoking AI judgment, and polling for results. The content exceeds fifty characters clearly.",
  "defendant_statement": "This is a complementary long statement from the other side. It also exceeds the minimum length to ensure validation passes and allows the downstream AI processing to be triggered correctly."
}'

CASE_RESPONSE=$(curl -s -X POST "$API_URL/cases/quick" \
  -H "Content-Type: application/json" \
  -H "X-Session-Id: $SESSION_ID" \
  -d "$CASE_DATA")

CASE_ID=$(echo $CASE_RESPONSE | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$CASE_ID" ]; then
  echo -e "${GREEN}✅ 案件創建成功: $CASE_ID${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌ 案件創建失敗${NC}"
  echo "  響應: $CASE_RESPONSE"
  ((FAILED++))
fi
echo ""

# 4. 獲取案件詳情
if [ -n "$CASE_ID" ]; then
  echo "📋 4. 獲取案件詳情測試"
  echo -n "測試: 獲取案件詳情 ... "
  RESPONSE=$(curl -s -w "\n%{http_code}" -H "X-Session-Id: $SESSION_ID" "$API_URL/cases/$CASE_ID" || echo -e "\n000")
  CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  if [ "$CODE" = "200" ]; then
    echo -e "${GREEN}✅ 通過${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ 失敗 (HTTP $CODE)${NC}"
    echo "  響應: $BODY"
    ((FAILED++))
  fi
  echo ""
fi

# 5. 檢查判決生成（輪詢）
if [ -n "$CASE_ID" ]; then
  echo "📋 5. 判決生成檢查（最多等待180秒）"
  echo "等待AI判決生成..."
  
  JUDGMENT_FOUND=false
  for i in {1..36}; do
    sleep 5
    JUDGMENT_RESPONSE=$(curl -s "$API_URL/cases/$CASE_ID/judgment" || echo "")
    
    if echo "$JUDGMENT_RESPONSE" | grep -q '"id"'; then
      echo -e "${GREEN}✅ 判決生成成功（等待了 $((i*5)) 秒）${NC}"
      ((PASSED++))
      JUDGMENT_FOUND=true
      break
    fi
    
    echo "  等待中... ($((i*5))秒)"
  done
  
  if [ "$JUDGMENT_FOUND" = false ]; then
    echo -e "${YELLOW}⚠️  判決未在180秒內生成（可能需要更長時間或AI服務異常）${NC}"
    ((FAILED++))
  fi
  echo ""
fi

# 總結
echo "================================"
echo "測試總結"
echo "================================"
echo -e "${GREEN}通過: $PASSED${NC}"
echo -e "${RED}失敗: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 所有測試通過！${NC}"
  exit 0
else
  echo -e "${RED}❌ 有測試失敗，請檢查上述錯誤${NC}"
  exit 1
fi
